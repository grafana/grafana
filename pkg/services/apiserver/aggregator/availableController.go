// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes/kube-aggregator/blob/master/pkg/controllers/status/available_controller.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package aggregator

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"reflect"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/apis/service/v0alpha1"
	informersservicev0alpha1 "github.com/grafana/grafana/pkg/generated/informers/externalversions/service/v0alpha1"
	listersservicev0alpha1 "github.com/grafana/grafana/pkg/generated/listers/service/v0alpha1"

	"k8s.io/apimachinery/pkg/api/equality"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/transport"
	"k8s.io/client-go/util/workqueue"
	"k8s.io/klog/v2"
	apiregistrationv1 "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1"
	apiregistrationv1apihelper "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1/helper"
	apiregistrationclient "k8s.io/kube-aggregator/pkg/client/clientset_generated/clientset/typed/apiregistration/v1"
	informers "k8s.io/kube-aggregator/pkg/client/informers/externalversions/apiregistration/v1"
	listers "k8s.io/kube-aggregator/pkg/client/listers/apiregistration/v1"
	"k8s.io/kube-aggregator/pkg/controllers"
)

type certKeyFunc func() ([]byte, []byte)

// ServiceResolver knows how to convert a service reference into an actual location.
type ServiceResolver interface {
	ResolveEndpoint(namespace, name string, port int32) (*url.URL, error)
}

// AvailableConditionController handles checking the availability of registered API services.
type AvailableConditionController struct {
	apiServiceClient apiregistrationclient.APIServicesGetter

	apiServiceLister listers.APIServiceLister
	apiServiceSynced cache.InformerSynced

	// externalNameLister is used to get the IP to create the transport for
	externalNameLister listersservicev0alpha1.ExternalNameLister
	servicesSynced     cache.InformerSynced

	// proxyTransportDial specifies the dial function for creating unencrypted TCP connections.
	proxyTransportDial         *transport.DialHolder
	proxyCurrentCertKeyContent certKeyFunc
	serviceResolver            ServiceResolver

	// To allow injection for testing.
	syncFn func(key string) error

	queue workqueue.TypedRateLimitingInterface[string]
	// map from service-namespace -> service-name -> apiservice names
	cache map[string]map[string][]string
	// this lock protects operations on the above cache
	cacheLock sync.RWMutex
}

// NewAvailableConditionController returns a new AvailableConditionController.
func NewAvailableConditionController(
	apiServiceInformer informers.APIServiceInformer,
	externalNameInformer informersservicev0alpha1.ExternalNameInformer,
	apiServiceClient apiregistrationclient.APIServicesGetter,
	proxyTransportDial *transport.DialHolder,
	proxyCurrentCertKeyContent certKeyFunc,
	serviceResolver ServiceResolver,
) (*AvailableConditionController, error) {
	c := &AvailableConditionController{
		apiServiceClient:   apiServiceClient,
		apiServiceLister:   apiServiceInformer.Lister(),
		externalNameLister: externalNameInformer.Lister(),
		serviceResolver:    serviceResolver,
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			// We want a fairly tight requeue time.  The controller listens to the API, but because it relies on the routability of the
			// service network, it is possible for an external, non-watchable factor to affect availability.  This keeps
			// the maximum disruption time to a minimum, but it does prevent hot loops.
			workqueue.NewTypedItemExponentialFailureRateLimiter[string](5*time.Millisecond, 30*time.Second),
			workqueue.TypedRateLimitingQueueConfig[string]{Name: "AvailableConditionController"},
		),
		proxyTransportDial:         proxyTransportDial,
		proxyCurrentCertKeyContent: proxyCurrentCertKeyContent,
	}

	// resync on this one because it is low cardinality and rechecking the actual discovery
	// allows us to detect health in a more timely fashion when network connectivity to
	// nodes is snipped, but the network still attempts to route there.  See
	// https://github.com/openshift/origin/issues/17159#issuecomment-341798063
	apiServiceHandler, _ := apiServiceInformer.Informer().AddEventHandlerWithResyncPeriod(
		cache.ResourceEventHandlerFuncs{
			AddFunc:    c.addAPIService,
			UpdateFunc: c.updateAPIService,
			DeleteFunc: c.deleteAPIService,
		},
		30*time.Second)
	c.apiServiceSynced = apiServiceHandler.HasSynced

	serviceHandler, _ := externalNameInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    c.addService,
		UpdateFunc: c.updateService,
		DeleteFunc: c.deleteService,
	})
	c.servicesSynced = serviceHandler.HasSynced

	c.syncFn = c.sync

	return c, nil
}

func (c *AvailableConditionController) sync(key string) error {
	originalAPIService, err := c.apiServiceLister.Get(key)
	if apierrors.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}

	// if a particular transport was specified, use that otherwise build one
	// construct an http client that will ignore TLS verification (if someone owns the network and messes with your status
	// that's not so bad) and sets a very short timeout.  This is a best effort GET that provides no additional information
	transportConfig := &transport.Config{
		TLS: transport.TLSConfig{
			Insecure: true,
		},
		DialHolder: c.proxyTransportDial,
	}

	if c.proxyCurrentCertKeyContent != nil {
		proxyClientCert, proxyClientKey := c.proxyCurrentCertKeyContent()

		transportConfig.TLS.CertData = proxyClientCert
		transportConfig.TLS.KeyData = proxyClientKey
	}
	restTransport, err := transport.New(transportConfig)
	if err != nil {
		return err
	}
	discoveryClient := &http.Client{
		Transport: restTransport,
		// the request should happen quickly.
		Timeout: 5 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	apiService := originalAPIService.DeepCopy()

	availableCondition := apiregistrationv1.APIServiceCondition{
		Type:               apiregistrationv1.Available,
		Status:             apiregistrationv1.ConditionTrue,
		LastTransitionTime: metav1.Now(),
	}

	// local API services are always considered available
	if apiService.Spec.Service == nil {
		apiregistrationv1apihelper.SetAPIServiceCondition(apiService, apiregistrationv1apihelper.NewLocalAvailableAPIServiceCondition())
		_, err := c.updateAPIServiceStatus(originalAPIService, apiService)
		return err
	}

	_, err = c.externalNameLister.ExternalNames(apiService.Spec.Service.Namespace).Get(apiService.Spec.Service.Name)
	if apierrors.IsNotFound(err) {
		availableCondition.Status = apiregistrationv1.ConditionFalse
		availableCondition.Reason = "ServiceNotFound"
		availableCondition.Message = fmt.Sprintf("service/%s in %q is not present", apiService.Spec.Service.Name, apiService.Spec.Service.Namespace)
		apiregistrationv1apihelper.SetAPIServiceCondition(apiService, availableCondition)
		_, err := c.updateAPIServiceStatus(originalAPIService, apiService)
		return err
	} else if err != nil {
		availableCondition.Status = apiregistrationv1.ConditionUnknown
		availableCondition.Reason = "ServiceAccessError"
		availableCondition.Message = fmt.Sprintf("service/%s in %q cannot be checked due to: %v", apiService.Spec.Service.Name, apiService.Spec.Service.Namespace, err)
		apiregistrationv1apihelper.SetAPIServiceCondition(apiService, availableCondition)
		_, err := c.updateAPIServiceStatus(originalAPIService, apiService)
		return err
	}

	// actually try to hit the discovery endpoint when it isn't local and when we're routing as a service.
	if apiService.Spec.Service != nil && c.serviceResolver != nil {
		attempts := 5
		results := make(chan error, attempts)
		for i := 0; i < attempts; i++ {
			go func() {
				discoveryURL, err := c.serviceResolver.ResolveEndpoint(apiService.Spec.Service.Namespace, apiService.Spec.Service.Name, *apiService.Spec.Service.Port)
				if err != nil {
					results <- err
					return
				}
				// render legacyAPIService health check path when it is delegated to a service
				if apiService.Name == "v1." {
					discoveryURL.Path = "/api/" + apiService.Spec.Version
				} else {
					discoveryURL.Path = "/apis/" + apiService.Spec.Group + "/" + apiService.Spec.Version
				}

				errCh := make(chan error, 1)
				go func() {
					// be sure to check a URL that the aggregated API server is required to serve
					newReq, err := http.NewRequest("GET", discoveryURL.String(), nil)
					if err != nil {
						errCh <- err
						return
					}

					// setting the system-masters identity ensures that we will always have access rights
					transport.SetAuthProxyHeaders(newReq, "system:kube-aggregator", []string{"system:masters"}, nil)
					resp, err := discoveryClient.Do(newReq)
					if resp != nil {
						_ = resp.Body.Close()
						// we should always been in the 200s or 300s
						if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
							errCh <- fmt.Errorf("bad status from %v: %v", discoveryURL, resp.StatusCode)
							return
						}
					}

					errCh <- err
				}()

				select {
				case err = <-errCh:
					if err != nil {
						results <- fmt.Errorf("failing or missing response from %v: %v", discoveryURL, err)
						return
					}

					// we had trouble with slow dial and DNS responses causing us to wait too long.
					// we added this as insurance
				case <-time.After(6 * time.Second):
					results <- fmt.Errorf("timed out waiting for %v", discoveryURL)
					return
				}

				results <- nil
			}()
		}

		var lastError error
		for i := 0; i < attempts; i++ {
			lastError = <-results
			// if we had at least one success, we are successful overall and we can return now
			if lastError == nil {
				break
			}
		}

		if lastError != nil {
			availableCondition.Status = apiregistrationv1.ConditionFalse
			availableCondition.Reason = "FailedDiscoveryCheck"
			availableCondition.Message = lastError.Error()
			apiregistrationv1apihelper.SetAPIServiceCondition(apiService, availableCondition)
			_, updateErr := c.updateAPIServiceStatus(originalAPIService, apiService)
			if updateErr != nil {
				return updateErr
			}
			// force a requeue to make it very obvious that this will be retried at some point in the future
			// along with other requeues done via service change, endpoint change, and resync
			return lastError
		}
	}

	availableCondition.Reason = "Passed"
	availableCondition.Message = "all checks passed"
	apiregistrationv1apihelper.SetAPIServiceCondition(apiService, availableCondition)
	_, err = c.updateAPIServiceStatus(originalAPIService, apiService)
	return err
}

// updateAPIServiceStatus only issues an update if a change is detected.  We have a tight resync loop to quickly detect dead
// apiservices. Doing that means we don't want to quickly issue no-op updates.
func (c *AvailableConditionController) updateAPIServiceStatus(originalAPIService, newAPIService *apiregistrationv1.APIService) (*apiregistrationv1.APIService, error) {
	if equality.Semantic.DeepEqual(originalAPIService.Status, newAPIService.Status) {
		return newAPIService, nil
	}

	orig := apiregistrationv1apihelper.GetAPIServiceConditionByType(originalAPIService, apiregistrationv1.Available)
	now := apiregistrationv1apihelper.GetAPIServiceConditionByType(newAPIService, apiregistrationv1.Available)
	unknown := apiregistrationv1.APIServiceCondition{
		Type:   apiregistrationv1.Available,
		Status: apiregistrationv1.ConditionUnknown,
	}
	if orig == nil {
		orig = &unknown
	}
	if now == nil {
		now = &unknown
	}
	if *orig != *now {
		klog.V(2).InfoS("changing APIService availability", "name", newAPIService.Name, "oldStatus", orig.Status, "newStatus", now.Status, "message", now.Message, "reason", now.Reason)
	}

	newAPIService, err := c.apiServiceClient.APIServices().UpdateStatus(context.TODO(), newAPIService, metav1.UpdateOptions{})
	if err != nil {
		return nil, err
	}

	return newAPIService, nil
}

// Run starts the AvailableConditionController loop which manages the availability condition of API services.
func (c *AvailableConditionController) Run(workers int, stopCh <-chan struct{}) {
	defer utilruntime.HandleCrash()
	defer c.queue.ShutDown()

	klog.Info("Starting AvailableConditionController")
	defer klog.Info("Shutting down AvailableConditionController")

	// This waits not just for the informers to sync, but for our handlers
	// to be called; since the handlers are three different ways of
	// enqueueing the same thing, waiting for this permits the queue to
	// maximally de-duplicate the entries.
	if !controllers.WaitForCacheSync("AvailableConditionCOverrideController", stopCh, c.apiServiceSynced, c.servicesSynced) {
		return
	}

	for i := 0; i < workers; i++ {
		go wait.Until(c.runWorker, time.Second, stopCh)
	}

	<-stopCh
}

func (c *AvailableConditionController) runWorker() {
	for c.processNextWorkItem() {
	}
}

// processNextWorkItem deals with one key off the queue.  It returns false when it's time to quit.
func (c *AvailableConditionController) processNextWorkItem() bool {
	key, quit := c.queue.Get()
	if quit {
		return false
	}
	defer c.queue.Done(key)

	err := c.syncFn(key)
	if err == nil {
		c.queue.Forget(key)
		return true
	}

	utilruntime.HandleError(fmt.Errorf("%v failed with: %v", key, err))
	c.queue.AddRateLimited(key)

	return true
}

func (c *AvailableConditionController) addAPIService(obj interface{}) {
	castObj := obj.(*apiregistrationv1.APIService)
	klog.V(4).Infof("Adding %s", castObj.Name)
	if castObj.Spec.Service != nil {
		c.rebuildAPIServiceCache()
	}
	c.queue.Add(castObj.Name)
}

func (c *AvailableConditionController) updateAPIService(oldObj, newObj interface{}) {
	castObj := newObj.(*apiregistrationv1.APIService)
	oldCastObj := oldObj.(*apiregistrationv1.APIService)
	klog.V(4).Infof("Updating %s", oldCastObj.Name)
	if !reflect.DeepEqual(castObj.Spec.Service, oldCastObj.Spec.Service) {
		c.rebuildAPIServiceCache()
	}
	c.queue.Add(oldCastObj.Name)
}

func (c *AvailableConditionController) deleteAPIService(obj interface{}) {
	castObj, ok := obj.(*apiregistrationv1.APIService)
	if !ok {
		tombstone, ok := obj.(cache.DeletedFinalStateUnknown)
		if !ok {
			klog.Errorf("Couldn't get object from tombstone %#v", obj)
			return
		}
		castObj, ok = tombstone.Obj.(*apiregistrationv1.APIService)
		if !ok {
			klog.Errorf("Tombstone contained object that is not expected %#v", obj)
			return
		}
	}
	klog.V(4).Infof("Deleting %q", castObj.Name)
	if castObj.Spec.Service != nil {
		c.rebuildAPIServiceCache()
	}
	c.queue.Add(castObj.Name)
}

func (c *AvailableConditionController) getAPIServicesFor(obj runtime.Object) []string {
	metadata, err := meta.Accessor(obj)
	if err != nil {
		utilruntime.HandleError(err)
		return nil
	}
	c.cacheLock.RLock()
	defer c.cacheLock.RUnlock()
	return c.cache[metadata.GetNamespace()][metadata.GetName()]
}

// if the service/endpoint handler wins the race against the cache rebuilding, it may queue a no-longer-relevant apiservice
// (which will get processed an extra time - this doesn't matter),
// and miss a newly relevant apiservice (which will get queued by the apiservice handler)
func (c *AvailableConditionController) rebuildAPIServiceCache() {
	apiServiceList, _ := c.apiServiceLister.List(labels.Everything())
	newCache := map[string]map[string][]string{}
	for _, apiService := range apiServiceList {
		if apiService.Spec.Service == nil {
			continue
		}
		if newCache[apiService.Spec.Service.Namespace] == nil {
			newCache[apiService.Spec.Service.Namespace] = map[string][]string{}
		}
		newCache[apiService.Spec.Service.Namespace][apiService.Spec.Service.Name] = append(newCache[apiService.Spec.Service.Namespace][apiService.Spec.Service.Name], apiService.Name)
	}

	c.cacheLock.Lock()
	defer c.cacheLock.Unlock()
	c.cache = newCache
}

// TODO, think of a way to avoid checking on every service manipulation

func (c *AvailableConditionController) addService(obj interface{}) {
	for _, apiService := range c.getAPIServicesFor(obj.(*v0alpha1.ExternalName)) {
		c.queue.Add(apiService)
	}
}

func (c *AvailableConditionController) updateService(obj, _ interface{}) {
	for _, apiService := range c.getAPIServicesFor(obj.(*v0alpha1.ExternalName)) {
		c.queue.Add(apiService)
	}
}

func (c *AvailableConditionController) deleteService(obj interface{}) {
	castObj, ok := obj.(*v0alpha1.ExternalName)
	if !ok {
		tombstone, ok := obj.(cache.DeletedFinalStateUnknown)
		if !ok {
			klog.Errorf("Couldn't get object from tombstone %#v", obj)
			return
		}
		castObj, ok = tombstone.Obj.(*v0alpha1.ExternalName)
		if !ok {
			klog.Errorf("Tombstone contained object that is not expected %#v", obj)
			return
		}
	}
	for _, apiService := range c.getAPIServicesFor(castObj) {
		c.queue.Add(apiService)
	}
}

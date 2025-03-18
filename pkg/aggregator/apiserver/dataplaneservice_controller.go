// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes/kube-aggregator/blob/master/pkg/apiserver/apiservice_controller.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package apiserver

import (
	"context"
	"fmt"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/labels"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/apiserver/pkg/server/dynamiccertificates"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"
	"k8s.io/klog/v2"

	v0alpha1 "github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
	informers "github.com/grafana/grafana/pkg/aggregator/generated/informers/externalversions/aggregation/v0alpha1"
	listers "github.com/grafana/grafana/pkg/aggregator/generated/listers/aggregation/v0alpha1"
)

// DataPlaneHandlerManager defines the behaviour that an API handler should have.
type DataPlaneHandlerManager interface {
	AddDataPlaneService(dataPlaneService *v0alpha1.DataPlaneService) error
	RemoveDataPlaneService(dataPlaneServiceName string)
}

// DataPlaneServiceRegistrationController is responsible for registering and removing API services.
type DataPlaneServiceRegistrationController struct {
	dataPlaneHandlerManager DataPlaneHandlerManager

	dataPlaneServiceLister listers.DataPlaneServiceLister
	dataPlaneServiceSynced cache.InformerSynced

	// To allow injection for testing.
	syncFn func(key string) error

	queue workqueue.TypedRateLimitingInterface[string]
}

var _ dynamiccertificates.Listener = &DataPlaneServiceRegistrationController{}

// NewDataPlaneServiceRegistrationController returns a new DataPlaneServiceRegistrationController.
func NewDataPlaneServiceRegistrationController(dataPlaneServiceInformer informers.DataPlaneServiceInformer, dataPlaneHandlerManager DataPlaneHandlerManager) *DataPlaneServiceRegistrationController {
	c := &DataPlaneServiceRegistrationController{
		dataPlaneHandlerManager: dataPlaneHandlerManager,
		dataPlaneServiceLister:  dataPlaneServiceInformer.Lister(),
		dataPlaneServiceSynced:  dataPlaneServiceInformer.Informer().HasSynced,
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			// We want a fairly tight requeue time.  The controller listens to the API, but because it relies on the routability of the
			// service network, it is possible for an external, non-watchable factor to affect availability.  This keeps
			// the maximum disruption time to a minimum, but it does prevent hot loops.
			workqueue.NewTypedItemExponentialFailureRateLimiter[string](5*time.Millisecond, 30*time.Second),
			workqueue.TypedRateLimitingQueueConfig[string]{Name: "DataPlaneServiceRegistrationController"},
		),
	}

	_, err := dataPlaneServiceInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    c.addDataPlaneService,
		UpdateFunc: c.updateDataPlaneService,
		DeleteFunc: c.deleteDataPlaneService,
	})

	if err != nil {
		klog.Errorf("Failed to register event handler for DataPlaneService: %v", err)
	}

	c.syncFn = c.sync

	return c
}

func (c *DataPlaneServiceRegistrationController) sync(key string) error {
	dataPlaneService, err := c.dataPlaneServiceLister.Get(key)
	if apierrors.IsNotFound(err) {
		c.dataPlaneHandlerManager.RemoveDataPlaneService(key)
		return nil
	}
	if err != nil {
		return err
	}

	return c.dataPlaneHandlerManager.AddDataPlaneService(dataPlaneService)
}

// Run starts DataPlaneServiceRegistrationController which will process all registration requests until stopCh is closed.
func (c *DataPlaneServiceRegistrationController) Run(ctx context.Context, handlerSyncedCh chan<- struct{}) {
	defer utilruntime.HandleCrash()
	defer c.queue.ShutDown()

	klog.Info("Starting DataPlaneServiceRegistrationController")
	defer klog.Info("Shutting down DataPlaneServiceRegistrationController")

	if !cache.WaitForCacheSync(ctx.Done(), c.dataPlaneServiceSynced) {
		return
	}

	// initially sync all DataPlaneServices to make sure the proxy handler is complete
	err := wait.PollUntilContextCancel(ctx, time.Second, true, func(context.Context) (bool, error) {
		services, err := c.dataPlaneServiceLister.List(labels.Everything())
		if err != nil {
			utilruntime.HandleError(fmt.Errorf("failed to initially list DataPlaneServices: %v", err))
			return false, nil
		}
		for _, s := range services {
			if err := c.dataPlaneHandlerManager.AddDataPlaneService(s); err != nil {
				utilruntime.HandleError(fmt.Errorf("failed to initially sync DataPlaneService %s: %v", s.Name, err))
				return false, nil
			}
		}
		return true, nil
	})
	if err != nil {
		utilruntime.HandleError(err)
		return
	}
	close(handlerSyncedCh)

	// only start one worker thread since its a slow moving API and the aggregation server adding bits
	// aren't threadsafe
	go wait.Until(c.runWorker, time.Second, ctx.Done())

	<-ctx.Done()
}

func (c *DataPlaneServiceRegistrationController) runWorker() {
	for c.processNextWorkItem() {
	}
}

// processNextWorkItem deals with one key off the queue.  It returns false when it's time to quit.
func (c *DataPlaneServiceRegistrationController) processNextWorkItem() bool {
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

	utilruntime.HandleError(fmt.Errorf("%v failed with : %v", key, err))
	c.queue.AddRateLimited(key)

	return true
}

func (c *DataPlaneServiceRegistrationController) enqueueInternal(obj *v0alpha1.DataPlaneService) {
	key, err := cache.DeletionHandlingMetaNamespaceKeyFunc(obj)
	if err != nil {
		klog.Errorf("Couldn't get key for object %#v: %v", obj, err)
		return
	}

	c.queue.Add(key)
}

func (c *DataPlaneServiceRegistrationController) addDataPlaneService(obj interface{}) {
	castObj := obj.(*v0alpha1.DataPlaneService)
	klog.V(4).Infof("Adding %s", castObj.Name)
	c.enqueueInternal(castObj)
}

func (c *DataPlaneServiceRegistrationController) updateDataPlaneService(obj, _ interface{}) {
	castObj := obj.(*v0alpha1.DataPlaneService)
	klog.V(4).Infof("Updating %s", castObj.Name)
	c.enqueueInternal(castObj)
}

func (c *DataPlaneServiceRegistrationController) deleteDataPlaneService(obj interface{}) {
	castObj, ok := obj.(*v0alpha1.DataPlaneService)
	if !ok {
		tombstone, ok := obj.(cache.DeletedFinalStateUnknown)
		if !ok {
			klog.Errorf("Couldn't get object from tombstone %#v", obj)
			return
		}
		castObj, ok = tombstone.Obj.(*v0alpha1.DataPlaneService)
		if !ok {
			klog.Errorf("Tombstone contained object that is not expected %#v", obj)
			return
		}
	}
	klog.V(4).Infof("Deleting %q", castObj.Name)
	c.enqueueInternal(castObj)
}

func (c *DataPlaneServiceRegistrationController) Enqueue() {
	dataPlaneServices, err := c.dataPlaneServiceLister.List(labels.Everything())
	if err != nil {
		utilruntime.HandleError(err)
		return
	}
	for _, dataPlaneService := range dataPlaneServices {
		c.addDataPlaneService(dataPlaneService)
	}
}

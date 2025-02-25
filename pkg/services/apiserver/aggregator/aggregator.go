// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes/kubernetes/blob/master/cmd/kube-apiserver/app/aggregator.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.
// Provenance-includes-location: https://github.com/kubernetes/kubernetes/blob/master/cmd/kube-apiserver/app/server.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.
// Provenance-includes-location: https://github.com/kubernetes/kubernetes/blob/master/pkg/controlplane/apiserver/apiextensions.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package aggregator

import (
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"gopkg.in/yaml.v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	utilnet "k8s.io/apimachinery/pkg/util/net"
	"k8s.io/apimachinery/pkg/util/sets"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/dynamiccertificates"
	"k8s.io/apiserver/pkg/server/healthz"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes/fake"
	"k8s.io/client-go/tools/cache"
	"k8s.io/component-base/metrics"
	"k8s.io/component-base/metrics/legacyregistry"
	"k8s.io/klog/v2"
	v1 "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1"
	v1helper "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1/helper"
	aggregatorapiserver "k8s.io/kube-aggregator/pkg/apiserver"
	aggregatorscheme "k8s.io/kube-aggregator/pkg/apiserver/scheme"
	apiregistrationclientset "k8s.io/kube-aggregator/pkg/client/clientset_generated/clientset"
	apiregistrationclient "k8s.io/kube-aggregator/pkg/client/clientset_generated/clientset/typed/apiregistration/v1"
	apiregistrationInformers "k8s.io/kube-aggregator/pkg/client/informers/externalversions/apiregistration/v1"
	"k8s.io/kube-aggregator/pkg/controllers"
	"k8s.io/kube-aggregator/pkg/controllers/autoregister"

	servicev0alpha1 "github.com/grafana/grafana/pkg/apis/service/v0alpha1"
	servicev0alpha1applyconfiguration "github.com/grafana/grafana/pkg/generated/applyconfiguration/service/v0alpha1"
	serviceclientset "github.com/grafana/grafana/pkg/generated/clientset/versioned"
	informersv0alpha1 "github.com/grafana/grafana/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/pkg/registry/apis/service"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
)

// making sure we only register metrics once into legacy registry
var registerIntoLegacyRegistryOnce sync.Once

//nolint:unused
func _readCABundlePEM(path string, devMode bool) ([]byte, error) {
	if devMode {
		return nil, nil
	}

	// We can ignore the gosec G304 warning on this one because `path` comes
	// from Grafana configuration (commandOptions.AggregatorOptions.APIServiceCABundleFile)
	//nolint:gosec
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := f.Close(); err != nil {
			klog.Errorf("error closing remote services file: %s", err)
		}
	}()

	return io.ReadAll(f)
}

func ReadRemoteServices(path string) ([]RemoteService, error) {
	// We can ignore the gosec G304 warning on this one because `path` comes
	// from Grafana configuration (commandOptions.AggregatorOptions.RemoteServicesFile)
	//nolint:gosec
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := f.Close(); err != nil {
			klog.Errorf("error closing remote services file: %s", err)
		}
	}()

	rawRemoteServices, err := io.ReadAll(f)
	if err != nil {
		return nil, err
	}

	remoteServices := make([]RemoteService, 0)
	if err := yaml.Unmarshal(rawRemoteServices, &remoteServices); err != nil {
		return nil, err
	}

	return remoteServices, nil
}

func CreateAggregatorConfig(commandOptions *options.Options, sharedConfig genericapiserver.RecommendedConfig, externalNamesNamespace string) (*Config, error) {
	// Create a fake clientset and informers for the k8s v1 API group.
	// These are not used in grafana's aggregator because v1 APIs are not available.
	fakev1Informers := informers.NewSharedInformerFactory(fake.NewSimpleClientset(), 10*time.Minute)

	serviceClient, err := serviceclientset.NewForConfig(sharedConfig.LoopbackClientConfig)
	if err != nil {
		return nil, err
	}
	sharedInformerFactory := informersv0alpha1.NewSharedInformerFactory(
		serviceClient,
		5*time.Minute, // this is effectively used as a refresh interval right now.  Might want to do something nicer later on.
	)
	serviceResolver := NewExternalNameResolver(sharedInformerFactory.Service().V0alpha1().ExternalNames().Lister())

	aggregatorConfig := &aggregatorapiserver.Config{
		GenericConfig: &genericapiserver.RecommendedConfig{
			Config:                sharedConfig.Config,
			SharedInformerFactory: fakev1Informers,
			ClientConfig:          sharedConfig.LoopbackClientConfig,
		},
		ExtraConfig: aggregatorapiserver.ExtraConfig{
			DisableRemoteAvailableConditionController: true,
			// NOTE: while ProxyTransport can be skipped in the configuration, it allows honoring
			// DISABLE_HTTP2, HTTPS_PROXY and NO_PROXY env vars as needed
			ProxyTransport:  createProxyTransport(),
			ServiceResolver: serviceResolver,
		},
	}

	if commandOptions.KubeAggregatorOptions.LegacyClientCertAuth {
		// NOTE: the availability controller below is a bit different and uses the cert/key pair regardless
		// of the legacy bool, this is because we are still using that for discovery requests
		aggregatorConfig.ExtraConfig.ProxyClientCertFile = commandOptions.KubeAggregatorOptions.ProxyClientCertFile
		aggregatorConfig.ExtraConfig.ProxyClientKeyFile = commandOptions.KubeAggregatorOptions.ProxyClientKeyFile
	}

	customExtraConfig := &CustomExtraConfig{
		DiscoveryOnlyProxyClientCertFile: commandOptions.KubeAggregatorOptions.ProxyClientCertFile,
		DiscoveryOnlyProxyClientKeyFile:  commandOptions.KubeAggregatorOptions.ProxyClientKeyFile,
	}

	if err := commandOptions.KubeAggregatorOptions.ApplyTo(aggregatorConfig, commandOptions.RecommendedOptions.Etcd); err != nil {
		return nil, err
	}

	serviceAPIBuilder := service.NewServiceAPIBuilder()
	if err := serviceAPIBuilder.InstallSchema(aggregatorscheme.Scheme); err != nil {
		return nil, err
	}
	APIVersionPriorities[serviceAPIBuilder.GetGroupVersion()] = Priority{Group: 15000, Version: int32(1)}

	// Exit early, if no remote services file is configured
	if commandOptions.KubeAggregatorOptions.RemoteServicesFile == "" {
		return NewConfig(aggregatorConfig, customExtraConfig, sharedInformerFactory, []builder.APIGroupBuilder{serviceAPIBuilder}, nil), nil
	}

	remoteServices, err := ReadRemoteServices(commandOptions.KubeAggregatorOptions.RemoteServicesFile)
	if err != nil {
		return nil, err
	}

	remoteServicesConfig := &RemoteServicesConfig{
		// TODO: in practice, we should only use the insecure flag when commandOptions.ExtraOptions.DevMode == true
		// But given the bug in K8s, we are forced to set it to true until the below PR is merged and available
		// https://github.com/kubernetes/kubernetes/pull/123808
		InsecureSkipTLSVerify:  true,
		ExternalNamesNamespace: externalNamesNamespace,
		// TODO: CABundle can't be set when insecure is true
		// CABundle: caBundlePEM,
		Services:         remoteServices,
		serviceClientSet: serviceClient,
	}

	return NewConfig(aggregatorConfig, customExtraConfig, sharedInformerFactory, []builder.APIGroupBuilder{serviceAPIBuilder}, remoteServicesConfig), nil
}

// CreateAggregatorServer creates an aggregated server to layer into the existing apiserver
// TODO: passing options temporarily as that allows us to pass in cert/key for client into AvailableController but skip it in the aggregator lib
func CreateAggregatorServer(config *Config, delegateAPIServer genericapiserver.DelegationTarget, reg prometheus.Registerer) (*aggregatorapiserver.APIAggregator, error) {
	aggregatorConfig := config.KubeAggregatorConfig
	sharedInformerFactory := config.Informers
	remoteServicesConfig := config.RemoteServicesConfig
	externalNamesInformer := sharedInformerFactory.Service().V0alpha1().ExternalNames()
	completedConfig := aggregatorConfig.Complete()

	aggregatorServer, err := completedConfig.NewWithDelegate(delegateAPIServer)
	if err != nil {
		return nil, err
	}

	// create controllers for auto-registration
	apiRegistrationClient, err := apiregistrationclient.NewForConfig(completedConfig.GenericConfig.LoopbackClientConfig)
	if err != nil {
		return nil, err
	}

	autoRegistrationController := autoregister.NewAutoRegisterController(aggregatorServer.APIRegistrationInformers.Apiregistration().V1().APIServices(), apiRegistrationClient)

	apiServices := apiServicesToRegister(delegateAPIServer, autoRegistrationController)

	// Imbue all builtin group-priorities onto the aggregated discovery
	if completedConfig.GenericConfig.AggregatedDiscoveryGroupManager != nil {
		for gv, entry := range APIVersionPriorities {
			completedConfig.GenericConfig.AggregatedDiscoveryGroupManager.SetGroupVersionPriority(metav1.GroupVersion(gv), int(entry.Group), int(entry.Version))
		}
	}

	err = aggregatorServer.GenericAPIServer.AddPostStartHook("grafana-apiserver-autoregistration", func(context genericapiserver.PostStartHookContext) error {
		go autoRegistrationController.Run(5, context.Done())
		return nil
	})
	if err != nil {
		return nil, err
	}

	if remoteServicesConfig != nil {
		addRemoteAPIServicesToRegister(remoteServicesConfig, autoRegistrationController)
		externalNames := getRemoteExternalNamesToRegister(remoteServicesConfig)
		err = aggregatorServer.GenericAPIServer.AddPostStartHook("grafana-apiserver-remote-autoregistration", func(ctx genericapiserver.PostStartHookContext) error {
			controllers.WaitForCacheSync("grafana-apiserver-remote-autoregistration", ctx.Done(), externalNamesInformer.Informer().HasSynced)
			namespacedClient := remoteServicesConfig.serviceClientSet.ServiceV0alpha1().ExternalNames(remoteServicesConfig.ExternalNamesNamespace)
			for _, externalName := range externalNames {
				_, err := namespacedClient.Apply(ctx, externalName, metav1.ApplyOptions{
					FieldManager: "grafana-aggregator",
					Force:        true,
				})
				if err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
	}

	err = aggregatorServer.GenericAPIServer.AddBootSequenceHealthChecks(
		makeAPIServiceAvailableHealthCheck(
			"autoregister-completion",
			apiServices,
			aggregatorServer.APIRegistrationInformers.Apiregistration().V1().APIServices(),
		),
	)
	if err != nil {
		return nil, err
	}

	apiregistrationClient, err := apiregistrationclientset.NewForConfig(completedConfig.GenericConfig.LoopbackClientConfig)
	if err != nil {
		return nil, err
	}

	proxyCurrentCertKeyContentFunc := func() ([]byte, []byte) {
		return nil, nil
	}
	if len(config.CustomExtraConfig.DiscoveryOnlyProxyClientCertFile) > 0 && len(config.CustomExtraConfig.DiscoveryOnlyProxyClientKeyFile) > 0 {
		aggregatorProxyCerts, err := dynamiccertificates.NewDynamicServingContentFromFiles("aggregator-proxy-cert", config.CustomExtraConfig.DiscoveryOnlyProxyClientCertFile, config.CustomExtraConfig.DiscoveryOnlyProxyClientKeyFile)
		if err != nil {
			return nil, err
		}
		proxyCurrentCertKeyContentFunc = func() ([]byte, []byte) {
			return aggregatorProxyCerts.CurrentCertKeyContent()
		}
	}

	registry := legacyregistry.DefaultGatherer.(metrics.KubeRegistry)
	availibilityMetrics := newAvailabilityMetrics()
	// create shared (remote and local) availability metrics
	// TODO: decouple from legacyregistry
	registerIntoLegacyRegistryOnce.Do(func() { err = availibilityMetrics.Register(registry.Register, registry.CustomRegister) })
	if err != nil {
		return nil, err
	}

	availableController, err := NewAvailableConditionController(
		aggregatorServer.APIRegistrationInformers.Apiregistration().V1().APIServices(),
		externalNamesInformer,
		apiregistrationClient.ApiregistrationV1(),
		nil,
		proxyCurrentCertKeyContentFunc,
		completedConfig.ExtraConfig.ServiceResolver,
		availibilityMetrics,
	)
	if err != nil {
		return nil, err
	}

	aggregatorServer.GenericAPIServer.AddPostStartHookOrDie("apiservice-status-override-available-controller", func(context genericapiserver.PostStartHookContext) error {
		// if we end up blocking for long periods of time, we may need to increase workers.
		go availableController.Run(5, context.Done())
		return nil
	})

	aggregatorServer.GenericAPIServer.AddPostStartHookOrDie("start-grafana-aggregator-informers", func(context genericapiserver.PostStartHookContext) error {
		sharedInformerFactory.Start(context.Done())
		aggregatorServer.APIRegistrationInformers.Start(context.Done())
		return nil
	})

	serviceAPIGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(servicev0alpha1.GROUP, aggregatorscheme.Scheme, metav1.ParameterCodec, aggregatorscheme.Codecs)
	for _, b := range config.Builders {
		err := b.UpdateAPIGroupInfo(
			&serviceAPIGroupInfo,
			builder.APIGroupOptions{
				Scheme:           aggregatorscheme.Scheme,
				OptsGetter:       aggregatorConfig.GenericConfig.RESTOptionsGetter,
				DualWriteBuilder: nil, // no dual writer
				MetricsRegister:  reg,
			},
		)
		if err != nil {
			return nil, err
		}
	}

	if err := aggregatorServer.GenericAPIServer.InstallAPIGroup(&serviceAPIGroupInfo); err != nil {
		return nil, err
	}

	return aggregatorServer, nil
}

func makeAPIService(gv schema.GroupVersion) *v1.APIService {
	apiServicePriority, ok := APIVersionPriorities[gv]
	if !ok {
		// if we aren't found, then we shouldn't register ourselves because it could result in a CRD group version
		// being permanently stuck in the APIServices list.
		klog.Infof("Skipping APIService creation for %v", gv)
		return nil
	}
	return &v1.APIService{
		ObjectMeta: metav1.ObjectMeta{Name: gv.Version + "." + gv.Group},
		Spec: v1.APIServiceSpec{
			Group:                gv.Group,
			Version:              gv.Version,
			GroupPriorityMinimum: apiServicePriority.Group,
			VersionPriority:      apiServicePriority.Version,
		},
	}
}

// makeAPIServiceAvailableHealthCheck returns a healthz check that returns healthy
// once all of the specified services have been observed to be available at least once.
func makeAPIServiceAvailableHealthCheck(name string, apiServices []*v1.APIService, apiServiceInformer apiregistrationInformers.APIServiceInformer) healthz.HealthChecker {
	// Track the auto-registered API services that have not been observed to be available yet
	pendingServiceNamesLock := &sync.RWMutex{}
	pendingServiceNames := sets.NewString()
	for _, service := range apiServices {
		pendingServiceNames.Insert(service.Name)
	}

	// When an APIService in the list is seen as available, remove it from the pending list
	handleAPIServiceChange := func(service *v1.APIService) {
		pendingServiceNamesLock.Lock()
		defer pendingServiceNamesLock.Unlock()
		if !pendingServiceNames.Has(service.Name) {
			return
		}
		if v1helper.IsAPIServiceConditionTrue(service, v1.Available) {
			pendingServiceNames.Delete(service.Name)
		}
	}

	// Watch add/update events for APIServices
	_, err := apiServiceInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(obj interface{}) { handleAPIServiceChange(obj.(*v1.APIService)) },
		UpdateFunc: func(old, new interface{}) { handleAPIServiceChange(new.(*v1.APIService)) },
	})
	if err != nil {
		klog.Errorf("Failed to watch APIServices for health check: %v", err)
	}

	// Don't return healthy until the pending list is empty
	return healthz.NamedCheck(name, func(r *http.Request) error {
		pendingServiceNamesLock.RLock()
		defer pendingServiceNamesLock.RUnlock()
		if pendingServiceNames.Len() > 0 {
			klog.Error("APIServices not yet available", "services", pendingServiceNames.List())
			return fmt.Errorf("missing APIService: %v", pendingServiceNames.List())
		}
		return nil
	})
}

// Priority defines group Priority that is used in discovery. This controls
// group position in the kubectl output.
type Priority struct {
	// Group indicates the order of the Group relative to other groups.
	Group int32
	// Version indicates the relative order of the Version inside of its group.
	Version int32
}

// APIVersionPriorities are the proper way to resolve this letting the aggregator know the desired group and version-within-group order of the underlying servers
// is to refactor the genericapiserver.DelegationTarget to include a list of priorities based on which APIs were installed.
// This requires the APIGroupInfo struct to evolve and include the concept of priorities and to avoid mistakes, the core storage map there needs to be updated.
// That ripples out every bit as far as you'd expect, so for 1.7 we'll include the list here instead of being built up during storage.
var APIVersionPriorities = map[schema.GroupVersion]Priority{
	{Group: "", Version: "v1"}: {Group: 18000, Version: 1},
	// to my knowledge, nothing below here collides
	{Group: "admissionregistration.k8s.io", Version: "v1"}:       {Group: 16700, Version: 15},
	{Group: "admissionregistration.k8s.io", Version: "v1beta1"}:  {Group: 16700, Version: 12},
	{Group: "admissionregistration.k8s.io", Version: "v1alpha1"}: {Group: 16700, Version: 9},
	// Append a new group to the end of the list if unsure.
	// You can use min(existing group)-100 as the initial value for a group.
	// Version can be set to 9 (to have space around) for a new group.
}

func addRemoteAPIServicesToRegister(config *RemoteServicesConfig, registration autoregister.AutoAPIServiceRegistration) {
	for i, service := range config.Services {
		port := service.Port
		apiService := &v1.APIService{
			ObjectMeta: metav1.ObjectMeta{Name: service.Version + "." + service.Group},
			Spec: v1.APIServiceSpec{
				Group:                 service.Group,
				Version:               service.Version,
				InsecureSkipTLSVerify: config.InsecureSkipTLSVerify,
				CABundle:              config.CABundle,
				// TODO: Group priority minimum of 1000 more than for local services, figure out a better story
				// when we have multiple versions, potentially running in heterogeneous ways (local and remote)
				GroupPriorityMinimum: 16000,
				VersionPriority:      1 + int32(i),
				Service: &v1.ServiceReference{
					Name:      service.Version + "." + service.Group,
					Namespace: config.ExternalNamesNamespace,
					Port:      &port,
				},
			},
		}

		registration.AddAPIServiceToSyncOnStart(apiService)
	}
}

func getRemoteExternalNamesToRegister(config *RemoteServicesConfig) []*servicev0alpha1applyconfiguration.ExternalNameApplyConfiguration {
	externalNames := make([]*servicev0alpha1applyconfiguration.ExternalNameApplyConfiguration, 0)

	for _, service := range config.Services {
		host := service.Host
		name := service.Version + "." + service.Group
		externalName := &servicev0alpha1applyconfiguration.ExternalNameApplyConfiguration{}
		externalName.WithAPIVersion(servicev0alpha1.SchemeGroupVersion.String())
		externalName.WithKind("ExternalName")
		externalName.WithName(name)
		externalName.WithSpec(&servicev0alpha1applyconfiguration.ExternalNameSpecApplyConfiguration{
			Host: &host,
		})
		externalNames = append(externalNames, externalName)
	}

	return externalNames
}

func apiServicesToRegister(delegateAPIServer genericapiserver.DelegationTarget, registration autoregister.AutoAPIServiceRegistration) []*v1.APIService {
	apiServices := []*v1.APIService{}

	for _, curr := range delegateAPIServer.ListedPaths() {
		if curr == "/api/v1" {
			apiService := makeAPIService(schema.GroupVersion{Group: "", Version: "v1"})
			registration.AddAPIServiceToSyncOnStart(apiService)
			apiServices = append(apiServices, apiService)
			continue
		}

		if !strings.HasPrefix(curr, "/apis/") {
			continue
		}
		// this comes back in a list that looks like /apis/rbac.authorization.k8s.io/v1alpha1
		tokens := strings.Split(curr, "/")
		if len(tokens) != 4 {
			continue
		}

		apiService := makeAPIService(schema.GroupVersion{Group: tokens[2], Version: tokens[3]})
		if apiService == nil {
			continue
		}
		registration.AddAPIServiceToSyncOnStart(apiService)
		apiServices = append(apiServices, apiService)
	}

	return apiServices
}

// NOTE: below function imported from https://github.com/kubernetes/kubernetes/blob/master/cmd/kube-apiserver/app/server.go#L197
// createProxyTransport creates the dialer infrastructure to connect to the api servers.
func createProxyTransport() *http.Transport {
	// NOTE: We don't set proxyDialerFn but the below SetTransportDefaults will
	// See https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/apimachinery/pkg/util/net/http.go#L109
	var proxyDialerFn utilnet.DialFunc
	// Proxying to services is IP-based... don't expect to be able to verify the hostname
	proxyTLSClientConfig := &tls.Config{InsecureSkipVerify: true}
	proxyTransport := utilnet.SetTransportDefaults(&http.Transport{
		DialContext:     proxyDialerFn,
		TLSClientConfig: proxyTLSClientConfig,
	})
	return proxyTransport
}

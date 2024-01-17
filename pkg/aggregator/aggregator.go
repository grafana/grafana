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
	"net"
	"net/http"
	"path"
	"strings"
	"sync"
	"time"

	servicev0alpha1 "github.com/grafana/grafana/pkg/apis/service/v0alpha1"
	serviceclientset "github.com/grafana/grafana/pkg/generated/clientset/versioned"
	informersv0alpha1 "github.com/grafana/grafana/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/pkg/registry/apis/service"
	grafanaAPIServer "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	filestorage "github.com/grafana/grafana/pkg/services/grafana-apiserver/storage/file"

	apiextensionsv1beta1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1beta1"
	apiextensionsapiserver "k8s.io/apiextensions-apiserver/pkg/apiserver"
	apiextensionsinformers "k8s.io/apiextensions-apiserver/pkg/client/informers/externalversions"
	apiextensionsopenapi "k8s.io/apiextensions-apiserver/pkg/generated/openapi"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	utilnet "k8s.io/apimachinery/pkg/util/net"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apiserver/pkg/endpoints/discovery/aggregated"
	openapinamer "k8s.io/apiserver/pkg/endpoints/openapi"
	genericfeatures "k8s.io/apiserver/pkg/features"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/healthz"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/apiserver/pkg/server/resourceconfig"
	utilfeature "k8s.io/apiserver/pkg/util/feature"
	"k8s.io/apiserver/pkg/util/openapi"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes/fake"
	"k8s.io/client-go/tools/cache"
	"k8s.io/klog/v2"
	v1 "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1"
	v1helper "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1/helper"
	apiregistrationv1beta1 "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1beta1"
	aggregatorapiserver "k8s.io/kube-aggregator/pkg/apiserver"
	aggregatorscheme "k8s.io/kube-aggregator/pkg/apiserver/scheme"
	apiregistrationclientset "k8s.io/kube-aggregator/pkg/client/clientset_generated/clientset"
	apiregistrationclient "k8s.io/kube-aggregator/pkg/client/clientset_generated/clientset/typed/apiregistration/v1"
	apiregistrationInformers "k8s.io/kube-aggregator/pkg/client/informers/externalversions/apiregistration/v1"
	"k8s.io/kube-aggregator/pkg/controllers/autoregister"
	apiserver "k8s.io/kube-aggregator/pkg/controllers/status"
	aggregatoropenapi "k8s.io/kube-aggregator/pkg/generated/openapi"
	"k8s.io/kube-openapi/pkg/common"
)

// AggregatorServerOptions contains the state for the aggregator apiserver
type AggregatorServerOptions struct {
	Builders        []grafanaAPIServer.APIGroupBuilder
	AlternateDNS    []string
	Config          *Config
	serviceResolver ServiceResolver

	sharedInformerFactory informersv0alpha1.SharedInformerFactory

	StdOut io.Writer
	StdErr io.Writer
}

func NewAggregatorServerOptions(out, errOut io.Writer,
	options *options.RecommendedOptions,
	extraConfig *ExtraConfig,
) (*AggregatorServerOptions, error) {
	sharedConfig, err := initSharedConfig(options, aggregatorscheme.Codecs, nil)
	if err != nil {
		klog.Errorf("Error creating shared config: %s", err)
		return nil, err
	}

	sharedInformerFactory, err := initSharedInformerFactory(sharedConfig)
	if err != nil {
		klog.Errorf("Error creating shared informer factory: %s", err)
		return nil, err
	}

	serviceResolver, err := initServiceResolver(sharedInformerFactory)
	if err != nil {
		klog.Errorf("Error creating service resolver: %s", err)
		return nil, err
	}

	fakeInformers := informers.NewSharedInformerFactory(fake.NewSimpleClientset(), 10*time.Minute)
	builders := []grafanaAPIServer.APIGroupBuilder{
		service.NewServiceAPIBuilder(),
	}

	extensionsConfig, err := initApiExtensionsConfig(options, sharedConfig, fakeInformers, serviceResolver, extraConfig.DataPath)
	if err != nil {
		klog.Errorf("Error creating extensions config: %s", err)
		return nil, err
	}

	aggregatorConfig, err := initAggregatorConfig(options, sharedConfig, extraConfig, fakeInformers, builders, serviceResolver, extraConfig.DataPath)
	if err != nil {
		klog.Errorf("Error creating aggregator config: %s", err)
		return nil, err
	}

	return &AggregatorServerOptions{
		StdOut:                out,
		StdErr:                errOut,
		Builders:              builders,
		sharedInformerFactory: sharedInformerFactory,
		serviceResolver:       serviceResolver,
		Config: &Config{
			Aggregator:    aggregatorConfig,
			ApiExtensions: extensionsConfig,

			SharedConfig: sharedConfig,
			extraConfig:  extraConfig,
		},
	}, nil
}

func (o *AggregatorServerOptions) LoadAPIGroupBuilders() error {
	// Install schemas
	for _, b := range o.Builders {
		if err := b.InstallSchema(aggregatorscheme.Scheme); err != nil {
			return err
		}
	}
	return nil
}

func initSharedConfig(options *options.RecommendedOptions, codecs serializer.CodecFactory, alternateDNS []string) (*genericapiserver.RecommendedConfig, error) {
	if err := options.SecureServing.MaybeDefaultWithSelfSignedCerts(
		"localhost", alternateDNS, []net.IP{net.IPv4(127, 0, 0, 1)},
	); err != nil {
		return nil, fmt.Errorf("error creating self-signed certificates: %v", err)
	}

	options.Authentication.RemoteKubeConfigFileOptional = true
	options.Authorization.RemoteKubeConfigFileOptional = true

	options.Admission = nil

	if options.CoreAPI.CoreAPIKubeconfigPath == "" {
		options.CoreAPI = nil
	}

	serverConfig := genericapiserver.NewRecommendedConfig(codecs)

	// NOTE: AggregatedDiscoveryGroupManager in kube-apiserver is set up by controlplane APIServerConfig creation
	// Here, we adopt that one line in addition to what recommendedOptions gives us
	// Without it, CRDs work on API routes (and are registered in openapi) but not discoverable by kubectl
	serverConfig.AggregatedDiscoveryGroupManager = aggregated.NewResourceManager("apis")

	if options.CoreAPI == nil {
		if err := modifiedApplyTo(options, serverConfig); err != nil {
			return nil, err
		}
	} else {
		if err := options.ApplyTo(serverConfig); err != nil {
			return nil, err
		}
	}

	return serverConfig, nil
}

// A copy of ApplyTo in recommended.go, but for >= 0.28, server pkg in apiserver does a bit extra causing
// a panic when CoreAPI is set to nil
func modifiedApplyTo(options *options.RecommendedOptions, config *genericapiserver.RecommendedConfig) error {
	if err := options.Etcd.ApplyTo(&config.Config); err != nil {
		return err
	}
	if err := options.EgressSelector.ApplyTo(&config.Config); err != nil {
		return err
	}
	if err := options.Traces.ApplyTo(config.Config.EgressSelector, &config.Config); err != nil {
		return err
	}
	if err := options.SecureServing.ApplyTo(&config.Config.SecureServing, &config.Config.LoopbackClientConfig); err != nil {
		return err
	}
	if err := options.Authentication.ApplyTo(&config.Config.Authentication, config.SecureServing, config.OpenAPIConfig); err != nil {
		return err
	}
	if err := options.Authorization.ApplyTo(&config.Config.Authorization); err != nil {
		return err
	}
	if err := options.Audit.ApplyTo(&config.Config); err != nil {
		return err
	}

	// TODO: determine whether we need flow control (API priority and fairness)
	//if err := options.Features.ApplyTo(&config.Config); err != nil {
	//	return err
	//}

	if err := options.CoreAPI.ApplyTo(config); err != nil {
		return err
	}

	_, err := options.ExtraAdmissionInitializers(config)
	if err != nil {
		return err
	}
	return nil
}

func getMergedOpenAPIDefinitions(builders []grafanaAPIServer.APIGroupBuilder, ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	// Add OpenAPI specs for each group+version
	prerequisiteAPIs := grafanaAPIServer.GetOpenAPIDefinitions(builders)(ref)
	aggregatorAPIs := aggregatoropenapi.GetOpenAPIDefinitions(ref)

	for k, v := range prerequisiteAPIs {
		aggregatorAPIs[k] = v
	}

	return aggregatorAPIs
}

func initSharedInformerFactory(sharedConfig *genericapiserver.RecommendedConfig) (informersv0alpha1.SharedInformerFactory, error) {
	serviceClient, err := serviceclientset.NewForConfig(sharedConfig.LoopbackClientConfig)
	if err != nil {
		return nil, err
	}
	return informersv0alpha1.NewSharedInformerFactory(
		serviceClient,
		5*time.Minute, // this is effectively used as a refresh interval right now.  Might want to do something nicer later on.
	), nil
}

func initServiceResolver(factory informersv0alpha1.SharedInformerFactory) (apiserver.ServiceResolver, error) {
	return NewExternalNameResolver(factory.Service().V0alpha1().ExternalNames().Lister()), nil
}

func initApiExtensionsConfig(options *options.RecommendedOptions,
	sharedConfig *genericapiserver.RecommendedConfig,
	fakeInfomers informers.SharedInformerFactory,
	serviceResolver apiserver.ServiceResolver,
	dataPath string,
) (*apiextensionsapiserver.Config, error) {
	// make a shallow copy to let us twiddle a few things
	// most of the config actually remains the same.  We only need to mess with a couple items related to the particulars of the api extensions
	genericConfig := sharedConfig.Config

	genericConfig.PostStartHooks = map[string]genericapiserver.PostStartHookConfigEntry{}
	genericConfig.RESTOptionsGetter = nil

	// copy the etcd options so we don't mutate originals.
	// we assume that the etcd options have been completed already.  avoid messing with anything outside
	// of changes to StorageConfig as that may lead to unexpected behavior when the options are applied.
	etcdOptions := *options.Etcd
	// this is where the true decodable levels come from.
	etcdOptions.StorageConfig.Codec = apiextensionsapiserver.Codecs.LegacyCodec(apiextensionsv1beta1.SchemeGroupVersion, v1.SchemeGroupVersion)
	// prefer the more compact serialization (v1beta1) for storage until https://issue.k8s.io/82292 is resolved for objects whose v1 serialization is too big but whose v1beta1 serialization can be stored
	etcdOptions.StorageConfig.EncodeVersioner = runtime.NewMultiGroupVersioner(apiextensionsv1beta1.SchemeGroupVersion, schema.GroupKind{Group: apiextensionsv1beta1.GroupName})
	etcdOptions.SkipHealthEndpoints = true // avoid double wiring of health checks
	if err := etcdOptions.ApplyTo(&genericConfig); err != nil {
		return nil, err
	}

	restOptionsGetter := filestorage.NewRESTOptionsGetter(path.Join(dataPath, "grafana-apiextensionsserver"), etcdOptions.StorageConfig)
	genericConfig.RESTOptionsGetter = restOptionsGetter

	// NOTE: ignoring genericConfig.ResourceTransformers in crdOptionsGetter creation for now
	// crdOptionsGetter := apiextensionsoptions.NewCRDRESTOptionsGetter(etcdOptions, genericConfig.ResourceTransformers, )
	// The following is equivalent code to apiextensionsoptions.NewCRDRESTOptionsGetter with lesser dependencies
	crdEtcdOptions := etcdOptions
	crdEtcdOptions.StorageConfig.Codec = unstructured.UnstructuredJSONScheme
	crdEtcdOptions.StorageConfig.StorageObjectCountTracker = genericConfig.StorageObjectCountTracker
	crdEtcdOptions.WatchCacheSizes = nil // this control is not provided for custom resources

	// override MergedResourceConfig with apiextensions defaults and registry
	mergedResourceConfig, err := resourceconfig.MergeAPIResourceConfigs(apiextensionsapiserver.DefaultAPIResourceConfigSource(), nil, apiextensionsapiserver.Scheme)
	if err != nil {
		return nil, err
	}
	genericConfig.MergedResourceConfig = mergedResourceConfig

	genericConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(openapi.GetOpenAPIDefinitionsWithoutDisabledFeatures(apiextensionsopenapi.GetOpenAPIDefinitions), openapinamer.NewDefinitionNamer(apiextensionsapiserver.Scheme, apiextensionsapiserver.Scheme))

	apiextensionsConfig := &apiextensionsapiserver.Config{
		GenericConfig: &genericapiserver.RecommendedConfig{
			Config:                genericConfig,
			SharedInformerFactory: fakeInfomers,
		},
		ExtraConfig: apiextensionsapiserver.ExtraConfig{
			CRDRESTOptionsGetter: filestorage.NewRESTOptionsGetter(path.Join(dataPath, "grafana-apiextensionsserver"), crdEtcdOptions.StorageConfig),
			// TODO: remove the hardcod when HA story is more developed
			MasterCount: 1,
			// TODO: leaving AuthResolverWrapper unset doesn't impact basic operation of CRDs
			// AuthResolverWrapper:  authResolverWrapper,
			ServiceResolver: serviceResolver,
		},
	}

	// we need to clear the poststarthooks so we don't add them multiple times to all the servers (that fails)
	apiextensionsConfig.GenericConfig.PostStartHooks = map[string]genericapiserver.PostStartHookConfigEntry{}

	return apiextensionsConfig, nil
}

func initAggregatorConfig(options *options.RecommendedOptions,
	sharedConfig *genericapiserver.RecommendedConfig,
	extra *ExtraConfig,
	fakeInformers informers.SharedInformerFactory,
	builders []grafanaAPIServer.APIGroupBuilder,
	serviceResolver apiserver.ServiceResolver,
	dataPath string,
) (*aggregatorapiserver.Config, error) {
	// make a shallow copy to let us twiddle a few things
	// most of the config actually remains the same.  We only need to mess with a couple items related to the particulars of the aggregator
	genericConfig := sharedConfig.Config

	genericConfig.PostStartHooks = map[string]genericapiserver.PostStartHookConfigEntry{}
	genericConfig.RESTOptionsGetter = nil
	// prevent generic API server from installing the OpenAPI handler. Aggregator server
	// has its own customized OpenAPI handler.
	genericConfig.SkipOpenAPIInstallation = true
	mergedResourceConfig, err := resourceconfig.MergeAPIResourceConfigs(aggregatorapiserver.DefaultAPIResourceConfigSource(), nil, aggregatorscheme.Scheme)
	if err != nil {
		return nil, err
	}
	genericConfig.MergedResourceConfig = mergedResourceConfig

	getOpenAPIDefinitionsFunc := func() common.GetOpenAPIDefinitions {
		return func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
			return getMergedOpenAPIDefinitions(builders, ref)
		}
	}

	namer := openapinamer.NewDefinitionNamer(aggregatorscheme.Scheme, apiextensionsapiserver.Scheme)
	genericConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(getOpenAPIDefinitionsFunc(), namer)
	genericConfig.OpenAPIV3Config.Info.Title = "Kubernetes"
	genericConfig.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(getOpenAPIDefinitionsFunc(), namer)
	genericConfig.OpenAPIConfig.Info.Title = "Kubernetes"

	if utilfeature.DefaultFeatureGate.Enabled(genericfeatures.StorageVersionAPI) &&
		utilfeature.DefaultFeatureGate.Enabled(genericfeatures.APIServerIdentity) {
		// Add StorageVersionPrecondition handler to aggregator-apiserver.
		// The handler will block write requests to built-in resources until the
		// target resources' storage versions are up-to-date.
		genericConfig.BuildHandlerChainFunc = genericapiserver.BuildHandlerChainWithStorageVersionPrecondition
	}

	// copy the etcd options so we don't mutate originals.
	// we assume that the etcd options have been completed already.  avoid messing with anything outside
	// of changes to StorageConfig as that may lead to unexpected behavior when the options are applied.
	etcdOptions := *options.Etcd
	etcdOptions.StorageConfig.Codec = aggregatorscheme.Codecs.LegacyCodec(v1.SchemeGroupVersion,
		apiregistrationv1beta1.SchemeGroupVersion,
		servicev0alpha1.SchemeGroupVersion)
	etcdOptions.StorageConfig.EncodeVersioner = runtime.NewMultiGroupVersioner(v1.SchemeGroupVersion,
		schema.GroupKind{Group: apiregistrationv1beta1.GroupName},
		schema.GroupKind{Group: servicev0alpha1.GROUP})
	etcdOptions.SkipHealthEndpoints = true // avoid double wiring of health checks
	if err := etcdOptions.ApplyTo(&genericConfig); err != nil {
		return nil, err
	}
	genericConfig.RESTOptionsGetter = filestorage.NewRESTOptionsGetter(path.Join(dataPath, "grafana-aggregator"), etcdOptions.StorageConfig)

	genericConfig.DisabledPostStartHooks = genericConfig.DisabledPostStartHooks.Insert("apiservice-status-available-controller")
	genericConfig.DisabledPostStartHooks = genericConfig.DisabledPostStartHooks.Insert("start-kube-aggregator-informers")

	aggregatorConfig := &aggregatorapiserver.Config{
		GenericConfig: &genericapiserver.RecommendedConfig{
			Config:                genericConfig,
			SharedInformerFactory: fakeInformers,
			ClientConfig:          genericConfig.LoopbackClientConfig,
		},
		ExtraConfig: aggregatorapiserver.ExtraConfig{
			ProxyClientCertFile: extra.ProxyClientCertFile,
			ProxyClientKeyFile:  extra.ProxyClientKeyFile,
			// NOTE: while ProxyTransport can be skipped in the configuration, it allows honoring
			// DISABLE_HTTP2, HTTPS_PROXY and NO_PROXY env vars as needed
			ProxyTransport: createProxyTransport(),
		},
	}

	aggregatorConfig.ExtraConfig.ServiceResolver = serviceResolver

	// we need to clear the poststarthooks so we don't add them multiple times to all the servers (that fails)
	aggregatorConfig.GenericConfig.PostStartHooks = map[string]genericapiserver.PostStartHookConfigEntry{}

	return aggregatorConfig, nil
}

func (o *AggregatorServerOptions) CreateAggregatorServer(delegateAPIServer genericapiserver.DelegationTarget, apiExtensionsInformers apiextensionsinformers.SharedInformerFactory) (*aggregatorapiserver.APIAggregator, error) {
	completedConfig := o.Config.AggregatorComplete
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

	crdRegistrationController := NewCRDRegistrationController(
		apiExtensionsInformers.Apiextensions().V1().CustomResourceDefinitions(),
		autoRegistrationController)

	// Imbue all builtin group-priorities onto the aggregated discovery
	if completedConfig.GenericConfig.AggregatedDiscoveryGroupManager != nil {
		for gv, entry := range apiVersionPriorities {
			completedConfig.GenericConfig.AggregatedDiscoveryGroupManager.SetGroupVersionPriority(metav1.GroupVersion(gv), int(entry.group), int(entry.version))
		}
	}

	err = aggregatorServer.GenericAPIServer.AddPostStartHook("kube-apiserver-autoregistration", func(context genericapiserver.PostStartHookContext) error {
		go crdRegistrationController.Run(5, context.StopCh)
		go func() {
			crdRegistrationController.WaitForInitialSync()
			autoRegistrationController.Run(5, context.StopCh)
		}()
		return nil
	})
	if err != nil {
		return nil, err
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

	availableController, err := NewAvailableConditionController(
		aggregatorServer.APIRegistrationInformers.Apiregistration().V1().APIServices(),
		o.sharedInformerFactory.Service().V0alpha1().ExternalNames(),
		apiregistrationClient.ApiregistrationV1(),
		nil,
		(func() ([]byte, []byte))(nil),
		completedConfig.ExtraConfig.ServiceResolver,
	)
	if err != nil {
		return nil, err
	}

	aggregatorServer.GenericAPIServer.AddPostStartHookOrDie("apiservice-status-override-available-controller", func(context genericapiserver.PostStartHookContext) error {
		// if we end up blocking for long periods of time, we may need to increase workers.
		go availableController.Run(5, context.StopCh)
		return nil
	})

	aggregatorServer.GenericAPIServer.AddPostStartHookOrDie("start-grafana-aggregator-informers", func(context genericapiserver.PostStartHookContext) error {
		o.sharedInformerFactory.Start(context.StopCh)
		aggregatorServer.APIRegistrationInformers.Start(context.StopCh)
		return nil
	})

	// Install the API Group+version
	for _, b := range o.Builders {
		g, err := b.GetAPIGroupInfo(aggregatorscheme.Scheme, aggregatorscheme.Codecs, completedConfig.GenericConfig.RESTOptionsGetter)
		if err != nil {
			return nil, err
		}
		if g == nil || len(g.PrioritizedVersions) < 1 {
			continue
		}
		err = aggregatorServer.GenericAPIServer.InstallAPIGroup(g)
		if err != nil {
			return nil, err
		}
	}

	return aggregatorServer, nil
}

func makeAPIService(gv schema.GroupVersion) *v1.APIService {
	apiServicePriority, ok := apiVersionPriorities[gv]
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
			GroupPriorityMinimum: apiServicePriority.group,
			VersionPriority:      apiServicePriority.version,
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
	_, _ = apiServiceInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(obj interface{}) { handleAPIServiceChange(obj.(*v1.APIService)) },
		UpdateFunc: func(old, new interface{}) { handleAPIServiceChange(new.(*v1.APIService)) },
	})

	// Don't return healthy until the pending list is empty
	return healthz.NamedCheck(name, func(r *http.Request) error {
		pendingServiceNamesLock.RLock()
		defer pendingServiceNamesLock.RUnlock()
		if pendingServiceNames.Len() > 0 {
			return fmt.Errorf("missing APIService: %v", pendingServiceNames.List())
		}
		return nil
	})
}

// priority defines group priority that is used in discovery. This controls
// group position in the kubectl output.
type priority struct {
	// group indicates the order of the group relative to other groups.
	group int32
	// version indicates the relative order of the version inside of its group.
	version int32
}

// The proper way to resolve this letting the aggregator know the desired group and version-within-group order of the underlying servers
// is to refactor the genericapiserver.DelegationTarget to include a list of priorities based on which APIs were installed.
// This requires the APIGroupInfo struct to evolve and include the concept of priorities and to avoid mistakes, the core storage map there needs to be updated.
// That ripples out every bit as far as you'd expect, so for 1.7 we'll include the list here instead of being built up during storage.
var apiVersionPriorities = map[schema.GroupVersion]priority{
	{Group: "", Version: "v1"}: {group: 18000, version: 1},
	// to my knowledge, nothing below here collides
	{Group: "admissionregistration.k8s.io", Version: "v1"}:       {group: 16700, version: 15},
	{Group: "admissionregistration.k8s.io", Version: "v1beta1"}:  {group: 16700, version: 12},
	{Group: "admissionregistration.k8s.io", Version: "v1alpha1"}: {group: 16700, version: 9},
	{Group: "apiextensions.k8s.io", Version: "v1"}:               {group: 16700, version: 15},
	// Append a new group to the end of the list if unsure.
	// You can use min(existing group)-100 as the initial value for a group.
	// Version can be set to 9 (to have space around) for a new group.
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

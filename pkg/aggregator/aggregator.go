/*
Copyright 2017 The Kubernetes Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Package app does all of the work necessary to create a Kubernetes
// APIServer by binding together the API, master and APIServer infrastructure.
// It can be configured and called directly or via the hyperkube framework.

package aggregator

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	servicev0alpha1 "github.com/grafana/grafana/pkg/apis/service/v0alpha1"
	serviceclientset "github.com/grafana/grafana/pkg/generated/clientset/versioned"
	informersv0alpha1 "github.com/grafana/grafana/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/pkg/registry/apis/service"
	grafanaAPIServer "github.com/grafana/grafana/pkg/services/grafana-apiserver"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/util/sets"
	openapinamer "k8s.io/apiserver/pkg/endpoints/openapi"
	genericfeatures "k8s.io/apiserver/pkg/features"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/healthz"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/apiserver/pkg/server/resourceconfig"
	utilfeature "k8s.io/apiserver/pkg/util/feature"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes/fake"
	"k8s.io/client-go/tools/cache"
	"k8s.io/klog/v2"
	v1 "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1"
	v1helper "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1/helper"
	"k8s.io/kube-aggregator/pkg/apis/apiregistration/v1beta1"
	aggregatorapiserver "k8s.io/kube-aggregator/pkg/apiserver"
	aggregatorscheme "k8s.io/kube-aggregator/pkg/apiserver/scheme"
	apiregistrationclientset "k8s.io/kube-aggregator/pkg/client/clientset_generated/clientset"
	apiregistrationclient "k8s.io/kube-aggregator/pkg/client/clientset_generated/clientset/typed/apiregistration/v1"
	apiserviceinformers "k8s.io/kube-aggregator/pkg/client/informers/externalversions"
	apiregistrationInformers "k8s.io/kube-aggregator/pkg/client/informers/externalversions/apiregistration/v1"
	"k8s.io/kube-aggregator/pkg/controllers/autoregister"
	aggregatoropenapi "k8s.io/kube-aggregator/pkg/generated/openapi"
	"k8s.io/kube-openapi/pkg/common"
	netutils "k8s.io/utils/net"
)

// AggregatorServerOptions contains the state for the aggregator apiserver
type AggregatorServerOptions struct {
	Builders           []grafanaAPIServer.APIGroupBuilder
	RecommendedOptions *options.RecommendedOptions
	AlternateDNS       []string

	sharedInformerFactory informersv0alpha1.SharedInformerFactory

	StdOut io.Writer
	StdErr io.Writer
}

func NewAggregatorServerOptions(out, errOut io.Writer) *AggregatorServerOptions {
	return &AggregatorServerOptions{
		StdOut: out,
		StdErr: errOut,
	}
}

func (o *AggregatorServerOptions) LoadAPIGroupBuilders() error {
	o.Builders = []grafanaAPIServer.APIGroupBuilder{
		service.NewServiceAPIBuilder(),
	}

	// Install schemas
	for _, b := range o.Builders {
		if err := b.InstallSchema(aggregatorscheme.Scheme); err != nil {
			return err
		}
	}
	return nil
}

func (o *AggregatorServerOptions) Config(codecs serializer.CodecFactory) (*genericapiserver.RecommendedConfig, error) {
	if err := o.RecommendedOptions.SecureServing.MaybeDefaultWithSelfSignedCerts(
		"localhost", o.AlternateDNS, []net.IP{netutils.ParseIPSloppy("127.0.0.1")},
	); err != nil {
		return nil, fmt.Errorf("error creating self-signed certificates: %v", err)
	}

	o.RecommendedOptions.Authentication.RemoteKubeConfigFileOptional = true
	o.RecommendedOptions.Authorization.RemoteKubeConfigFileOptional = true

	o.RecommendedOptions.Admission = nil

	if o.RecommendedOptions.CoreAPI.CoreAPIKubeconfigPath == "" {
		o.RecommendedOptions.CoreAPI = nil
	}

	serverConfig := genericapiserver.NewRecommendedConfig(codecs)

	if o.RecommendedOptions.CoreAPI == nil {
		if err := o.ModifiedApplyTo(serverConfig); err != nil {
			return nil, err
		}
	} else {
		if err := o.RecommendedOptions.ApplyTo(serverConfig); err != nil {
			return nil, err
		}
	}

	return serverConfig, nil
}

// A copy of ApplyTo in recommended.go, but for >= 0.28, server pkg in apiserver does a bit extra causing
// a panic when CoreAPI is set to nil
func (o *AggregatorServerOptions) ModifiedApplyTo(config *genericapiserver.RecommendedConfig) error {
	if err := o.RecommendedOptions.Etcd.ApplyTo(&config.Config); err != nil {
		return err
	}
	if err := o.RecommendedOptions.EgressSelector.ApplyTo(&config.Config); err != nil {
		return err
	}
	if err := o.RecommendedOptions.Traces.ApplyTo(config.Config.EgressSelector, &config.Config); err != nil {
		return err
	}
	if err := o.RecommendedOptions.SecureServing.ApplyTo(&config.Config.SecureServing, &config.Config.LoopbackClientConfig); err != nil {
		return err
	}
	if err := o.RecommendedOptions.Authentication.ApplyTo(&config.Config.Authentication, config.SecureServing, config.OpenAPIConfig); err != nil {
		return err
	}
	if err := o.RecommendedOptions.Authorization.ApplyTo(&config.Config.Authorization); err != nil {
		return err
	}
	if err := o.RecommendedOptions.Audit.ApplyTo(&config.Config); err != nil {
		return err
	}
	//if err := o.RecommendedOptions.Features.ApplyTo(&config.Config); err != nil {
	//	return err
	//}

	if err := o.RecommendedOptions.CoreAPI.ApplyTo(config); err != nil {
		return err
	}

	_, err := o.RecommendedOptions.ExtraAdmissionInitializers(config)
	if err != nil {
		return err
	}
	return nil
}

func (o *AggregatorServerOptions) getMergedOpenAPIDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	// Add OpenAPI specs for each group+version
	prerequisiteAPIs := grafanaAPIServer.GetOpenAPIDefinitions(o.Builders)(ref)
	aggregatorAPIs := aggregatoropenapi.GetOpenAPIDefinitions(ref)

	for k, v := range prerequisiteAPIs {
		aggregatorAPIs[k] = v
	}

	return aggregatorAPIs
}

func (o *AggregatorServerOptions) CreateAggregatorConfig() (*aggregatorapiserver.Config, error) {
	sharedConfig, err := o.Config(aggregatorscheme.Codecs)
	if err != nil {
		klog.Errorf("Error translating server options to config: %s", err)
		return nil, err
	}

	commandOptions := *o.RecommendedOptions

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

	namer := openapinamer.NewDefinitionNamer(aggregatorscheme.Scheme)
	genericConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(o.getMergedOpenAPIDefinitions, namer)
	genericConfig.OpenAPIV3Config.Info.Title = "Kubernetes"
	genericConfig.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(o.getMergedOpenAPIDefinitions, namer)
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
	etcdOptions := *commandOptions.Etcd
	etcdOptions.StorageConfig.Codec = aggregatorscheme.Codecs.LegacyCodec(v1.SchemeGroupVersion,
		v1beta1.SchemeGroupVersion,
		servicev0alpha1.SchemeGroupVersion)
	etcdOptions.StorageConfig.EncodeVersioner = runtime.NewMultiGroupVersioner(v1.SchemeGroupVersion,
		schema.GroupKind{Group: v1beta1.GroupName},
		schema.GroupKind{Group: servicev0alpha1.GROUP})
	etcdOptions.StorageConfig.Transport.ServerList = []string{"127.0.0.1:2379"}
	etcdOptions.SkipHealthEndpoints = true // avoid double wiring of health checks
	if err := etcdOptions.ApplyTo(&genericConfig); err != nil {
		return nil, err
	}
	// genericConfig.RESTOptionsGetter = filestorage.NewRESTOptionsGetter("/tmp/grafana.aggregator", etcdOptions.StorageConfig)

	versionedInformers := informers.NewSharedInformerFactory(fake.NewSimpleClientset(), 10*time.Minute)

	serviceClient, err := serviceclientset.NewForConfig(genericConfig.LoopbackClientConfig)
	if err != nil {
		return nil, err
	}
	o.sharedInformerFactory = informersv0alpha1.NewSharedInformerFactory(
		serviceClient,
		5*time.Minute, // this is effectively used as a refresh interval right now.  Might want to do something nicer later on.
	)
	serviceResolver := NewExternalNameResolver(o.sharedInformerFactory.Service().V0alpha1().ExternalNames().Lister())

	genericConfig.DisabledPostStartHooks = genericConfig.DisabledPostStartHooks.Insert("apiservice-status-available-controller")
	genericConfig.DisabledPostStartHooks = genericConfig.DisabledPostStartHooks.Insert("start-kube-aggregator-informers")

	aggregatorConfig := &aggregatorapiserver.Config{
		GenericConfig: &genericapiserver.RecommendedConfig{
			Config:                genericConfig,
			SharedInformerFactory: versionedInformers,
			ClientConfig:          genericConfig.LoopbackClientConfig,
		},
		ExtraConfig: aggregatorapiserver.ExtraConfig{
			// ProxyClientCertFile:       commandOptions.ProxyClientCertFile,
			// ProxyClientKeyFile:        commandOptions.ProxyClientKeyFile,
			// ProxyTransport:  proxyTransport,
		},
	}

	aggregatorConfig.ExtraConfig.ServiceResolver = serviceResolver

	// we need to clear the poststarthooks so we don't add them multiple times to all the servers (that fails)
	aggregatorConfig.GenericConfig.PostStartHooks = map[string]genericapiserver.PostStartHookConfigEntry{}

	return aggregatorConfig, nil
}

func (o *AggregatorServerOptions) CreateAggregatorServer(aggregatorConfig *aggregatorapiserver.Config, delegateAPIServer genericapiserver.DelegationTarget) (*aggregatorapiserver.APIAggregator, error) {
	completedConfig := aggregatorConfig.Complete()
	aggregatorServer, err := completedConfig.NewWithDelegate(delegateAPIServer)
	if err != nil {
		return nil, err
	}

	// create controllers for auto-registration
	apiRegistrationClient, err := apiregistrationclient.NewForConfig(aggregatorConfig.GenericConfig.LoopbackClientConfig)
	if err != nil {
		return nil, err
	}
	autoRegistrationController := autoregister.NewAutoRegisterController(aggregatorServer.APIRegistrationInformers.Apiregistration().V1().APIServices(), apiRegistrationClient)
	apiServices := apiServicesToRegister(delegateAPIServer, autoRegistrationController)

	// Imbue all builtin group-priorities onto the aggregated discovery
	if aggregatorConfig.GenericConfig.AggregatedDiscoveryGroupManager != nil {
		for gv, entry := range apiVersionPriorities {
			aggregatorConfig.GenericConfig.AggregatedDiscoveryGroupManager.SetGroupVersionPriority(metav1.GroupVersion(gv), int(entry.group), int(entry.version))
		}
	}

	err = aggregatorServer.GenericAPIServer.AddPostStartHook("kube-apiserver-autoregistration", func(context genericapiserver.PostStartHookContext) error {
		go func() {
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
	informerFactory := apiserviceinformers.NewSharedInformerFactory(
		apiregistrationClient,
		5*time.Minute, // this is effectively used as a refresh interval right now.  Might want to do something nicer later on.
	)

	availableController, err := NewAvailableConditionController(
		informerFactory.Apiregistration().V1().APIServices(),
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
		informerFactory.Start(context.StopCh)
		o.sharedInformerFactory.Start(context.StopCh)
		return nil
	})

	// Install the API Group+version
	for _, b := range o.Builders {
		g, err := b.GetAPIGroupInfo(aggregatorscheme.Scheme, aggregatorscheme.Codecs, aggregatorConfig.GenericConfig.RESTOptionsGetter)
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
	apiServiceInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
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

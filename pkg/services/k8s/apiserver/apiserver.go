package apiserver

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"net/url"
	"time"

	extensionsapiserver "k8s.io/apiextensions-apiserver/pkg/apiserver"
	utilnet "k8s.io/apimachinery/pkg/util/net"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	openapinamer "k8s.io/apiserver/pkg/endpoints/openapi"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/egressselector"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	utilfeature "k8s.io/apiserver/pkg/util/feature"
	"k8s.io/apiserver/pkg/util/openapi"
	"k8s.io/apiserver/pkg/util/webhook"
	clientgoinformers "k8s.io/client-go/informers"
	clientgoclientset "k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
	aggregatorapiserver "k8s.io/kube-aggregator/pkg/apiserver"
	"k8s.io/kubernetes/pkg/api/legacyscheme"
	"k8s.io/kubernetes/pkg/controlplane"
	generatedopenapi "k8s.io/kubernetes/pkg/generated/openapi"
	"k8s.io/kubernetes/pkg/kubeapiserver"
	kubeapiserveradmission "k8s.io/kubernetes/pkg/kubeapiserver/admission"
	"k8s.io/kubernetes/pkg/kubeapiserver/authorizer/modes"
	kubeoptions "k8s.io/kubernetes/pkg/kubeapiserver/options"
	rbacrest "k8s.io/kubernetes/pkg/registry/rbac/rest"
)

func (s *service) apiserverConfig() (*options.APIEnablementOptions, clientgoinformers.SharedInformerFactory, *options.EtcdOptions, *genericapiserver.Config, error) {
	serverRunOptions := options.NewServerRunOptions()
	admissionOptions := kubeoptions.NewAdmissionOptions()
	authentication := kubeoptions.NewBuiltInAuthenticationOptions().WithAll()
	authorization := kubeoptions.NewBuiltInAuthorizationOptions()
	apiEnablement := options.NewAPIEnablementOptions()
	etcdOptions := options.NewEtcdOptions(storagebackend.NewDefaultConfig(kubeoptions.DefaultEtcdPathPrefix, nil))

	etcdConfig := s.etcdProvider.GetConfig()
	etcdOptions.StorageConfig.Transport.ServerList = etcdConfig.Endpoints
	etcdOptions.StorageConfig.Transport.CertFile = etcdConfig.TLSConfig.CertFile
	etcdOptions.StorageConfig.Transport.KeyFile = etcdConfig.TLSConfig.KeyFile
	etcdOptions.StorageConfig.Transport.TrustedCAFile = etcdConfig.TLSConfig.CAFile
	etcdOptions.DefaultStorageMediaType = "application/vnd.kubernetes.protobuf"

	serverConfig := genericapiserver.NewConfig(legacyscheme.Codecs)
	serverConfig.MergedResourceConfig = controlplane.DefaultAPIResourceConfigSource()
	serverConfig.LoopbackClientConfig = &rest.Config{
		Host: "http://127.0.0.1:6443",
	}
	if err := serverRunOptions.ApplyTo(serverConfig); err != nil {
		return nil, nil, nil, nil, err
	}
	if err := apiEnablement.ApplyTo(serverConfig, controlplane.DefaultAPIResourceConfigSource(), legacyscheme.Scheme); err != nil {
		return nil, nil, nil, nil, err
	}
	// wrap the definitions to revert any changes from disabled features
	getOpenAPIDefinitions := openapi.GetOpenAPIDefinitionsWithoutDisabledFeatures(generatedopenapi.GetOpenAPIDefinitions)
	serverConfig.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(getOpenAPIDefinitions, openapinamer.NewDefinitionNamer(legacyscheme.Scheme, extensionsapiserver.Scheme))
	serverConfig.OpenAPIConfig.Info.Title = "Kubernetes"
	serverConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(getOpenAPIDefinitions, openapinamer.NewDefinitionNamer(legacyscheme.Scheme, extensionsapiserver.Scheme))
	serverConfig.OpenAPIV3Config.Info.Title = "Kubernetes"
	if err := etcdOptions.Complete(serverConfig.StorageObjectCountTracker, serverConfig.DrainedNotify(), serverConfig.AddPostStartHook); err != nil {
		return nil, nil, nil, nil, err
	}
	storageFactoryConfig := kubeapiserver.NewStorageFactoryConfig()
	storageFactoryConfig.APIResourceConfig = serverConfig.MergedResourceConfig
	storageFactory, err := storageFactoryConfig.Complete(etcdOptions).New()
	if err != nil {
		return nil, nil, nil, nil, err
	}
	if err = etcdOptions.ApplyWithStorageFactoryTo(storageFactory, serverConfig); err != nil {
		return nil, nil, nil, nil, err
	}

	serverConfig.LoopbackClientConfig.ContentConfig.ContentType = "application/vnd.kubernetes.protobuf"
	serverConfig.LoopbackClientConfig.DisableCompression = true

	kubeClientConfig := serverConfig.LoopbackClientConfig
	clientgoExternalClient, err := clientgoclientset.NewForConfig(kubeClientConfig)
	if err != nil {
		return nil, nil, nil, nil, fmt.Errorf("failed to create clientset: %v", err)
	}

	versionedInformers := clientgoinformers.NewSharedInformerFactory(clientgoExternalClient, 10*time.Minute)

	// Authentication.ApplyTo requires already applied OpenAPIConfig and EgressSelector if present
	if err = authentication.ApplyTo(&serverConfig.Authentication, serverConfig.SecureServing, serverConfig.EgressSelector, serverConfig.OpenAPIConfig, serverConfig.OpenAPIV3Config, clientgoExternalClient, versionedInformers); err != nil {
		return nil, nil, nil, nil, err
	}

	serverConfig.Authorization.Authorizer, serverConfig.RuleResolver, err = BuildAuthorizer(authorization, serverConfig.EgressSelector, versionedInformers)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	if !sets.NewString(authorization.Modes...).Has(modes.ModeRBAC) {
		serverConfig.DisabledPostStartHooks.Insert(rbacrest.PostStartHookName)
	}

	proxyTransport := CreateProxyTransport()

	admissionConfig := &kubeapiserveradmission.Config{
		ExternalInformers:    versionedInformers,
		LoopbackClientConfig: serverConfig.LoopbackClientConfig,
	}
	serviceResolver := buildServiceResolver(false, serverConfig.LoopbackClientConfig.Host, versionedInformers)
	pluginInitializers, admissionPostStartHook, err := admissionConfig.New(proxyTransport, serverConfig.EgressSelector, serviceResolver, serverConfig.TracerProvider)
	if err != nil {
		return nil, nil, nil, nil, err
	}

	err = admissionOptions.ApplyTo(
		serverConfig,
		versionedInformers,
		kubeClientConfig,
		utilfeature.DefaultFeatureGate,
		pluginInitializers...)
	if err != nil {
		return nil, nil, nil, nil, err
	}

	if err := serverConfig.AddPostStartHook("start-kube-apiserver-admission-initializer", admissionPostStartHook); err != nil {
		return nil, nil, nil, nil, err
	}
	serverConfig.ExternalAddress = "127.0.0.1:6443"

	if err := s.writeKubeConfiguration(serverConfig.LoopbackClientConfig); err != nil {
		return nil, nil, nil, nil, err
	}
	return apiEnablement, versionedInformers, etcdOptions, serverConfig, nil
}

func (s *service) writeKubeConfiguration(restConfig *rest.Config) error {
	clusters := make(map[string]*clientcmdapi.Cluster)
	clusters["default-cluster"] = &clientcmdapi.Cluster{
		Server:                   restConfig.Host,
		CertificateAuthorityData: restConfig.CAData,
	}

	contexts := make(map[string]*clientcmdapi.Context)
	contexts["default-context"] = &clientcmdapi.Context{
		Cluster:   "default-cluster",
		Namespace: "default",
		AuthInfo:  "default",
	}

	authinfos := make(map[string]*clientcmdapi.AuthInfo)
	authinfos["default"] = &clientcmdapi.AuthInfo{}

	clientConfig := clientcmdapi.Config{
		Kind:           "Config",
		APIVersion:     "v1",
		Clusters:       clusters,
		Contexts:       contexts,
		CurrentContext: "default-context",
		AuthInfos:      authinfos,
	}
	return clientcmd.WriteToFile(clientConfig, "data/grafana.kubeconfig")
}

// BuildAuthorizer constructs the authorizer
func BuildAuthorizer(authorization *kubeoptions.BuiltInAuthorizationOptions, EgressSelector *egressselector.EgressSelector, versionedInformers clientgoinformers.SharedInformerFactory) (authorizer.Authorizer, authorizer.RuleResolver, error) {
	authorizationConfig := authorization.ToAuthorizationConfig(versionedInformers)

	if EgressSelector != nil {
		egressDialer, err := EgressSelector.Lookup(egressselector.ControlPlane.AsNetworkContext())
		if err != nil {
			return nil, nil, err
		}
		authorizationConfig.CustomDial = egressDialer
	}

	return authorizationConfig.New()
}

func buildServiceResolver(enabledAggregatorRouting bool, hostname string, informer clientgoinformers.SharedInformerFactory) webhook.ServiceResolver {
	var serviceResolver webhook.ServiceResolver
	if enabledAggregatorRouting {
		serviceResolver = aggregatorapiserver.NewEndpointServiceResolver(
			informer.Core().V1().Services().Lister(),
			informer.Core().V1().Endpoints().Lister(),
		)
	} else {
		serviceResolver = aggregatorapiserver.NewClusterIPServiceResolver(
			informer.Core().V1().Services().Lister(),
		)
	}
	// resolve kubernetes.default.svc locally
	if localHost, err := url.Parse(hostname); err == nil {
		serviceResolver = aggregatorapiserver.NewLoopbackServiceResolver(serviceResolver, localHost)
	}
	return serviceResolver
}

func CreateProxyTransport() *http.Transport {
	var proxyDialerFn utilnet.DialFunc
	// Proxying to pods and services is IP-based... don't expect to be able to verify the hostname
	proxyTLSClientConfig := &tls.Config{InsecureSkipVerify: true}
	proxyTransport := utilnet.SetTransportDefaults(&http.Transport{
		DialContext:     proxyDialerFn,
		TLSClientConfig: proxyTLSClientConfig,
	})
	return proxyTransport
}

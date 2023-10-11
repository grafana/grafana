package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"testing"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/openapi"
	"k8s.io/apiserver/pkg/features"
	"k8s.io/apiserver/pkg/registry/generic"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/storage"
	etcd3testing "k8s.io/apiserver/pkg/storage/etcd3/testing"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"
	utilfeature "k8s.io/apiserver/pkg/util/feature"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
	"k8s.io/sample-apiserver/pkg/apiserver"
	"k8s.io/sample-apiserver/pkg/cmd/server"
	sampleopenapi "k8s.io/sample-apiserver/pkg/generated/openapi"
	netutils "k8s.io/utils/net"
)

const (
	DefaultServerPort    = 6443
	DefaultAPIServerIp   = "127.0.0.1"
	DefaultAPIServerHost = "http://" + DefaultAPIServerIp + ":6443"
)

func main() {
	ctx := context.Background()

	if err := run(ctx); err != nil {
		panic(err)
	}
}

func run(ctx context.Context) error {
	o := server.NewWardleServerOptions(os.Stdout, os.Stderr)

	o.RecommendedOptions.Etcd.SkipHealthEndpoints = true
	o.RecommendedOptions.SecureServing.BindAddress = net.ParseIP(DefaultAPIServerIp)
	o.RecommendedOptions.SecureServing.BindPort = DefaultServerPort
	o.RecommendedOptions.SecureServing.ServerCert.CertDirectory = "./certs"

	if err := o.RecommendedOptions.SecureServing.MaybeDefaultWithSelfSignedCerts("localhost", o.AlternateDNS, []net.IP{netutils.ParseIPSloppy("127.0.0.1")}); err != nil {
		return fmt.Errorf("error creating self-signed certificates: %v", err)
	}

	serverConfig := genericapiserver.NewRecommendedConfig(apiserver.Codecs)

	serverConfig.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(sampleopenapi.GetOpenAPIDefinitions, openapi.NewDefinitionNamer(apiserver.Scheme))
	serverConfig.OpenAPIConfig.Info.Title = "Wardle"
	serverConfig.OpenAPIConfig.Info.Version = "0.1"

	if utilfeature.DefaultFeatureGate.Enabled(features.OpenAPIV3) {
		serverConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(sampleopenapi.GetOpenAPIDefinitions, openapi.NewDefinitionNamer(apiserver.Scheme))
		serverConfig.OpenAPIV3Config.Info.Title = "Wardle"
		serverConfig.OpenAPIV3Config.Info.Version = "0.1"
	}

	if err := o.RecommendedOptions.SecureServing.ApplyTo(&serverConfig.SecureServing, &serverConfig.LoopbackClientConfig); err != nil {
		return err
	}
	if err := o.RecommendedOptions.Etcd.ApplyTo(&serverConfig.Config); err != nil {
		return err
	}

	optsGetter := newFakeOptsGetter()
	//optsGetter := jsonstorage.NewRESTOptionsGetter("/tmp/wardle", o.RecommendedOptions.Etcd.StorageConfig)

	serverConfig.RESTOptionsGetter = wrapRESTOptionsGetter(serverConfig.RESTOptionsGetter, optsGetter)

	cfg := &apiserver.Config{
		GenericConfig: serverConfig,
		ExtraConfig:   apiserver.ExtraConfig{},
	}

	completed := cfg.Complete()

	if err := writeKubeConfiguration(completed.GenericConfig.LoopbackClientConfig); err != nil {
		return err
	}

	server, err := completed.New()
	if err != nil {
		return err
	}

	return server.GenericAPIServer.PrepareRun().Run(ctx.Done())
}

func writeKubeConfiguration(restConfig *rest.Config) error {
	clusters := make(map[string]*clientcmdapi.Cluster)
	clusters["default-cluster"] = &clientcmdapi.Cluster{
		Server:                restConfig.Host,
		InsecureSkipTLSVerify: true,
	}

	contexts := make(map[string]*clientcmdapi.Context)
	contexts["default-context"] = &clientcmdapi.Context{
		Cluster:   "default-cluster",
		Namespace: "default",
		AuthInfo:  "default",
	}

	authinfos := make(map[string]*clientcmdapi.AuthInfo)
	authinfos["default"] = &clientcmdapi.AuthInfo{
		ImpersonateUserExtra: map[string][]string{
			"org-id":  []string{"1"},
			"user-id": []string{"1"},
		},
		Username:     restConfig.Username,
		Password:     restConfig.Password,
		AuthProvider: &clientcmdapi.AuthProviderConfig{},
		Exec:         &clientcmdapi.ExecConfig{},
		Extensions:   map[string]runtime.Object{},
	}

	clientConfig := clientcmdapi.Config{
		Kind:           "Config",
		APIVersion:     "v1",
		Clusters:       clusters,
		Contexts:       contexts,
		CurrentContext: "default-context",
		AuthInfos:      authinfos,
	}
	return clientcmd.WriteToFile(clientConfig, "./kubeconfig")
}

type optsGetterWrapper struct {
	original    generic.RESTOptionsGetter
	replacement generic.RESTOptionsGetter
}

func wrapRESTOptionsGetter(original, replacement generic.RESTOptionsGetter) generic.RESTOptionsGetter {
	return &optsGetterWrapper{
		original:    original,
		replacement: replacement,
	}
}

func (o *optsGetterWrapper) GetRESTOptions(gr schema.GroupResource) (generic.RESTOptions, error) {
	a, err := o.original.GetRESTOptions(gr)
	if err != nil {
		return a, err
	}

	b, err := o.replacement.GetRESTOptions(gr)
	if err != nil {
		return b, err
	}

	return generic.RESTOptions{
		StorageConfig: &storagebackend.ConfigForResource{
			Config: storagebackend.Config{
				Type:                      b.StorageConfig.Type,
				Prefix:                    b.StorageConfig.Prefix,
				Transport:                 b.StorageConfig.Transport,
				Paging:                    a.StorageConfig.Paging,
				Codec:                     a.StorageConfig.Codec,
				EncodeVersioner:           a.StorageConfig.EncodeVersioner,
				Transformer:               a.StorageConfig.Transformer,
				CompactionInterval:        b.StorageConfig.CompactionInterval,
				CountMetricPollPeriod:     b.CountMetricPollPeriod,
				DBMetricPollInterval:      b.StorageConfig.DBMetricPollInterval,
				HealthcheckTimeout:        b.StorageConfig.HealthcheckTimeout,
				ReadycheckTimeout:         b.StorageConfig.HealthcheckTimeout,
				LeaseManagerConfig:        b.StorageConfig.LeaseManagerConfig,
				StorageObjectCountTracker: b.StorageConfig.StorageObjectCountTracker,
			},
			GroupResource: gr,
		},
		Decorator:                 b.Decorator,
		EnableGarbageCollection:   b.EnableGarbageCollection,
		DeleteCollectionWorkers:   b.DeleteCollectionWorkers,
		ResourcePrefix:            b.ResourcePrefix,
		CountMetricPollPeriod:     b.CountMetricPollPeriod,
		StorageObjectCountTracker: b.StorageObjectCountTracker,
	}, nil

}

type fakeOptsGetter struct {
	t             *testing.T
	server        *etcd3testing.EtcdTestServer
	storageConfig *storagebackend.Config
}

func (f *fakeOptsGetter) GetRESTOptions(gr schema.GroupResource) (generic.RESTOptions, error) {
	return generic.RESTOptions{
		StorageConfig: f.storageConfig.ForResource(gr),
		Decorator: func(config *storagebackend.ConfigForResource, resourcePrefix string, keyFunc func(obj runtime.Object) (string, error), newFunc func() runtime.Object, newListFunc func() runtime.Object, getAttrsFunc storage.AttrFunc, trigger storage.IndexerFuncs, indexers *cache.Indexers) (storage.Interface, factory.DestroyFunc, error) {
			return factory.Create(*config, newFunc)
		},
		EnableGarbageCollection:   false,
		DeleteCollectionWorkers:   0,
		ResourcePrefix:            "test",
		CountMetricPollPeriod:     0,
		StorageObjectCountTracker: nil,
	}, nil
}

func newFakeOptsGetter() *fakeOptsGetter {
	t := &testing.T{}
	s, storageConfig := etcd3testing.NewUnsecuredEtcd3TestClientServer(t)
	restOptionsGetter := &fakeOptsGetter{
		t:             t,
		server:        s,
		storageConfig: storageConfig,
	}

	return restOptionsGetter
}

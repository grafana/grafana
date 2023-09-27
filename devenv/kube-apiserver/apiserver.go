package main

import (
	"context"
	"net"
	"testing"
	_ "time/tzdata" // for timeZone support in CronJob

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/storage"
	etcd3testing "k8s.io/apiserver/pkg/storage/etcd3/testing"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
	_ "k8s.io/component-base/logs/json/register"          // for JSON log format registration
	_ "k8s.io/component-base/metrics/prometheus/clientgo" // load all the prometheus client-go plugins
	_ "k8s.io/component-base/metrics/prometheus/version"  // for version metric registration
	"k8s.io/kubernetes/cmd/kube-apiserver/app"
	"k8s.io/kubernetes/cmd/kube-apiserver/app/options"
	"k8s.io/kubernetes/pkg/kubeapiserver"
)

const (
	DefaultServerPort    = 6443
	DefaultAPIServerIp   = "127.0.0.1"
	DefaultAPIServerHost = "http://" + DefaultAPIServerIp + ":6443"
)

func main() {
	ctx := context.Background()

	// TODO: add unified storage RESTOptionsGetter here
	optsGetter := newFakeOptsGetter()

	// TODO: this is only needed for the fakeOptsGetter, and can be removed
	defer optsGetter.server.Terminate(optsGetter.t)

	if err := run(ctx, optsGetter); err != nil {
		panic(err)
	}
}

func run(ctx context.Context, optsGetter generic.RESTOptionsGetter) error {
	serverRunOptions := options.NewServerRunOptions()
	serverRunOptions.ServiceClusterIPRanges = "127.0.0.0/24"
	serverRunOptions.GenericServerRunOptions.ExternalHost = DefaultAPIServerHost
	serverRunOptions.Etcd.StorageConfig.Transport.ServerList = []string{"http://127.0.0.1:2379"} // this is needed to pass cli validation
	serverRunOptions.Authentication.ServiceAccounts.Issuers = []string{DefaultAPIServerHost}
	serverRunOptions.Authentication.Anonymous.Allow = false
	serverRunOptions.Authorization.Modes = []string{"AlwaysAllow"}
	serverRunOptions.SecureServing.BindAddress = net.ParseIP(DefaultAPIServerIp)
	serverRunOptions.Authentication.WithBootstrapToken()
	serverRunOptions.SecureServing.BindPort = DefaultServerPort
	serverRunOptions.SecureServing.ServerCert.CertDirectory = "./certs"

	opts, err := serverRunOptions.Complete()
	if err != nil {
		return err
	}
	serverRunOptions.Etcd.StorageConfig.Transport.ServerList = []string{}

	config, err := app.NewConfig(opts)
	if err != nil {
		return err
	}

	if optsGetter != nil {
		config.Aggregator.GenericConfig.RESTOptionsGetter = wrapRESTOptionsGetter(config.Aggregator.GenericConfig.RESTOptionsGetter, optsGetter)
		config.ControlPlane.GenericConfig.RESTOptionsGetter = wrapRESTOptionsGetter(config.ControlPlane.GenericConfig.RESTOptionsGetter, optsGetter)
		config.ApiExtensions.GenericConfig.RESTOptionsGetter = wrapRESTOptionsGetter(config.ApiExtensions.GenericConfig.RESTOptionsGetter, optsGetter)
		config.ApiExtensions.ExtraConfig.CRDRESTOptionsGetter = wrapRESTOptionsGetter(config.ApiExtensions.ExtraConfig.CRDRESTOptionsGetter, optsGetter)

		storageFactoryConfig := kubeapiserver.NewStorageFactoryConfig()
		storageFactoryConfig.APIResourceConfig = config.ControlPlane.GenericConfig.MergedResourceConfig

		// the GroupResource doesn't matter here. we just need the storage config
		restOpts, err := config.ControlPlane.GenericConfig.RESTOptionsGetter.GetRESTOptions(schema.GroupResource{})
		if err != nil {
			return err
		}

		storageFactory, err := storageFactoryConfig.Complete(config.Options.Etcd).New()
		if err != nil {
			return err
		}
		// override the storage config with the one from the RESTOptionsGetter
		storageFactory.StorageConfig = restOpts.StorageConfig.Config
		config.ControlPlane.ExtraConfig.StorageFactory = storageFactory
	}

	completed, err := config.Complete()
	if err != nil {
		return err
	}

	config.Options.Etcd = nil

	server, err := app.CreateServerChain(completed)
	if err != nil {
		return err
	}

	if err := writeKubeConfiguration(server.GenericAPIServer.LoopbackClientConfig); err != nil {
		return err
	}

	prepared, err := server.PrepareRun()
	if err != nil {
		return err
	}

	return prepared.Run(ctx.Done())
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
		Token:    restConfig.BearerToken,
		Username: restConfig.Username,
		Password: restConfig.Password,
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
				Prefix:                    a.StorageConfig.Prefix,
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
		ResourcePrefix:            a.ResourcePrefix,
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

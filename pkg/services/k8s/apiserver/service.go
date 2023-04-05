package apiserver

import (
	"context"
	customStorage "k8s.io/apiextensions-apiserver/pkg/storage"
	"net"
	"path"

	"github.com/go-logr/logr"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/certgenerator"
	"github.com/grafana/grafana/pkg/services/k8s/kine"
	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/apiextensions-apiserver/pkg/registry/customresource"
	"k8s.io/apiextensions-apiserver/pkg/registry/customresourcedefinition"
	serveroptions "k8s.io/apiserver/pkg/server/options"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
	"k8s.io/klog/v2"
	"k8s.io/kubernetes/cmd/kube-apiserver/app"
	"k8s.io/kubernetes/cmd/kube-apiserver/app/options"
	authzmodes "k8s.io/kubernetes/pkg/kubeapiserver/authorizer/modes"
)

const (
	DefaultAPIServerHost = "https://" + certgenerator.DefaultAPIServerIp + ":6443"
)

var (
	_ Service            = (*service)(nil)
	_ RestConfigProvider = (*service)(nil)
)

type Service interface {
	services.NamedService
}

type RestConfigProvider interface {
	GetRestConfig() *rest.Config
}

type service struct {
	*services.BasicService

	etcdProvider kine.EtcdProvider
	restConfig   *rest.Config
	newStorage   customStorage.NewStorageFunc

	dataPath  string
	stopCh    chan struct{}
	stoppedCh chan error
}

func ProvideService(etcdProvider kine.EtcdProvider, cfg *setting.Cfg, newStorage customStorage.NewStorageFunc) (*service, error) {
	s := &service{
		dataPath:     path.Join(cfg.DataPath, "k8s"),
		etcdProvider: etcdProvider,
		stopCh:       make(chan struct{}),
		newStorage:   newStorage,
	}

	s.BasicService = services.NewBasicService(s.start, s.running, nil).WithName(modules.KubernetesAPIServer)

	return s, nil
}

func (s *service) GetRestConfig() *rest.Config {
	return s.restConfig
}

func (s *service) start(ctx context.Context) error {
	customresource.Storage = s.newStorage
	customresourcedefinition.Storage = s.newStorage

	// Get the util to get the paths to pre-generated certs
	certUtil := certgenerator.CertUtil{
		K8sDataPath: s.dataPath,
	}

	serverRunOptions := options.NewServerRunOptions()
	serverRunOptions.Logs.Verbosity = 5
	serverRunOptions.SecureServing.BindAddress = net.ParseIP(certgenerator.DefaultAPIServerIp)

	serverRunOptions.SecureServing.ServerCert.CertKey = serveroptions.CertKey{
		CertFile: certUtil.APIServerCertFile(),
		KeyFile:  certUtil.APIServerKeyFile(),
	}

	serverRunOptions.Authentication.ServiceAccounts.Issuers = []string{DefaultAPIServerHost}
	serverRunOptions.Authentication.WebHook.ConfigFile = "conf/k8s-authn-webhook-config"
	serverRunOptions.Authentication.WebHook.Version = "v1"

	serverRunOptions.Authorization.Modes = []string{authzmodes.ModeRBAC, authzmodes.ModeWebhook}
	serverRunOptions.Authorization.WebhookConfigFile = "conf/k8s-authz-webhook-config"
	serverRunOptions.Authorization.WebhookVersion = "v1"

	etcdConfig := s.etcdProvider.GetConfig()
	serverRunOptions.Etcd.StorageConfig.Transport.ServerList = etcdConfig.Endpoints
	serverRunOptions.Etcd.StorageConfig.Transport.CertFile = etcdConfig.TLSConfig.CertFile
	serverRunOptions.Etcd.StorageConfig.Transport.KeyFile = etcdConfig.TLSConfig.KeyFile
	serverRunOptions.Etcd.StorageConfig.Transport.TrustedCAFile = etcdConfig.TLSConfig.CAFile

	completedOptions, err := app.Complete(serverRunOptions)
	if err != nil {
		return err
	}

	logger := logr.New(newLogAdapter())
	logger.V(1)
	klog.SetLoggerWithOptions(logger, klog.ContextualLogger(true))

	server, err := app.CreateServerChain(completedOptions)
	if err != nil {
		return err
	}

	s.restConfig = server.GenericAPIServer.LoopbackClientConfig
	s.restConfig.Host = DefaultAPIServerHost
	err = s.writeKubeConfiguration(s.restConfig)
	if err != nil {
		return err
	}

	prepared, err := server.PrepareRun()
	if err != nil {
		return err
	}

	go func() {
		s.stoppedCh <- prepared.Run(s.stopCh)
	}()

	return nil
}

func (s *service) running(ctx context.Context) error {
	select {
	case err := <-s.stoppedCh:
		if err != nil {
			return err
		}
	case <-ctx.Done():
		close(s.stopCh)
	}
	return nil
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
	return clientcmd.WriteToFile(clientConfig, path.Join(s.dataPath, "grafana.kubeconfig"))
}

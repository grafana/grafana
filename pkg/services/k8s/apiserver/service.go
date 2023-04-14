package apiserver

import (
	"context"
	"fmt"
	"net"
	"path"

	"github.com/go-logr/logr"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/certgenerator"
	"github.com/grafana/grafana/pkg/services/k8s/kine"
	"github.com/grafana/grafana/pkg/setting"
	serveroptions "k8s.io/apiserver/pkg/server/options"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
	certutil "k8s.io/client-go/util/cert"
	"k8s.io/client-go/util/keyutil"
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

	etcdProvider   kine.EtcdProvider
	restConfig     *rest.Config
	caDataProvider certgenerator.CADataProvider

	dataPath  string
	stopCh    chan struct{}
	stoppedCh chan error
}

func ProvideService(etcdProvider kine.EtcdProvider, caDataProvider certgenerator.CADataProvider, cfg *setting.Cfg) (*service, error) {
	s := &service{
		caDataProvider: caDataProvider,
		dataPath:       path.Join(cfg.DataPath, "k8s"),
		etcdProvider:   etcdProvider,
		stopCh:         make(chan struct{}),
	}

	s.BasicService = services.NewBasicService(s.start, s.running, nil).WithName(modules.KubernetesAPIServer)

	return s, nil
}

func (s *service) GetRestConfig() *rest.Config {
	_ = s.AwaitRunning(context.Background())
	return s.restConfig
}

func (s *service) enableServiceAccountsAuthn(serverRunOptions *options.ServerRunOptions) error {
	tokenSigningCertFile := s.dataPath + "/token-signing.apiserver.crt"
	tokenSigningKeyFile := s.dataPath + "/token-signing.apiserver.key"
	tokenSigningCertExists, _ := certutil.CanReadCertAndKey(tokenSigningCertFile, tokenSigningKeyFile)
	if tokenSigningCertExists == false {
		cert, key, err := certutil.GenerateSelfSignedCertKey(DefaultAPIServerHost, []net.IP{}, []string{})
		if err != nil {
			fmt.Println("Error generating token signing cert")
			return err
		} else {
			certutil.WriteCert(tokenSigningCertFile, cert)
			keyutil.WriteKey(tokenSigningKeyFile, key)
		}
	}

	serverRunOptions.ServiceAccountSigningKeyFile = tokenSigningKeyFile
	serverRunOptions.Authentication.ServiceAccounts.KeyFiles = []string{tokenSigningKeyFile}
	serverRunOptions.Authentication.ServiceAccounts.Issuers = []string{DefaultAPIServerHost}
	serverRunOptions.Authentication.ServiceAccounts.JWKSURI = DefaultAPIServerHost + "/.well-known/openid-configuration"

	return nil
}

func (s *service) start(ctx context.Context) error {
	// Get the util to get the paths to pre-generated certs
	certUtil := certgenerator.CertUtil{
		K8sDataPath: s.dataPath,
	}

	serverRunOptions := options.NewServerRunOptions()
	serverRunOptions.SecureServing.BindAddress = net.ParseIP(certgenerator.DefaultAPIServerIp)

	serverRunOptions.SecureServing.ServerCert.CertKey = serveroptions.CertKey{
		CertFile: certUtil.APIServerCertFile(),
		KeyFile:  certUtil.APIServerKeyFile(),
	}

	err := s.enableServiceAccountsAuthn(serverRunOptions)
	if err != nil {
		return err
	}

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
	logger.V(6)
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
		Server: restConfig.Host,
		// LoopbackConfig CAData from restConfig doesn't get rid of the TLS error with kubectl even when specifying
		// CA data in kubeconfig, likely cuz the certificate that SecureServingWithLoopback default options logic
		// in kube-apiserver creates is just a self-signed one, not originating from a CA
		// Here, we utilize the CADataProvider exposed by certgenerator from which APIServer's PKI is also issued.
		CertificateAuthorityData: s.caDataProvider.GetCAData(),
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

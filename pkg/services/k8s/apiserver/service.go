package apiserver

import (
	"context"
	"path"

	"github.com/go-logr/logr"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/certgenerator"
	"github.com/grafana/grafana/pkg/setting"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
	"k8s.io/klog/v2"
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

	restConfig *rest.Config

	dataPath  string
	stopCh    chan struct{}
	stoppedCh chan error
}

func ProvideService(cfg *setting.Cfg) (*service, error) {
	s := &service{
		dataPath: path.Join(cfg.DataPath, "k8s"),
		stopCh:   make(chan struct{}),
	}

	s.BasicService = services.NewBasicService(s.start, s.running, nil).WithName(modules.KubernetesAPIServer)

	return s, nil
}

func (s *service) GetRestConfig() *rest.Config {
	return s.restConfig
}

func (s *service) start(ctx context.Context) error {
	logger := logr.New(newLogAdapter())
	logger.V(1)
	klog.SetLoggerWithOptions(logger, klog.ContextualLogger(true))

	extensionsConfig, err := createAPIExtensionsConfig(s.dataPath)
	if err != nil {
		return err
	}

	extensionServer, err := createAPIExtensionsServer(&extensionsConfig, genericapiserver.NewEmptyDelegate())
	if err != nil {
		return err
	}

	config, err := createAggregatorConfig(extensionsConfig.GenericConfig.Config)
	if err != nil {
		return err
	}

	server, err := createAggregatorServer(config, extensionServer.GenericAPIServer, extensionServer.Informers)
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
		Server:                restConfig.Host,
		InsecureSkipTLSVerify: restConfig.Insecure,
	}

	contexts := make(map[string]*clientcmdapi.Context)
	contexts["default-context"] = &clientcmdapi.Context{
		Cluster:   "default-cluster",
		Namespace: "default",
		AuthInfo:  "default",
	}

	authinfos := make(map[string]*clientcmdapi.AuthInfo)
	authinfos["default"] = &clientcmdapi.AuthInfo{
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

package apiserver

import (
	"context"
	"path"
	"strconv"
	"strings"

	"github.com/go-logr/logr"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/certgenerator"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"k8s.io/apiextensions-apiserver/pkg/registry/customresource"
	"k8s.io/apiextensions-apiserver/pkg/registry/customresourcedefinition"
	customStorage "k8s.io/apiextensions-apiserver/pkg/storage"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
	"k8s.io/klog/v2"
	aggregator "k8s.io/kube-aggregator/pkg/registry/apiservice/storage"
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
	newStorage customStorage.NewStorageFunc
	rr         routing.RouteRegister

	handler   web.Handler
	dataPath  string
	stopCh    chan struct{}
	stoppedCh chan error
}

func ProvideService(cfg *setting.Cfg, newStorage customStorage.NewStorageFunc, rr routing.RouteRegister) (*service, error) {
	s := &service{
		rr:         rr,
		dataPath:   path.Join(cfg.DataPath, "k8s"),
		stopCh:     make(chan struct{}),
		newStorage: newStorage,
	}

	s.BasicService = services.NewBasicService(s.start, s.running, nil).WithName(modules.KubernetesAPIServer)

	s.rr.Any("/k8s/*", middleware.ReqSignedIn, func(c *contextmodel.ReqContext) {
		if s.handler != nil {
			if handle, ok := s.handler.(func(c *contextmodel.ReqContext)); ok {
				handle(c)
				return
			}
		}
		panic("k8s api handler not added")
	})

	return s, nil
}

func (s *service) GetRestConfig() *rest.Config {
	return s.restConfig
}

func (s *service) start(ctx context.Context) error {
	// Use custom storage for CRDs
	customresource.Storage = s.newStorage
	customresourcedefinition.Storage = s.newStorage
	aggregator.Storage = s.newStorage

	logger := logr.New(newLogAdapter())
	logger.V(5)
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
	err = s.writeKubeConfiguration(s.restConfig)
	if err != nil {
		return err
	}

	prepared, err := server.PrepareRun()
	if err != nil {
		return err
	}

	s.handler = func(c *contextmodel.ReqContext) {
		req := c.Req
		req.URL.Path = strings.TrimPrefix(req.URL.Path, "/k8s")
		ctx := req.Context()
		signedInUser := appcontext.MustUser(ctx)

		req.Header.Set("X-Remote-User", strconv.FormatInt(signedInUser.UserID, 10))
		req.Header.Set("X-Remote-Group", "grafana")
		req.Header.Set("X-Remote-Extra-token-name", signedInUser.Name)
		req.Header.Set("X-Remote-Extra-org-role", string(signedInUser.OrgRole))
		req.Header.Set("X-Remote-Extra-org-id", strconv.FormatInt(signedInUser.OrgID, 10))
		req.Header.Set("X-Remote-Extra-user-id", strconv.FormatInt(signedInUser.UserID, 10))
		prepared.GenericAPIServer.Handler.ServeHTTP(c.Resp, req)
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
		Token: restConfig.BearerToken,
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

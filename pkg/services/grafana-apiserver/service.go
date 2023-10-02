package grafanaapiserver

import (
	"context"
	"crypto/x509"
	"net"
	"path"
	"strconv"
	"strings"

	"github.com/go-logr/logr"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-apiserver/pkg/certgenerator"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/request/headerrequest"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	openapinamer "k8s.io/apiserver/pkg/endpoints/openapi"
	"k8s.io/apiserver/pkg/endpoints/responsewriter"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/apiserver/pkg/util/openapi"
	"k8s.io/client-go/kubernetes/scheme"
	clientrest "k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/registry"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

const (
	DefaultAPIServerHost = "https://" + certgenerator.DefaultAPIServerIp + ":6443"
)

var (
	_ Service                    = (*service)(nil)
	_ RestConfigProvider         = (*service)(nil)
	_ registry.BackgroundService = (*service)(nil)
	_ registry.CanBeDisabled     = (*service)(nil)
)

var (
	Scheme = runtime.NewScheme()
	Codecs = serializer.NewCodecFactory(Scheme)

	unversionedVersion = schema.GroupVersion{Group: "", Version: "v1"}
	unversionedTypes   = []runtime.Object{
		&metav1.Status{},
		&metav1.WatchEvent{},
		&metav1.APIVersions{},
		&metav1.APIGroupList{},
		&metav1.APIGroup{},
		&metav1.APIResourceList{},
	}
)

func init() {
	// we need to add the options to empty v1
	metav1.AddToGroupVersion(Scheme, schema.GroupVersion{Group: "", Version: "v1"})
	Scheme.AddUnversionedTypes(unversionedVersion, unversionedTypes...)
}

type Service interface {
	services.NamedService
	registry.BackgroundService
	registry.CanBeDisabled
}

type APIRegistrar interface {
	RegisterAPI(builder APIGroupBuilder)
}

type RestConfigProvider interface {
	GetRestConfig() *clientrest.Config
}

type service struct {
	*services.BasicService

	restConfig   *clientrest.Config
	etcd_servers []string

	enabled   bool
	dataPath  string
	stopCh    chan struct{}
	stoppedCh chan error

	rr       routing.RouteRegister
	handler  web.Handler
	builders []APIGroupBuilder

	authorizer authorizer.Authorizer
}

func ProvideService(
	cfg *setting.Cfg,
	rr routing.RouteRegister,
	authz authorizer.Authorizer,
) (*service, error) {
	s := &service{
		etcd_servers: cfg.SectionWithEnvOverrides("grafana-apiserver").Key("etcd_servers").Strings(","),
		enabled:      cfg.IsFeatureToggleEnabled(featuremgmt.FlagGrafanaAPIServer),
		rr:           rr,
		dataPath:     path.Join(cfg.DataPath, "k8s"),
		stopCh:       make(chan struct{}),
		builders:     []APIGroupBuilder{},
		authorizer:   authz,
	}

	// This will be used when running as a dskit service
	s.BasicService = services.NewBasicService(s.start, s.running, nil).WithName(modules.GrafanaAPIServer)

	// TODO: this is very hacky
	// We need to register the routes in ProvideService to make sure
	// the routes are registered before the Grafana HTTP server starts.
	s.rr.Group("/k8s", func(k8sRoute routing.RouteRegister) {
		handler := func(c *contextmodel.ReqContext) {
			if s.handler == nil {
				c.Resp.WriteHeader(404)
				_, _ = c.Resp.Write([]byte("Not found"))
				return
			}

			if handle, ok := s.handler.(func(c *contextmodel.ReqContext)); ok {
				handle(c)
				return
			}
		}
		k8sRoute.Any("/", middleware.ReqSignedIn, handler)
		k8sRoute.Any("/*", middleware.ReqSignedIn, handler)
	})

	return s, nil
}

func (s *service) GetRestConfig() *clientrest.Config {
	return s.restConfig
}

func (s *service) IsDisabled() bool {
	return !s.enabled
}

// Run is an adapter for the BackgroundService interface.
func (s *service) Run(ctx context.Context) error {
	if err := s.start(ctx); err != nil {
		return err
	}
	return s.running(ctx)
}

func (s *service) RegisterAPI(builder APIGroupBuilder) {
	s.builders = append(s.builders, builder)
}

func (s *service) start(ctx context.Context) error {
	logger := logr.New(newLogAdapter())
	logger.V(9)
	klog.SetLoggerWithOptions(logger, klog.ContextualLogger(true))

	o := options.NewRecommendedOptions("", unstructured.UnstructuredJSONScheme)
	o.SecureServing.BindPort = 6443
	o.Authentication.RemoteKubeConfigFileOptional = true
	o.Authorization.RemoteKubeConfigFileOptional = true
	o.Etcd.StorageConfig.Transport.ServerList = s.etcd_servers

	o.Admission = nil
	o.CoreAPI = nil
	if len(o.Etcd.StorageConfig.Transport.ServerList) == 0 {
		o.Etcd = nil
	}

	// Get the util to get the paths to pre-generated certs
	certUtil := certgenerator.CertUtil{
		K8sDataPath: s.dataPath,
	}

	if err := certUtil.InitializeCACertPKI(); err != nil {
		return err
	}

	if err := certUtil.EnsureApiServerPKI(certgenerator.DefaultAPIServerIp); err != nil {
		return err
	}

	o.SecureServing.BindAddress = net.ParseIP(certgenerator.DefaultAPIServerIp)
	o.SecureServing.ServerCert.CertKey = options.CertKey{
		CertFile: certUtil.APIServerCertFile(),
		KeyFile:  certUtil.APIServerKeyFile(),
	}

	if err := o.Validate(); len(err) > 0 {
		return err[0]
	}

	serverConfig := genericapiserver.NewRecommendedConfig(Codecs)
	err := o.ApplyTo(serverConfig)
	if err != nil {
		return err
	}

	rootCert, err := certUtil.GetK8sCACert()
	if err != nil {
		return err
	}

	authenticator, err := newAuthenticator(rootCert)
	if err != nil {
		return err
	}

	serverConfig.Authorization.Authorizer = s.authorizer
	serverConfig.Authentication.Authenticator = authenticator

	// Get the list of groups the server will support
	builders := s.builders

	// Install schemas
	for _, b := range builders {
		err = b.InstallSchema(Scheme) // previously was in init
		if err != nil {
			return err
		}
	}

	// Add OpenAPI specs for each group+version
	defsGetter := getOpenAPIDefinitions(builders)
	serverConfig.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(
		openapi.GetOpenAPIDefinitionsWithoutDisabledFeatures(defsGetter),
		openapinamer.NewDefinitionNamer(Scheme, scheme.Scheme))

	serverConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(
		openapi.GetOpenAPIDefinitionsWithoutDisabledFeatures(defsGetter),
		openapinamer.NewDefinitionNamer(Scheme, scheme.Scheme))

	serverConfig.SkipOpenAPIInstallation = false

	// Create the server
	server, err := serverConfig.Complete().New("grafana-apiserver", genericapiserver.NewEmptyDelegate())
	if err != nil {
		return err
	}

	// Install the API Group+version
	for _, b := range builders {
		g, err := b.GetAPIGroupInfo(Scheme, Codecs, serverConfig.RESTOptionsGetter)
		if err != nil {
			return err
		}
		err = server.InstallAPIGroup(g)
		if err != nil {
			return err
		}
	}

	s.restConfig = server.LoopbackClientConfig
	err = s.writeKubeConfiguration(s.restConfig)
	if err != nil {
		return err
	}

	prepared := server.PrepareRun()

	// TODO: this is a hack. see note in ProvideService
	s.handler = func(c *contextmodel.ReqContext) {
		req := c.Req
		req.URL.Path = strings.TrimPrefix(req.URL.Path, "/k8s")
		if req.URL.Path == "" {
			req.URL.Path = "/"
		}
		ctx := req.Context()
		signedInUser := appcontext.MustUser(ctx)

		req.Header.Set("X-Remote-User", strconv.FormatInt(signedInUser.UserID, 10))
		req.Header.Set("X-Remote-Group", "grafana")

		resp := responsewriter.WrapForHTTP1Or2(c.Resp)
		prepared.GenericAPIServer.Handler.ServeHTTP(resp, req)
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

func (s *service) writeKubeConfiguration(restConfig *clientrest.Config) error {
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

func newAuthenticator(cert *x509.Certificate) (authenticator.Request, error) {
	reqHeaderOptions := options.RequestHeaderAuthenticationOptions{
		UsernameHeaders:     []string{"X-Remote-User"},
		GroupHeaders:        []string{"X-Remote-Group"},
		ExtraHeaderPrefixes: []string{"X-Remote-Extra-"},
	}

	requestHeaderAuthenticator, err := headerrequest.New(
		reqHeaderOptions.UsernameHeaders,
		reqHeaderOptions.GroupHeaders,
		reqHeaderOptions.ExtraHeaderPrefixes,
	)
	if err != nil {
		return nil, err
	}

	return requestHeaderAuthenticator, nil
}

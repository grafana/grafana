package grafanaapiserver

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path"
	goruntime "runtime"
	"runtime/debug"
	"strconv"
	"strings"
	"time"

	"github.com/go-logr/logr"
	"github.com/grafana/dskit/services"
	"golang.org/x/mod/semver"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/version"
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
	"k8s.io/component-base/logs"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/registry"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	filestorage "github.com/grafana/grafana/pkg/services/grafana-apiserver/storage/file"
	"github.com/grafana/grafana/pkg/setting"
)

type StorageType string

const (
	StorageTypeFile   StorageType = "file"
	StorageTypeEtcd   StorageType = "etcd"
	StorageTypeLegacy StorageType = "legacy"
)

var (
	_ Service                    = (*service)(nil)
	_ RestConfigProvider         = (*service)(nil)
	_ registry.BackgroundService = (*service)(nil)
	_ registry.CanBeDisabled     = (*service)(nil)

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

type DirectRestConfigProvider interface {
	// GetDirectRestConfig returns a k8s client configuration that will use the same
	// logged logged in user as the current request context.  This is useful when
	// creating clients that map legacy API handlers to k8s backed services
	GetDirectRestConfig(c *contextmodel.ReqContext) *clientrest.Config
}

type service struct {
	*services.BasicService

	config     *config
	restConfig *clientrest.Config

	stopCh    chan struct{}
	stoppedCh chan error

	rr       routing.RouteRegister
	handler  http.Handler
	builders []APIGroupBuilder

	tracing *tracing.TracingService

	authorizer authorizer.Authorizer
}

func ProvideService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	rr routing.RouteRegister,
	authz authorizer.Authorizer,
	tracing *tracing.TracingService,
) (*service, error) {
	s := &service{
		config:     newConfig(cfg, features),
		rr:         rr,
		stopCh:     make(chan struct{}),
		builders:   []APIGroupBuilder{},
		authorizer: authz,
		tracing:    tracing,
	}

	// This will be used when running as a dskit service
	s.BasicService = services.NewBasicService(s.start, s.running, nil).WithName(modules.GrafanaAPIServer)

	// TODO: this is very hacky
	// We need to register the routes in ProvideService to make sure
	// the routes are registered before the Grafana HTTP server starts.
	proxyHandler := func(k8sRoute routing.RouteRegister) {
		handler := func(c *contextmodel.ReqContext) {
			if s.handler == nil {
				c.Resp.WriteHeader(404)
				_, _ = c.Resp.Write([]byte("Not found"))
				return
			}

			req := c.Req
			if req.URL.Path == "" {
				req.URL.Path = "/"
			}

			//TODO: add support for the existing MetricsEndpointBasicAuth config option
			if req.URL.Path == "/apiserver-metrics" {
				req.URL.Path = "/metrics"
			}

			ctx := req.Context()
			signedInUser := appcontext.MustUser(ctx)

			req.Header.Set("X-Remote-User", strconv.FormatInt(signedInUser.UserID, 10))
			req.Header.Set("X-Remote-Group", "grafana")

			resp := responsewriter.WrapForHTTP1Or2(c.Resp)
			s.handler.ServeHTTP(resp, req)
		}
		k8sRoute.Any("/", middleware.ReqSignedIn, handler)
		k8sRoute.Any("/*", middleware.ReqSignedIn, handler)
	}

	s.rr.Group("/apis", proxyHandler)
	s.rr.Group("/apiserver-metrics", proxyHandler)
	s.rr.Group("/openapi", proxyHandler)

	return s, nil
}

func (s *service) GetRestConfig() *clientrest.Config {
	return s.restConfig
}

func (s *service) IsDisabled() bool {
	return !s.config.enabled
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
	logger := logr.New(newLogAdapter(s.config.logLevel))
	klog.SetLoggerWithOptions(logger, klog.ContextualLogger(true))
	if _, err := logs.GlogSetter(strconv.Itoa(s.config.logLevel)); err != nil {
		logger.Error(err, "failed to set log level")
	}

	// Get the list of groups the server will support
	builders := s.builders

	groupVersions := make([]schema.GroupVersion, 0, len(builders))
	// Install schemas
	for _, b := range builders {
		groupVersions = append(groupVersions, b.GetGroupVersion())
		if err := b.InstallSchema(Scheme); err != nil {
			return err
		}
	}

	o := options.NewRecommendedOptions("/registry/grafana.app", Codecs.LegacyCodec(groupVersions...))
	o.SecureServing.BindAddress = s.config.ip
	o.SecureServing.BindPort = s.config.port
	o.Authentication.RemoteKubeConfigFileOptional = true
	o.Authorization.RemoteKubeConfigFileOptional = true

	o.Admission = nil
	o.CoreAPI = nil

	serverConfig := genericapiserver.NewRecommendedConfig(Codecs)
	serverConfig.ExternalAddress = s.config.host

	if s.config.devMode {
		// SecureServingOptions is used when the apiserver needs it's own listener.
		// this is not needed in production, but it's useful for development kubectl access.
		if err := o.SecureServing.ApplyTo(&serverConfig.SecureServing, &serverConfig.LoopbackClientConfig); err != nil {
			return err
		}
		// AuthenticationOptions is needed to authenticate requests from kubectl in dev mode.
		if err := o.Authentication.ApplyTo(&serverConfig.Authentication, serverConfig.SecureServing, serverConfig.OpenAPIConfig); err != nil {
			return err
		}
	} else {
		// In production mode, override ExternalAddress and LoopbackClientConfig.
		// In dev mode we want to use the loopback client config
		// and address provided by SecureServingOptions.
		serverConfig.ExternalAddress = s.config.host
		serverConfig.LoopbackClientConfig = &clientrest.Config{
			Host: s.config.apiURL,
			TLSClientConfig: clientrest.TLSClientConfig{
				Insecure: true,
			},
		}
	}

	if s.config.storageType == StorageTypeEtcd {
		o.Etcd.StorageConfig.Transport.ServerList = s.config.etcdServers
		if err := o.Etcd.Validate(); len(err) > 0 {
			return err[0]
		}
		if err := o.Etcd.ApplyTo(&serverConfig.Config); err != nil {
			return err
		}
	}

	if s.config.storageType == StorageTypeFile {
		serverConfig.RESTOptionsGetter = filestorage.NewRESTOptionsGetter(s.config.dataPath, o.Etcd.StorageConfig)
	}

	serverConfig.Authorization.Authorizer = s.authorizer
	serverConfig.TracerProvider = s.tracing.GetTracerProvider()

	// Add OpenAPI specs for each group+version
	defsGetter := getOpenAPIDefinitions(builders)
	serverConfig.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(
		openapi.GetOpenAPIDefinitionsWithoutDisabledFeatures(defsGetter),
		openapinamer.NewDefinitionNamer(Scheme, scheme.Scheme))

	serverConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(
		openapi.GetOpenAPIDefinitionsWithoutDisabledFeatures(defsGetter),
		openapinamer.NewDefinitionNamer(Scheme, scheme.Scheme))

	// Add the custom routes to service discovery
	serverConfig.OpenAPIV3Config.PostProcessSpec3 = getOpenAPIPostProcessor(builders)

	// Set the swagger build versions
	serverConfig.OpenAPIConfig.Info.Version = setting.BuildVersion
	serverConfig.OpenAPIV3Config.Info.Version = setting.BuildVersion

	serverConfig.SkipOpenAPIInstallation = false
	serverConfig.BuildHandlerChainFunc = func(delegateHandler http.Handler, c *genericapiserver.Config) http.Handler {
		// Call DefaultBuildHandlerChain on the main entrypoint http.Handler
		// See https://github.com/kubernetes/apiserver/blob/v0.28.0/pkg/server/config.go#L906
		// DefaultBuildHandlerChain provides many things, notably CORS, HSTS, cache-control, authz and latency tracking
		requestHandler, err := getAPIHandler(
			delegateHandler,
			c.LoopbackClientConfig,
			builders)
		if err != nil {
			panic(fmt.Sprintf("could not build handler chain func: %s", err.Error()))
		}
		return genericapiserver.DefaultBuildHandlerChain(requestHandler, c)
	}

	k8sVersion, err := getK8sApiserverVersion()
	if err != nil {
		return err
	}
	before, after, _ := strings.Cut(setting.BuildVersion, ".")
	serverConfig.Version = &version.Info{
		Major:        before,
		Minor:        after,
		GoVersion:    goruntime.Version(),
		Platform:     fmt.Sprintf("%s/%s", goruntime.GOOS, goruntime.GOARCH),
		Compiler:     goruntime.Compiler,
		GitTreeState: setting.BuildBranch,
		GitCommit:    setting.BuildCommit,
		BuildDate:    time.Unix(setting.BuildStamp, 0).UTC().Format(time.DateTime),
		GitVersion:   k8sVersion,
	}

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
		if g == nil || len(g.PrioritizedVersions) < 1 {
			continue
		}
		err = server.InstallAPIGroup(g)
		if err != nil {
			return err
		}
	}

	// Used by the proxy wrapper registered in ProvideService
	s.handler = server.Handler
	s.restConfig = server.LoopbackClientConfig

	// When running in production, do not start a standalone https server
	if !s.config.devMode {
		return nil
	}

	// only write kubeconfig in dev mode
	if err := s.ensureKubeConfig(); err != nil {
		return err
	}

	prepared := server.PrepareRun()
	go func() {
		s.stoppedCh <- prepared.Run(s.stopCh)
	}()
	return nil
}

func (s *service) GetDirectRestConfig(c *contextmodel.ReqContext) *clientrest.Config {
	return &clientrest.Config{
		Transport: &roundTripperFunc{
			fn: func(req *http.Request) (*http.Response, error) {
				ctx := appcontext.WithUser(req.Context(), c.SignedInUser)
				w := httptest.NewRecorder()
				s.handler.ServeHTTP(w, req.WithContext(ctx))
				return w.Result(), nil
			},
		},
	}
}

func (s *service) running(ctx context.Context) error {
	// skip waiting for the server in prod mode
	if !s.config.devMode {
		<-ctx.Done()
		return nil
	}

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

func (s *service) ensureKubeConfig() error {
	clusters := make(map[string]*clientcmdapi.Cluster)
	clusters["default-cluster"] = &clientcmdapi.Cluster{
		Server:                s.restConfig.Host,
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
		Token: s.restConfig.BearerToken,
	}

	clientConfig := clientcmdapi.Config{
		Kind:           "Config",
		APIVersion:     "v1",
		Clusters:       clusters,
		Contexts:       contexts,
		CurrentContext: "default-context",
		AuthInfos:      authinfos,
	}

	return clientcmd.WriteToFile(clientConfig, path.Join(s.config.dataPath, "grafana.kubeconfig"))
}

type roundTripperFunc struct {
	fn func(req *http.Request) (*http.Response, error)
}

func (f *roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f.fn(req)
}

// find the k8s version according to build info
func getK8sApiserverVersion() (string, error) {
	bi, ok := debug.ReadBuildInfo()
	if !ok {
		return "", fmt.Errorf("debug.ReadBuildInfo() failed")
	}

	for _, dep := range bi.Deps {
		if dep.Path == "k8s.io/apiserver" {
			if !semver.IsValid(dep.Version) {
				return "", fmt.Errorf("invalid semantic version for k8s.io/apiserver")
			}
			// v0 => v1
			majorVersion := strings.TrimPrefix(semver.Major(dep.Version), "v")
			majorInt, err := strconv.Atoi(majorVersion)
			if err != nil {
				return "", fmt.Errorf("could not convert majorVersion to int. majorVersion: %s", majorVersion)
			}
			newMajor := fmt.Sprintf("v%d", majorInt+1)
			return strings.Replace(dep.Version, semver.Major(dep.Version), newMajor, 1), nil
		}
	}

	return "", fmt.Errorf("could not find k8s.io/apiserver in build info")
}

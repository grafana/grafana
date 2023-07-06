package apiserver

import (
	"context"
	"crypto/x509"
	"net"
	"os"
	"path"
	"strconv"

	"cuelang.org/go/pkg/strings"
	"github.com/go-logr/logr"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-apiserver/pkg/apis/kinds/install"
	kindsv1 "github.com/grafana/grafana-apiserver/pkg/apis/kinds/v1"
	grafanaapiserveroptions "github.com/grafana/grafana-apiserver/pkg/cmd/server/options"
	"github.com/grafana/grafana/pkg/registry/corekind"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/request/headerrequest"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/responsewriter"
	genericregistry "k8s.io/apiserver/pkg/registry/generic"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/certgenerator"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	grafanaAdmission "github.com/grafana/grafana/pkg/services/k8s/apiserver/admission"
	"github.com/grafana/grafana/pkg/services/k8s/apiserver/authorization"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
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
	rr         routing.RouteRegister

	corereg *corekind.Base

	restOptionsGetter func(runtime.Codec) genericregistry.RESTOptionsGetter

	handler   web.Handler
	dataPath  string
	stopCh    chan struct{}
	stoppedCh chan error
}

func ProvideService(cfg *setting.Cfg, rr routing.RouteRegister, restOptionsGetter func(runtime.Codec) genericregistry.RESTOptionsGetter, reg *corekind.Base) (*service, error) {
	s := &service{
		rr:                rr,
		dataPath:          path.Join(cfg.DataPath, "k8s"),
		stopCh:            make(chan struct{}),
		restOptionsGetter: restOptionsGetter,
		corereg:           reg,
	}

	s.BasicService = services.NewBasicService(s.start, s.running, nil).WithName(modules.KubernetesAPIServer)

	s.rr.Group("/k8s", func(k8sRoute routing.RouteRegister) {
		handler := func(c *contextmodel.ReqContext) {
			if s.handler != nil {
				if handle, ok := s.handler.(func(c *contextmodel.ReqContext)); ok {
					handle(c)
					return
				}
			}
			panic("k8s api handler not added")
		}
		k8sRoute.Any("/", middleware.ReqSignedIn, handler)
		k8sRoute.Any("/*", middleware.ReqSignedIn, handler)
	})

	return s, nil
}

var (
	Scheme = runtime.NewScheme()
	Codecs = serializer.NewCodecFactory(Scheme)

	// if you modify this, make sure you update the crEncoder
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
	install.Install(Scheme)

	// we need to add the options to empty v1
	metav1.AddToGroupVersion(Scheme, schema.GroupVersion{Group: "", Version: "v1"})

	Scheme.AddUnversionedTypes(unversionedVersion, unversionedTypes...)
}

func (s *service) GetRestConfig() *rest.Config {
	return s.restConfig
}

func (s *service) start(ctx context.Context) error {
	logger := logr.New(newLogAdapter())
	logger.V(10)
	klog.SetLoggerWithOptions(logger, klog.ContextualLogger(true))

	o := grafanaapiserveroptions.NewGrafanaAPIServerOptions(os.Stdout, os.Stderr)
	o.RecommendedOptions.SecureServing.BindPort = 6443
	o.RecommendedOptions.Authentication.RemoteKubeConfigFileOptional = true
	o.RecommendedOptions.Authorization.RemoteKubeConfigFileOptional = true
	o.RecommendedOptions.Authorization.AlwaysAllowPaths = []string{"*"}
	o.RecommendedOptions.Authorization.AlwaysAllowGroups = []string{user.SystemPrivilegedGroup, "grafana"}
	o.RecommendedOptions.Etcd = nil

	if true { // standalone
		o.RecommendedOptions.CoreAPI = nil
	} else {
		// TODO... currently need ext-api registered manually:
		// https://github.com/grafana/grafana-apiserver/blob/main/deploy/local-darwin/service.yaml
		// for now, easiest setup is checkout:
		// - https://github.com/grafana/grafana-apiserver
		// - run tilt up
		// - then quit
		// verify exists:
		// kubectl get service ext-api -n grafana
		o.RecommendedOptions.CoreAPI.CoreAPIKubeconfigPath = "/Users/ryan/.kube/config"
	}

	// this currently only will work for standalone mode. we are removing all default enabled plugins
	// and replacing them with our internal admission plugins. this avoids issues with the default admission
	// plugins that depend on the Core V1 APIs and informers.
	o.RecommendedOptions.Admission.Plugins = admission.NewPlugins()
	grafanaAdmission.RegisterDenyByName(o.RecommendedOptions.Admission.Plugins)
	grafanaAdmission.RegisterSchemaValidate(o.RecommendedOptions.Admission.Plugins, s.corereg)
	grafanaAdmission.RegisterAddDefaultFields(o.RecommendedOptions.Admission.Plugins)
	o.RecommendedOptions.Admission.RecommendedPluginOrder = []string{grafanaAdmission.PluginNameDenyByName, grafanaAdmission.PluginNameSchemaTranslate, grafanaAdmission.PluginNameSchemaValidate, grafanaAdmission.PluginNameAddDefaultFields}
	o.RecommendedOptions.Admission.DisablePlugins = append([]string{}, o.RecommendedOptions.Admission.EnablePlugins...)
	o.RecommendedOptions.Admission.EnablePlugins = []string{grafanaAdmission.PluginNameDenyByName, grafanaAdmission.PluginNameSchemaTranslate, grafanaAdmission.PluginNameSchemaValidate, grafanaAdmission.PluginNameAddDefaultFields}

	// Get the util to get the paths to pre-generated certs
	certUtil := certgenerator.CertUtil{
		K8sDataPath: s.dataPath,
	}

	o.RecommendedOptions.SecureServing.BindAddress = net.ParseIP(certgenerator.DefaultAPIServerIp)
	o.RecommendedOptions.SecureServing.ServerCert.CertKey = options.CertKey{
		CertFile: certUtil.APIServerCertFile(),
		KeyFile:  certUtil.APIServerKeyFile(),
	}

	if err := o.Complete(); err != nil {
		return err
	}

	if err := o.Validate(); err != nil {
		return err
	}

	serverConfig, err := o.Config()
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

	authorizer, err := newAuthorizer()
	if err != nil {
		return err
	}

	serverConfig.ExtraConfig.RESTOptionsGetter = s.restOptionsGetter(unstructured.UnstructuredJSONScheme)
	serverConfig.GenericConfig.RESTOptionsGetter = s.restOptionsGetter(Codecs.LegacyCodec(kindsv1.SchemeGroupVersion))
	serverConfig.GenericConfig.Config.RESTOptionsGetter = s.restOptionsGetter(Codecs.LegacyCodec(kindsv1.SchemeGroupVersion))

	serverConfig.GenericConfig.Authentication.Authenticator = authenticator
	serverConfig.GenericConfig.Authorization.Authorizer = authorizer

	server, err := serverConfig.Complete().New(genericapiserver.NewEmptyDelegate())
	if err != nil {
		return err
	}

	s.restConfig = server.GenericAPIServer.LoopbackClientConfig
	err = s.writeKubeConfiguration(s.restConfig)
	if err != nil {
		return err
	}

	prepared := server.GenericAPIServer.PrepareRun()

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
		req.Header.Set("X-Remote-Extra-token-name", signedInUser.Name)
		req.Header.Set("X-Remote-Extra-org-role", string(signedInUser.OrgRole))
		req.Header.Set("X-Remote-Extra-org-id", strconv.FormatInt(signedInUser.OrgID, 10))
		req.Header.Set("X-Remote-Extra-user-id", strconv.FormatInt(signedInUser.UserID, 10))

		resp := responsewriter.WrapForHTTP1Or2(c.Resp)
		prepared.GenericAPIServer.Handler.ServeHTTP(resp, req)
	}

	go func() {
		s.stoppedCh <- prepared.Run(s.stopCh)
	}()

	<-prepared.MuxAndDiscoveryCompleteSignals()["GrafanaKindDiscoveryReady"]

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

func newAuthorizer() (authorizer.Authorizer, error) {
	return authorization.NewGrafanaAuthorizer(), nil
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

package grafanaapiserver

import (
	"context"
	"crypto/x509"
	"net"
	"os"
	"path"

	"github.com/go-logr/logr"
	"github.com/grafana/dskit/services"
	grafanaapiserveroptions "github.com/grafana/grafana-apiserver/pkg/cmd/server/options"
	"github.com/grafana/grafana/pkg/modules"
	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/request/headerrequest"
	"k8s.io/apiserver/pkg/authentication/user"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana-apiserver/pkg/certgenerator"
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

func New(dataPath string) (*service, error) {
	s := &service{
		dataPath: dataPath,
		stopCh:   make(chan struct{}),
	}

	s.BasicService = services.NewBasicService(s.start, s.running, nil).WithName(modules.GrafanaAPIServer)

	return s, nil
}

func (s *service) GetRestConfig() *rest.Config {
	return s.restConfig
}

func (s *service) start(ctx context.Context) error {
	logger := logr.New(newLogAdapter())
	logger.V(9)
	klog.SetLoggerWithOptions(logger, klog.ContextualLogger(true))

	o := grafanaapiserveroptions.NewGrafanaAPIServerOptions(os.Stdout, os.Stderr)
	o.RecommendedOptions.SecureServing.BindPort = 6443
	o.RecommendedOptions.Authentication.RemoteKubeConfigFileOptional = true
	o.RecommendedOptions.Authorization.RemoteKubeConfigFileOptional = true
	o.RecommendedOptions.Authorization.AlwaysAllowPaths = []string{"*"}
	o.RecommendedOptions.Authorization.AlwaysAllowGroups = []string{user.SystemPrivilegedGroup, "grafana"}
	o.RecommendedOptions.Etcd = nil
	o.RecommendedOptions.CoreAPI = nil

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

	serverConfig.GenericConfig.Authentication.Authenticator = authenticator

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

	// TODO: not sure if we can still inject RouteRegister with the new module server setup
	// Disabling the /k8s endpoint until we have a solution

	/* handler := func(c *contextmodel.ReqContext) {
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
	/* s.rr.Group("/k8s", func(k8sRoute routing.RouteRegister) {
		k8sRoute.Any("/", middleware.ReqSignedIn, handler)
		k8sRoute.Any("/*", middleware.ReqSignedIn, handler)
	}) */

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

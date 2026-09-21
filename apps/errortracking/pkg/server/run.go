package server

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"

	"k8s.io/apiserver/pkg/authorization/authorizer"
	requestcontext "k8s.io/apiserver/pkg/endpoints/request"
	genericapiserver "k8s.io/apiserver/pkg/server"
	genericoptions "k8s.io/apiserver/pkg/server/options"
	"k8s.io/apiserver/pkg/util/compatibility"

	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"

	"github.com/grafana/grafana/apps/errortracking/pkg/storage"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func Run(ctx context.Context, config Config) error {
	store, err := storage.NewStore(os.Getenv("ERROR_TRACKING_DATABASE_URL"), config.Database.MaxConnections)
	if err != nil {
		return err
	}
	defer store.Close()

	accessClient, authzConnection, err := newAuthzClient(config)
	if err != nil {
		return err
	}
	defer func() { _ = authzConnection.Close() }()

	installer, err := NewAppInstaller(store, accessClient)
	if err != nil {
		return fmt.Errorf("create error tracking app: %w", err)
	}
	apiConfig, err := appsdkapiserver.NewConfig([]appsdkapiserver.AppInstaller{installer})
	if err != nil {
		return fmt.Errorf("create API server config: %w", err)
	}

	secureServing := genericoptions.NewSecureServingOptions().WithLoopback()
	secureServing.BindAddress = net.ParseIP(config.Server.BindAddress)
	if secureServing.BindAddress == nil {
		return fmt.Errorf("server.bindAddress must be an IP address")
	}
	secureServing.BindPort = config.Server.SecurePort
	secureServing.ServerCert.CertKey.CertFile = config.Server.CertFile
	secureServing.ServerCert.CertKey.KeyFile = config.Server.KeyFile
	secureServing.Required = true
	if err := secureServing.ApplyToConfig(&apiConfig.Generic.Config); err != nil {
		return fmt.Errorf("configure HTTPS serving: %w", err)
	}

	apiConfig.Generic.Authentication.Authenticator = newRequestAuthenticator(config)
	apiConfig.Generic.Authentication.APIAudiences = []string{Audience}
	apiConfig.Generic.Authorization.Authorizer = withRequesterAuthorization(installer.GetAuthorizer())
	apiConfig.Generic.BuildHandlerChainFunc = func(handler http.Handler, serverConfig *genericapiserver.Config) http.Handler {
		return genericapiserver.DefaultBuildHandlerChain(requesterHandler{next: handler}, serverConfig)
	}

	auditOptions := genericoptions.NewAuditOptions()
	auditOptions.PolicyFile = config.Audit.PolicyFile
	auditOptions.LogOptions.Path = config.Audit.LogPath
	if err := auditOptions.ApplyTo(&apiConfig.Generic.Config); err != nil {
		return fmt.Errorf("configure audit logging: %w", err)
	}

	apiConfig.UpdateOpenAPIConfig()
	apiServer, err := newRouteServer(apiConfig, installer)
	if err != nil {
		return fmt.Errorf("create API server: %w", err)
	}
	if err := apiServer.PrepareRun().RunWithContext(ctx); err != nil {
		return fmt.Errorf("run API server: %w", err)
	}
	return nil
}

// newRouteServer installs this route-only app without starting an app runner:
// it has custom HTTP routes and no controllers or other background work.
func newRouteServer(config *appsdkapiserver.Config, installer appsdkapiserver.AppInstaller) (*genericapiserver.GenericAPIServer, error) {
	loopbackConfig := *config.Generic.LoopbackClientConfig
	loopbackConfig.APIPath = "/apis"
	if err := installer.InitializeApp(loopbackConfig); err != nil {
		return nil, err
	}
	config.Generic.EffectiveVersion = compatibility.DefaultBuildEffectiveVersion()
	server, err := config.Generic.Complete().New("error-tracking", genericapiserver.NewEmptyDelegate())
	if err != nil {
		return nil, err
	}
	if err := installer.InstallAPIs(appsdkapiserver.NewKubernetesGenericAPIServer(server), config.Generic.RESTOptionsGetter); err != nil {
		return nil, err
	}
	return server, nil
}

// withRequesterAuthorization makes the authenticated identity available through
// both the Kubernetes and Grafana context APIs before the app authorizer runs.
func withRequesterAuthorization(delegate authorizer.Authorizer) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(ctx context.Context, attributes authorizer.Attributes) (authorizer.Decision, string, error) {
		if (attributes.GetVerb() == "get" || attributes.GetVerb() == "head") && isPublicPath(attributes.GetPath()) {
			return authorizer.DecisionAllow, "", nil
		}
		requester, ok := attributes.GetUser().(identity.Requester)
		if !ok {
			return authorizer.DecisionDeny, "authenticated Grafana identity is required", nil
		}
		return delegate.Authorize(identity.WithRequester(ctx, requester), attributes)
	})
}

type requesterHandler struct{ next http.Handler }

func (h requesterHandler) ServeHTTP(response http.ResponseWriter, request *http.Request) {
	user, ok := requestcontext.UserFrom(request.Context())
	if requester, isRequester := user.(identity.Requester); ok && isRequester {
		request = request.WithContext(identity.WithRequester(request.Context(), requester))
	}
	h.next.ServeHTTP(response, request)
}

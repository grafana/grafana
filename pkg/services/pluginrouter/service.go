package pluginrouter

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin/pluginroute"
	searchapi "github.com/grafana/grafana/pkg/registry/apis/search"
	"github.com/grafana/grafana/pkg/router"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// readyPollInterval is how often the shared /readyz is brought in step with the
// router's readiness. The router has no readiness event to subscribe to -- its
// state changes on a reconcile it runs on its own goroutine -- so this polls.
const readyPollInterval = time.Second

// Service runs the Grafana router over the locally installed app plugins, as a
// dskit module.
//
// It owns the two halves the router deliberately does not: the RoutesLoader
// that says what to serve (Loader, in this package) and the handler mounted in
// front of it. GrafanaRouter itself is only the reconcile engine.
//
// It does not own a listener. This target already runs one HTTP server -- the
// instrumentation server, on the ordinary http_addr and http_port -- so the
// router mounts onto its router rather than opening a second port with a second
// address to configure. /apis and /openapi/v3 are served there alongside
// /metrics and the health endpoints.
type Service struct {
	*services.BasicService

	log    log.Logger
	router *router.GrafanaRouter

	// ready is how this module reports into the shared /readyz, which is
	// answered by the instrumentation server, not here.
	ready readyNotifier

	// login is the sign-in gate in front of the identity. Every request that
	// reaches a group goes through it.
	login *loginGate

	// plugins loads the plugins and starts their backends. It is run as a
	// subservice so the backends come up before the router serves their groups
	// and are torn down with this module.
	plugins *pluginstore.Service
}

// readyNotifier is the part of the module server's health notifier this
// service uses: it flips /readyz once the router has a routing table.
type readyNotifier interface {
	SetReady()
	SetNotReady()
}

// ProvideService builds the module: the plugin sources to discover groups in,
// the router over them, and the routes it serves on the shared HTTP server.
//
// The storage client is passed in rather than built here, because how this
// process reaches unified storage is a property of the process, not of the
// router: run as a monolith target it shares the backend the unified-backend
// module already built, and pointed at a remote storage server it dials one.
func ProvideService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	tracer tracing.Tracer,
	reg prometheus.Registerer,
	client resource.ResourceClient,
	httpRouter *mux.Router,
	ready readyNotifier,
	license licensing.Licensing,
	deps PluginDeps,
) (*Service, error) {
	logger := log.New("plugin-router")

	// A signed-in caller here runs as Grafana's service identity, with full
	// access to every group served, because there is no access control in this
	// process to ask anything narrower of. That is a development posture, so
	// the target refuses to run anywhere else rather than leaving the decision
	// to a config key someone could set in the wrong place.
	if cfg.Env != setting.Dev {
		return nil, fmt.Errorf("the plugin router serves every group to whoever signs in, and only runs when app_mode is %q", setting.Dev)
	}
	if client == nil {
		return nil, fmt.Errorf("a unified storage client is required to serve plugin kinds")
	}
	if httpRouter == nil {
		return nil, fmt.Errorf("an http router is required to serve the plugin groups on")
	}

	apiserverCfg := cfg.SectionWithEnvOverrides(searchapi.ConfigSection)
	loader, err := NewLoader(LoaderOptions{
		// The sources the plugin store loaded from, so the groups served are
		// the plugins that are actually running -- not a second, independent
		// reading of the same directories. NewLoader refuses a nil registry.
		Sources:         deps.Sources,
		ClientV3Loader:  deps.ClientV3Loader,
		PluginClient:    deps.Client,
		ContextProvider: deps.ContextProvider,
		PluginSettings:  deps.PluginSettings,
		DualWrite:       deps.DualWrite,
		// The same per-resource config a Grafana server reads its dual write
		// modes from, straight off the ini.
		StorageOpts: &options.StorageOptions{UnifiedStorageConfig: cfg.UnifiedStorage},
		// Secure values are decrypted by a service this process does not have,
		// so a kind with inline secure values cannot be read yet.
		Storage:          pluginroute.UnifiedStorage(client, nil),
		Search:           client,
		Tracer:           tracer,
		Features:         features,
		MetricsRegister:  reg,
		BuildVersion:     cfg.BuildVersion,
		SearchAPIEnabled: apiserverCfg.Key(searchapi.ConfigKey).MustBool(true),
		TrashAPIEnabled:  apiserverCfg.Key(searchapi.ConfigKeyTrash).MustBool(true),
		Authorizer:       serviceIdentityAuthorizer(),
	})
	if err != nil {
		return nil, err
	}

	gate, err := newLoginGate(cfg, deps.Authn, logger)
	if err != nil {
		return nil, err
	}
	gate.register(httpRouter)

	s := &Service{
		log:     logger,
		router:  router.NewGrafanaRouter(loader),
		ready:   ready,
		login:   gate,
		plugins: deps.Store,
	}
	s.registerRoutes(httpRouter)
	newSwaggerUI(cfg, license).register(httpRouter)
	s.BasicService = services.NewBasicService(s.start, s.running, s.stop).WithName("plugin-router")
	return s, nil
}

// registerRoutes mounts the router's tree on the shared HTTP server.
//
// The two prefixes are the ones GrafanaRouter owns; everything else on that
// server (metrics, health, the API navigator) is somebody else's, so this must
// not mount at the root. Requests for a group the router does not serve fall
// through to the shared router's own not-found rather than being answered here.
func (s *Service) registerRoutes(httpRouter *mux.Router) {
	handler := s.login.middleware(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		s.router.HandleFunc(w, req, http.NotFoundHandler())
	}))

	for _, prefix := range []string{"/apis", "/openapi/v3"} {
		httpRouter.PathPrefix(prefix).Handler(handler)
	}

	// An exact match, not a prefix: this router also carries /metrics and the
	// health endpoints, and a prefix at / would answer for them too.
	httpRouter.Path("/").HandlerFunc(s.redirectRoot)
}

// redirectRoot sends a browser to the API navigator, or to the sign-in form
// first when the caller has not been through it. The navigator itself is left
// reachable either way: it is a page that reads APIs which answer 401 on their
// own, not a thing to protect.
func (s *Service) redirectRoot(w http.ResponseWriter, req *http.Request) {
	target := "/swagger"
	if s.login.authenticated(req) == nil {
		target = "/login"
	}
	http.Redirect(w, req, target, http.StatusFound)
}

// start runs the reconcile loop, then reports readiness once the router has a
// routing table to serve from.
func (s *Service) start(ctx context.Context) error {
	// Before the router, so the groups it builds have backends to reach. The
	// store loads eagerly in its constructor unless the store-service feature
	// is on, in which case this is what loads them.
	if s.plugins != nil {
		if err := services.StartAndAwaitRunning(ctx, s.plugins); err != nil {
			return fmt.Errorf("starting the plugin store: %w", err)
		}
	}

	if err := s.router.Run(ctx); err != nil {
		return fmt.Errorf("starting router: %w", err)
	}

	s.log.Info("serving app plugin API groups; sign in at /login with the configured admin " +
		"credentials, which grants full access to every group served")
	return nil
}

// running holds the module open and keeps the shared /readyz in step with the
// router's own readiness, which only becomes true once a group has loaded.
func (s *Service) running(ctx context.Context) error {
	ticker := time.NewTicker(readyPollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			s.reportReady(ctx)
		}
	}
}

func (s *Service) reportReady(ctx context.Context) {
	if s.ready == nil {
		return
	}
	if err := s.router.Ready(ctx); err != nil {
		s.ready.SetNotReady()
		return
	}
	s.ready.SetReady()
}

func (s *Service) stop(failureReason error) error {
	s.log.Info("stopping plugin router", "reason", failureReason)
	if s.ready != nil {
		s.ready.SetNotReady()
	}
	if s.plugins == nil {
		return nil
	}
	// Stopping the store terminates the plugin backends it started.
	return services.StopAndAwaitTerminated(context.Background(), s.plugins)
}

// serviceIdentityAuthorizer is how the groups this process serves authorize a
// caller.
//
// Their own authorizer asks Grafana's access control whether the caller may
// reach that plugin, and there is no access control in this process to ask, so
// leaving it in place denies every request. A caller that signed in arrives as
// the service identity, and the check it would run has no user to run against;
// this stands in with the narrowest thing that is still true -- the service
// identity, and nothing else. A caller that did not sign in never becomes one,
// so it is still refused here.
func serviceIdentityAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, _ authorizer.Attributes) (authorizer.Decision, string, error) {
			authInfo, ok := claims.AuthInfoFrom(ctx)
			if ok && claims.IsIdentityType(authInfo.GetIdentityType(), claims.TypeAccessPolicy) {
				return authorizer.DecisionAllow, "", nil
			}
			return authorizer.DecisionDeny, "only the service identity is served here", nil
		})
}

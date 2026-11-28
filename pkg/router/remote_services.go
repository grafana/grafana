package router

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/dskit/services"
	"github.com/open-feature/go-sdk/openfeature"
	"go.yaml.in/yaml/v3"

	"github.com/grafana/grafana-app-sdk/logging"

	grafanarequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

// Remote services exist only for Grafana Cloud's single-tenant (ST) stack pods:
// they let an ST pod serve multi-tenant (MT) APIs by proxying them to MT. They
// are a stopgap until every request starts at the MT router, which falls back
// to the ST pods, and nothing else should configure them. The loader enforces
// that it runs only as middleware in a Grafana server (never the standalone
// router) with a stack ID, and remote_services_cycle.go keeps a request from
// cycling between an ST pod and the MT router.
//
// The settings below replace what the embedded kube-aggregator reads to mount
// MT APIs into an ST Grafana's API server. They keep the aggregator's names,
// so a deployment moves to the router by dropping the
// kubernetes_aggregator_enabled setting, not by rewriting its config:
//
//	[grafana-apiserver] remote_services_file        the MT services to mount
//	[grpc_client_authentication] token              CAP token that signs requests
//	[grpc_client_authentication] token_exchange_url
//	[grpc_client_authentication] token_namespace    namespace of the discovery
//	                                                token; defaults to the stack's
//
// Every proxied request is signed, as the aggregator signed it
// (remote_services_auth.go), and carries Grafana-Upstream-Traceparent and
// Grafana-Remote-Services-Origin (remote_services_cycle.go).
//
// The aggregator always skipped TLS verification; the router verifies. It adds:
//
//	remote_services_ca_file   CA bundle for the remote services; defaults to
//	                          apiservice_ca_bundle_file, which other MT clients
//	                          also read, so the remotes' CA can be trusted
//	                          without widening theirs
//	remote_services_insecure  skip TLS verification, as the aggregator did
//	remote_services_audience  CAP token audience for discovery; defaults to the
//	                          aggregator's hardcoded one
const (
	remoteServicesSection = "grafana-apiserver"
	remoteServicesAuth    = "grpc_client_authentication"

	// defaultRemoteServicesAudience is the audience the aggregator hardcodes for
	// its discovery requests, so existing deployments need no new setting.
	defaultRemoteServicesAudience = "cloudAppPlatformDiscovery"
)

// remoteService is one entry of the remote services file: an MT apiserver that
// serves a group version.
type remoteService struct {
	Group   string `yaml:"group"`
	Version string `yaml:"version"`
	Host    string `yaml:"host"`
	Port    int32  `yaml:"port"`
}

func readRemoteServicesFile(path string) ([]remoteService, error) {
	// #nosec G304 -- path is operator-controlled configuration.
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("router: reading remote services file: %w", err)
	}
	var out []remoteService
	if err := yaml.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("router: parsing remote services file %s: %w", path, err)
	}
	return out, nil
}

// remoteServiceFlag is the OpenFeature flag that opts a group into being served
// by its MT apiserver: aggregation.<group with dashes>.enabled.
func remoteServiceFlag(group string) string {
	return fmt.Sprintf("aggregation.%s.enabled", strings.ReplaceAll(group, ".", "-"))
}

// remoteServiceOptedIn mirrors the aggregator: a *grafana.app group (except
// features.grafana.app, which no flag controls) is mounted only when its flag
// is on, and any other group in the file always is.
func remoteServiceOptedIn(ctx context.Context, group string) bool {
	if !strings.HasSuffix(group, "grafana.app") || group == "features.grafana.app" {
		return true
	}
	return openfeature.NewDefaultClient().Boolean(ctx, remoteServiceFlag(group), false, openfeature.TransactionContext(ctx))
}

// remoteServiceOptions are the settings shared by every remote service target.
type remoteServiceOptions struct {
	audience, tokenNamespace, caFile string
	insecure                         bool
}

func newRemoteServiceOptions(cfg *setting.Cfg, stackNamespace string) remoteServiceOptions {
	section := cfg.SectionWithEnvOverrides(remoteServicesSection)
	return remoteServiceOptions{
		audience:       section.Key("remote_services_audience").MustString(defaultRemoteServicesAudience),
		tokenNamespace: cfg.SectionWithEnvOverrides(remoteServicesAuth).Key("token_namespace").MustString(stackNamespace),
		caFile:         section.Key("remote_services_ca_file").MustString(section.Key("apiservice_ca_bundle_file").MustString("")),
		insecure:       section.Key("remote_services_insecure").MustBool(false),
	}
}

// remoteServiceTargets turns the services into one aggregate target per
// host:port, in file order, serving that host's opted-in groups. Cloud lists
// every group at one MT aggregator, so this is one poller, not one per group.
// The first entry for a group wins, as it does for the aggregator's version
// priority. Discovery polls carry a CAP token in Authorization, as the
// aggregator's did.
func remoteServiceTargets(ctx context.Context, svcs []remoteService, optedIn func(context.Context, string) bool, o remoteServiceOptions) []aggregateTargetConfig {
	var targets []aggregateTargetConfig
	byAddr := map[string]int{}
	seen := map[string]bool{}
	for _, s := range svcs {
		if s.Group == "" || s.Host == "" || seen[s.Group] {
			continue
		}
		seen[s.Group] = true
		if !optedIn(ctx, s.Group) {
			continue
		}
		addr := hostPort(s.Host, s.Port)
		i, ok := byAddr[addr]
		if !ok {
			i = len(targets)
			byAddr[addr] = i
			targets = append(targets, aggregateTargetConfig{
				Name:         "remote_" + addr,
				URL:          "https://" + addr,
				PollInterval: defaultAggregatePollInterval,
				// The aggregator sent its discovery token in Authorization.
				DiscoveryAuth:      discoveryAuthBearer,
				Audience:           o.audience,
				TokenNamespace:     o.tokenNamespace,
				CAFile:             o.caFile,
				InsecureSkipVerify: o.insecure,
			})
		}
		targets[i].GroupPatterns = append(targets[i].GroupPatterns, s.Group)
	}
	return targets
}

func hostPort(host string, port int32) string {
	if port == 0 {
		return host
	}
	return fmt.Sprintf("%s:%d", host, port)
}

// newRemoteServicesLoader mounts the MT APIs the remote services file lists
// over base, replacing the embedded aggregator for them. A group it serves
// takes over that group from base and from the embedded API server. It returns
// base unchanged when no file is configured, or none of its groups is opted in.
//
// It is for cloud ST stack pods only. It refuses the standalone router, which
// MiddlewareEnabled already keeps from calling it, and a server with no stack
// ID: without one there is no namespace to sign for.
func newRemoteServicesLoader(ctx context.Context, cfg *setting.Cfg, base RoutesLoader) (RoutesLoader, error) {
	section := cfg.SectionWithEnvOverrides(remoteServicesSection)
	path := section.Key("remote_services_file").MustString("")
	if path == "" {
		return base, nil
	}
	if standaloneRouter(cfg) {
		return nil, fmt.Errorf("router: remote_services_file is only for single-tenant cloud stack pods, not the standalone router")
	}
	if cfg.StackID == "" {
		return nil, fmt.Errorf("router: remote_services_file is only for single-tenant cloud stack pods, but [environment] stack_id is not set")
	}
	svcs, err := readRemoteServicesFile(path)
	if err != nil {
		return nil, err
	}
	// The aggregator signed every token for the stack's namespace.
	stackNamespace := grafanarequest.GetNamespaceMapper(cfg)(1)
	opts := newRemoteServiceOptions(cfg, stackNamespace)
	configs := remoteServiceTargets(ctx, svcs, remoteServiceOptedIn, opts)
	if len(configs) == 0 {
		return base, nil
	}
	auth := cfg.SectionWithEnvOverrides(remoteServicesAuth)
	token, exchangeURL := auth.Key("token").MustString(""), auth.Key("token_exchange_url").MustString("")
	if token == "" || exchangeURL == "" {
		return nil, fmt.Errorf("router: [%s] token and token_exchange_url are required to mount remote services", remoteServicesAuth)
	}
	exchanger, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{TokenExchangeURL: exchangeURL, Token: token})
	if err != nil {
		return nil, fmt.Errorf("router: token exchange client: %w", err)
	}
	sign := newRemoteServiceSigner(exchanger, stackNamespace, opts.audience)
	headers := newRemoteServiceHeaders(stackNamespace)
	for i := range configs {
		// The cycle check runs first, so a refused request costs no exchange.
		configs[i].wrapProxy = func(next http.RoundTripper) http.RoundTripper {
			return headers(sign(next))
		}
	}
	targets, err := buildAggregateTargets(configs, exchanger)
	if err != nil {
		return nil, err
	}
	remote, err := newCloudLoader(targets, nil, nil)
	if err != nil {
		return nil, err
	}
	return newOverlayLoader(base, remote), nil
}

// overlayLoader serves the groups of over on top of base: over wins a shared
// group. It is a service so that over's poll loops run with the router.
type overlayLoader struct {
	*services.BasicService
	base RoutesLoader
	over *cloudLoader
}

func newOverlayLoader(base RoutesLoader, over *cloudLoader) *overlayLoader {
	l := &overlayLoader{base: base, over: over}
	// The router starts a loader that is a service, but base may be one too.
	l.BasicService = services.NewIdleService(l.starting, l.stopping).WithName("remote-services-routes-loader")
	return l
}

func (l *overlayLoader) starting(ctx context.Context) error {
	if svc, ok := l.base.(services.Service); ok {
		if err := services.StartAndAwaitRunning(ctx, svc); err != nil {
			return err
		}
	}
	return services.StartAndAwaitRunning(ctx, l.over)
}

func (l *overlayLoader) stopping(error) error {
	err := services.StopAndAwaitTerminated(context.Background(), l.over)
	if svc, ok := l.base.(services.Service); ok {
		if baseErr := services.StopAndAwaitTerminated(context.Background(), svc); err == nil {
			err = baseErr
		}
	}
	return err
}

func (l *overlayLoader) Load(ctx context.Context) ([]Backend, error) {
	backends, err := l.base.Load(ctx)
	if err != nil {
		return nil, err
	}
	remote, err := l.over.Load(ctx)
	if err != nil {
		// Until the remotes first poll, or when they fail, base groups keep
		// serving; the next poll's Notify brings the remote groups in.
		logging.FromContext(ctx).Warn("router: remote services not loaded", "err", err)
		return backends, nil
	}
	return append(backends, remote...), nil
}

// Notify wakes on either loader. Each only coalesces, so so does the merge.
func (l *overlayLoader) Notify(ctx context.Context) (<-chan struct{}, error) {
	a, err := l.base.Notify(ctx)
	if err != nil {
		return nil, err
	}
	b, err := l.over.Notify(ctx)
	if err != nil {
		return nil, err
	}
	out := make(chan struct{}, 1)
	go func() {
		for a != nil || b != nil {
			select {
			case <-ctx.Done():
				return
			case _, ok := <-a:
				if !ok {
					a = nil
					continue
				}
			case _, ok := <-b:
				if !ok {
					b = nil
					continue
				}
			}
			select {
			case out <- struct{}{}:
			default:
			}
		}
	}()
	return out, nil
}

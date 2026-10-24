package router

import (
	"context"
	crand "crypto/rand"
	"encoding/binary"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"sync"
	"time"

	authnlib "github.com/grafana/authlib/authn"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// mtRouterAddressKey, in the [cloud_router] section, is the multi-tenant
	// router that a stack gets the groups it does not serve from.
	mtRouterAddressKey = "mt_router_address"
	// mtRouterCAFileKey is a PEM bundle that verifies the router's certificate,
	// for one the system roots do not trust. mtRouterInsecureKey skips
	// verification: use it only over a link that is trusted anyway.
	mtRouterCAFileKey   = "mt_router_ca_file"
	mtRouterInsecureKey = "mt_router_insecure"
	// mtRouterAudience is the audience of the token the stack exchanges its
	// access policy for, to read the router's discovery. The router does not
	// check it.
	mtRouterAudience = "mt-discovery"

	// The router's groups change only when apps roll out, so poll rarely, and
	// spread the many stacks that poll it.
	mtDiscoveryInterval = 10 * time.Minute
	mtDiscoveryJitter   = 0.1
)

// mtSourceName names the multi-tenant router as an aggregate target, so its
// groups are reported under the "aggregate:mt-router" source.
const mtSourceName = "mt-router"

// mtRoutes adds the groups the multi-tenant router serves to an inner loader's
// routes. The router's groups are polled, like an aggregate target's, and
// served by proxying to it, which is what lets the stack's own discovery,
// OpenAPI documents, metrics and circuit breakers cover them with no code of
// their own.
type mtRoutes struct {
	inner  RoutesLoader
	target *aggregateTarget
	local  *localGroups

	// wake carries "the local groups became known" to the reconcile loop.
	wake chan struct{}
}

func newMTRoutes(inner RoutesLoader, target *aggregateTarget, local *localGroups) *mtRoutes {
	m := &mtRoutes{inner: inner, target: target, local: local, wake: make(chan struct{}, 1)}
	local.onLoaded = func() {
		select {
		case m.wake <- struct{}{}:
		default: // already pending; coalesce
		}
	}
	return m
}

// Load returns the inner loader's routes, then the router's groups that
// neither an inner source nor the embedded apiserver serves. Until the
// apiserver's groups are known, every group might be local, so none of the
// router's are offered.
func (m *mtRoutes) Load(ctx context.Context) ([]Backend, error) {
	backends, err := m.inner.Load(ctx)
	taken := make(map[string]struct{}, len(backends))
	for _, b := range backends {
		taken[b.Group().Name] = struct{}{}
	}
	routes := slices.Clone(backends)
	for _, b := range m.target.Backends() {
		name := b.Group().Name
		if _, ok := taken[name]; ok || !m.local.absent(name) {
			continue
		}
		if backend, ok := b.(*aggregateBackend); ok {
			routes = append(routes, &mtBackend{aggregateBackend: backend})
		}
	}
	return routes, err
}

// Notify wakes on the inner loader's changes, on a change to the router's
// groups, and when the local groups become known.
func (m *mtRoutes) Notify(ctx context.Context) (<-chan struct{}, error) {
	innerWake, err := m.inner.Notify(ctx)
	if err != nil {
		return nil, err
	}
	dirty := make(chan struct{}, 1)
	signal := func() {
		select {
		case dirty <- struct{}{}:
		default: // already pending; coalesce
		}
	}

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		m.target.run(ctx, dirty)
	}()
	go func() {
		defer wg.Done()
		for {
			select {
			case <-ctx.Done():
				return
			case _, ok := <-innerWake:
				if !ok {
					innerWake = nil // closed: never wakes again, and must not busy-loop
					continue
				}
				signal()
			case <-m.wake:
				signal()
			}
		}
	}()
	go func() {
		wg.Wait()
		close(dirty)
	}()
	return dirty, nil
}

// mtBackend serves one of the multi-tenant router's groups from a stack.
type mtBackend struct{ *aggregateBackend }

// Load marks what the stack forwards, and refuses what already crossed, from
// the router or from a stack: with the stack's address pointing at itself, or
// a group the router no longer serves, that would be a loop.
func (b *mtBackend) Load(ctx context.Context) (http.Handler, error) {
	proxy, err := b.aggregateBackend.Load(ctx)
	if err != nil {
		return nil, err
	}
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if crossed(req) {
			http.NotFound(w, req)
			return
		}
		req = req.Clone(req.Context())
		req.Header.Set(routerOriginHeader, originST)
		proxy.ServeHTTP(w, req)
	}), nil
}

// mtRoutesConfig is what a stack needs to read from, and proxy to, the
// multi-tenant router.
type mtRoutesConfig struct {
	Address  string
	CAFile   string
	Insecure bool
	// Exchanger turns the stack's access policy into the token the router
	// authenticates its discovery poll with.
	Exchanger authnlib.TokenExchanger
}

// newMTRoutesFromConfig adds the multi-tenant router's groups to inner when
// [cloud_router] mt_router_address is set, and returns inner otherwise.
//
// Only a cloud stack gets them: its platform sets [environment] stack_id, which
// the rest of Grafana also reads to tell a stack from a self-managed install.
// A stack authenticates to the router with its access policy, the one it uses
// for its other service calls ([grpc_client_authentication]).
func newMTRoutesFromConfig(cfg *setting.Cfg, inner RoutesLoader) (RoutesLoader, error) {
	if cfg == nil {
		return inner, nil
	}
	section := cfg.SectionWithEnvOverrides(cloudRouterSection)
	address := section.Key(mtRouterAddressKey).MustString("")
	if address == "" {
		return inner, nil
	}
	if cfg.StackID == "" {
		logging.DefaultLogger.Warn("router: ignoring " + mtRouterAddressKey + ", which applies only to a cloud stack ([environment] stack_id is not set)")
		return inner, nil
	}

	c := mtRoutesConfig{
		Address:  address,
		CAFile:   section.Key(mtRouterCAFileKey).MustString(""),
		Insecure: section.Key(mtRouterInsecureKey).MustBool(false),
	}
	if policy := grpcutils.ReadGrpcClientConfig(cfg); policy.Token != "" && policy.TokenExchangeURL != "" {
		exchanger, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{Token: policy.Token, TokenExchangeURL: policy.TokenExchangeURL})
		if err != nil {
			return nil, fmt.Errorf("%s: token exchange client: %w", cloudRouterSection, err)
		}
		c.Exchanger = exchanger
	}
	routes, err := buildMTRoutes(inner, c)
	if err != nil {
		return nil, err
	}
	return routes, nil
}

func buildMTRoutes(inner RoutesLoader, c mtRoutesConfig) (*mtRoutes, error) {
	if u, err := url.Parse(c.Address); err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return nil, fmt.Errorf("%s: %s must be an absolute HTTP(S) URL", cloudRouterSection, mtRouterAddressKey)
	}
	// Insecure would silently override the CA, which hides a misconfiguration.
	if c.Insecure && c.CAFile != "" {
		return nil, fmt.Errorf("%s: %s and %s cannot both be set", cloudRouterSection, mtRouterCAFileKey, mtRouterInsecureKey)
	}
	if c.Exchanger == nil {
		return nil, fmt.Errorf("%s: token and token_exchange_url in [grpc_client_authentication] are required when %s is set", cloudRouterSection, mtRouterAddressKey)
	}
	tlsCfg, err := buildAggregateTLSConfig(c.CAFile, c.Insecure)
	if err != nil {
		return nil, fmt.Errorf("%s: %s: %w", cloudRouterSection, mtRouterAddressKey, err)
	}

	// The poll signs as the stack, and asks for the router's own groups. Proxied
	// requests carry the caller's credentials instead (see aggregateBackend).
	client, err := rest.HTTPClientFor(&rest.Config{
		Host:          c.Address,
		Transport:     headerTransport{base: newAggregateBaseTransport(tlsCfg), name: routerOriginHeader, value: originST},
		WrapTransport: aggregateTokenWrapper(mtSourceName, c.Exchanger, mtRouterAudience),
		Timeout:       defaultAggregateDiscoveryTimeout,
	})
	if err != nil {
		return nil, fmt.Errorf("%s: building the %s http client: %w", cloudRouterSection, mtSourceName, err)
	}
	target, err := newAggregateTarget(aggregateTargetConfig{Name: mtSourceName, URL: c.Address, PollInterval: mtDiscoveryInterval}, client, newAggregateBaseTransport(tlsCfg))
	if err != nil {
		return nil, err
	}
	target.cooldown.withJitter(mtDiscoveryJitter, randomFraction)
	return newMTRoutes(inner, target, newLocalGroups()), nil
}

// headerTransport sets a header on each request it sends.
type headerTransport struct {
	base        http.RoundTripper
	name, value string
}

func (t headerTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req = req.Clone(req.Context())
	req.Header.Set(t.name, t.value)
	return t.base.RoundTrip(req)
}

// mtDiscoveryRule serves a request from the router: a stack's own groups only,
// so what the router has offered never comes back to it as the stack's.
func mtDiscoveryRule() discoveryRule {
	return discoveryRule{
		Header:  routerOriginHeader,
		Value:   originMT,
		Exclude: func(e servingEntry) bool { return e.source == aggregateSource(mtSourceName) },
	}
}

// WatchLocalGroups reads the groups the embedded apiserver serves, once it is
// ready, through its loopback config. It does nothing without the router's
// groups to compare them with.
func (s *Service) WatchLocalGroups(ctx context.Context, cfg *rest.Config) error {
	if s.mtRoutes == nil {
		return nil
	}
	client, err := rest.HTTPClientFor(cfg)
	if err != nil {
		return fmt.Errorf("building loopback discovery client: %w", err)
	}
	client.Timeout = singleTenantLookupTimeout
	go s.mtRoutes.local.run(ctx, client, cfg.Host)
	return nil
}

// randomFraction returns a uniform value in [0, 1).
func randomFraction() float64 {
	var b [8]byte
	if _, err := crand.Read(b[:]); err != nil {
		return 0
	}
	return float64(binary.BigEndian.Uint64(b[:])>>11) / (1 << 53)
}

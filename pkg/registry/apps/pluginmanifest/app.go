package pluginmanifest

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/health"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
)

// pluginContextGetter is the narrow slice of *plugincontext.Provider that the proxy app needs.
// Defined as an interface so unit tests can inject a fake without standing up the real provider.
type pluginContextGetter interface {
	Get(ctx context.Context, pluginID string, user identity.Requester, orgID int64) (backend.PluginContext, error)
}

// pluginBackendApp is an app.App for plugin-manifest kinds that proxies the request-time behaviors
// (admission Validate/Mutate and custom routes) to the plugin's backend over gRPC. App methods with
// no request-time backend equivalent are no-ops, defined below.
//
// The admission methods (Validate/Mutate) live in admission.go; CallCustomRoute lives in
// customroute.go.
type pluginBackendApp struct {
	pluginID  string
	client    plugins.Client
	pluginCtx pluginContextGetter
}

var _ app.App = (*pluginBackendApp)(nil)

func newPluginBackendApp(pluginID string, client plugins.Client, pluginCtx pluginContextGetter) *pluginBackendApp {
	return &pluginBackendApp{
		pluginID:  pluginID,
		client:    client,
		pluginCtx: pluginCtx,
	}
}

// resolvePluginContext resolves the plugin context for the current request, pulling the requester
// identity from the context (which may be absent for system/anonymous requests).
func (a *pluginBackendApp) resolvePluginContext(ctx context.Context) (backend.PluginContext, error) {
	var user identity.Requester
	var orgID int64
	if u, err := identity.GetRequester(ctx); err == nil && u != nil {
		user = u
		orgID = u.GetOrgID()
	}
	return a.pluginCtx.Get(ctx, a.pluginID, user, orgID)
}

// The methods below are the app.App interface members that have no request-time plugin-backend
// equivalent, so the proxy implements them as no-ops. The request-time methods it does proxy live
// in admission.go (Validate/Mutate) and customroute.go (CallCustomRoute).

func (a *pluginBackendApp) Convert(_ context.Context, _ app.ConversionRequest) (*app.RawObject, error) {
	return nil, app.ErrNotImplemented
}
func (a *pluginBackendApp) ManagedKinds() []resource.Kind {
	return nil
}
func (a *pluginBackendApp) Runner() app.Runnable {
	return &noOpRunner{}
}

func (a *pluginBackendApp) PrometheusCollectors() []prometheus.Collector {
	return nil
}

func (a *pluginBackendApp) HealthChecks() []health.Check {
	return nil
}

type noOpRunner struct{}

func (r *noOpRunner) Run(ctx context.Context) error {
	<-ctx.Done()
	return nil
}

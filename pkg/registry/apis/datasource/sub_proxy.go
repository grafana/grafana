package datasource

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/config"

	authnlib "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasourceproxy/proxymetrics"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

// ProxyDependencies contains the services and configuration used to proxy a request.
type ProxyDependencies struct {
	RequestValidator   validations.DataSourceRequestValidator
	ProxyCfg           *pluginproxy.DataSourceProxySettings
	HTTPClientProvider httpclient.Provider
	GrafanaConfig      *config.GrafanaCfg
	// TransportConfigKey changes when provider configuration changes between requests.
	TransportConfigKey string
	// OAuthTokenService supplies Forward OAuth Identity tokens; nil rejects those data sources.
	OAuthTokenService oauthtoken.OAuthTokenService
	Tracer            tracing.Tracer
	Features          featuremgmt.FeatureToggles
	// IDTokenDeriver mints X-Grafana-Id from a requester's OBO access token when the requester
	// carries no id token of its own. Nil disables that fallback (see
	// proxyutil.ApplyForwardIDHeader).
	IDTokenDeriver authnlib.IDTokenDeriver
}

// ProxyDependenciesProvider returns fixed dependencies in ordinary Grafana and
// resolves tenant configuration per request in multi-tenant Grafana.
type ProxyDependenciesProvider func(context.Context, *http.Request) (*ProxyDependencies, error)

// ProvideProxyDependencies wires the fixed dependencies used by ordinary Grafana.
func ProvideProxyDependencies(
	cfg *setting.Cfg,
	httpClientProvider httpclient.Provider,
	oAuthTokenService *oauthtoken.Service,
	tracer tracing.Tracer,
	features featuremgmt.FeatureToggles,
) ProxyDependenciesProvider {
	deps := &ProxyDependencies{
		ProxyCfg:           pluginproxy.NewDataSourceProxySettings(cfg),
		HTTPClientProvider: httpClientProvider,
		OAuthTokenService:  oAuthTokenService,
		Tracer:             tracer,
		Features:           features,
		// Single-tenant Grafana mints its own id token at the edge, so requester always carries
		// one and this fallback is never needed on the wire-injected (ST) path.
		IDTokenDeriver: nil,
	}
	return func(context.Context, *http.Request) (*ProxyDependencies, error) {
		return deps, nil
	}
}

type subProxyREST struct {
	builder    *DataSourceAPIBuilder
	transports *proxyTransportCache
}

var _ rest.Connecter = (*subProxyREST)(nil)

func (r *subProxyREST) New() runtime.Object {
	return &metav1.Status{}
}

func (r *subProxyREST) Destroy() {
	r.transports.close()
}

func (r *subProxyREST) ConnectMethods() []string {
	unique := map[string]bool{}
	methods := []string{}
	for _, route := range r.builder.pluginJSON.Routes {
		if unique[route.Method] {
			continue
		}
		unique[route.Method] = true
		methods = append(methods, route.Method)
	}
	return methods
}

func (r *subProxyREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, ""
}

func (r *subProxyREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	m := newConnectMetric("proxy", r.builder.pluginJSON.ID)

	if r.builder.proxyDependencies == nil {
		m.SetError()
		m.Record()
		r.recordRequest(ctx, proxymetrics.Observation{
			PluginID: r.builder.pluginJSON.ID,
			Status:   http.StatusInternalServerError,
			Source:   proxymetrics.SourceServer,
		})
		return nil, errors.New("datasource proxy is not configured")
	}

	loader := newDatasourceLoader(r.builder.datasources, name, r.builder.pluginJSON.ID)

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		defer m.Record()

		start := time.Now()
		recorder := proxymetrics.NewStatusRecorder(w)
		w = recorder
		// Errors go through the responder rather than w, so their status is taken from the error.
		var errStatus int
		defer func() {
			status := recorder.Status()
			if errStatus != 0 {
				status = errStatus
			}
			r.recordRequest(req.Context(), proxymetrics.Observation{
				PluginID: r.builder.pluginJSON.ID,
				Status:   status,
				Source:   proxymetrics.ClassifySource(status, requestmeta.GetRequestMetaData(req.Context()).StatusSource),
				Duration: time.Since(start),
				Log: proxymetrics.LogFields{
					DatasourceUID: name,
					Namespace:     k8srequest.NamespaceValue(req.Context()),
					Method:        req.Method,
					Path:          proxyPathFromRequest(req, name),
				},
			})
		}()

		respondError := func(err error) {
			err = proxyResponseError(req.Context(), err)
			errStatus = errorStatus(err)
			responder.Error(err)
		}
		if r.builder.cfg.HandlerOrigin != "" {
			w.Header().Set("X-Grafana-DS-Apiserver", r.builder.cfg.HandlerOrigin)
		}

		// The apiserver request context carries the authenticated identity that
		// NewDataSourceProxy reads via identity.GetRequester.
		req = req.WithContext(ctx)
		deps, err := r.builder.proxyDependencies(ctx, req)
		if err != nil {
			m.SetError()
			respondError(err)
			return
		}
		req = req.WithContext(requestmeta.EnsureRequestMetaData(req.Context()))
		if deps.GrafanaConfig != nil {
			req = req.WithContext(config.WithGrafanaConfig(req.Context(), deps.GrafanaConfig))
		}
		loader.transports = r.transports
		loader.transportConfigKey = deps.TransportConfigKey

		ds, err := loader.DataSource(req.Context())
		if err != nil {
			if errors.Is(err, datasources.ErrDataSourceNotFound) {
				m.SetNotFound()
				respondError(r.builder.datasourceResourceInfo.NewNotFound(name))
				return
			}
			m.SetError()
			respondError(err)
			return
		}
		jsonData, _ := ds.Spec.JSONData().(map[string]any)
		if deps.GrafanaConfig != nil && datasources.IsSecureSocksDSProxyEnabled(jsonData) {
			proxyCfg, err := deps.GrafanaConfig.Proxy()
			if err != nil || proxyCfg.ClientCfg == nil {
				m.SetError()
				respondError(apierrors.NewBadRequest("PDC is not configured for this datasource proxy"))
				return
			}
		}
		validate := r.builder.validateDataSourceRequest
		if deps.RequestValidator != nil {
			validate = deps.RequestValidator.Validate
		}
		if err := validate(ds.Spec.URL(), jsonData, req); err != nil {
			m.SetError()
			respondError(apierrors.NewForbidden(r.builder.datasourceResourceInfo.GroupResource(), name, err))
			return
		}

		if ds.Spec.IsOAuthPassThruEnabled() && deps.OAuthTokenService == nil {
			m.SetError()
			respondError(apierrors.NewBadRequest("OAuth passthrough is not supported by this datasource proxy"))
			return
		}

		proxy, err := pluginproxy.NewDataSourceProxy(
			loader,
			r.builder.pluginJSON.Routes,
			pluginproxy.HTTPContext{Req: req, Resp: w},
			proxyPathFromRequest(req, name),
			deps.ProxyCfg,
			deps.HTTPClientProvider,
			deps.OAuthTokenService,
			deps.Tracer,
			deps.Features,
			deps.IDTokenDeriver,
			r.builder.checkProxyRouteAccess,
		)
		if err != nil {
			m.SetError()
			respondError(err)
			return
		}
		proxy.HandleRequest()
	}), nil
}

func (r *subProxyREST) recordRequest(ctx context.Context, o proxymetrics.Observation) {
	r.builder.proxyMetrics.RecordMetricsAndLog(o)
	if record := r.builder.cfg.RecordProxyRequest; record != nil {
		record(ctx, o.PluginID, o.Status, o.Source)
	}
}

// errorStatus returns the HTTP status the apiserver reports for err.
func errorStatus(err error) int {
	var status apierrors.APIStatus
	if errors.As(err, &status) && status.Status().Code != 0 {
		return int(status.Status().Code)
	}
	return http.StatusInternalServerError
}

// proxyResponseError reports a request the client abandoned as 499, as the
// apiserver handler chain and the shared proxy error handler do. Otherwise the
// apiserver reports the untyped context error as a 500. The context is checked
// as well because some errors, such as gRPC status errors, do not wrap
// context.Canceled.
func proxyResponseError(ctx context.Context, err error) error {
	if !errors.Is(err, context.Canceled) && !errors.Is(ctx.Err(), context.Canceled) {
		return err
	}
	return &apierrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    proxyutil.StatusClientClosedRequest,
		Message: "client closed the request",
	}}
}

// proxyPathFromRequest returns everything after the "<name>/proxy" subresource
// boundary, which is the path that should be forwarded to the datasource.
//
// We anchor on the datasource name to avoid matching a literal "/proxy" that
// the forwarded path itself may contain. The real subresource boundary always
// precedes the forwarded subpath, so the first occurrence is the correct one.
func proxyPathFromRequest(req *http.Request, name string) string {
	_, after, found := strings.Cut(req.URL.EscapedPath(), "/"+name+"/proxy")
	if !found {
		return ""
	}
	return strings.TrimPrefix(after, "/")
}

func (b *DataSourceAPIBuilder) checkProxyRouteAccess(ctx context.Context, user identity.Requester, uid, action string) (bool, error) {
	ns, err := request.NamespaceInfoFrom(ctx, false)
	if err != nil {
		return false, err
	}
	req := authlib.CheckRequest{
		Namespace: ns.Value,
		Group:     b.GetGroupVersion().Group,
		Resource:  "datasources",
		Name:      uid,
		Verb:      action,
	}
	// Route actions describe the required permission independently of the proxied HTTP method.
	if check, ok := proxyRouteChecks[action]; ok {
		req.Subresource, req.Verb = check.subresource, check.verb
	}
	result, err := b.accessClient.Check(ctx, user, req, "")
	return result.Allowed, err
}

type proxyRouteCheck struct {
	subresource string
	verb        string
}

// proxyRouteChecks maps plugin route actions (reqAction) to the datasource
// subresource and verb that pkg/services/authz/rbac/mapper.go resolves back to
// the same action, scoped to datasources:uid:<UID>. Unlisted actions are sent
// as-is and rejected by authz as unsupported verbs.
var proxyRouteChecks = map[string]proxyRouteCheck{
	datasources.ActionQuery:                                {"query", utils.VerbCreate},
	datasources.ActionRead:                                 {"", utils.VerbGet},
	datasources.ActionDelete:                               {"", utils.VerbDelete},
	datasources.ActionPermissionsRead:                      {"", utils.VerbGetPermissions},
	datasources.ActionPermissionsWrite:                     {"", utils.VerbSetPermissions},
	"datasources.caching:read":                             {"caching", utils.VerbGet},
	"datasources.caching:write":                            {"caching", utils.VerbUpdate},
	accesscontrol.ActionAlertingRuleExternalRead:           {"alertrules", utils.VerbGet},
	accesscontrol.ActionAlertingRuleExternalWrite:          {"alertrules", utils.VerbUpdate},
	accesscontrol.ActionAlertingInstancesExternalRead:      {"alertinstances", utils.VerbGet},
	accesscontrol.ActionAlertingInstancesExternalWrite:     {"alertinstances", utils.VerbUpdate},
	accesscontrol.ActionAlertingNotificationsExternalRead:  {"alertnotifications", utils.VerbGet},
	accesscontrol.ActionAlertingNotificationsExternalWrite: {"alertnotifications", utils.VerbUpdate},
}

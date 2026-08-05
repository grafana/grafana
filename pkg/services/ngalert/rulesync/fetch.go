package rulesync

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"io"
	"net/http"

	"go.yaml.in/yaml/v3"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

// RulerConfig is the namespace-grouped rule configuration returned by a
// Mimir ruler config API — the exact shape the convert API already
// accepts (map[namespace][]PrometheusRuleGroup).
type RulerConfig = map[string][]apimodels.PrometheusRuleGroup

// ErrNotARuler indicates the datasource returned a 2xx response that does not
// parse as namespace-grouped rule configs — i.e. it is not a Mimir ruler config
// API — letting callers distinguish a misconfigured datasource from a fetch
// failure (any non-2xx is classified as a transient fetch error). An empty ruler
// (no rule groups) is NOT an error; see Fetch.
var ErrNotARuler = errors.New("datasource does not expose a Mimir ruler config API")

// datasourceProxy routes an outbound request through Grafana's datasource proxy
// service, so the datasource's configured auth/TLS/headers are honoured and the
// same egress allow/deny-list validation the user-driven proxy runs is applied.
// *datasourceproxy.DataSourceProxyService satisfies it; a fake stands in for it
// in tests.
type datasourceProxy interface {
	ProxyDatasourceRequestWithUID(c *contextmodel.ReqContext, dsUID string)
}

// RulerFetcher fetches namespace-grouped rule configs from a Mimir ruler
// datasource by routing the ruler config GET through Grafana's datasource proxy
// service (transport, auth and egress validation are all handled there).
type RulerFetcher struct {
	proxy  datasourceProxy
	logger log.Logger
}

// NewRulerFetcher constructs a RulerFetcher around the datasource proxy service.
func NewRulerFetcher(proxy datasourceProxy, logger log.Logger) *RulerFetcher {
	return &RulerFetcher{proxy: proxy, logger: logger}
}

// Fetch retrieves the ruler configuration from ds, returning the parsed configs
// and the FNV-1a hash of the raw body (for cross-tick dedup). Any non-2xx
// (including a 404) is a fetch failure — the ruler config list API returns 200
// with an empty object when there are no rule groups, so a 404 is never "no
// rules"; an unparseable or empty 2xx body yields ErrNotARuler. The GET is routed through the datasource
// proxy service, which loads the datasource by UID, access-checks SignedInUser,
// validates egress, and derives the upstream path from the request URL
// (/api/datasources/proxy/uid/<uid>/config/v1/rules -> config/v1/rules).
func (f *RulerFetcher) Fetch(ctx context.Context, ds *datasources.DataSource) (RulerConfig, uint64, error) {
	// Service-identity context so the proxy's requester lookup succeeds; Fetch
	// runs from a background job with no user request context.
	svcCtx, _ := identity.WithServiceIdentity(ctx, ds.OrgID)

	// The proxy strips the /api/datasources/proxy/uid/<uid>/ prefix to derive the
	// upstream path.
	proxyURL := fmt.Sprintf("/api/datasources/proxy/uid/%s/config/v1/rules", ds.UID)
	req, err := http.NewRequestWithContext(svcCtx, http.MethodGet, proxyURL, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create HTTP request: %w", err)
	}
	// Mimir serves the ruler config API as YAML.
	req.Header.Set("Accept", "application/yaml")

	// Capture the proxied reply in-memory (mirrors AlertingProxy.withReq in
	// api/util.go): response.NormalResponse records status/body and the wrapper
	// adds the CloseNotify method web.NewResponseWriter requires. SignedInUser is
	// the org-scoped service identity the proxy access-checks.
	resp := response.CreateNormalResponse(make(http.Header), nil, 0)
	c := &contextmodel.ReqContext{
		Context: &web.Context{
			Req:  req,
			Resp: web.NewResponseWriter(req.Method, &closeNotifierResponseWriter{resp}),
		},
		SignedInUser: serviceIdentityUser(ds.OrgID),
		// The proxy calls ReqContext.JsonApiErr on failures (datasource lookup,
		// access, plugin load), which logs via Logger when err != nil — it must be
		// non-nil or that call panics (and this runs in a background goroutine).
		Logger: f.logger,
	}

	f.proxy.ProxyDatasourceRequestWithUID(c, ds.UID)

	// The ruler config list API returns HTTP 200 with an empty object when there
	// are no rule groups (see Mimir's ListRules), so a non-2xx is never "no rules":
	// a 404 here is a proxy-local error (datasource/plugin not found) or an upstream
	// failure, not an empty ruler. Treat every non-2xx as a fetch failure so
	// apply/prune never runs and synced rules aren't wiped.
	if resp.Status()/100 != 2 {
		body, _ := io.ReadAll(io.LimitReader(bytes.NewReader(resp.Body()), 1024))
		return nil, 0, fmt.Errorf("ruler config API returned HTTP %d: %s", resp.Status(), string(body))
	}

	body := resp.Body()
	// A ruler config API always returns at least an empty object ("{}") when it
	// has no rule groups, so a 2xx with an empty body is a broken or non-ruler
	// response, not "no rules" — treating it as empty would prune every synced
	// rule. An empty YAML body also unmarshals to a nil map without error, so it
	// must be rejected explicitly.
	if len(bytes.TrimSpace(body)) == 0 {
		return nil, 0, fmt.Errorf("%w: empty response body", ErrNotARuler)
	}
	var cfg RulerConfig
	if err := yaml.Unmarshal(body, &cfg); err != nil {
		return nil, 0, fmt.Errorf("%w: failed to parse response as ruler config: %v", ErrNotARuler, err)
	}

	h := fnv.New64a()
	_, _ = h.Write(body)
	return cfg, h.Sum64(), nil
}

// closeNotifierResponseWriter adapts the in-memory response.NormalResponse to
// what web.NewResponseWriter expects, adding CloseNotify. Mirrors the
// safeMacaronWrapper used by AlertingProxy (api/util.go).
type closeNotifierResponseWriter struct {
	http.ResponseWriter
}

func (w *closeNotifierResponseWriter) CloseNotify() <-chan bool {
	return make(chan bool)
}

// serviceIdentityUser builds the *user.SignedInUser the datasource proxy
// access-checks. The ReqContext requires a *user.SignedInUser, which
// identity.WithServiceIdentity does not provide, so mirror it here carrying the
// datasource query/read permissions the proxy's access check requires.
func serviceIdentityUser(orgID int64) *user.SignedInUser {
	return &user.SignedInUser{
		OrgID:          orgID,
		OrgRole:        identity.RoleAdmin,
		Login:          "grafana_external_ruler_sync",
		IsGrafanaAdmin: true,
		Permissions: map[int64]map[string][]string{
			orgID: {
				datasources.ActionQuery: {datasources.ScopeAll},
				datasources.ActionRead:  {datasources.ScopeAll},
			},
		},
	}
}

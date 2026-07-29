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
	proxy datasourceProxy
}

// NewRulerFetcher constructs a RulerFetcher around the datasource proxy service.
func NewRulerFetcher(proxy datasourceProxy) *RulerFetcher {
	return &RulerFetcher{proxy: proxy}
}

// Fetch retrieves the ruler configuration from ds, returning the parsed configs
// and the FNV-1a hash of the raw body (for cross-tick dedup). A 404 is "no rules
// configured" (empty RulerConfig, nil error); any other non-2xx is a fetch
// failure; an unparseable 2xx yields ErrNotARuler. The GET is routed through the datasource
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
	}

	f.proxy.ProxyDatasourceRequestWithUID(c, ds.UID)

	// 404 → no rule groups (mirrors Grafana's frontend ruler client).
	if resp.Status() == http.StatusNotFound {
		return RulerConfig{}, emptyHash, nil
	}

	if resp.Status()/100 != 2 {
		// Any other non-2xx is a failed fetch (transient 5xx, auth, wrong URL, ...),
		// not a definitive "not a ruler" signal — SyncOrg classifies it as a fetch
		// failure. Cap the body echoed into the error.
		body, _ := io.ReadAll(io.LimitReader(bytes.NewReader(resp.Body()), 1024))
		return nil, 0, fmt.Errorf("ruler config API returned HTTP %d: %s", resp.Status(), string(body))
	}

	body := resp.Body()
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

// emptyHash is the FNV-1a hash of an empty body, used for the no-rules (404)
// case so dedup treats "still empty" as unchanged across ticks.
var emptyHash = func() uint64 {
	h := fnv.New64a()
	return h.Sum64()
}()

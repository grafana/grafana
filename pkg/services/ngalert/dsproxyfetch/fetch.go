// Package dsproxyfetch is the shared plumbing external sync workers (the
// external ruler syncer, the external Alertmanager syncer) use to pull
// upstream config through Grafana's datasource proxy service instead of
// managing their own HTTP transport. Routing through the proxy means the
// datasource's configured auth/TLS/headers are honoured and the same
// egress allow/deny-list validation the user-driven proxy runs applies to
// the sync worker too, so callers no longer need their own transport or
// request validator.
package dsproxyfetch

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

// Proxy routes an outbound request through Grafana's datasource proxy
// service. *datasourceproxy.DataSourceProxyService satisfies it; a fake
// stands in for it in tests.
type Proxy interface {
	ProxyDatasourceRequestWithUID(c *contextmodel.ReqContext, dsUID string)
}

// Result is the raw outcome of a proxied GET: the upstream status code and
// body, before any caller-specific parsing or status-code interpretation —
// e.g. a 404 means "no config for this tenant" to the AM syncer but "hard
// failure" to the ruler syncer, so that judgment stays with the caller.
type Result struct {
	Status int
	Body   []byte
}

// Get issues a GET for upstreamPath (e.g. "/api/v1/alerts") through proxy,
// routed by ds's UID. login identifies the calling sync worker in the
// service-identity user the proxy access-checks (surfaced in logs/audit
// only, not otherwise meaningful). accept, when non-empty, sets the Accept
// header on the outbound request.
//
// Runs from a background job with no user request context, so it builds
// its own service-identity context and user rather than relying on one
// already present in ctx.
func Get(ctx context.Context, proxy Proxy, logger log.Logger, ds *datasources.DataSource, upstreamPath, login, accept string) (Result, error) {
	svcCtx, _ := identity.WithServiceIdentity(ctx, ds.OrgID)

	// The proxy strips /api/datasources/proxy/uid/<uid>/ to derive the upstream path.
	proxyURL := fmt.Sprintf("/api/datasources/proxy/uid/%s/%s", ds.UID, strings.TrimPrefix(upstreamPath, "/"))
	req, err := http.NewRequestWithContext(svcCtx, http.MethodGet, proxyURL, nil)
	if err != nil {
		return Result{}, fmt.Errorf("failed to create HTTP request: %w", err)
	}
	if accept != "" {
		req.Header.Set("Accept", accept)
	}

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
		SignedInUser: serviceIdentityUser(ds.OrgID, login),
		// The proxy calls ReqContext.JsonApiErr on failures (datasource lookup,
		// access, plugin load), which logs via Logger when err != nil — it must be
		// non-nil or that call panics (and this runs in a background goroutine).
		Logger: logger,
	}

	proxy.ProxyDatasourceRequestWithUID(c, ds.UID)

	return Result{Status: resp.Status(), Body: resp.Body()}, nil
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
func serviceIdentityUser(orgID int64, login string) *user.SignedInUser {
	return &user.SignedInUser{
		OrgID:          orgID,
		OrgRole:        identity.RoleAdmin,
		Login:          login,
		IsGrafanaAdmin: true,
		Permissions: map[int64]map[string][]string{
			orgID: {
				datasources.ActionQuery: {datasources.ScopeAll},
				datasources.ActionRead:  {datasources.ScopeAll},
			},
		},
	}
}

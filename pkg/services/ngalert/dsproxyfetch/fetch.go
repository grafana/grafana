// Package dsproxyfetch lets background sync workers (the external ruler and
// Alertmanager syncers) fetch config through Grafana's datasource proxy
// instead of managing their own HTTP transport, so datasource auth and
// egress validation are handled the same way as for user-driven requests.
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

	// Capture the proxied reply in-memory, mirroring AlertingProxy.withReq (api/util.go).
	resp := response.CreateNormalResponse(make(http.Header), nil, 0)
	c := &contextmodel.ReqContext{
		Context: &web.Context{
			Req:  req,
			Resp: web.NewResponseWriter(req.Method, &closeNotifierResponseWriter{resp}),
		},
		SignedInUser: serviceIdentityUser(ds.OrgID, login),
		// Must be non-nil — the proxy panics on a nil Logger when it errors.
		Logger: logger,
	}

	proxy.ProxyDatasourceRequestWithUID(c, ds.UID)

	return Result{Status: resp.Status(), Body: resp.Body()}, nil
}

// closeNotifierResponseWriter adds the CloseNotify method web.NewResponseWriter
// requires; mirrors AlertingProxy's safeMacaronWrapper (api/util.go).
type closeNotifierResponseWriter struct {
	http.ResponseWriter
}

func (w *closeNotifierResponseWriter) CloseNotify() <-chan bool {
	return make(chan bool)
}

// serviceIdentityUser builds the *user.SignedInUser ReqContext requires —
// identity.WithServiceIdentity doesn't provide one — carrying the datasource
// query/read permissions the proxy's access check needs.
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

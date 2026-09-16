// Package dsproxyclient is a client for Grafana's datasource proxy, used by
// background sync workers (the external ruler and Alertmanager syncers) to
// fetch config without managing their own HTTP transport, so datasource auth
// and egress validation are handled the same way as for user-driven requests.
package dsproxyclient

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

// Client fetches from a fixed upstream path through Grafana's datasource
// proxy service. One Client per sync worker: upstreamPath, login and accept
// never vary across the datasources a given worker fetches from, only ds
// itself does.
type Client struct {
	proxy        Proxy
	logger       log.Logger
	upstreamPath string
	// login identifies the calling sync worker in the service-identity user
	// the proxy access-checks (surfaced in logs/audit only, not otherwise
	// meaningful).
	login string
	// accept, when non-empty, sets the Accept header on every request.
	accept string
}

// New constructs a Client for upstreamPath (e.g. "/api/v1/alerts").
func New(proxy Proxy, logger log.Logger, upstreamPath, login, accept string) *Client {
	return &Client{proxy: proxy, logger: logger, upstreamPath: upstreamPath, login: login, accept: accept}
}

// Get issues a GET routed by ds's UID. Runs from a background job with no
// user request context, so it builds its own service-identity context and
// user rather than relying on one already present in ctx.
func (c *Client) Get(ctx context.Context, ds *datasources.DataSource) (Result, error) {
	svcCtx, _ := identity.WithServiceIdentity(ctx, ds.OrgID)

	// The proxy strips /api/datasources/proxy/uid/<uid>/ to derive the upstream path.
	proxyURL := fmt.Sprintf("/api/datasources/proxy/uid/%s/%s", ds.UID, strings.TrimPrefix(c.upstreamPath, "/"))
	req, err := http.NewRequestWithContext(svcCtx, http.MethodGet, proxyURL, nil)
	if err != nil {
		return Result{}, fmt.Errorf("failed to create HTTP request: %w", err)
	}
	if c.accept != "" {
		req.Header.Set("Accept", c.accept)
	}

	// Capture the proxied reply in-memory, mirroring AlertingProxy.withReq (api/util.go).
	resp := response.CreateNormalResponse(make(http.Header), nil, 0)
	reqCtx := &contextmodel.ReqContext{
		Context: &web.Context{
			Req:  req,
			Resp: web.NewResponseWriter(req.Method, &closeNotifierResponseWriter{resp}),
		},
		SignedInUser: serviceIdentityUser(ds.OrgID, c.login),
		// Must be non-nil — the proxy panics on a nil Logger when it errors.
		Logger: c.logger,
	}

	c.proxy.ProxyDatasourceRequestWithUID(reqCtx, ds.UID)

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

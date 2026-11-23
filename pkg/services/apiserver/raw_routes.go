package apiserver

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rawroutes"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

// registerRawRoutes mounts raw routes on the Grafana HTTP router, relative to
// the /apis group. Requests to them never reach the router middleware or the
// embedded k8s handler chain, so long-lived connections are not cut by its
// request timeout and upgrades are not rejected.
func registerRawRoutes(apis routing.RouteRegister, routes []rawroutes.Route) error {
	seen := make(map[string]bool, len(routes))
	for _, rt := range routes {
		pattern := "/" + rt.API.Group + "/" + rt.API.Version + "/"
		if rt.Namespaced {
			pattern += "namespaces/:namespace/"
		}
		pattern += rt.Path

		switch {
		case rt.API.Group == "" || rt.API.Version == "":
			return fmt.Errorf("raw route %s %s: group and version are required", rt.Method, pattern)
		case rt.Path == "" || strings.HasPrefix(rt.Path, "/"):
			return fmt.Errorf("raw route %s %s: path must be relative and not empty", rt.Method, pattern)
		case rt.Handler == nil:
			return fmt.Errorf("raw route %s %s: handler is required", rt.Method, pattern)
		case seen[rt.Method+" "+pattern]:
			return fmt.Errorf("raw route %s %s: registered more than once", rt.Method, pattern)
		}
		seen[rt.Method+" "+pattern] = true

		handlers := []web.Handler{
			middleware.ReqSignedIn,
			// Long-lived connections would skew request latency SLOs.
			requestmeta.SetSLOGroup(requestmeta.SLOGroupNone),
			rawRouteHandler(rt.Handler, rt.Namespaced),
		}
		switch rt.Method {
		case http.MethodGet:
			apis.Get(pattern, handlers...)
		case http.MethodPost:
			apis.Post(pattern, handlers...)
		default:
			return fmt.Errorf("raw route %s %s: unsupported method", rt.Method, pattern)
		}
	}
	return nil
}

func rawRouteHandler(h http.Handler, namespaced bool) web.Handler {
	return func(c *contextmodel.ReqContext) {
		ctx := c.Req.Context()
		if c.SignedInUser != nil {
			ctx = identity.WithRequester(ctx, c.SignedInUser)
		}
		req := c.Req.WithContext(ctx)
		if namespaced {
			req.SetPathValue("namespace", web.Params(c.Req)[":namespace"])
		}
		h.ServeHTTP(c.Resp, req)
	}
}

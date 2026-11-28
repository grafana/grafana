package apiserver

import (
	"fmt"
	"net/http"

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

		if err := rt.Validate(); err != nil {
			return err
		}
		if seen[rt.Method+" "+pattern] {
			return fmt.Errorf("raw route %s %s: registered more than once", rt.Method, pattern)
		}
		seen[rt.Method+" "+pattern] = true

		handlers := []web.Handler{
			middleware.ReqSignedIn,
			// Long-lived connections would skew request latency SLOs.
			requestmeta.SetSLOGroup(requestmeta.SLOGroupNone),
			rawRouteHandler(rt.Handler, rt.Namespaced),
		}
		if rt.Method == http.MethodPost {
			apis.Post(pattern, handlers...)
		} else {
			apis.Get(pattern, handlers...)
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

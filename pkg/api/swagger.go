package api

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/api/webassets"
	"github.com/grafana/grafana/pkg/middleware"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

func (hs *HTTPServer) registerSwaggerUI(r routing.RouteRegister) {
	// Deprecated
	r.Get("/swagger-ui", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "swagger", http.StatusMovedPermanently)
	})
	// Deprecated
	r.Get("/openapi3", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "swagger", http.StatusMovedPermanently)
	})

	// The swagger based api navigator
	r.Get("/swagger", func(c *contextmodel.ReqContext) {
		ctx := c.Context.Req.Context()

		assets, err := webassets.GetWebAssets(ctx, hs.Cfg, hs.License)
		if err != nil {
			errhttp.Write(ctx, err, c.Resp)
			return
		}

		nonce, err := middleware.GenerateNonce()
		if err != nil {
			errhttp.Write(ctx, err, c.Resp)
			return
		}

		// Create a strict CSP only for the Swagger page
		// 'self' is to be backwards compatible with browsers not supporting nonces
		csp := fmt.Sprintf("script-src 'nonce-%s' 'self'; object-src 'none'; base-uri 'none';"+
			"worker-src blob:; require-trusted-types-for 'script'", nonce)

		data := map[string]any{
			"Nonce":          nonce,
			"CSPContent":     csp,
			"Assets":         assets,
			"FavIcon":        "public/img/fav32.png",
			"AppleTouchIcon": "public/img/apple-touch-icon.png",
		}

		c.Resp.Header().Set("Content-Security-Policy", csp)
		c.HTML(http.StatusOK, "swagger", data)
	})
}

package api

import (
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
		ctx := c.Req.Context()
		assets, err := webassets.GetWebAssets(ctx, hs.Cfg, hs.License)
		if err != nil {
			errhttp.Write(ctx, err, c.Resp)
			return
		}

		data := map[string]any{
			"Nonce":          c.RequestNonce,
			"Assets":         assets,
			"FavIcon":        "public/img/fav32.png",
			"AppleTouchIcon": "public/img/apple-touch-icon.png",
		}
		if hs.Cfg.CSPEnabled {
			data["CSPEnabled"] = true
			data["CSPContent"] = middleware.ReplacePolicyVariables(hs.Cfg.CSPTemplate, hs.Cfg.AppURL, c.RequestNonce)
		}

		c.HTML(http.StatusOK, "swagger", data)
	})
}

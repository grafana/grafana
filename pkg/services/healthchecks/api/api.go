package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/healthchecks"
	"github.com/grafana/grafana/pkg/web"
	"net/http"
)
import "github.com/grafana/grafana/pkg/infra/log"

type Api struct {
	HealthCheckService healthchecks.Service
	RouteRegister      routing.RouteRegister
	Log                log.Logger
}

func ProvideApi(hcs healthchecks.Service, rr routing.RouteRegister) *Api {
	api := &Api{
		HealthCheckService: nil,
		RouteRegister:      nil,
		Log:                log.New("healthchecks.api"),
	}

	// is this behind a feature flag?

	return api
}

func (api *Api) RegisterApiEndpoints() {
	api.RouteRegister.Get("/healthz", routing.Wrap(api.Heathz))
}

func (api *Api) Heathz(c *models.ReqContext) response.Response {
	c.Resp.WriteHeader(http.StatusOK)
	if _, err := c.Resp.Write([]byte("Ok")); err != nil {
		// Can we use the api logger for this?
		api.Log.Error("could not write to response", "err", err)
	}

	return response.Success("healthy?")
}

func (api *Api) HealthHandler(ctx *web.Context) {
	//notHeadOrGet := ctx.Req.Method != http.MethodGet && ctx.Req.Method != http.MethodHead
	//if notHeadOrGet || ctx.Req.URL.Path != "/api/health" {
	//	return
	//}

	data := simplejson.New()
	data.Set("database", "ok")
	//if !hs.Cfg.AnonymousHideVersion {
	//	data.Set("version", hs.Cfg.BuildVersion)
	//	data.Set("commit", hs.Cfg.BuildCommit)
	//}

	err := api.HealthCheckService.CheckDatabaseHealth(ctx.Req.Context())
	if err != nil {
		data.Set("database", "failing")
		ctx.Resp.Header().Set("Content-Type", "application/json; charset=UTF-8")
		ctx.Resp.WriteHeader(http.StatusServiceUnavailable)
	} else {
		ctx.Resp.Header().Set("Content-Type", "application/json; charset=UTF-8")
		ctx.Resp.WriteHeader(http.StatusOK)
	}

	dataBytes, err := data.EncodePretty()
	if err != nil {
		api.Log.Error("Failed to encode data", "err", err)
		return
	}

	if _, err := ctx.Resp.Write(dataBytes); err != nil {
		api.Log.Error("Failed to write to response", "err", err)
	}
}

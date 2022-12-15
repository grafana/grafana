package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/healthchecks"
)
import "github.com/grafana/grafana/pkg/infra/log"

type Api struct {
	HealthCheckService healthchecks.Service
	RouteRegister      routing.RouteRegister
	Log                log.Logger
}

func ProvideApi(hcs healthchecks.Service, rr routing.RouteRegister) *Api {
	api := &Api{
		HealthCheckService: hcs,
		RouteRegister:      rr,
		Log:                log.New("healthchecks.api"),
	}

	return api
}

func (api *Api) RegisterApiEndpoints() {
	// TODO figure out how to move the old health checks over here. They're awkward.
	//api.RouteRegister.Get("/healthz/v2", routing.Wrap(api.Healthz))
	//api.RouteRegister.Get("/api/health/v2", routing.Wrap(api.HealthHandler))
}

func (api *Api) ListHealthChecks(ctx *models.ReqContext) response.Response {
	return response.Success("THERE ARE NONE. SORRY!")
}

func (api *Api) GetHealthCheck(ctx *models.ReqContext, key string) response.Response {
	// TODO
	return response.Success("should get a single health check result")
}

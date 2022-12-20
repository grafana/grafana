package api

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/healthchecks"
	hcm "github.com/grafana/grafana/pkg/services/healthchecks/models"
	"github.com/grafana/grafana/pkg/web"
)

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
	api.RegisterApiEndpoints()
	return api
}

func (api *Api) RegisterApiEndpoints() {
	// TODO figure out how to move the old health checks over here. They're awkward.
	api.RouteRegister.Get("/api/healthv2/list", routing.Wrap(api.listHealthChecks))
	api.RouteRegister.Get("/api/healthv2/readiness", routing.Wrap(api.getReadiness))
	api.RouteRegister.Get("/api/healthv2/liveness", routing.Wrap(api.getLiveness))
	api.RouteRegister.Get("/api/healthv2/get/:healthCheckName", routing.Wrap(api.getHealthCheck))
}

func (api *Api) getReadiness(ctx *models.ReqContext) response.Response {
	err := api.HealthCheckService.RunCoreHealthChecks(ctx.Req.Context())
	if errors.Is(err, hcm.ErrCoreChecksNotRegistered) {
		return response.Empty(http.StatusServiceUnavailable)
	} else if err == nil {
		return response.Success("ready")
	} else {
		return response.Error(http.StatusInternalServerError, "error running readiness checks", err)
	}
}

func (api *Api) getLiveness(ctx *models.ReqContext) response.Response {
	s, m := api.HealthCheckService.GetLatestHealth(ctx.Req.Context())
	// TODO need to do filtering based on whether auth is required
	resp := make(map[string]interface{})
	resp["status"] = s
	resp["metrics"] = m
	return response.JSON(http.StatusOK, resp)
}

func (api *Api) listHealthChecks(ctx *models.ReqContext) response.Response {
	return response.JSON(http.StatusOK, api.HealthCheckService.ListHealthChecks(ctx.Req.Context()))
}

func (api *Api) getHealthCheck(ctx *models.ReqContext) response.Response {
	name := web.Params(ctx.Req)[":healthCheckName"]
	found, res := api.HealthCheckService.GetHealthCheck(ctx.Req.Context(), name)
	if found {
		return response.JSON(http.StatusOK, res.HealthCheckConfig)
	} else {
		return response.Empty(http.StatusNotFound)
	}
}

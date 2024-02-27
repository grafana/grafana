package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

type MigrationAPI struct {
	cloudMigrationsService cloudmigration.Service
	routeRegister          routing.RouteRegister
	log                    log.Logger
}

func RegisterApi(
	rr routing.RouteRegister,
	cms cloudmigration.Service,
) *MigrationAPI {
	api := &MigrationAPI{
		log:                    log.New("cloudmigrations.api"),
		routeRegister:          rr,
		cloudMigrationsService: cms,
	}
	api.registerEndpoints()
	return api
}

// RegisterAPIEndpoints Registers Endpoints on Grafana Router
func (api *MigrationAPI) registerEndpoints() {
	api.routeRegister.Group("/api/cloudmigrations", func(apiRoute routing.RouteRegister) {
		apiRoute.Post(
			"/migrate_datasources",
			routing.Wrap(api.MigrateDatasources),
		)
	}, middleware.ReqGrafanaAdmin)
}

func (api *MigrationAPI) MigrateDatasources(c *contextmodel.ReqContext) response.Response {
	var req cloudmigration.MigrateDatasourcesRequestDTO
	if err := web.Bind(c.Req, &req); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	resp, err := api.cloudMigrationsService.MigrateDatasources(c.Req.Context(), &cloudmigration.MigrateDatasourcesRequest{MigrateToPDC: req.MigrateToPDC, MigrateCredentials: req.MigrateCredentials})
	if err != nil {
		return response.Error(http.StatusInternalServerError, "data source migrations error", err)
	}

	return response.JSON(http.StatusOK, cloudmigration.MigrateDatasourcesResponseDTO{DatasourcesMigrated: resp.DatasourcesMigrated})
}

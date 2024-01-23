package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/services/cloudmigrations"
	"github.com/grafana/grafana/pkg/services/cloudmigrations/models"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

type MigrationAPI struct {
	cloudMigrationsService cloudmigrations.CloudMigrationService
	routeRegister          routing.RouteRegister
	log                    log.Logger
}

func RegisterApi(
	rr routing.RouteRegister,
	cms cloudmigrations.CloudMigrationService,
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
	var req migrateDatasourcesRequestDTO
	if err := web.Bind(c.Req, &req); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	resp, err := api.cloudMigrationsService.MigrateDatasources(c.Req.Context(), &models.MigrateDatasourcesRequest{MigrateToPDC: req.MigrateToPDC, MigrateCredentials: req.MigrateCredentials})
	if err != nil {
		return response.Error(http.StatusInternalServerError, "data source migrations error", err)
	}

	return response.JSON(http.StatusOK, migrateDatasourcesResponseDTO{DatasourcesMigrated: resp.DatasourcesMigrated})
}

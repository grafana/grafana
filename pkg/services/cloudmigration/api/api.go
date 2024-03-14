package api

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

type CloudMigrationAPI struct {
	cloudMigrationsService cloudmigration.Service
	routeRegister          routing.RouteRegister
	log                    log.Logger
}

func RegisterApi(
	rr routing.RouteRegister,
	cms cloudmigration.Service,
) *CloudMigrationAPI {
	api := &CloudMigrationAPI{
		log:                    log.New("cloudmigrations.api"),
		routeRegister:          rr,
		cloudMigrationsService: cms,
	}
	api.registerEndpoints()
	return api
}

// RegisterAPIEndpoints Registers Endpoints on Grafana Router
func (cma *CloudMigrationAPI) registerEndpoints() {
	cma.routeRegister.Group("/api/cloudmigration", func(cloudMigrationRoute routing.RouteRegister) {
		// authentication
		cloudMigrationRoute.Get("/authentication", routing.Wrap(cma.Authenticate))
		cloudMigrationRoute.Post("/token", routing.Wrap(cma.CreateToken))
		// migration
		cloudMigrationRoute.Get("/migration", routing.Wrap(cma.GetMigrationList))
		cloudMigrationRoute.Get("/migration/:id", routing.Wrap(cma.GetMigration))
		cloudMigrationRoute.Post("/migration", routing.Wrap(cma.CreateMigration))
		cloudMigrationRoute.Post("/migration/:id/run", routing.Wrap(cma.UpdateMigration))
		cloudMigrationRoute.Post("/migration/:uid/run", routing.Wrap(cma.RunMigration))
		cloudMigrationRoute.Get("/migration/:uid/status", routing.Wrap(cma.GetMigrationStatus))
	}, middleware.ReqGrafanaAdmin)
}

func (cma *CloudMigrationAPI) CreateToken(c *contextmodel.ReqContext) response.Response {
	err := cma.cloudMigrationsService.CreateToken(c.Req.Context())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "token creation error", err)
	}
	return response.Success("Token created")
}

func (cma *CloudMigrationAPI) Authenticate(c *contextmodel.ReqContext) response.Response {
	jwtToken := c.Req.Header.Get("Authorization")
	token := strings.TrimPrefix(jwtToken, "Bearer ")
	// token validation
	err := cma.cloudMigrationsService.ValidateToken(c.Req.Context(), token)
	if err != nil {
		return response.Error(http.StatusBadRequest, "token validation error", err)
	}
	err = cma.cloudMigrationsService.SaveEncryptedToken(c.Req.Context(), token)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "token save error", err)
	}
	return response.Success("Token saved")
}

func (cma *CloudMigrationAPI) GetMigrationList(c *contextmodel.ReqContext) response.Response {
	cloudMigrations, err := cma.cloudMigrationsService.GetMigrationList(c.Req.Context())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "migration list error", err)
	}
	return response.JSON(http.StatusOK, cloudMigrations)
}

func (cma *CloudMigrationAPI) GetMigration(c *contextmodel.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	cloudMigration, err := cma.cloudMigrationsService.GetMigration(c.Req.Context(), id)
	if err != nil {
		return response.Error(http.StatusNotFound, "migration not found", err)
	}
	return response.JSON(http.StatusOK, cloudMigration)
}

func (cma *CloudMigrationAPI) CreateMigration(c *contextmodel.ReqContext) response.Response {
	cmd := cloudmigration.CloudMigrationRequest{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cloudMigration, err := cma.cloudMigrationsService.CreateMigration(c.Req.Context(), cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "migration creation error", err)
	}
	return response.JSON(http.StatusOK, cloudMigration)
}

func (cma *CloudMigrationAPI) UpdateMigration(c *contextmodel.ReqContext) response.Response {
	cmd := cloudmigration.CloudMigrationRequest{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	cloudMigrationRun, err := cma.cloudMigrationsService.UpdateMigration(c.Req.Context(), id, cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "migration run error", err)
	}
	return response.JSON(http.StatusOK, cloudMigrationRun)
}

func (cma *CloudMigrationAPI) RunMigration(c *contextmodel.ReqContext) response.Response {
	cloudMigratonRun, err := cma.cloudMigrationsService.RunMigration(c.Req.Context(), web.Params(c.Req)[":uid"])
	if err != nil {
		return response.Error(http.StatusInternalServerError, "migration run error", err)
	}
	return response.JSON(http.StatusOK, cloudMigratonRun)
}

func (cma *CloudMigrationAPI) GetMigrationStatus(c *contextmodel.ReqContext) response.Response {
	migrationStatus, err := cma.cloudMigrationsService.GetMigrationStatus(c.Req.Context(), web.Params(c.Req)[":uid"])
	if err != nil {
		return response.Error(http.StatusInternalServerError, "migration status error", err)
	}
	return response.JSON(http.StatusOK, migrationStatus)
}

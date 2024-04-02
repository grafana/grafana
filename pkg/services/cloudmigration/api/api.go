package api

import (
	"bytes"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

type CloudMigrationAPI struct {
	cloudMigrationService cloudmigration.Service
	routeRegister         routing.RouteRegister
	log                   log.Logger
	tracer                tracing.Tracer
}

func RegisterApi(
	rr routing.RouteRegister,
	cms cloudmigration.Service,
	tracer tracing.Tracer,
) *CloudMigrationAPI {
	api := &CloudMigrationAPI{
		log:                   log.New("cloudmigrations.api"),
		routeRegister:         rr,
		cloudMigrationService: cms,
		tracer:                tracer,
	}
	api.registerEndpoints()
	return api
}

// RegisterAPIEndpoints Registers Endpoints on Grafana Router
func (cma *CloudMigrationAPI) registerEndpoints() {
	cma.routeRegister.Group("/api/cloudmigration", func(cloudMigrationRoute routing.RouteRegister) {
		// migration
		cloudMigrationRoute.Get("/migration", routing.Wrap(cma.GetMigrationList))
		cloudMigrationRoute.Post("/migration", routing.Wrap(cma.CreateMigration))
		cloudMigrationRoute.Get("/migration/:id", routing.Wrap(cma.GetMigration))
		cloudMigrationRoute.Delete("migration/:id", routing.Wrap(cma.DeleteMigration))
		cloudMigrationRoute.Post("/migration/:id/run", routing.Wrap(cma.RunMigration))
		cloudMigrationRoute.Get("/migration/:id/run", routing.Wrap(cma.GetMigrationRunList))
		cloudMigrationRoute.Get("/migration/:id/run/:runID", routing.Wrap(cma.GetMigrationRun))
		cloudMigrationRoute.Post("/token", routing.Wrap(cma.CreateToken))
	}, middleware.ReqGrafanaAdmin)
}

// swagger:route POST /cloudmigration/token migrations createCloudMigrationToken
//
// Create gcom access token.
//
// Responses:
// 200: cloudMigrationCreateTokenResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) CreateToken(c *contextmodel.ReqContext) response.Response {
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.CreateAccessToken")
	defer span.End()

	logger := cma.log.FromContext(ctx)

	resp, err := cma.cloudMigrationService.CreateToken(ctx)
	if err != nil {
		logger.Error("creating gcom access token", "err", err.Error())
		return response.Error(http.StatusInternalServerError, "creating gcom access token", err)
	}

	return response.JSON(http.StatusOK, cloudmigration.CreateAccessTokenResponseDTO(resp))
}

// swagger:route GET /cloudmigration/migration migrations getMigrationList
//
// Get a list of all cloud migrations.
//
// Responses:
// 200: cloudMigrationListResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) GetMigrationList(c *contextmodel.ReqContext) response.Response {
	cloudMigrations, err := cma.cloudMigrationService.GetMigrationList(c.Req.Context())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "migration list error", err)
	}

	return response.JSON(http.StatusOK, cloudMigrations)
}

// swagger:route GET /cloudmigration/migration/{id} migrations getCloudMigration
//
// Get a cloud migration.
//
// It returns migrations that has been created.
//
// Responses:
// 200: cloudMigrationResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) GetMigration(c *contextmodel.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	cloudMigration, err := cma.cloudMigrationService.GetMigration(c.Req.Context(), id)
	if err != nil {
		return response.Error(http.StatusNotFound, "migration not found", err)
	}
	return response.JSON(http.StatusOK, cloudMigration)
}

// swagger:parameters getCloudMigration
type GetCloudMigrationRequest struct {
	// ID of an migration
	//
	// in: path
	ID int64 `json:"id"`
}

// swagger:route POST /cloudmigration/migration migrations createMigration
//
// Create a migration.
//
// Responses:
// 200: cloudMigrationResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) CreateMigration(c *contextmodel.ReqContext) response.Response {
	cmd := cloudmigration.CloudMigrationRequest{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cloudMigration, err := cma.cloudMigrationService.CreateMigration(c.Req.Context(), cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "migration creation error", err)
	}
	return response.JSON(http.StatusOK, cloudMigration)
}

// swagger:route GET /cloudmigration/migration/{id}/run migrations runCloudMigration
//
// Trigger the run of a migration to the Grafana Cloud.
//
// It returns migrations that has been created.
//
// Responses:
// 200: cloudMigrationRunResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) RunMigration(c *contextmodel.ReqContext) response.Response {
	var items []cloudmigration.MigrateDataResponseItemDTO

	stringID := web.Params(c.Req)[":id"]
	id, err := strconv.ParseInt(stringID, 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	cmd := cloudmigration.MigrateDataRequestDTO{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	// Get migration to read the auth token
	migration, err := cma.cloudMigrationService.GetMigration(c.Req.Context(), id)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "migration get error", err)
	}
	// get CMS path from the config
	domain, err := cma.cloudMigrationService.ParseCloudMigrationConfig()
	if err != nil {
		return response.Error(http.StatusInternalServerError, "config parse error", err)
	}
	//path := fmt.Sprintf("%s/api/v1/migrate-data", domain)
	path := fmt.Sprintf("https://cms-dev-%s.%s/api/v1/migrate-data", migration.ClusterSlug, domain)

	// Get migration data JSON
	body, err := cma.cloudMigrationService.GetMigrationDataJSON(c.Req.Context(), id)
	if err != nil {
		cma.log.Error("error getting the json request body for migration run", "err", err.Error())
		return response.Error(http.StatusInternalServerError, "migration data get error", err)
	}

	req, err := http.NewRequest("POST", path, bytes.NewReader(body))
	if err != nil {
		cma.log.Error("error creating http request for cloud migration run", "err", err.Error())
		return response.Error(http.StatusInternalServerError, "http request error", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %d:%s", migration.StackID, migration.AuthToken))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		cma.log.Error("error sending http request for cloud migration run", "err", err.Error())
		return response.Error(http.StatusInternalServerError, "http request error", err)
	}
	defer func() {
		err = resp.Body.Close()
		cma.log.Error("error clousing response body", "err", err)
	}()

	_, err = cma.cloudMigrationService.SaveMigrationRun(c.Req.Context(), &cloudmigration.CloudMigrationRun{
		ID:     id,
		Result: body,
	})
	if err != nil {
		response.Error(http.StatusInternalServerError, "migration run save error", err)
	}

	result := cloudmigration.MigrateDataResponseDTO{
		Items: items,
	}

	return response.JSON(http.StatusOK, result)
}

// swagger:parameters runCloudMigration
type RunCloudMigrationRequest struct {
	// ID of an migration
	//
	// in: path
	ID int64 `json:"id"`
}

// swagger:route GET /cloudmigration/migration/{id}/run/{runID} migrations getCloudMigrationRun
//
// Get the result of a single migration run.
//
// Responses:
// 200: cloudMigrationRunResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) GetMigrationRun(c *contextmodel.ReqContext) response.Response {
	migrationStatus, err := cma.cloudMigrationService.GetMigrationStatus(c.Req.Context(), web.Params(c.Req)[":id"], web.Params(c.Req)[":runID"])
	if err != nil {
		return response.Error(http.StatusInternalServerError, "migration status error", err)
	}
	return response.JSON(http.StatusOK, migrationStatus)
}

// swagger:parameters getCloudMigrationRun
type GetMigrationRunParams struct {
	// ID of an migration
	//
	// in: path
	ID int64 `json:"id"`

	// Run ID of a migration run
	//
	// in: path
	RunID int64 `json:"runID"`
}

// swagger:route GET /cloudmigration/migration/{id}/run migrations getCloudMigrationRunList
//
// Get a list of migration runs for a migration.
//
// Responses:
// 200: cloudMigrationRunListResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) GetMigrationRunList(c *contextmodel.ReqContext) response.Response {
	migrationStatus, err := cma.cloudMigrationService.GetMigrationStatusList(c.Req.Context(), web.Params(c.Req)[":id"])
	if err != nil {
		return response.Error(http.StatusInternalServerError, "migration status error", err)
	}

	runList := cloudmigration.CloudMigrationRunList{Runs: migrationStatus}
	return response.JSON(http.StatusOK, runList)
}

// swagger:parameters getCloudMigrationRunList
type GetCloudMigrationRunList struct {
	// ID of an migration
	//
	// in: path
	ID int64 `json:"id"`
}

// swagger:route DELETE /cloudmigration/migration/{id} migrations deleteCloudMigration
//
// Delete a migration.
//
// Responses:
// 200
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) DeleteMigration(c *contextmodel.ReqContext) response.Response {
	err := cma.cloudMigrationService.DeleteMigration(c.Req.Context(), web.Params(c.Req)[":id"])
	if err != nil {
		return response.Error(http.StatusInternalServerError, "migration delete error", err)
	}
	return response.Empty(http.StatusOK)
}

// swagger:parameters deleteCloudMigration
type DeleteMigrationRequest struct {
	// ID of an migration
	//
	// in: path
	ID int64 `json:"id"`
}

// swagger:response cloudMigrationRunResponse
type CloudMigrationRunResponse struct {
	// in: body
	Body cloudmigration.CloudMigrationRun
}

// swagger:response cloudMigrationListResponse
type CloudMigrationListResponse struct {
	// in: body
	Body cloudmigration.CloudMigrationListResponse
}

// swagger:response cloudMigrationResponse
type CloudMigrationResponse struct {
	// in: body
	Body cloudmigration.CloudMigrationResponse
}

// swagger:response cloudMigrationRunListResponse
type CloudMigrationRunListResponse struct {
	// in: body
	Body cloudmigration.CloudMigrationRunList
}

// swagger:response cloudMigrationCreateTokenResponse
type CloudMigrationCreateTokenResponse struct {
	// in: body
	Body cloudmigration.CreateAccessTokenResponseDTO
}

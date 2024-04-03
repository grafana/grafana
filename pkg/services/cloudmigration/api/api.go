package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
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
		cloudMigrationRoute.Delete("/migration/:id", routing.Wrap(cma.DeleteMigration))
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
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.GetMigrationList")
	defer span.End()

	cloudMigrations, err := cma.cloudMigrationService.GetMigrationList(ctx)
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
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.GetMigration")
	defer span.End()

	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	cloudMigration, err := cma.cloudMigrationService.GetMigration(ctx, id)
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
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.CreateMigration")
	defer span.End()

	cmd := cloudmigration.CloudMigrationRequest{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cloudMigration, err := cma.cloudMigrationService.CreateMigration(ctx, cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "migration creation error", err)
	}
	return response.JSON(http.StatusOK, cloudMigration)
}

// swagger:route POST /cloudmigration/migration/{id}/run migrations runCloudMigration
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
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.RunMigration")
	defer span.End()
	logger := cma.log.FromContext(ctx)

	stringID := web.Params(c.Req)[":id"]
	id, err := strconv.ParseInt(stringID, 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	// Get migration to read the auth token
	migration, err := cma.cloudMigrationService.GetMigration(ctx, id)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "migration get error", err)
	}
	// get CMS path from the config
	domain, err := cma.cloudMigrationService.ParseCloudMigrationConfig()
	if err != nil {
		return response.Error(http.StatusInternalServerError, "config parse error", err)
	}
	path := fmt.Sprintf("https://cms-dev-%s.%s/cloud-migrations/api/v1/migrate-data", migration.ClusterSlug, domain)

	// Get migration data JSON
	body, err := cma.cloudMigrationService.GetMigrationDataJSON(ctx, id)
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
	} else if resp.StatusCode >= 400 {
		cma.log.Error("received error response for cloud migration run", "statusCode", resp.StatusCode)
		return response.Error(http.StatusInternalServerError, "http request error", fmt.Errorf("http request error while migrating data"))
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			logger.Error("closing request body: %w", err)
		}
	}()

	// read response so we can unmarshal it
	respData, err := io.ReadAll(resp.Body)
	if err != nil {
		logger.Error("reading response body: %w", err)
		return response.Error(http.StatusInternalServerError, "reading migration run response", err)
	}
	var result cloudmigration.MigrateDataResponseDTO
	if err := json.Unmarshal(respData, &result); err != nil {
		logger.Error("unmarshalling response body: %w", err)
		return response.Error(http.StatusInternalServerError, "unmarshalling migration run response", err)
	}

	_, err = cma.cloudMigrationService.SaveMigrationRun(ctx, &cloudmigration.CloudMigrationRun{
		CloudMigrationUID: stringID,
		Result:            respData,
	})
	if err != nil {
		response.Error(http.StatusInternalServerError, "migration run save error", err)
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
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.GetMigrationRun")
	defer span.End()

	migrationStatus, err := cma.cloudMigrationService.GetMigrationStatus(ctx, web.Params(c.Req)[":id"], web.Params(c.Req)[":runID"])
	if err != nil {
		return response.Error(http.StatusInternalServerError, "migration status error", err)
	}

	err, runResponse := migrationStatus.ToResponse(migrationStatus)
	if err != nil {
		cma.log.Error("could not return migration run", "err", err)
		return response.Error(http.StatusInternalServerError, "migration run get error", err)
	}

	return response.JSON(http.StatusOK, runResponse)
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
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.GetMigrationRunList")
	defer span.End()

	migrationStatuses, err := cma.cloudMigrationService.GetMigrationStatusList(ctx, web.Params(c.Req)[":id"])
	if err != nil {
		return response.Error(http.StatusInternalServerError, "migration status error", err)
	}

	runList := cloudmigration.CloudMigrationRunList{Runs: []cloudmigration.MigrateDataResponseDTO{}}
	for _, s := range migrationStatuses {
		// attempt to bind the raw result to a list of response item DTOs
		r := cloudmigration.MigrateDataResponseDTO{
			Items: []cloudmigration.MigrateDataResponseItemDTO{},
		}
		if err := json.Unmarshal(s.Result, &r); err != nil {
			return response.Error(http.StatusInternalServerError, "error unmarshalling migration response items", err)
		}
		r.RunID = s.ID
		runList.Runs = append(runList.Runs, r)
	}

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
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.DeleteMigration")
	defer span.End()

	idStr := web.Params(c.Req)[":id"]
	if idStr == "" {
		return response.Error(http.StatusBadRequest, "missing migration id", fmt.Errorf("missing migration id"))
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "migration id should be numeric", fmt.Errorf("migration id should be numeric"))
	}
	_, err = cma.cloudMigrationService.DeleteMigration(ctx, id)
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
	Body cloudmigration.CloudMigrationRunResponse
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

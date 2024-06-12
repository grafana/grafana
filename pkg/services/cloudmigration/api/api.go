package api

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/util"
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

// registerEndpoints Registers Endpoints on Grafana Router
func (cma *CloudMigrationAPI) registerEndpoints() {
	cma.routeRegister.Group("/api/cloudmigration", func(cloudMigrationRoute routing.RouteRegister) {
		cloudMigrationRoute.Get("/migration", routing.Wrap(cma.GetSessionList))
		cloudMigrationRoute.Post("/migration", routing.Wrap(cma.CreateSession))
		cloudMigrationRoute.Get("/migration/:uid", routing.Wrap(cma.GetSession))
		cloudMigrationRoute.Delete("/migration/:uid", routing.Wrap(cma.DeleteSession))

		// TODO new APIs for snapshot management to replace these
		cloudMigrationRoute.Post("/migration/:uid/run", routing.Wrap(cma.RunMigration))
		cloudMigrationRoute.Get("/migration/:uid/run", routing.Wrap(cma.GetMigrationRunList))
		cloudMigrationRoute.Get("/migration/run/:runUID", routing.Wrap(cma.GetMigrationRun))

		cloudMigrationRoute.Get("/token", routing.Wrap(cma.GetToken))
		cloudMigrationRoute.Post("/token", routing.Wrap(cma.CreateToken))
		cloudMigrationRoute.Delete("/token/:uid", routing.Wrap(cma.DeleteToken))
	}, middleware.ReqOrgAdmin)
}

// swagger:route GET /cloudmigration/token migrations getCloudMigrationToken
//
// Fetch the cloud migration token if it exists.
//
// Responses:
// 200: cloudMigrationGetTokenResponse
// 401: unauthorisedError
// 404: notFoundError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) GetToken(c *contextmodel.ReqContext) response.Response {
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.GetToken")
	defer span.End()

	logger := cma.log.FromContext(ctx)

	token, err := cma.cloudMigrationService.GetToken(ctx)
	if err != nil {
		if !errors.Is(err, cloudmigration.ErrTokenNotFound) {
			logger.Error("fetching cloud migration access token", "err", err.Error())
		}

		return response.ErrOrFallback(http.StatusInternalServerError, "fetching cloud migration access token", err)
	}

	return response.JSON(http.StatusOK, cloudmigration.GetAccessTokenResponseDTO{
		ID:          token.ID,
		DisplayName: token.DisplayName,
		ExpiresAt:   token.ExpiresAt,
		FirstUsedAt: token.FirstUsedAt,
		LastUsedAt:  token.LastUsedAt,
		CreatedAt:   token.CreatedAt,
	})
}

// swagger:parameters getCloudMigrationToken
type GetCloudMigrationToken struct {
}

// swagger:response cloudMigrationGetTokenResponse
type CloudMigrationGetTokenResponse struct {
	// in: body
	Body cloudmigration.GetAccessTokenResponseDTO
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
		return response.ErrOrFallback(http.StatusInternalServerError, "creating gcom access token", err)
	}

	return response.JSON(http.StatusOK, cloudmigration.CreateAccessTokenResponseDTO(resp))
}

// swagger:response cloudMigrationCreateTokenResponse
type CloudMigrationCreateTokenResponse struct {
	// in: body
	Body cloudmigration.CreateAccessTokenResponseDTO
}

// swagger:route DELETE /cloudmigration/token/{uid} migrations deleteCloudMigrationToken
//
// Deletes a cloud migration token.
//
// Responses:
// 204: cloudMigrationDeleteTokenResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) DeleteToken(c *contextmodel.ReqContext) response.Response {
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.DeleteToken")
	defer span.End()

	logger := cma.log.FromContext(ctx)

	uid := web.Params(c.Req)[":uid"]
	if err := util.ValidateUID(uid); err != nil {
		return response.Error(http.StatusBadRequest, "invalid migration uid", err)
	}

	if err := cma.cloudMigrationService.DeleteToken(ctx, uid); err != nil {
		logger.Error("deleting cloud migration token", "err", err.Error())
		return response.ErrOrFallback(http.StatusInternalServerError, "deleting cloud migration token", err)
	}

	return response.Empty(http.StatusNoContent)
}

// swagger:parameters deleteCloudMigrationToken
type DeleteCloudMigrationToken struct {
	// UID of a cloud migration token
	//
	// in: path
	UID string `json:"uid"`
}

// swagger:response cloudMigrationDeleteTokenResponse
type CloudMigrationDeleteTokenResponse struct {
}

// swagger:route GET /cloudmigration/migration migrations getSessionList
//
// Get a list of all cloud migration sessions that have been created.
//
// Responses:
// 200: cloudMigrationSessionListResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) GetSessionList(c *contextmodel.ReqContext) response.Response {
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.GetSessionList")
	defer span.End()

	sessions, err := cma.cloudMigrationService.GetSessionList(ctx)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "session list error", err)
	}

	return response.JSON(http.StatusOK, sessions)
}

// swagger:response cloudMigrationSessionListResponse
type CloudMigrationSessionListResponse struct {
	// in: body
	Body cloudmigration.CloudMigrationSessionListResponse
}

// swagger:route GET /cloudmigration/migration/{uid} migrations getSession
//
// Get a cloud migration session by its uid.
//
// Responses:
// 200: cloudMigrationSessionResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) GetSession(c *contextmodel.ReqContext) response.Response {
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.GetSession")
	defer span.End()

	uid := web.Params(c.Req)[":uid"]
	if err := util.ValidateUID(uid); err != nil {
		return response.Error(http.StatusBadRequest, "invalid session uid", err)
	}

	session, err := cma.cloudMigrationService.GetSession(ctx, uid)
	if err != nil {
		return response.ErrOrFallback(http.StatusNotFound, "session not found", err)
	}
	return response.JSON(http.StatusOK, session)
}

// swagger:parameters getSession
type GetCloudMigrationSessionRequest struct {
	// UID of a migration session
	//
	// in: path
	UID string `json:"uid"`
}

// swagger:response cloudMigrationSessionResponse
type CloudMigrationSessionResponse struct {
	// in: body
	Body cloudmigration.CloudMigrationSessionResponse
}

// swagger:route POST /cloudmigration/migration migrations createSession
//
// Create a migration session.
//
// Responses:
// 200: cloudMigrationSessionResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) CreateSession(c *contextmodel.ReqContext) response.Response {
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.CreateSession")
	defer span.End()

	cmd := cloudmigration.CloudMigrationSessionRequest{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.ErrOrFallback(http.StatusBadRequest, "bad request data", err)
	}
	session, err := cma.cloudMigrationService.CreateSession(ctx, cmd)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "session creation error", err)
	}
	return response.JSON(http.StatusOK, session)
}

// swagger:parameters createSession
type CreateSession struct {
	// in:body
	// required:true
	Body cloudmigration.CloudMigrationSessionRequest
}

// swagger:route POST /cloudmigration/migration/{uid}/run migrations runCloudMigration
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

	uid := web.Params(c.Req)[":uid"]
	if err := util.ValidateUID(uid); err != nil {
		return response.ErrOrFallback(http.StatusBadRequest, "invalid migration uid", err)
	}

	result, err := cma.cloudMigrationService.RunMigration(ctx, uid)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "migration run error", err)
	}

	return response.JSON(http.StatusOK, result)
}

// swagger:parameters runCloudMigration
type RunCloudMigrationRequest struct {
	// UID of a migration
	//
	// in: path
	UID string `json:"uid"`
}

// swagger:response cloudMigrationRunResponse
type CloudMigrationRunResponse struct {
	// in: body
	Body cloudmigration.MigrateDataResponseDTO
}

// swagger:route GET /cloudmigration/migration/run/{runUID} migrations getCloudMigrationRun
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

	runUid := web.Params(c.Req)[":runUID"]
	if err := util.ValidateUID(runUid); err != nil {
		return response.ErrOrFallback(http.StatusBadRequest, "invalid runUID", err)
	}

	migrationStatus, err := cma.cloudMigrationService.GetMigrationStatus(ctx, runUid)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "migration status error", err)
	}

	runResponse, err := migrationStatus.ToResponse()
	if err != nil {
		cma.log.Error("could not return migration run", "err", err)
		return response.Error(http.StatusInternalServerError, "migration run get error", err)
	}

	return response.JSON(http.StatusOK, runResponse)
}

// swagger:parameters getCloudMigrationRun
type GetMigrationRunParams struct {
	// RunUID of a migration run
	//
	// in: path
	RunUID string `json:"runUID"`
}

// swagger:route GET /cloudmigration/migration/{uid}/run migrations getCloudMigrationRunList
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

	uid := web.Params(c.Req)[":uid"]
	if err := util.ValidateUID(uid); err != nil {
		return response.ErrOrFallback(http.StatusBadRequest, "invalid migration uid", err)
	}

	runList, err := cma.cloudMigrationService.GetMigrationRunList(ctx, uid)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "list migration status error", err)
	}

	return response.JSON(http.StatusOK, runList)
}

// swagger:parameters getCloudMigrationRunList
type GetCloudMigrationRunList struct {
	// UID of a migration
	//
	// in: path
	UID string `json:"uid"`
}

// swagger:response cloudMigrationRunListResponse
type CloudMigrationRunListResponse struct {
	// in: body
	Body cloudmigration.SnapshotList
}

// swagger:route DELETE /cloudmigration/migration/{uid} migrations deleteSession
//
// Delete a migration session by its uid.
//
// Responses:
// 200
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) DeleteSession(c *contextmodel.ReqContext) response.Response {
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.DeleteSession")
	defer span.End()

	uid := web.Params(c.Req)[":uid"]
	if err := util.ValidateUID(uid); err != nil {
		return response.ErrOrFallback(http.StatusBadRequest, "invalid session uid", err)
	}

	_, err := cma.cloudMigrationService.DeleteSession(ctx, uid)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "session delete error", err)
	}
	return response.Empty(http.StatusOK)
}

// swagger:parameters deleteSession
type DeleteMigrationSessionRequest struct {
	// UID of a migration session
	//
	// in: path
	UID string `json:"uid"`
}

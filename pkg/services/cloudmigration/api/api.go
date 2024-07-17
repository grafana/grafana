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
		// destination instance endpoints for token management
		cloudMigrationRoute.Get("/token", routing.Wrap(cma.GetToken))
		cloudMigrationRoute.Post("/token", routing.Wrap(cma.CreateToken))
		cloudMigrationRoute.Delete("/token/:uid", routing.Wrap(cma.DeleteToken))

		// on-prem instance endpoints for managing GMS sessions
		cloudMigrationRoute.Get("/migration", routing.Wrap(cma.GetSessionList))
		cloudMigrationRoute.Post("/migration", routing.Wrap(cma.CreateSession))
		cloudMigrationRoute.Get("/migration/:uid", routing.Wrap(cma.GetSession))
		cloudMigrationRoute.Delete("/migration/:uid", routing.Wrap(cma.DeleteSession))

		// sync approach to data migration
		cloudMigrationRoute.Post("/migration/:uid/run", routing.Wrap(cma.RunMigration))
		cloudMigrationRoute.Get("/migration/:uid/run", routing.Wrap(cma.GetMigrationRunList))
		cloudMigrationRoute.Get("/migration/run/:runUID", routing.Wrap(cma.GetMigrationRun))

		// async approach to data migration using snapshots
		cloudMigrationRoute.Post("/migration/:uid/snapshot", routing.Wrap(cma.CreateSnapshot))
		cloudMigrationRoute.Get("/migration/:uid/snapshot/:snapshotUid", routing.Wrap(cma.GetSnapshot))
		cloudMigrationRoute.Get("/migration/:uid/snapshots", routing.Wrap(cma.GetSnapshotList))
		cloudMigrationRoute.Post("/migration/:uid/snapshot/:snapshotUid/upload", routing.Wrap(cma.UploadSnapshot))
		cloudMigrationRoute.Post("/migration/:uid/snapshot/:snapshotUid/cancel", routing.Wrap(cma.CancelSnapshot))
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

	return response.JSON(http.StatusOK, GetAccessTokenResponseDTO{
		ID:          token.ID,
		DisplayName: token.DisplayName,
		ExpiresAt:   token.ExpiresAt,
		FirstUsedAt: token.FirstUsedAt,
		LastUsedAt:  token.LastUsedAt,
		CreatedAt:   token.CreatedAt,
	})
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

	return response.JSON(http.StatusOK, CreateAccessTokenResponseDTO(resp))
}

// swagger:route DELETE /cloudmigration/token/{uid} migrations deleteCloudMigrationToken
//
// Deletes a cloud migration token.
//
// Responses:
// 204: cloudMigrationDeleteTokenResponse
// 400: badRequestError
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

	sl, err := cma.cloudMigrationService.GetSessionList(ctx)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "session list error", err)
	}

	return response.JSON(http.StatusOK, convertSessionListToDTO(*sl))
}

// swagger:route GET /cloudmigration/migration/{uid} migrations getSession
//
// Get a cloud migration session by its uid.
//
// Responses:
// 200: cloudMigrationSessionResponse
// 400: badRequestError
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

	s, err := cma.cloudMigrationService.GetSession(ctx, uid)
	if err != nil {
		return response.ErrOrFallback(http.StatusNotFound, "session not found", err)
	}

	return response.JSON(http.StatusOK, CloudMigrationSessionResponseDTO{
		UID:     s.UID,
		Slug:    s.Slug,
		Created: s.Created,
		Updated: s.Updated,
	})
}

// swagger:route POST /cloudmigration/migration migrations createSession
//
// Create a migration session.
//
// Responses:
// 200: cloudMigrationSessionResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) CreateSession(c *contextmodel.ReqContext) response.Response {
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.CreateSession")
	defer span.End()

	cmd := CloudMigrationSessionRequestDTO{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.ErrOrFallback(http.StatusBadRequest, "bad request data", err)
	}
	s, err := cma.cloudMigrationService.CreateSession(ctx, cloudmigration.CloudMigrationSessionRequest{
		AuthToken: cmd.AuthToken,
	})
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "session creation error", err)
	}

	return response.JSON(http.StatusOK, CloudMigrationSessionResponseDTO{
		UID:     s.UID,
		Slug:    s.Slug,
		Created: s.Created,
		Updated: s.Updated,
	})
}

// swagger:route POST /cloudmigration/migration/{uid}/run migrations runCloudMigration
//
// Trigger the run of a migration to the Grafana Cloud.
//
// It returns migrations that has been created.
//
// Responses:
// 200: cloudMigrationRunResponse
// 400: badRequestError
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

	return response.JSON(http.StatusOK, convertMigrateDataResponseToDTO(*result))
}

// swagger:route GET /cloudmigration/migration/run/{runUID} migrations getCloudMigrationRun
//
// Get the result of a single migration run.
//
// Responses:
// 200: cloudMigrationRunResponse
// 400: badRequestError
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

	result, err := migrationStatus.GetResult()
	if err != nil {
		cma.log.Error("could not return migration run", "err", err)
		return response.Error(http.StatusInternalServerError, "migration run get error", err)
	}

	return response.JSON(http.StatusOK, convertMigrateDataResponseToDTO(*result))
}

// swagger:route GET /cloudmigration/migration/{uid}/run migrations getCloudMigrationRunList
//
// Get a list of migration runs for a migration.
//
// Responses:
// 200: cloudMigrationRunListResponse
// 400: badRequestError
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

	runs := make([]MigrateDataResponseListDTO, len(runList.Runs))
	for i := 0; i < len(runList.Runs); i++ {
		runs[i] = MigrateDataResponseListDTO{runList.Runs[i].RunUID}
	}
	return response.JSON(http.StatusOK, CloudMigrationRunListDTO{
		Runs: runs,
	})
}

// swagger:route DELETE /cloudmigration/migration/{uid} migrations deleteSession
//
// Delete a migration session by its uid.
//
// Responses:
// 200
// 401: unauthorisedError
// 400: badRequestError
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

// swagger:route POST /cloudmigration/migration/{uid}/snapshot migrations createSnapshot
//
// Trigger the creation of an instance snapshot associated with the provided session.
// If the snapshot initialization is successful, the snapshot uid is returned.
//
// Responses:
// 200: createSnapshotResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) CreateSnapshot(c *contextmodel.ReqContext) response.Response {
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.CreateSnapshot")
	defer span.End()

	uid := web.Params(c.Req)[":uid"]

	if err := util.ValidateUID(uid); err != nil {
		return response.ErrOrFallback(http.StatusBadRequest, "invalid session uid", err)
	}

	ss, err := cma.cloudMigrationService.CreateSnapshot(ctx, c.SignedInUser, uid)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "error creating snapshot", err)
	}

	return response.JSON(http.StatusOK, CreateSnapshotResponseDTO{
		SnapshotUID: ss.UID,
	})
}

// swagger:route GET /cloudmigration/migration/{uid}/snapshot/{snapshotUid} migrations getSnapshot
//
// Get metadata about a snapshot, including where it is in its processing and final results.
//
// Responses:
// 200: getSnapshotResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) GetSnapshot(c *contextmodel.ReqContext) response.Response {
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.GetSnapshot")
	defer span.End()

	sessUid, snapshotUid := web.Params(c.Req)[":uid"], web.Params(c.Req)[":snapshotUid"]
	if err := util.ValidateUID(sessUid); err != nil {
		return response.ErrOrFallback(http.StatusBadRequest, "invalid session uid", err)
	}
	if err := util.ValidateUID(snapshotUid); err != nil {
		return response.ErrOrFallback(http.StatusBadRequest, "invalid snapshot uid", err)
	}

	q := cloudmigration.GetSnapshotsQuery{
		SnapshotUID: snapshotUid,
		SessionUID:  sessUid,
		ResultPage:  c.QueryInt("resultPage"),
		ResultLimit: c.QueryInt("resultLimit"),
	}
	if q.ResultLimit == 0 {
		q.ResultLimit = 100
	}
	if q.ResultPage < 1 {
		q.ResultPage = 1
	}
	snapshot, err := cma.cloudMigrationService.GetSnapshot(ctx, q)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "error retrieving snapshot", err)
	}

	results := snapshot.Resources

	dtoResults := make([]MigrateDataResponseItemDTO, len(results))
	for i := 0; i < len(results); i++ {
		dtoResults[i] = MigrateDataResponseItemDTO{
			Type:   MigrateDataType(results[i].Type),
			RefID:  results[i].RefID,
			Status: ItemStatus(results[i].Status),
			Error:  results[i].Error,
		}
	}

	dtoStats := SnapshotResourceStats{
		Types:    make(map[MigrateDataType]int, len(snapshot.StatsRollup.CountsByStatus)),
		Statuses: make(map[ItemStatus]int, len(snapshot.StatsRollup.CountsByType)),
	}
	for s, c := range snapshot.StatsRollup.CountsByStatus {
		dtoStats.Statuses[ItemStatus(s)] = c
	}
	for s, c := range snapshot.StatsRollup.CountsByType {
		dtoStats.Types[MigrateDataType(s)] = c
	}

	respDto := GetSnapshotResponseDTO{
		SnapshotDTO: SnapshotDTO{
			SnapshotUID: snapshot.UID,
			Status:      fromSnapshotStatus(snapshot.Status),
			SessionUID:  sessUid,
			Created:     snapshot.Created,
			Finished:    snapshot.Finished,
		},
		Results:     dtoResults,
		StatsRollup: dtoStats,
	}

	return response.JSON(http.StatusOK, respDto)
}

// swagger:route GET /cloudmigration/migration/{uid}/snapshots migrations getShapshotList
//
// Get a list of snapshots for a session.
//
// Responses:
// 200: snapshotListResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) GetSnapshotList(c *contextmodel.ReqContext) response.Response {
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.GetShapshotList")
	defer span.End()

	uid := web.Params(c.Req)[":uid"]
	if err := util.ValidateUID(uid); err != nil {
		return response.ErrOrFallback(http.StatusBadRequest, "invalid session uid", err)
	}
	q := cloudmigration.ListSnapshotsQuery{
		SessionUID: uid,
		Limit:      c.QueryInt("limit"),
		Page:       c.QueryInt("page"),
	}
	if q.Limit == 0 {
		q.Limit = 100
	}
	if q.Page < 1 {
		q.Page = 1
	}

	snapshotList, err := cma.cloudMigrationService.GetSnapshotList(ctx, q)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "error retrieving snapshot list", err)
	}

	dtos := make([]SnapshotDTO, len(snapshotList))
	for i := 0; i < len(snapshotList); i++ {
		dtos[i] = SnapshotDTO{
			SnapshotUID: snapshotList[i].UID,
			Status:      fromSnapshotStatus(snapshotList[i].Status),
			SessionUID:  uid,
			Created:     snapshotList[i].Created,
			Finished:    snapshotList[i].Finished,
		}
	}

	return response.JSON(http.StatusOK, SnapshotListResponseDTO{
		Snapshots: dtos,
	})
}

// swagger:route POST /cloudmigration/migration/{uid}/snapshot/{snapshotUid}/upload migrations uploadSnapshot
//
// Upload a snapshot to the Grafana Migration Service for processing.
//
// Responses:
// 200:
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) UploadSnapshot(c *contextmodel.ReqContext) response.Response {
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.UploadSnapshot")
	defer span.End()

	sessUid, snapshotUid := web.Params(c.Req)[":uid"], web.Params(c.Req)[":snapshotUid"]
	if err := util.ValidateUID(sessUid); err != nil {
		return response.ErrOrFallback(http.StatusBadRequest, "invalid session uid", err)
	}
	if err := util.ValidateUID(snapshotUid); err != nil {
		return response.ErrOrFallback(http.StatusBadRequest, "invalid snapshot uid", err)
	}

	if err := cma.cloudMigrationService.UploadSnapshot(ctx, sessUid, snapshotUid); err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "error uploading snapshot", err)
	}

	return response.JSON(http.StatusOK, nil)
}

// swagger:route POST /cloudmigration/migration/{uid}/snapshot/{snapshotUid}/cancel migrations cancelSnapshot
//
// Cancel a snapshot, wherever it is in its processing chain.
// TODO: Implement
//
// Responses:
// 200:
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (cma *CloudMigrationAPI) CancelSnapshot(c *contextmodel.ReqContext) response.Response {
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.CancelSnapshot")
	defer span.End()

	sessUid, snapshotUid := web.Params(c.Req)[":uid"], web.Params(c.Req)[":snapshotUid"]
	if err := util.ValidateUID(sessUid); err != nil {
		return response.ErrOrFallback(http.StatusBadRequest, "invalid session uid", err)
	}
	if err := util.ValidateUID(snapshotUid); err != nil {
		return response.ErrOrFallback(http.StatusBadRequest, "invalid snapshot uid", err)
	}

	if err := cma.cloudMigrationService.CancelSnapshot(ctx, sessUid, snapshotUid); err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "error canceling snapshot", err)
	}

	return response.JSON(http.StatusOK, nil)
}

package api

import (
	"errors"
	"net/http"
	"strings"

	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
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
	resourceDependencyMap cloudmigration.DependencyMap
}

func RegisterApi(
	rr routing.RouteRegister,
	cms cloudmigration.Service,
	tracer tracing.Tracer,
	acHandler accesscontrol.AccessControl,
	resourceDependencyMap cloudmigration.DependencyMap,
) *CloudMigrationAPI {
	api := &CloudMigrationAPI{
		log:                   log.New("cloudmigrations.api"),
		routeRegister:         rr,
		cloudMigrationService: cms,
		tracer:                tracer,
		resourceDependencyMap: resourceDependencyMap,
	}
	api.registerEndpoints(acHandler)
	return api
}

// registerEndpoints Registers Endpoints on Grafana Router
func (cma *CloudMigrationAPI) registerEndpoints(acHandler accesscontrol.AccessControl) {
	authorize := accesscontrol.Middleware(acHandler)

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

		// async approach to data migration using snapshots
		cloudMigrationRoute.Post("/migration/:uid/snapshot", routing.Wrap(cma.CreateSnapshot))
		cloudMigrationRoute.Get("/migration/:uid/snapshot/:snapshotUid", routing.Wrap(cma.GetSnapshot))
		cloudMigrationRoute.Get("/migration/:uid/snapshots", routing.Wrap(cma.GetSnapshotList))
		cloudMigrationRoute.Post("/migration/:uid/snapshot/:snapshotUid/upload", routing.Wrap(cma.UploadSnapshot))
		cloudMigrationRoute.Post("/migration/:uid/snapshot/:snapshotUid/cancel", routing.Wrap(cma.CancelSnapshot))

		// resource dependency list
		cloudMigrationRoute.Get("/resources/dependencies", routing.Wrap(cma.GetResourceDependencies))
	}, authorize(cloudmigration.MigrationAssistantAccess))
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
		span.SetStatus(codes.Error, "fetching cloud migration access token")
		span.RecordError(err)

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
		span.SetStatus(codes.Error, "creating gcom access token")
		span.RecordError(err)
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
		span.SetStatus(codes.Error, "invalid migration uid")
		span.RecordError(err)

		return response.Error(http.StatusBadRequest, "invalid migration uid", err)
	}

	if err := cma.cloudMigrationService.DeleteToken(ctx, uid); err != nil {
		span.SetStatus(codes.Error, "deleting cloud migration token")
		span.RecordError(err)
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

	sl, err := cma.cloudMigrationService.GetSessionList(ctx, c.OrgID)
	if err != nil {
		span.SetStatus(codes.Error, "session list error")
		span.RecordError(err)

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
		span.SetStatus(codes.Error, "invalid session uid")
		span.RecordError(err)

		return response.Error(http.StatusBadRequest, "invalid session uid", err)
	}

	s, err := cma.cloudMigrationService.GetSession(ctx, c.OrgID, uid)
	if err != nil {
		span.SetStatus(codes.Error, "session not found")
		span.RecordError(err)

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
		span.SetStatus(codes.Error, "bad request data")
		span.RecordError(err)

		return response.ErrOrFallback(http.StatusBadRequest, "bad request data", err)
	}
	s, err := cma.cloudMigrationService.CreateSession(ctx, c.SignedInUser, cloudmigration.CloudMigrationSessionRequest{
		AuthToken: cmd.AuthToken,
		OrgID:     c.OrgID,
	})
	if err != nil {
		span.SetStatus(codes.Error, "session creation error")
		span.RecordError(err)

		return response.ErrOrFallback(http.StatusInternalServerError, "session creation error", err)
	}

	return response.JSON(http.StatusOK, CloudMigrationSessionResponseDTO{
		UID:     s.UID,
		Slug:    s.Slug,
		Created: s.Created,
		Updated: s.Updated,
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
		span.SetStatus(codes.Error, "invalid session uid")
		span.RecordError(err)

		return response.ErrOrFallback(http.StatusBadRequest, "invalid session uid", err)
	}

	_, err := cma.cloudMigrationService.DeleteSession(ctx, c.OrgID, c.SignedInUser, uid)
	if err != nil {
		span.SetStatus(codes.Error, "session delete error")
		span.RecordError(err)

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
		span.SetStatus(codes.Error, "invalid session uid")
		span.RecordError(err)

		return response.ErrOrFallback(http.StatusBadRequest, "invalid session uid", err)
	}

	var cmd CreateSnapshotRequestDTO
	if err := web.Bind(c.Req, &cmd); err != nil {
		span.SetStatus(codes.Error, "invalid request body")
		span.RecordError(err)

		return response.ErrOrFallback(http.StatusBadRequest, "invalid request body", err)
	}

	if len(cmd.ResourceTypes) == 0 {
		return response.ErrOrFallback(http.StatusBadRequest, "at least one resource type is required", cloudmigration.ErrEmptyResourceTypes)
	}

	rawResourceTypes := make([]cloudmigration.MigrateDataType, 0, len(cmd.ResourceTypes))
	for _, t := range cmd.ResourceTypes {
		rawResourceTypes = append(rawResourceTypes, cloudmigration.MigrateDataType(t))
	}

	resourceTypes, err := cma.resourceDependencyMap.Parse(rawResourceTypes)
	if err != nil {
		span.SetStatus(codes.Error, "invalid resource types")
		span.RecordError(err)

		return response.ErrOrFallback(http.StatusBadRequest, "invalid resource types", err)
	}

	ss, err := cma.cloudMigrationService.CreateSnapshot(ctx, c.SignedInUser, cloudmigration.CreateSnapshotCommand{
		SessionUID:    uid,
		ResourceTypes: resourceTypes,
	})
	if err != nil {
		span.SetStatus(codes.Error, "error creating snapshot")
		span.RecordError(err)

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
		span.SetStatus(codes.Error, "invalid session uid")
		span.RecordError(err)

		return response.ErrOrFallback(http.StatusBadRequest, "invalid session uid", err)
	}
	if err := util.ValidateUID(snapshotUid); err != nil {
		span.SetStatus(codes.Error, "invalid snapshot uid")
		span.RecordError(err)

		return response.ErrOrFallback(http.StatusBadRequest, "invalid snapshot uid", err)
	}

	page := getQueryPageParams(c.QueryInt("resultPage"), cloudmigration.ResultPage(1))
	lim := getQueryPageParams(c.QueryInt("resultLimit"), cloudmigration.ResultLimit(100))
	col := getQueryCol(c.Query("resultSortColumn"), cloudmigration.SortColumnID)
	order := getQueryOrder(c.Query("resultSortOrder"), cloudmigration.SortOrderAsc)
	errorsOnly := c.QueryBool("errorsOnly")
	// Don't allow the user to reverse-sort by ID
	if col == cloudmigration.SortColumnID && order == cloudmigration.SortOrderDesc {
		order = cloudmigration.SortOrderAsc
	}

	q := cloudmigration.GetSnapshotsQuery{
		SnapshotUID: snapshotUid,
		SessionUID:  sessUid,
		OrgID:       c.OrgID,
		SnapshotResultQueryParams: cloudmigration.SnapshotResultQueryParams{
			ResultPage:  page,
			ResultLimit: lim,
			SortColumn:  col,
			SortOrder:   order,
			ErrorsOnly:  errorsOnly,
		},
	}

	snapshot, err := cma.cloudMigrationService.GetSnapshot(ctx, q)
	if err != nil {
		span.SetStatus(codes.Error, "error retrieving snapshot")
		span.RecordError(err)

		return response.ErrOrFallback(http.StatusInternalServerError, "error retrieving snapshot", err)
	}

	results := snapshot.Resources

	// convert the results to DTOs
	dtoResults := make([]MigrateDataResponseItemDTO, len(results))
	for i := 0; i < len(results); i++ {
		dtoResults[i] = MigrateDataResponseItemDTO{
			Name:       results[i].Name,
			Type:       MigrateDataType(results[i].Type),
			RefID:      results[i].RefID,
			Status:     ItemStatus(results[i].Status),
			Message:    results[i].Error,
			ErrorCode:  ItemErrorCode(results[i].ErrorCode),
			ParentName: results[i].ParentName,
		}
	}

	dtoStats := SnapshotResourceStats{
		Types:    make(map[MigrateDataType]int, len(snapshot.StatsRollup.CountsByStatus)),
		Statuses: make(map[ItemStatus]int, len(snapshot.StatsRollup.CountsByType)),
		Total:    snapshot.StatsRollup.Total,
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

type PageParam interface {
	~int // any int or underlying int type
}

func getQueryPageParams[D PageParam](page int, def D) D {
	if page < 1 || page > 10000 {
		return def
	}
	return D(page)
}

func getQueryCol(col string, defaultCol cloudmigration.ResultSortColumn) cloudmigration.ResultSortColumn {
	switch strings.ToLower(col) {
	case string(cloudmigration.SortColumnID):
		return cloudmigration.SortColumnID
	case string(cloudmigration.SortColumnName):
		return cloudmigration.SortColumnName
	case string(cloudmigration.SortColumnType):
		return cloudmigration.SortColumnType
	case string(cloudmigration.SortColumnStatus):
		return cloudmigration.SortColumnStatus
	default:
		return defaultCol
	}
}

func getQueryOrder(order string, defaultOrder cloudmigration.SortOrder) cloudmigration.SortOrder {
	switch strings.ToUpper(order) {
	case string(cloudmigration.SortOrderAsc):
		return cloudmigration.SortOrderAsc
	case string(cloudmigration.SortOrderDesc):
		return cloudmigration.SortOrderDesc
	default:
		return defaultOrder
	}
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
	ctx, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.GetSnapshotList")
	defer span.End()

	uid := web.Params(c.Req)[":uid"]
	if err := util.ValidateUID(uid); err != nil {
		span.SetStatus(codes.Error, "invalid session uid")
		span.RecordError(err)

		return response.ErrOrFallback(http.StatusBadRequest, "invalid session uid", err)
	}
	q := cloudmigration.ListSnapshotsQuery{
		SessionUID: uid,
		Limit:      getQueryPageParams(c.QueryInt("limit"), 100),
		Page:       getQueryPageParams(c.QueryInt("page"), 1),
		// TODO: change to pattern used by GetSnapshot results
		Sort:  c.Query("sort"),
		OrgID: c.OrgID,
	}

	snapshotList, err := cma.cloudMigrationService.GetSnapshotList(ctx, q)
	if err != nil {
		span.SetStatus(codes.Error, "error retrieving snapshot list")
		span.RecordError(err)

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
		span.SetStatus(codes.Error, "invalid session uid")
		span.RecordError(err)

		return response.ErrOrFallback(http.StatusBadRequest, "invalid session uid", err)
	}
	if err := util.ValidateUID(snapshotUid); err != nil {
		span.SetStatus(codes.Error, "invalid snapshot uid")
		span.RecordError(err)

		return response.ErrOrFallback(http.StatusBadRequest, "invalid snapshot uid", err)
	}

	if err := cma.cloudMigrationService.UploadSnapshot(ctx, c.OrgID, c.SignedInUser, sessUid, snapshotUid); err != nil {
		span.SetStatus(codes.Error, "error uploading snapshot")
		span.RecordError(err)

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
		span.SetStatus(codes.Error, "invalid session uid")
		span.RecordError(err)

		return response.ErrOrFallback(http.StatusBadRequest, "invalid session uid", err)
	}
	if err := util.ValidateUID(snapshotUid); err != nil {
		span.SetStatus(codes.Error, "invalid snapshot uid")
		span.RecordError(err)

		return response.ErrOrFallback(http.StatusBadRequest, "invalid snapshot uid", err)
	}

	if err := cma.cloudMigrationService.CancelSnapshot(ctx, sessUid, snapshotUid); err != nil {
		span.SetStatus(codes.Error, "error canceling snapshot")
		span.RecordError(err)

		return response.ErrOrFallback(http.StatusInternalServerError, "error canceling snapshot", err)
	}

	return response.JSON(http.StatusOK, nil)
}

// swagger:route GET /cloudmigration/resources/dependencies migrations getResourceDependencies
//
// Get the resource dependencies graph for the current set of migratable resources.
//
// Responses:
// 200: resourceDependenciesResponse
func (cma *CloudMigrationAPI) GetResourceDependencies(c *contextmodel.ReqContext) response.Response {
	_, span := cma.tracer.Start(c.Req.Context(), "MigrationAPI.GetResourceDependencies")
	defer span.End()

	resourceDependencies := make([]ResourceDependencyDTO, 0, len(cma.resourceDependencyMap))
	for resourceType, dependencies := range cma.resourceDependencyMap {
		dependencyNames := make([]MigrateDataType, 0, len(dependencies))
		for _, dependency := range dependencies {
			dependencyNames = append(dependencyNames, MigrateDataType(dependency))
		}

		resourceDependencies = append(resourceDependencies, ResourceDependencyDTO{
			ResourceType: MigrateDataType(resourceType),
			Dependencies: dependencyNames,
		})
	}

	return response.JSON(http.StatusOK, ResourceDependenciesResponseDTO{
		ResourceDependencies: resourceDependencies,
	})
}

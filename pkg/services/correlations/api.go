package correlations

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"

	"github.com/grafana/grafana/pkg/web"
)

func (s *CorrelationsService) registerAPIEndpoints() {
	uidScope := datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":uid"))
	authorize := ac.Middleware(s.AccessControl)

	s.RouteRegister.Get("/api/datasources/correlations", middleware.ReqSignedIn, authorize(middleware.ReqSignedIn, ac.EvalPermission(datasources.ActionRead)), routing.Wrap(s.getCorrelationsHandler))

	s.RouteRegister.Group("/api/datasources/uid/:uid/correlations", func(entities routing.RouteRegister) {
		entities.Get("/", authorize(middleware.ReqSignedIn, ac.EvalPermission(datasources.ActionRead)), routing.Wrap(s.getCorrelationsBySourceUIDHandler))
		entities.Post("/", authorize(middleware.ReqOrgAdmin, ac.EvalPermission(datasources.ActionWrite, uidScope)), routing.Wrap(s.createHandler))

		entities.Group("/:correlationUID", func(entities routing.RouteRegister) {
			entities.Get("/", authorize(middleware.ReqSignedIn, ac.EvalPermission(datasources.ActionRead)), routing.Wrap(s.getCorrelationHandler))
			entities.Delete("/", authorize(middleware.ReqOrgAdmin, ac.EvalPermission(datasources.ActionWrite, uidScope)), routing.Wrap(s.deleteHandler))
			entities.Patch("/", authorize(middleware.ReqOrgAdmin, ac.EvalPermission(datasources.ActionWrite, uidScope)), routing.Wrap(s.updateHandler))
		})
	}, middleware.ReqSignedIn)
}

// swagger:route POST /datasources/uid/{sourceUID}/correlations correlations createCorrelation
//
// Add correlation.
//
// Responses:
// 200: createCorrelationResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (s *CorrelationsService) createHandler(c *models.ReqContext) response.Response {
	cmd := CreateCorrelationCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.SourceUID = web.Params(c.Req)[":uid"]
	cmd.OrgId = c.OrgID

	correlation, err := s.CreateCorrelation(c.Req.Context(), cmd)
	if err != nil {
		if errors.Is(err, ErrSourceDataSourceDoesNotExists) || errors.Is(err, ErrTargetDataSourceDoesNotExists) {
			return response.Error(http.StatusNotFound, "Data source not found", err)
		}

		if errors.Is(err, ErrSourceDataSourceReadOnly) {
			return response.Error(http.StatusForbidden, "Data source is read only", err)
		}

		return response.Error(http.StatusInternalServerError, "Failed to add correlation", err)
	}

	return response.JSON(http.StatusOK, CreateCorrelationResponseBody{Result: correlation, Message: "Correlation created"})
}

// swagger:parameters createCorrelation
type CreateCorrelationParams struct {
	// in:body
	// required:true
	Body CreateCorrelationCommand `json:"body"`
	// in:path
	// required:true
	SourceUID string `json:"sourceUID"`
}

//swagger:response createCorrelationResponse
type CreateCorrelationResponse struct {
	// in: body
	Body CreateCorrelationResponseBody `json:"body"`
}

// swagger:route DELETE /datasources/uid/{uid}/correlations/{correlationUID} correlations deleteCorrelation
//
// Delete a correlation.
//
// Responses:
// 200: deleteCorrelationResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (s *CorrelationsService) deleteHandler(c *models.ReqContext) response.Response {
	cmd := DeleteCorrelationCommand{
		UID:       web.Params(c.Req)[":correlationUID"],
		SourceUID: web.Params(c.Req)[":uid"],
		OrgId:     c.OrgID,
	}

	err := s.DeleteCorrelation(c.Req.Context(), cmd)
	if err != nil {
		if errors.Is(err, ErrSourceDataSourceDoesNotExists) {
			return response.Error(http.StatusNotFound, "Data source not found", err)
		}

		if errors.Is(err, ErrCorrelationNotFound) {
			return response.Error(http.StatusNotFound, "Correlation not found", err)
		}

		if errors.Is(err, ErrSourceDataSourceReadOnly) {
			return response.Error(http.StatusForbidden, "Data source is read only", err)
		}

		return response.Error(http.StatusInternalServerError, "Failed to delete correlation", err)
	}

	return response.JSON(http.StatusOK, DeleteCorrelationResponseBody{Message: "Correlation deleted"})
}

// swagger:parameters deleteCorrelation
type DeleteCorrelationParams struct {
	// in:path
	// required:true
	DatasourceUID string `json:"uid"`
	// in:path
	// required:true
	CorrelationUID string `json:"correlationUID"`
}

//swagger:response deleteCorrelationResponse
type DeleteCorrelationResponse struct {
	// in: body
	Body DeleteCorrelationResponseBody `json:"body"`
}

// swagger:route PATCH /datasources/uid/{sourceUID}/correlations/{correlationUID} correlations updateCorrelation
//
// Updates a correlation.
//
// Responses:
// 200: updateCorrelationResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (s *CorrelationsService) updateHandler(c *models.ReqContext) response.Response {
	cmd := UpdateCorrelationCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	cmd.UID = web.Params(c.Req)[":correlationUID"]
	cmd.SourceUID = web.Params(c.Req)[":uid"]
	cmd.OrgId = c.OrgID

	correlation, err := s.UpdateCorrelation(c.Req.Context(), cmd)
	if err != nil {
		if errors.Is(err, ErrUpdateCorrelationEmptyParams) {
			return response.Error(http.StatusBadRequest, "At least one of label, description is required", err)
		}

		if errors.Is(err, ErrSourceDataSourceDoesNotExists) {
			return response.Error(http.StatusNotFound, "Data source not found", err)
		}

		if errors.Is(err, ErrCorrelationNotFound) {
			return response.Error(http.StatusNotFound, "Correlation not found", err)
		}

		if errors.Is(err, ErrSourceDataSourceReadOnly) {
			return response.Error(http.StatusForbidden, "Data source is read only", err)
		}

		return response.Error(http.StatusInternalServerError, "Failed to update correlation", err)
	}

	return response.JSON(http.StatusOK, UpdateCorrelationResponseBody{Message: "Correlation updated", Result: correlation})
}

// swagger:parameters updateCorrelation
type UpdateCorrelationParams struct {
	// in:path
	// required:true
	DatasourceUID string `json:"sourceUID"`
	// in:path
	// required:true
	CorrelationUID string `json:"correlationUID"`
	// in: body
	Body UpdateCorrelationCommand `json:"body"`
}

//swagger:response updateCorrelationResponse
type UpdateCorrelationResponse struct {
	// in: body
	Body UpdateCorrelationResponseBody `json:"body"`
}

// swagger:route GET /datasources/uid/{sourceUID}/correlations/{correlationUID} correlations getCorrelation
//
// Gets a correlation.
//
// Responses:
// 200: getCorrelationResponse
// 401: unauthorisedError
// 404: notFoundError
// 500: internalServerError
func (s *CorrelationsService) getCorrelationHandler(c *models.ReqContext) response.Response {
	query := GetCorrelationQuery{
		UID:       web.Params(c.Req)[":correlationUID"],
		SourceUID: web.Params(c.Req)[":uid"],
		OrgId:     c.OrgID,
	}

	correlation, err := s.getCorrelation(c.Req.Context(), query)
	if err != nil {
		if errors.Is(err, ErrCorrelationNotFound) {
			return response.Error(http.StatusNotFound, "Correlation not found", err)
		}
		if errors.Is(err, ErrSourceDataSourceDoesNotExists) {
			return response.Error(http.StatusNotFound, "Source data source not found", err)
		}

		return response.Error(http.StatusInternalServerError, "Failed to update correlation", err)
	}

	return response.JSON(http.StatusOK, correlation)
}

// swagger:parameters getCorrelation
type GetCorrelationParams struct {
	// in:path
	// required:true
	DatasourceUID string `json:"sourceUID"`
	// in:path
	// required:true
	CorrelationUID string `json:"correlationUID"`
}

//swagger:response getCorrelationResponse
type GetCorrelationResponse struct {
	// in: body
	Body Correlation `json:"body"`
}

// swagger:route GET /datasources/uid/{sourceUID}/correlations correlations getCorrelationsBySourceUID
//
// Gets all correlations originating from the given data source.
//
// Responses:
// 200: getCorrelationsBySourceUIDResponse
// 401: unauthorisedError
// 404: notFoundError
// 500: internalServerError
func (s *CorrelationsService) getCorrelationsBySourceUIDHandler(c *models.ReqContext) response.Response {
	query := GetCorrelationsBySourceUIDQuery{
		SourceUID: web.Params(c.Req)[":uid"],
		OrgId:     c.OrgID,
	}

	correlations, err := s.getCorrelationsBySourceUID(c.Req.Context(), query)
	if err != nil {
		if errors.Is(err, ErrCorrelationNotFound) {
			return response.Error(http.StatusNotFound, "No correlation found", err)
		}
		if errors.Is(err, ErrSourceDataSourceDoesNotExists) {
			return response.Error(http.StatusNotFound, "Source data source not found", err)
		}

		return response.Error(http.StatusInternalServerError, "Failed to update correlation", err)
	}

	return response.JSON(http.StatusOK, correlations)
}

// swagger:parameters getCorrelationsBySourceUID
type GetCorrelationsBySourceUIDParams struct {
	// in:path
	// required:true
	DatasourceUID string `json:"sourceUID"`
}

//swagger:response getCorrelationsBySourceUIDResponse
type GetCorrelationsBySourceUIDResponse struct {
	// in: body
	Body []Correlation `json:"body"`
}

// swagger:route GET /datasources/correlations correlations getCorrelations
//
// Gets all correlations.
//
// Responses:
// 200: getCorrelationsResponse
// 401: unauthorisedError
// 404: notFoundError
// 500: internalServerError
func (s *CorrelationsService) getCorrelationsHandler(c *models.ReqContext) response.Response {
	query := GetCorrelationsQuery{
		OrgId: c.OrgID,
	}

	correlations, err := s.getCorrelations(c.Req.Context(), query)
	if err != nil {
		if errors.Is(err, ErrCorrelationNotFound) {
			return response.Error(http.StatusNotFound, "No correlation found", err)
		}

		return response.Error(http.StatusInternalServerError, "Failed to update correlation", err)
	}

	return response.JSON(http.StatusOK, correlations)
}

//swagger:response getCorrelationsResponse
type GetCorrelationsResponse struct {
	// in: body
	Body []Correlation `json:"body"`
}

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

	s.RouteRegister.Group("/api/datasources/uid/:uid/correlations", func(entities routing.RouteRegister) {
		entities.Post("/", middleware.ReqSignedIn, authorize(ac.ReqOrgAdmin, ac.EvalPermission(datasources.ActionWrite, uidScope)), routing.Wrap(s.createHandler))
		entities.Delete("/:correlationUid", middleware.ReqSignedIn, authorize(ac.ReqOrgAdmin, ac.EvalPermission(datasources.ActionWrite, uidScope)), routing.Wrap(s.deleteHandler))
	})
}

// createHandler handles POST /datasources/uid/:uid/correlations
func (s *CorrelationsService) createHandler(c *models.ReqContext) response.Response {
	cmd := CreateCorrelationCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.SourceUID = web.Params(c.Req)[":uid"]
	cmd.OrgId = c.OrgId

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

	return response.JSON(http.StatusOK, CreateCorrelationResponse{Result: correlation, Message: "Correlation created"})
}

// deleteHandler handles DELETE /datasources/uid/:uid/correlations/:correlationUid
func (s *CorrelationsService) deleteHandler(c *models.ReqContext) response.Response {
	cmd := DeleteCorrelationCommand{
		UID:       web.Params(c.Req)[":correlationUid"],
		SourceUID: web.Params(c.Req)[":uid"],
		OrgId:     c.OrgId,
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

	return response.JSON(http.StatusOK, DeleteCorrelationResponse{Message: "Correlation deleted"})
}

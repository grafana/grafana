package querylibrary

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
)

type HTTPService interface {
	registry.CanBeDisabled
	RegisterHTTPRoutes(routes routing.RouteRegister)
}

type queriesServiceHTTPHandler struct {
	service Service
}

func (s *queriesServiceHTTPHandler) IsDisabled() bool {
	return s.service.IsDisabled()
}

func (s *queriesServiceHTTPHandler) RegisterHTTPRoutes(routes routing.RouteRegister) {
	reqSignedIn := middleware.ReqSignedIn
	routes.Get("/get", reqSignedIn, routing.Wrap(s.getBatch))
	routes.Post("/update", reqSignedIn, routing.Wrap(s.update))
	routes.Delete("/delete", reqSignedIn, routing.Wrap(s.delete))
}

func (s *queriesServiceHTTPHandler) getBatch(c *models.ReqContext) response.Response {
	uids := c.QueryStrings("uid")

	queries, err := s.service.GetBatch(c.Req.Context(), c.SignedInUser, uids)
	if err != nil {
		return response.Error(500, fmt.Sprintf("error retrieving queries: [%s]", strings.Join(uids, ",")), err)
	}

	return response.JSON(200, queries)
}

func (s *queriesServiceHTTPHandler) update(c *models.ReqContext) response.Response {
	body, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(500, "error reading bytes", err)
	}

	query := &Query{}
	err = json.Unmarshal(body, query)
	if err != nil {
		return response.Error(400, "error parsing body", err)
	}

	if err := s.service.Update(c.Req.Context(), c.SignedInUser, *query); err != nil {
		var msg string
		if len(query.UID) > 0 {
			msg = fmt.Sprintf("error updating query with UID %s: %s", query.UID, err.Error())
		} else {
			msg = fmt.Sprintf("error updating query with: %s", err.Error())
		}
		return response.Error(500, msg, err)
	}

	return response.JSON(200, map[string]interface{}{
		"success": true,
	})
}

func (s *queriesServiceHTTPHandler) delete(c *models.ReqContext) response.Response {
	uid := c.Query("uid")
	err := s.service.Delete(c.Req.Context(), c.SignedInUser, uid)
	if err != nil {
		return response.Error(500, fmt.Sprintf("error deleting query with id %s", uid), err)
	}

	return response.JSON(200, map[string]interface{}{
		"success": true,
	})
}

func ProvideHTTPService(
	queriesService Service,
) HTTPService {
	return &queriesServiceHTTPHandler{
		service: queriesService,
	}
}

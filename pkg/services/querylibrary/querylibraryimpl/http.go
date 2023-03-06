package querylibraryimpl

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/querylibrary"
)

type queriesServiceHTTPHandler struct {
	service querylibrary.Service
}

func (s *queriesServiceHTTPHandler) IsDisabled() bool {
	return s.service.IsDisabled()
}

func (s *queriesServiceHTTPHandler) delete(c *contextmodel.ReqContext) response.Response {
	uid := c.Query("uid")
	err := s.service.Delete(c.Req.Context(), c.SignedInUser, uid)
	if err != nil {
		return response.Error(500, fmt.Sprintf("error deleting query with id %s", uid), err)
	}

	return response.JSON(200, map[string]interface{}{
		"success": true,
	})
}

func (s *queriesServiceHTTPHandler) RegisterHTTPRoutes(routes routing.RouteRegister) {
	reqSignedIn := middleware.ReqSignedIn
	routes.Get("/", reqSignedIn, routing.Wrap(s.getBatch))
	routes.Post("/", reqSignedIn, routing.Wrap(s.update))
	routes.Delete("/", reqSignedIn, routing.Wrap(s.delete))
}

func (s *queriesServiceHTTPHandler) getBatch(c *contextmodel.ReqContext) response.Response {
	uids := c.QueryStrings("uid")

	queries, err := s.service.GetBatch(c.Req.Context(), c.SignedInUser, uids)
	if err != nil {
		return response.Error(500, fmt.Sprintf("error retrieving queries: [%s]", strings.Join(uids, ",")), err)
	}

	return response.JSON(200, queries)
}

func (s *queriesServiceHTTPHandler) update(c *contextmodel.ReqContext) response.Response {
	body, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(500, "error reading bytes", err)
	}

	query := &querylibrary.Query{}
	err = json.Unmarshal(body, query)
	if err != nil {
		return response.Error(400, "error parsing body", err)
	}

	if err := s.service.Update(c.Req.Context(), c.SignedInUser, query); err != nil {
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

func ProvideHTTPService(
	queriesService querylibrary.Service,
) querylibrary.HTTPService {
	return &queriesServiceHTTPHandler{
		service: queriesService,
	}
}

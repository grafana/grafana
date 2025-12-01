package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/exploremap"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) registerExploreMapAPI(apiRoute routing.RouteRegister, exploreMapService exploremap.Service) {
	apiRoute.Group("/explore-maps", func(exploreMapRoute routing.RouteRegister) {
		exploreMapRoute.Get("/", routing.Wrap(hs.listExploreMaps))
		exploreMapRoute.Post("/", routing.Wrap(hs.createExploreMap))
		exploreMapRoute.Get("/:uid", routing.Wrap(hs.getExploreMap))
		exploreMapRoute.Put("/:uid", routing.Wrap(hs.updateExploreMap))
		exploreMapRoute.Delete("/:uid", routing.Wrap(hs.deleteExploreMap))
	})
	hs.exploreMapService = exploreMapService
}

// swagger:parameters listExploreMaps
type ListExploreMapsParams struct {
	// in:query
	// required:false
	Limit int `json:"limit"`
}

// swagger:parameters getExploreMap
type GetExploreMapParams struct {
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters deleteExploreMap
type DeleteExploreMapParams struct {
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters updateExploreMap
type UpdateExploreMapParams struct {
	// in:body
	// required:true
	Body exploremap.UpdateExploreMapCommand
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters createExploreMap
type CreateExploreMapParams struct {
	// in:body
	// required:true
	Body exploremap.CreateExploreMapCommand
}

// swagger:response listExploreMapsResponse
type ListExploreMapsResponse struct {
	// The response message
	// in: body
	Body exploremap.ExploreMaps `json:"body"`
}

// swagger:response getExploreMapResponse
type GetExploreMapResponse struct {
	// The response message
	// in: body
	Body *exploremap.ExploreMapDTO `json:"body"`
}

// swagger:response updateExploreMapResponse
type UpdateExploreMapResponse struct {
	// The response message
	// in: body
	Body *exploremap.ExploreMapDTO `json:"body"`
}

// swagger:response createExploreMapResponse
type CreateExploreMapResponse struct {
	// The response message
	// in: body
	Body *exploremap.ExploreMap `json:"body"`
}

// swagger:route GET /explore-maps explore-maps listExploreMaps
//
// Get explore maps.
//
// Responses:
// 200: listExploreMapsResponse
// 500: internalServerError
func (hs *HTTPServer) listExploreMaps(c *contextmodel.ReqContext) response.Response {
	query := &exploremap.GetExploreMapsQuery{
		OrgID: c.SignedInUser.GetOrgID(),
		Limit: c.QueryInt("limit"),
	}

	if query.Limit == 0 {
		query.Limit = 100
	}

	maps, err := hs.exploreMapService.List(c.Req.Context(), query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get explore maps", err)
	}

	return response.JSON(http.StatusOK, maps)
}

// swagger:route GET /explore-maps/{uid} explore-maps getExploreMap
//
// Get explore map.
//
// Responses:
// 200: getExploreMapResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) getExploreMap(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	query := &exploremap.GetExploreMapByUIDQuery{
		UID:   uid,
		OrgID: c.SignedInUser.GetOrgID(),
	}

	m, err := hs.exploreMapService.Get(c.Req.Context(), query)
	if err != nil {
		if err == exploremap.ErrExploreMapNotFound {
			return response.Error(http.StatusNotFound, "Explore map not found", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to get explore map", err)
	}

	return response.JSON(http.StatusOK, m)
}

// swagger:route POST /explore-maps explore-maps createExploreMap
//
// Create explore map.
//
// Responses:
// 200: createExploreMapResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) createExploreMap(c *contextmodel.ReqContext) response.Response {
	cmd := exploremap.CreateExploreMapCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	cmd.OrgID = c.SignedInUser.GetOrgID()
	cmd.CreatedBy = c.SignedInUser.UserID

	m, err := hs.exploreMapService.Create(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create explore map", err)
	}

	return response.JSON(http.StatusOK, m)
}

// swagger:route PUT /explore-maps/{uid} explore-maps updateExploreMap
//
// Update explore map.
//
// Responses:
// 200: updateExploreMapResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) updateExploreMap(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	cmd := exploremap.UpdateExploreMapCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	cmd.UID = uid
	cmd.OrgID = c.SignedInUser.GetOrgID()
	cmd.UpdatedBy = c.SignedInUser.UserID

	m, err := hs.exploreMapService.Update(c.Req.Context(), &cmd)
	if err != nil {
		if err == exploremap.ErrExploreMapNotFound {
			return response.Error(http.StatusNotFound, "Explore map not found", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to update explore map", err)
	}

	return response.JSON(http.StatusOK, m)
}

// swagger:route DELETE /explore-maps/{uid} explore-maps deleteExploreMap
//
// Delete explore map.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) deleteExploreMap(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	cmd := &exploremap.DeleteExploreMapCommand{
		UID:   uid,
		OrgID: c.SignedInUser.GetOrgID(),
	}

	err := hs.exploreMapService.Delete(c.Req.Context(), cmd)
	if err != nil {
		if err == exploremap.ErrExploreMapNotFound {
			return response.Error(http.StatusNotFound, "Explore map not found", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to delete explore map", err)
	}

	return response.JSON(http.StatusOK, map[string]string{"message": "Explore map deleted"})
}

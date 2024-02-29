package exploreworkspaces

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

func (s *ExploreWorkspacesService) registerAPIEndpoints() {
	authorize := ac.Middleware(s.AccessControl)
	s.RouteRegister.Get("/api/exploreworkspaces/:uid", middleware.ReqSignedIn, authorize(ac.EvalPermission(ac.ActionDatasourcesExplore)), routing.Wrap(s.GetExploreWorkspaceHandler))
	s.RouteRegister.Post("/api/exploreworkspaces/", middleware.ReqSignedIn, authorize(ac.EvalPermission(ac.ActionDatasourcesExplore)), routing.Wrap(s.CreateExploreWorkspaceHandler))
	s.RouteRegister.Get("/api/exploreworkspaces/", middleware.ReqSignedIn, authorize(ac.EvalPermission(ac.ActionDatasourcesExplore)), routing.Wrap(s.GetExploreWorkspacesHandler))
}

func (s *ExploreWorkspacesService) CreateExploreWorkspaceHandler(c *contextmodel.ReqContext) response.Response {
	cmd := CreateExploreWorkspaceCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	createExploreWorkspaceRespose, err := s.CreateExploreWorkspace(c.Req.Context(), cmd)

	if err != nil {
		return response.Error(http.StatusBadRequest, "cannot create a workspace", err)
	}

	return response.JSON(http.StatusOK, createExploreWorkspaceRespose)
}

func (s *ExploreWorkspacesService) GetExploreWorkspaceHandler(c *contextmodel.ReqContext) response.Response {
	query := GetExploreWorkspaceCommand{
		ExploreWorkspaceUID: web.Params(c.Req)[":uid"],
		OrgId:               c.SignedInUser.GetOrgID(),
	}

	exploreWorkspace, err := s.GetExploreWorkspace(c.Req.Context(), query)

	if err != nil {
		return response.Error(http.StatusBadRequest, "cannot get workspace", err)
	}

	return response.JSON(http.StatusOK, GetExploreWorkspaceResponse{ExploreWorkspace: exploreWorkspace})
}

func (s *ExploreWorkspacesService) GetExploreWorkspacesHandler(c *contextmodel.ReqContext) response.Response {
	query := GetExploreWorkspacesCommand{
		OrgId: c.SignedInUser.GetOrgID(),
	}

	exploreWorkspaces, err := s.GetExploreWorkspaces(c.Req.Context(), query)

	if err != nil {
		return response.Error(http.StatusBadRequest, "cannot get workspaces", err)
	}

	return response.JSON(http.StatusOK, GetExploreWorkspacesResponse{ExploreWorkspaces: exploreWorkspaces})
}

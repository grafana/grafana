package exploreworkspaces

import (
	"net/http"
	"time"

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
	s.RouteRegister.Post("/api/exploreworkspaces/:uid", middleware.ReqSignedIn, authorize(ac.EvalPermission(ac.ActionDatasourcesExplore)), routing.Wrap(s.UpdateExploreWorkspaceLatestSnapshotHandler))
	s.RouteRegister.Get("/api/exploreworkspaces/", middleware.ReqSignedIn, authorize(ac.EvalPermission(ac.ActionDatasourcesExplore)), routing.Wrap(s.GetExploreWorkspacesHandler))
}

func (s *ExploreWorkspacesService) CreateExploreWorkspaceHandler(c *contextmodel.ReqContext) response.Response {
	cmd := CreateExploreWorkspaceCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.SignedInUser.OrgID
	cmd.UserId = c.SignedInUser.UserID
	uid, err := s.CreateExploreWorkspace(c.Req.Context(), cmd)

	if err != nil {
		return response.Error(http.StatusBadRequest, "Cannot create a new workspace. "+err.Error(), err)
	}

	return response.JSON(http.StatusOK, CreateExploreWorkspaceResponse{UID: uid})
}

func (s *ExploreWorkspacesService) GetExploreWorkspaceHandler(c *contextmodel.ReqContext) response.Response {
	query := GetExploreWorkspaceCommand{
		ExploreWorkspaceUID: web.Params(c.Req)[":uid"],
		OrgId:               c.SignedInUser.GetOrgID(),
	}

	exploreWorkspace, err := s.GetExploreWorkspace(c.Req.Context(), query)

	if err != nil {
		return response.Error(http.StatusBadRequest, "Cannot get workspace. "+err.Error(), err)
	}

	return response.JSON(http.StatusOK, GetExploreWorkspaceResponse{ExploreWorkspace: exploreWorkspace})
}

func (s *ExploreWorkspacesService) GetExploreWorkspacesHandler(c *contextmodel.ReqContext) response.Response {
	query := GetExploreWorkspacesCommand{
		OrgId: c.SignedInUser.GetOrgID(),
	}

	exploreWorkspaces, err := s.GetExploreWorkspaces(c.Req.Context(), query)

	if err != nil {
		return response.Error(http.StatusBadRequest, "Cannot get all workspaces. "+err.Error(), err)
	}

	return response.JSON(http.StatusOK, GetExploreWorkspacesResponse{ExploreWorkspaces: exploreWorkspaces})
}

func (s *ExploreWorkspacesService) UpdateExploreWorkspaceLatestSnapshotHandler(c *contextmodel.ReqContext) response.Response {
	cmd := UpdateExploreWorkspaceLatestSnapshotCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.Updated = time.Now()
	cmd.UserId = c.SignedInUser.UserID
	cmd.ExploreWorspaceUID = web.Params(c.Req)[":uid"]

	snapshot, err := s.UpdateLatestExploreWorkspaceSnapshot(c.Req.Context(), cmd)

	if err != nil {
		return response.Error(http.StatusBadRequest, "Cannot update the snapshot "+err.Error(), err)
	}

	return response.JSON(http.StatusOK, UpdateExploreWorkspaceLatestSnapshotResponse{Snapshot: *snapshot})

}

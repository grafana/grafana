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
	s.RouteRegister.Get("/api/exploreworkspaces/", middleware.ReqSignedIn, authorize(ac.EvalPermission(ac.ActionDatasourcesExplore)), routing.Wrap(s.GetExploreWorkspaceHandler))
}

func (s *ExploreWorkspacesService) GetExploreWorkspaceHandler(c *contextmodel.ReqContext) response.Response {
	query := GetExploreWorkspaceCommand{
		ExploreWorkspaceUID: web.Params(c.Req)[":uid"],
		OrgId:               c.SignedInUser.GetOrgID(),
	}

	exploreWorkspace, _ := s.GetExploreWorkspace(c.Req.Context(), query)

	return response.JSON(http.StatusOK, GetExploreWorkspaceResponse{ExploreWorkspace: exploreWorkspace})
}

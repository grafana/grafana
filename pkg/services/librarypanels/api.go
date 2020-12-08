package librarypanels

import (
	"github.com/go-macaron/binding"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func (lps *LibraryPanelService) registerAPIEndpoints() {
	if !lps.IsEnabled() {
		return
	}

	lps.RouteRegister.Group("/api/library-panels", func(libraryPanels routing.RouteRegister) {
		libraryPanels.Post("/", middleware.ReqSignedIn, binding.Bind(addLibraryPanelCommand{}), api.Wrap(lps.addLibraryPanelEndpoint))
	})
}

// addLibraryPanelEndpoint handles POST /api/library-panels.
func (lps *LibraryPanelService) addLibraryPanelEndpoint(c *models.ReqContext, cmd addLibraryPanelCommand) api.Response {
	cmd.OrgId = c.SignedInUser.OrgId
	cmd.SignedInUser = c.SignedInUser

	if err := lps.addLibraryPanel(&cmd); err != nil {
		return api.Error(500, "Failed to create library panel", err)
	}

	return api.JSON(200, util.DynMap{"id": cmd.Result.Id})
}

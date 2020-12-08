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
		libraryPanels.Post("/", middleware.ReqSignedIn, binding.Bind(AddLibraryPanelCommand{}), api.Wrap(lps.createHandler))
	})
}

// createHandler handles POST /api/library-panels.
func (lps *LibraryPanelService) createHandler(c *models.ReqContext, cmd AddLibraryPanelCommand) api.Response {
	panel, err := lps.Create(c, cmd)

	if err != nil {
		return api.Error(500, "Failed to create library panel", err)
	}

	return api.JSON(200, util.DynMap{"panel": panel})
}


package navbarpreferences 

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

func (n *NavbarPreferencesService) registerAPIEndpoints() {
	n.RouteRegister.Group("/api/navbar-preferences", func(entities routing.RouteRegister) {
		entities.Post("/", middleware.ReqSignedIn, routing.Wrap(l.createHandler))
		// entities.Delete("/:uid", middleware.ReqSignedIn, routing.Wrap(l.deleteHandler))
		// entities.Patch("/:uid", middleware.ReqSignedIn, routing.Wrap(l.patchHandler))
	})
}

// createHandler handles POST /api/library-elements.
func (n *NavbarPreferencesService)) createHandler(c *models.ReqContext) response.Response {
	cmd := CreateNavbarPreferenceCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	element, err := n.createNavbarPreference(c.Req.Context(), c.SignedInUser, cmd)
	if err != nil {
		return toLibraryElementError(err, "Failed to create library element")
	}

	return response.JSON(200, LibraryElementResponse{Result: element})
}


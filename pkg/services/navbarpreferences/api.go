package navbarpreferences

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

func (n *NavbarPreferencesService) registerAPIEndpoints() {
	n.RouteRegister.Group("/api/navbar-preferences", func(entities routing.RouteRegister) {
		entities.Put("/", middleware.ReqSignedIn, routing.Wrap(n.createHandler))
	})
}

// createHandler handles PUT /api/navbar-preferences.
func (n *NavbarPreferencesService) createHandler(c *models.ReqContext) response.Response {
	createCmd := CreateNavbarPreferenceCommand{}
	if err := web.Bind(c.Req, &createCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	preference, err := n.createNavbarPreference(c.Req.Context(), c.SignedInUser, createCmd)
	if err != nil {
		return toNavbarPreferenceError(err, "Failed to create navbar preferences")
	}

	return response.JSON(201, NavbarPreferenceResponse{Result: preference})
}

func toNavbarPreferenceError(err error, message string) response.Response {
	return response.Error(500, message, err)
}

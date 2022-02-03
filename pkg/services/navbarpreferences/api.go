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
		entities.Put("/", middleware.ReqSignedIn, routing.Wrap(n.createHandler))
		// entities.Delete("/:uid", middleware.ReqSignedIn, routing.Wrap(l.deleteHandler))
		// entities.Patch("/:uid", middleware.ReqSignedIn, routing.Wrap(l.patchHandler))
	})
}

// createHandler handles POST /api/navbar-preferences.
func (n *NavbarPreferencesService) createHandler(c *models.ReqContext) response.Response {
	createCmd := CreateNavbarPreferenceCommand{}
	if err := web.Bind(c.Req, &createCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	// TODO tidy up this logic
	hasExistingPreference, err := n.hasExistingPreference(c.Req.Context(), c.SignedInUser, createCmd)
	if err != nil {
		return toNavbarPreferenceError(err, "Failed to create navbar preference")
	}
	if hasExistingPreference {
		return toNavbarPreferenceError(errNavbarPreferenceAlreadyExists, "Failed to create navbar preference")
	}

	preference, err := n.createNavbarPreference(c.Req.Context(), c.SignedInUser, createCmd)
	if err != nil {
		return toNavbarPreferenceError(err, "Failed to create navbar preferences")
	}

	return response.JSON(200, NavbarPreferenceResponse{Result: preference})
}

func toNavbarPreferenceError(err error, message string) response.Response {
	if errors.Is(err, errNavbarPreferenceAlreadyExists) {
		return response.Error(400, errNavbarPreferenceAlreadyExists.Error(), err)
	}
	if errors.Is(err, errNavbarPreferenceNotFound) {
		return response.Error(404, errNavbarPreferenceNotFound.Error(), err)
	}
	return response.Error(500, message, err)
}

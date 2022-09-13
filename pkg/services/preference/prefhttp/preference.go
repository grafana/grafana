package prefhttp

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/web"
)

type Service struct {
	preferenceService pref.Service
}

func ProvideService(storeService pref.Service) *Service {
	return &Service{
		preferenceService: storeService,
	}
}

// swagger:route GET /org/preferences org_preferences getOrgPreferences
//
// Get Current Org Prefs.
//
// Responses:
// 200: getPreferencesResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (s *Service) GetOrgPreferences(c *models.ReqContext) response.Response {
	return s.preferenceService.getPreferencesFor(c.Req.Context(), c.OrgID, 0, 0)
}

// swagger:route PUT /org/preferences org_preferences updateOrgPreferences
//
// Update Current Org Prefs.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (s *Service) UpdateOrgPreferences(c *models.ReqContext) response.Response {
	dtoCmd := dtos.UpdatePrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	return s.preferenceService.updatePreferencesFor(c.Req.Context(), c.OrgID, 0, 0, &dtoCmd)
}

// swagger:route PATCH /org/preferences org_preferences patchOrgPreferences
//
// Patch Current Org Prefs.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (s *Service) PatchOrgPreferences(c *models.ReqContext) response.Response {
	dtoCmd := dtos.PatchPrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	return s.preferenceService.patchPreferencesFor(c.Req.Context(), c.OrgID, 0, 0, &dtoCmd)
}

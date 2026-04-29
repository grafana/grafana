package prefapi

import (
	"net/http"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/utils/ptr"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	prefutils "github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/setting"
)

// K8sHandler bridges legacy /api preference endpoints to the
// preferences.grafana.app app platform API. It lightly validates input, resolves
// home-dashboard ID/UID, and delegates the actual K8s call to a K8sClient.
type K8sHandler struct {
	client     K8sClient
	dashboards dashboards.DashboardService
}

// ProvideK8sHandler is the Wire provider for the legacy preferences
// bridge.
func ProvideK8sHandler(cfg *setting.Cfg, configProvider grafanaapiserver.DirectRestConfigProvider, ds dashboards.DashboardService) *K8sHandler {
	return &K8sHandler{
		client:     NewK8sClient(cfg, configProvider),
		dashboards: ds,
	}
}

// NewK8sHandler builds a handler with an explicit client; tests can pass a
// mock implementation here.
func NewK8sHandler(client K8sClient, ds dashboards.DashboardService) *K8sHandler {
	return &K8sHandler{
		client:     client,
		dashboards: ds,
	}
}

// UserOwner returns the resource owner reference for the signed-in user.
func UserOwner(c *contextmodel.ReqContext) prefutils.OwnerReference {
	return prefutils.OwnerReference{
		Owner:      prefutils.UserResourceOwner,
		Identifier: c.GetIdentifier(),
	}
}

// TeamOwner returns the resource owner reference for the given team UID.
func TeamOwner(teamUID string) prefutils.OwnerReference {
	return prefutils.OwnerReference{
		Owner:      prefutils.TeamResourceOwner,
		Identifier: teamUID,
	}
}

// NamespaceOwner returns the resource owner reference for org-wide preferences.
func NamespaceOwner() prefutils.OwnerReference {
	return prefutils.OwnerReference{Owner: prefutils.NamespaceResourceOwner}
}

// GetPreferences fetches the preferences for the given owner and returns
// them as the legacy PreferencesSpec response.
func (h *K8sHandler) GetPreferences(c *contextmodel.ReqContext, owner prefutils.OwnerReference) response.Response {
	spec, err := h.client.Get(c, owner)
	if err != nil {
		return responseFromError(err)
	}
	return response.JSON(http.StatusOK, spec)
}

// UpdatePreferences performs a full replace of the preferences for the
// given owner, matching the legacy PUT semantics. Field validation is
// enforced by the apiserver admission webhook
func (h *K8sHandler) UpdatePreferences(c *contextmodel.ReqContext, owner prefutils.OwnerReference, dto *dtos.UpdatePrefsCmd) response.Response {
	homeDashboardUID, errResp := h.resolveHomeDashboardUID(c, dto.HomeDashboardUID, dto.HomeDashboardID)
	if errResp != nil {
		return errResp
	}

	if err := h.client.Update(c, owner, updateCmdToSpec(dto, homeDashboardUID)); err != nil {
		return responseFromError(err)
	}
	return response.Success("Preferences updated")
}

// PatchPreferences performs a partial update of the preferences for the
// given owner, matching the legacy PATCH semantics (fields not present in
// the request are left unchanged).
func (h *K8sHandler) PatchPreferences(c *contextmodel.ReqContext, owner prefutils.OwnerReference, dto *dtos.PatchPrefsCmd) response.Response {
	var legacyID int64
	if dto.HomeDashboardID != nil {
		legacyID = *dto.HomeDashboardID
	}
	homeDashboardUID, errResp := h.resolveHomeDashboardUID(c, dto.HomeDashboardUID, legacyID)
	if errResp != nil {
		return errResp
	}

	if err := h.client.Patch(c, owner, patchCmdToSpec(dto, homeDashboardUID)); err != nil {
		return responseFromError(err)
	}
	return response.Success("Preferences updated")
}

// resolveHomeDashboardUID translates the deprecated HomeDashboardID DTO
// field into the HomeDashboardUID that the new app-platform spec stores.
// When the caller already supplied a UID it is passed through unchanged
func (h *K8sHandler) resolveHomeDashboardUID(c *contextmodel.ReqContext, uidPtr *string, legacyID int64) (*string, response.Response) {
	if uidPtr != nil || legacyID == 0 {
		return uidPtr, nil
	}

	dash, err := h.dashboards.GetDashboard(c.Req.Context(), &dashboards.GetDashboardQuery{ID: legacyID, OrgID: c.GetOrgID()})

	if err != nil {
		return nil, response.Error(http.StatusNotFound, "Dashboard not found", err)
	}

	return &dash.UID, nil
}

// updateCmdToSpec builds a fully populated spec from a PUT request DTO.
// Scalar fields are always pointer-to-value (including empty strings) so PUT
// semantics — clearing fields the request omitted — match the legacy
// pref.Service.Save behaviour.
func updateCmdToSpec(dto *dtos.UpdatePrefsCmd, homeDashboardUID *string) *preferences.PreferencesSpec {
	spec := &preferences.PreferencesSpec{
		Theme:            ptr.To(dto.Theme),
		Timezone:         ptr.To(dto.Timezone),
		WeekStart:        ptr.To(dto.WeekStart),
		Language:         ptr.To(dto.Language),
		HomeDashboardUID: homeDashboardUID,
	}
	if dto.QueryHistory != nil {
		spec.QueryHistory = &preferences.PreferencesQueryHistoryPreference{
			HomeTab: ptr.To(dto.QueryHistory.HomeTab),
		}
	}
	if dto.Navbar != nil {
		spec.Navbar = &preferences.PreferencesNavbarPreference{
			BookmarkUrls: dto.Navbar.BookmarkUrls,
		}
	}
	return spec
}

// patchCmdToSpec builds a partially populated spec from a PATCH request DTO.
// Only fields the caller set are present, so a JSON merge-patch will leave
// other fields untouched.
func patchCmdToSpec(dto *dtos.PatchPrefsCmd, homeDashboardUID *string) *preferences.PreferencesSpec {
	spec := &preferences.PreferencesSpec{
		Theme:            dto.Theme,
		Timezone:         dto.Timezone,
		WeekStart:        dto.WeekStart,
		Language:         dto.Language,
		HomeDashboardUID: homeDashboardUID,
	}
	if dto.QueryHistory != nil {
		spec.QueryHistory = &preferences.PreferencesQueryHistoryPreference{
			HomeTab: ptr.To(dto.QueryHistory.HomeTab),
		}
	}
	if dto.Navbar != nil {
		spec.Navbar = &preferences.PreferencesNavbarPreference{
			BookmarkUrls: dto.Navbar.BookmarkUrls,
		}
	}
	return spec
}

func responseFromError(err error) response.Response {
	//nolint:errorlint
	statusError, ok := err.(*errors.StatusError)
	if ok {
		return response.Error(int(statusError.Status().Code), statusError.Status().Message, err)
	}
	return response.ErrOrFallback(http.StatusInternalServerError, "Failed to handle preferences request", err)
}

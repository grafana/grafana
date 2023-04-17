package api

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/stats"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// swagger:route GET /admin/settings admin adminGetSettings
//
// Fetch settings.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `settings:read` and scopes: `settings:*`, `settings:auth.saml:` and `settings:auth.saml:enabled` (property level).
//
// Security:
// - basic:
//
// Responses:
// 200: adminGetSettingsResponse
// 401: unauthorisedError
// 403: forbiddenError
func (hs *HTTPServer) AdminGetSettings(c *contextmodel.ReqContext) response.Response {
	settings, err := hs.getAuthorizedSettings(c.Req.Context(), c.SignedInUser, hs.SettingsProvider.Current())
	if err != nil {
		return response.Error(http.StatusForbidden, "Failed to authorize settings", err)
	}
	return response.JSON(http.StatusOK, settings)
}

// swagger:route GET /admin/verbise-settings admin adminGetVerboseSettings
//
// Fetch verbise settings.
//
// This endpoint will render the same as `GET /admin/settings`, but this endpoint will render all sources for every setting.
//
// Security:
// - basic:
//
// Responses:
// 200: adminGetSettingsResponse
// 401: unauthorisedError
// 403: forbiddenError
func (hs *HTTPServer) AdminGetVerboseSettings(c *contextmodel.ReqContext) response.Response {
	verboseSettings, err := hs.getAuthorizedVerboseSettings(c.Req.Context(), c.SignedInUser, hs.SettingsProvider.CurrentVerbose())
	if err != nil {
		return response.Error(http.StatusForbidden, "Failed to authorize settings", err)
	}
	return response.JSON(http.StatusOK, verboseSettings)
}

// swagger:route GET /admin/stats admin adminGetStats
//
// Fetch Grafana Stats.
//
// Only works with Basic Authentication (username and password). See introduction for an explanation.
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `server:stats:read`.
//
// Responses:
// 200: adminGetStatsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) AdminGetStats(c *contextmodel.ReqContext) response.Response {
	adminStats, err := hs.statsService.GetAdminStats(c.Req.Context(), &stats.GetAdminStatsQuery{})
	if err != nil {
		return response.Error(500, "Failed to get admin stats from database", err)
	}

	return response.JSON(http.StatusOK, adminStats)
}

func (hs *HTTPServer) getAuthorizedSettings(ctx context.Context, user *user.SignedInUser, bag setting.SettingsBag) (setting.SettingsBag, error) {
	if hs.AccessControl.IsDisabled() {
		return bag, nil
	}

	eval := func(scope string) (bool, error) {
		return hs.AccessControl.Evaluate(ctx, user, ac.EvalPermission(ac.ActionSettingsRead, scope))
	}

	ok, err := eval(ac.ScopeSettingsAll)
	if err != nil {
		return nil, err
	}
	if ok {
		return bag, nil
	}

	authorizedBag := make(setting.SettingsBag)

	for section, keys := range bag {
		ok, err := eval(ac.Scope("settings", section, "*"))
		if err != nil {
			return nil, err
		}
		if ok {
			authorizedBag[section] = keys
			continue
		}

		for key := range keys {
			ok, err := eval(ac.Scope("settings", section, key))
			if err != nil {
				return nil, err
			}
			if ok {
				if _, exists := authorizedBag[section]; !exists {
					authorizedBag[section] = make(map[string]string)
				}
				authorizedBag[section][key] = bag[section][key]
			}
		}
	}
	return authorizedBag, nil
}

func (hs *HTTPServer) getAuthorizedVerboseSettings(ctx context.Context, user *user.SignedInUser, bag setting.VerboseSettingsBag) (setting.VerboseSettingsBag, error) {
	if hs.AccessControl.IsDisabled() {
		return bag, nil
	}

	eval := func(scope string) (bool, error) {
		return hs.AccessControl.Evaluate(ctx, user, ac.EvalPermission(ac.ActionSettingsRead, scope))
	}

	ok, err := eval(ac.ScopeSettingsAll)
	if err != nil {
		return nil, err
	}
	if ok {
		return bag, nil
	}

	authorizedBag := make(setting.VerboseSettingsBag)

	for section, keys := range bag {
		ok, err := eval(ac.Scope("settings", section, "*"))
		if err != nil {
			return nil, err
		}
		if ok {
			authorizedBag[section] = keys
			continue
		}

		for key := range keys {
			ok, err := eval(ac.Scope("settings", section, key))
			if err != nil {
				return nil, err
			}

			if !ok {
				continue
			}

			if _, exists := authorizedBag[section]; !exists {
				authorizedBag[section] = make(map[string]map[string]string)
			}
			authorizedBag[section][key] = bag[section][key]
		}
	}

	return authorizedBag, nil
}

// swagger:response adminGetSettingsResponse
type GetSettingsResponse struct {
	// in:body
	Body setting.SettingsBag `json:"body"`
}

// swagger:response adminGetStatsResponse
type GetStatsResponse struct {
	// in:body
	Body stats.AdminStats `json:"body"`
}

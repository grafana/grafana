package api

import (
	"context"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/stats"
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

func (hs *HTTPServer) AdminGetVerboseSettings(c *contextmodel.ReqContext) response.Response {
	bag := hs.SettingsProvider.CurrentVerbose()
	if bag == nil {
		return response.JSON(http.StatusNotImplemented, make(map[string]string))
	}

	verboseSettings, err := hs.getAuthorizedVerboseSettings(c.Req.Context(), c.SignedInUser, bag)
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
		return response.Error(http.StatusInternalServerError, "Failed to get admin stats from database", err)
	}
	anonymousDeviceExpiration := 30 * 24 * time.Hour
	devicesCount, err := hs.anonService.CountDevices(c.Req.Context(), time.Now().Add(-anonymousDeviceExpiration), time.Now().Add(time.Minute))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get anon stats from database", err)
	}
	adminStats.ActiveDevices = devicesCount

	return response.JSON(http.StatusOK, adminStats)
}

func (hs *HTTPServer) getAuthorizedSettings(ctx context.Context, user identity.Requester, bag setting.SettingsBag) (setting.SettingsBag, error) {
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

func (hs *HTTPServer) getAuthorizedVerboseSettings(ctx context.Context, user identity.Requester, bag setting.VerboseSettingsBag) (setting.VerboseSettingsBag, error) {
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
				authorizedBag[section] = make(map[string]map[setting.VerboseSourceType]string)
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

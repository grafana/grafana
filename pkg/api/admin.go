package api

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"
)

func (hs *HTTPServer) AdminGetSettings(c *models.ReqContext) response.Response {
	settings, err := hs.getAuthorizedSettings(c.Req.Context(), c.SignedInUser, hs.SettingsProvider.Current())
	if err != nil {
		return response.Error(http.StatusForbidden, "Failed to authorize settings", err)
	}
	return response.JSON(http.StatusOK, settings)
}

func AdminGetStats(c *models.ReqContext) response.Response {
	statsQuery := models.GetAdminStatsQuery{}

	if err := bus.Dispatch(&statsQuery); err != nil {
		return response.Error(500, "Failed to get admin stats from database", err)
	}

	return response.JSON(200, statsQuery.Result)
}

func (hs *HTTPServer) getAuthorizedSettings(ctx context.Context, user *models.SignedInUser, bag setting.SettingsBag) (setting.SettingsBag, error) {
	if hs.AccessControl.IsDisabled() {
		return bag, nil
	}

	eval := func(scopes ...string) (bool, error) {
		return hs.AccessControl.Evaluate(ctx, user, accesscontrol.ActionSettingsRead, scopes...)
	}

	ok, err := eval(accesscontrol.ScopeSettingsAll)
	if err != nil {
		return nil, err
	}
	if ok {
		return bag, nil
	}

	authorizedBag := make(setting.SettingsBag)

	for section, keys := range bag {
		ok, err := eval(getSettingsScope(section, "*"))
		if err != nil {
			return nil, err
		}
		if ok {
			authorizedBag[section] = keys
			continue
		}

		for key := range keys {
			ok, err := eval(getSettingsScope(section, key))
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

func getSettingsScope(section, key string) string {
	return fmt.Sprintf("settings:%s:%s", section, key)
}

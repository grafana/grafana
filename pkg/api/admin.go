package api

import (
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/settings"
	"github.com/grafana/grafana/pkg/setting"
)

func AdminGetSettings(c *models.ReqContext) response.Response {
	settings := make(map[string]interface{})

	for _, section := range setting.Raw.Sections() {
		jsonSec := make(map[string]interface{})
		settings[section.Name()] = jsonSec

		for _, key := range section.Keys() {
			keyName := key.Name()
			value := key.Value()
			if strings.Contains(keyName, "secret") || strings.Contains(keyName, "password") || (strings.Contains(keyName, "provider_config")) {
				value = "************"
			}
			if strings.Contains(keyName, "url") {
				var rgx = regexp.MustCompile(`.*:\/\/([^:]*):([^@]*)@.*?$`)
				var subs = rgx.FindAllSubmatch([]byte(value), -1)
				if subs != nil && len(subs[0]) == 3 {
					value = strings.Replace(value, string(subs[0][1]), "******", 1)
					value = strings.Replace(value, string(subs[0][2]), "******", 1)
				}
			}

			jsonSec[keyName] = value
		}
	}

	return response.JSON(200, settings)
}

func (hs *HTTPServer) AdminUpsertSettings(c *models.ReqContext, cmd settings.UpsertSettingsCommand) response.Response {
	/*
			{
				"errors": {
					"saml.auth: could not validate blaha",
					"database screwed uop big time
				},
				"message": "Validation failed"
			}



		{
			"errors": {
				{ "section":"saml.auth", "error:"bad config"}
			},
			"message": "Validation failed"
		}
			{
				"errors": {},
				"message": "Database update failed"
			}
	*/

	if err := hs.SettingsProvider.Update(cmd.Settings); err != nil {
		returnErrs := func(status int, message string, errors ...error) response.Response {
			data := make(map[string]interface{})
			data["message"] = message

			errorDetails := make([]string, 0, len(errors))
			for _, err := range errors {
				errorDetails = append(errorDetails, err.Error())
			}

			data["errors"] = errorDetails
			return response.JSON(status, data)
		}

		var validationErrors settings.ValidationError

		switch {
		case errors.As(err, &validationErrors):
			return returnErrs(http.StatusBadRequest, "Invalid settings", validationErrors.Errors...)
		case errors.Is(err, settings.ErrOperationNotPermitted):
			return returnErrs(http.StatusForbidden, "Settings update not permitted", err)
		default:
			return returnErrs(http.StatusInternalServerError, err.Error(), err)
		}
	}

	return response.Success("Settings updated")
}

func AdminGetStats(c *models.ReqContext) response.Response {
	statsQuery := models.GetAdminStatsQuery{}

	if err := bus.Dispatch(&statsQuery); err != nil {
		return response.Error(500, "Failed to get admin stats from database", err)
	}

	return response.JSON(200, statsQuery.Result)
}

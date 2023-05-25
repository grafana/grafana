package settingsprovider

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmodels "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/settings"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/grafana/grafana/pkg/web"
)

const (
	updateSettingsPath = "/api/admin/settings"
)

var errHigherRole = errutil.NewBase(errutil.StatusUnauthorized, "settings.escalation",
	errutil.WithPublicMessage("Can't assign role higher than the user"))
var errInvalidSetting = errutil.NewBase(errutil.StatusBadRequest, "settings.validation",
	errutil.WithPublicMessage("Invalid setting provided"))
var errRestrictedSetting = errutil.NewBase(errutil.StatusUnauthorized, "settings.restriction",
	errutil.WithPublicMessage("Restricted setting provided"))

func (i *Implementation) registerEndpoints() {
	authorize := accesscontrol.Middleware(i.AccessControl)
	i.RouteRegister.Put(
		updateSettingsPath,
		authorize(accesscontrol.EvalPermission(accesscontrol.ActionSettingsWrite)),
		routing.Wrap(i.AdminUpsertSettings),
	)
}

func (i *Implementation) AdminUpsertSettings(c *contextmodel.ReqContext) response.Response {
	cmd := settings.UpsertSettingsCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if cmd.Updates == nil && cmd.Removals == nil {
		return response.JSON(
			http.StatusBadRequest,
			map[string]string{
				"message": "You need to specify either removals or updates",
			},
		)
	}

	if err := i.evalAuthorization(c.Req.Context(), c.SignedInUser, cmd); err != nil {
		return response.Error(http.StatusForbidden, "", err)
	}

	// validate SAML settings specific here to avoid having to
	// modify signature of Update method. TODO: refactor
	// Check if setting modified affects a higher role than the user
	if err := validateNoHigherRole(c.SignedInUser, cmd); err != nil {
		return response.Err(err)
	}

	if err := i.Update(cmd.Updates, cmd.Removals); err != nil {
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

		var validationErrors setting.ValidationError

		switch {
		case errors.As(err, &validationErrors):
			return returnErrs(http.StatusBadRequest, "Invalid settings", validationErrors.Errors...)
		case errors.Is(err, setting.ErrOperationNotPermitted):
			return returnErrs(http.StatusForbidden, "Settings update not permitted", err)
		default:
			return returnErrs(http.StatusInternalServerError, err.Error(), err)
		}
	}

	return response.Success("Settings updated")
}

func validateNoHigherRole(user *user.SignedInUser, cmd settings.UpsertSettingsCommand) error {
	if user.IsGrafanaAdmin {
		return nil
	}

	if cmd.Updates == nil {
		return nil
	}

	for section, keys := range cmd.Updates {
		for key := range keys {
			if section != "auth.saml" {
				continue
			}

			// role_values_admin, role_values_editor, role_values_grafana_admin:
			if strings.HasPrefix(key, "role_values_") {
				role := strings.TrimPrefix(key, "role_values_")
				// FIXME: allows setting to empty string but not setting to value
				// satisfies requirements for now
				if role == "grafana_admin" {
					return errHigherRole.Errorf("can't set Grafana Admin role in key %s", key)
				}

				roleType := roletype.RoleType(strings.Title(role))
				if !roleType.IsValid() {
					return errInvalidSetting.Errorf("invalid key: %s", key)
				}

				if !user.OrgRole.Includes(roleType) {
					return errHigherRole.Errorf("can't set %s role in key %s", roleType, key)
				}
			}

			// org_mapping:admin:1:Admin, editor:2:Editor, viewer:3:Viewer
			if key == "org_mapping" {
				return errRestrictedSetting.Errorf("org mapping can only be done by a server admin")
			}
		}
	}

	return nil
}

func (i *Implementation) evalAuthorization(ctx context.Context, user *user.SignedInUser, cmd settings.UpsertSettingsCommand) error {
	// skip checks if access control is disabled
	if i.AccessControl.IsDisabled() {
		return nil
	}

	permissions := make([]accesscontrol.Evaluator, 0)
	for section, keys := range cmd.Updates {
		for key := range keys {
			permissions = append(permissions, getPermission(section, key))
		}
	}
	for section, keys := range cmd.Removals {
		for _, key := range keys {
			permissions = append(permissions, getPermission(section, key))
		}
	}

	ok, err := i.AccessControl.Evaluate(ctx, user, accesscontrol.EvalAny(
		accesscontrol.EvalPermission(accesscontrol.ActionSettingsWrite, accesscontrol.ScopeSettingsAll),
		accesscontrol.EvalAll(
			permissions...,
		),
	))

	if err != nil || !ok {
		// TODO: create better error for this occurence
		return acmodels.ErrInvalidScope
	}

	return nil
}

func getPermission(section, key string) accesscontrol.Evaluator {
	return accesscontrol.EvalPermission(accesscontrol.ActionSettingsWrite, fmt.Sprintf("%s:%s:%s", "settings", section, key))
}

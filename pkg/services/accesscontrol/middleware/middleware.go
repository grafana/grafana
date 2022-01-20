package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func authorize(c *models.ReqContext, ac accesscontrol.AccessControl, user *models.SignedInUser, evaluator accesscontrol.Evaluator) {
	injected, err := evaluator.MutateScopes(c.Req.Context(), accesscontrol.ScopeInjector(buildScopeParams(c)))
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "Internal server error", err)
		return
	}

	hasAccess, err := ac.Evaluate(c.Req.Context(), user, injected)
	if !hasAccess || err != nil {
		Deny(c, injected, err)
		return
	}
}

func Middleware(ac accesscontrol.AccessControl) func(web.Handler, accesscontrol.Evaluator) web.Handler {
	return func(fallback web.Handler, evaluator accesscontrol.Evaluator) web.Handler {
		if ac.IsDisabled() {
			return fallback
		}

		return func(c *models.ReqContext) {
			authorize(c, ac, c.SignedInUser, evaluator)
		}
	}
}

func Deny(c *models.ReqContext, evaluator accesscontrol.Evaluator, err error) {
	id := newID()
	if err != nil {
		c.Logger.Error("Error from access control system", "error", err, "accessErrorID", id)
	} else {
		c.Logger.Info(
			"Access denied",
			"userID", c.UserId,
			"accessErrorID", id,
			"permissions", evaluator.String(),
		)
	}

	if !c.IsApiRequest() {
		// TODO(emil): I'd like to show a message after this redirect, not sure how that can be done?
		c.Redirect(setting.AppSubUrl + "/")
		return
	}

	// If the user triggers an error in the access control system, we
	// don't want the user to be aware of that, so the user gets the
	// same information from the system regardless of if it's an
	// internal server error or access denied.
	c.JSON(http.StatusForbidden, map[string]string{
		"title":         "Access denied", // the component needs to pick this up
		"message":       fmt.Sprintf("You'll need additional permissions to perform this action. Refer your administrator to a Grafana log with the reference %s to identify which permissions to add.", id),
		"accessErrorId": id,
	})
}

func newID() string {
	// Less ambiguity than alphanumerical.
	numerical := []byte("0123456789")
	id, err := util.GetRandomString(10, numerical...)
	if err != nil {
		// this should not happen, but if it does, a timestamp is as
		// useful as anything.
		id = fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return "ACE" + id
}

func buildScopeParams(c *models.ReqContext) accesscontrol.ScopeParams {
	return accesscontrol.ScopeParams{
		OrgID:     c.OrgId,
		URLParams: web.Params(c.Req),
	}
}

type OrgIDGetter func(c *models.ReqContext) (int64, error)

func AuthorizeInOrgMiddleware(ac accesscontrol.AccessControl, db *sqlstore.SQLStore) func(web.Handler, OrgIDGetter, accesscontrol.Evaluator) web.Handler {
	return func(fallback web.Handler, getTargetOrg OrgIDGetter, evaluator accesscontrol.Evaluator) web.Handler {
		if ac.IsDisabled() {
			return fallback
		}

		return func(c *models.ReqContext) {
			// using a copy of the user not to modify the signedInUser, yet perform the permission evaluation in another org
			userCopy := *(c.SignedInUser)
			orgID, err := getTargetOrg(c)
			if err != nil {
				Deny(c, nil, fmt.Errorf("failed to get target org: %w", err))
				return
			}
			if orgID == accesscontrol.GlobalOrgID {
				userCopy.OrgId = orgID
				userCopy.OrgName = ""
				userCopy.OrgRole = ""
			} else {
				query := models.GetSignedInUserQuery{UserId: c.UserId, OrgId: orgID}
				if err := db.GetSignedInUserWithCacheCtx(c.Req.Context(), &query); err != nil {
					Deny(c, nil, fmt.Errorf("failed to authenticate user in target org: %w", err))
					return
				}
				userCopy.OrgId = query.Result.OrgId
				userCopy.OrgName = query.Result.OrgName
				userCopy.OrgRole = query.Result.OrgRole
			}

			authorize(c, ac, &userCopy, evaluator)
		}
	}
}

func UseOrgFromContextParams(c *models.ReqContext) (int64, error) {
	orgID, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)

	// Special case of macaron handling invalid params
	if orgID == 0 || err != nil {
		return 0, models.ErrOrgNotFound
	}

	return orgID, nil
}

func UseGlobalOrg(c *models.ReqContext) (int64, error) {
	return accesscontrol.GlobalOrgID, nil
}

// Disable returns http 404 if shouldDisable is set to true
func Disable(shouldDisable bool) web.Handler {
	return func(c *models.ReqContext) {
		if shouldDisable {
			c.Resp.WriteHeader(http.StatusNotFound)
			return
		}
	}
}

func LoadPermissionsMiddleware(ac accesscontrol.AccessControl) web.Handler {
	return func(c *models.ReqContext) {
		if ac.IsDisabled() {
			return
		}

		permissions, err := ac.GetUserPermissions(c.Req.Context(), c.SignedInUser)
		if err != nil {
			c.JsonApiErr(http.StatusForbidden, "", err)
			return
		}

		if c.SignedInUser.Permissions == nil {
			c.SignedInUser.Permissions = make(map[int64]map[string][]string)
		}
		c.SignedInUser.Permissions[c.OrgId] = accesscontrol.GroupScopesByAction(permissions)
	}
}

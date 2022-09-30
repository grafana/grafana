package accesscontrol

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"strconv"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func Middleware(ac AccessControl) func(web.Handler, Evaluator) web.Handler {
	return func(fallback web.Handler, evaluator Evaluator) web.Handler {
		if ac.IsDisabled() {
			return fallback
		}

		return func(c *models.ReqContext) {
			authorize(c, ac, c.SignedInUser, evaluator)
		}
	}
}

func authorize(c *models.ReqContext, ac AccessControl, user *user.SignedInUser, evaluator Evaluator) {
	injected, err := evaluator.MutateScopes(c.Req.Context(), scopeInjector(scopeParams{
		OrgID:     c.OrgID,
		URLParams: web.Params(c.Req),
	}))
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "Internal server error", err)
		return
	}

	hasAccess, err := ac.Evaluate(c.Req.Context(), user, injected)
	if !hasAccess || err != nil {
		deny(c, injected, err)
		return
	}
}

func deny(c *models.ReqContext, evaluator Evaluator, err error) {
	id := newID()
	if err != nil {
		c.Logger.Error("Error from access control system", "error", err, "accessErrorID", id)
	} else {
		c.Logger.Info(
			"Access denied",
			"userID", c.UserID,
			"accessErrorID", id,
			"permissions", evaluator.GoString(),
		)
	}

	if !c.IsApiRequest() {
		// TODO(emil): I'd like to show a message after this redirect, not sure how that can be done?
		c.Redirect(setting.AppSubUrl + "/")
		return
	}

	message := ""
	if evaluator != nil {
		message = evaluator.String()
	}

	// If the user triggers an error in the access control system, we
	// don't want the user to be aware of that, so the user gets the
	// same information from the system regardless of if it's an
	// internal server error or access denied.
	c.JSON(http.StatusForbidden, map[string]string{
		"title":         "Access denied", // the component needs to pick this up
		"message":       fmt.Sprintf("You'll need additional permissions to perform this action. Permissions needed: %s", message),
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

type OrgIDGetter func(c *models.ReqContext) (int64, error)
type userCache interface {
	GetSignedInUserWithCacheCtx(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error)
}

func AuthorizeInOrgMiddleware(ac AccessControl, service Service, cache userCache) func(web.Handler, OrgIDGetter, Evaluator) web.Handler {
	return func(fallback web.Handler, getTargetOrg OrgIDGetter, evaluator Evaluator) web.Handler {
		if ac.IsDisabled() {
			return fallback
		}

		return func(c *models.ReqContext) {
			// using a copy of the user not to modify the signedInUser, yet perform the permission evaluation in another org
			userCopy := *(c.SignedInUser)
			orgID, err := getTargetOrg(c)
			if err != nil {
				deny(c, nil, fmt.Errorf("failed to get target org: %w", err))
				return
			}
			if orgID == GlobalOrgID {
				userCopy.OrgID = orgID
				userCopy.OrgName = ""
				userCopy.OrgRole = ""
			} else {
				query := user.GetSignedInUserQuery{UserID: c.UserID, OrgID: orgID}
				queryResult, err := cache.GetSignedInUserWithCacheCtx(c.Req.Context(), &query)
				if err != nil {
					deny(c, nil, fmt.Errorf("failed to authenticate user in target org: %w", err))
					return
				}
				userCopy.OrgID = queryResult.OrgID
				userCopy.OrgName = queryResult.OrgName
				userCopy.OrgRole = queryResult.OrgRole
			}

			if userCopy.Permissions[userCopy.OrgID] == nil {
				permissions, err := service.GetUserPermissions(c.Req.Context(), &userCopy, Options{})
				if err != nil {
					deny(c, nil, fmt.Errorf("failed to authenticate user in target org: %w", err))
				}
				userCopy.Permissions[userCopy.OrgID] = GroupScopesByAction(permissions)
			}

			authorize(c, ac, &userCopy, evaluator)

			// Set the sign-ed in user permissions in that org
			c.SignedInUser.Permissions[userCopy.OrgID] = userCopy.Permissions[userCopy.OrgID]
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
	return GlobalOrgID, nil
}

func LoadPermissionsMiddleware(service Service) web.Handler {
	return func(c *models.ReqContext) {
		if service.IsDisabled() {
			return
		}

		permissions, err := service.GetUserPermissions(c.Req.Context(), c.SignedInUser,
			Options{ReloadCache: false})
		if err != nil {
			c.JsonApiErr(http.StatusForbidden, "", err)
			return
		}

		if c.SignedInUser.Permissions == nil {
			c.SignedInUser.Permissions = make(map[int64]map[string][]string)
		}
		c.SignedInUser.Permissions[c.OrgID] = GroupScopesByAction(permissions)
	}
}

// scopeParams holds the parameters used to fill in scope templates
type scopeParams struct {
	OrgID     int64
	URLParams map[string]string
}

// scopeInjector inject request params into the templated scopes. e.g. "settings:" + eval.Parameters(":id")
func scopeInjector(params scopeParams) ScopeAttributeMutator {
	return func(_ context.Context, scope string) ([]string, error) {
		tmpl, err := template.New("scope").Parse(scope)
		if err != nil {
			return nil, err
		}
		var buf bytes.Buffer
		if err = tmpl.Execute(&buf, params); err != nil {
			return nil, err
		}
		return []string{buf.String()}, nil
	}
}

package accesscontrol

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/authn"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func Middleware(ac AccessControl) func(Evaluator) web.Handler {
	return func(evaluator Evaluator) web.Handler {
		return func(c *contextmodel.ReqContext) {
			ctx, span := tracer.Start(c.Req.Context(), "accesscontrol.Middleware")
			defer span.End()
			c.Req = c.Req.WithContext(ctx)

			if c.AllowAnonymous {
				forceLogin, _ := strconv.ParseBool(c.Req.URL.Query().Get("forceLogin")) // ignoring error, assuming false for non-true values is ok.
				orgID, err := strconv.ParseInt(c.Req.URL.Query().Get("orgId"), 10, 64)
				if err == nil && orgID > 0 && orgID != c.GetOrgID() {
					forceLogin = true
				}

				if !c.IsSignedIn && forceLogin {
					unauthorized(c)
					return
				}
			}

			if c.LookupTokenErr != nil {
				var revokedErr *usertoken.TokenRevokedError
				if errors.As(c.LookupTokenErr, &revokedErr) {
					tokenRevoked(c, revokedErr)
					return
				}

				unauthorized(c)
				return
			}

			authorize(c, ac, c.SignedInUser, evaluator)
		}
	}
}

func authorize(c *contextmodel.ReqContext, ac AccessControl, user identity.Requester, evaluator Evaluator) {
	ctx, span := tracer.Start(c.Req.Context(), "accesscontrol.authorize")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	injected, err := evaluator.MutateScopes(ctx, scopeInjector(scopeParams{
		OrgID:     user.GetOrgID(),
		URLParams: web.Params(c.Req),
	}))
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "Internal server error", err)
		return
	}

	hasAccess, err := ac.Evaluate(ctx, user, injected)
	if !hasAccess || err != nil {
		deny(c, injected, err)
		return
	}
}

func deny(c *contextmodel.ReqContext, evaluator Evaluator, err error) {
	id := newID()
	if err != nil {
		c.Logger.Error("Error from access control system", "error", err, "accessErrorID", id)
		// Return 404s for dashboard not found errors, our plugins rely on being able to distinguish between access denied and not found.
		var dashboardErr dashboardaccess.DashboardErr
		if ok := errors.As(err, &dashboardErr); ok {
			if c.IsApiRequest() && dashboardErr.StatusCode == http.StatusNotFound {
				c.JSON(http.StatusNotFound, map[string]string{
					"title":   "Not found", // the component needs to pick this up
					"message": dashboardErr.Error(),
				})
				return
			}
		}
	} else {
		c.Logger.Info(
			"Access denied",
			"id", c.GetID(),
			"accessErrorID", id,
			"permissions", evaluator.GoString(),
		)
	}

	if !c.IsApiRequest() {
		// TODO(emil): I'd like to show a message after this redirect, not sure how that can be done?
		if !c.UseSessionStorageRedirect {
			writeRedirectCookie(c)
			c.Redirect(setting.AppSubUrl + "/")
			return
		}

		c.Redirect(setting.AppSubUrl + "/" + getRedirectToQueryParam(c))
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

func unauthorized(c *contextmodel.ReqContext) {
	if c.IsApiRequest() {
		c.WriteErrOrFallback(http.StatusUnauthorized, http.StatusText(http.StatusUnauthorized), c.LookupTokenErr)
		return
	}

	if !c.UseSessionStorageRedirect {
		writeRedirectCookie(c)
	}

	if errors.Is(c.LookupTokenErr, authn.ErrTokenNeedsRotation) {
		if !c.UseSessionStorageRedirect {
			c.Redirect(setting.AppSubUrl + "/user/auth-tokens/rotate")
			return
		}
		c.Redirect(setting.AppSubUrl + "/user/auth-tokens/rotate" + getRedirectToQueryParam(c))
		return
	}

	if !c.UseSessionStorageRedirect {
		c.Redirect(setting.AppSubUrl + "/login")
		return
	}

	c.Redirect(setting.AppSubUrl + "/login" + getRedirectToQueryParam(c))
}

func tokenRevoked(c *contextmodel.ReqContext, err *usertoken.TokenRevokedError) {
	if c.IsApiRequest() {
		c.JSON(http.StatusUnauthorized, map[string]any{
			"message": "Token revoked",
			"error": map[string]any{
				"id":                    "ERR_TOKEN_REVOKED",
				"maxConcurrentSessions": err.MaxConcurrentSessions,
			},
		})
		return
	}

	if !c.UseSessionStorageRedirect {
		writeRedirectCookie(c)
		c.Redirect(setting.AppSubUrl + "/login")
		return
	}

	c.Redirect(setting.AppSubUrl + "/login" + getRedirectToQueryParam(c))
}

func writeRedirectCookie(c *contextmodel.ReqContext) {
	redirectTo := c.Req.RequestURI
	if setting.AppSubUrl != "" && !strings.HasPrefix(redirectTo, setting.AppSubUrl) {
		redirectTo = setting.AppSubUrl + c.Req.RequestURI
	}

	// remove any forceLogin=true params
	redirectTo = removeForceLoginParams(redirectTo)

	cookies.WriteCookie(c.Resp, "redirect_to", url.QueryEscape(redirectTo), 0, nil)
}

func getRedirectToQueryParam(c *contextmodel.ReqContext) string {
	redirectTo := c.Req.RequestURI
	if setting.AppSubUrl != "" && strings.HasPrefix(redirectTo, setting.AppSubUrl) {
		redirectTo = strings.TrimPrefix(redirectTo, setting.AppSubUrl)
	}

	if redirectTo == "/" {
		return ""
	}

	// remove any forceLogin=true params
	redirectTo = removeForceLoginParams(redirectTo)
	return "?redirectTo=" + url.QueryEscape(redirectTo)
}

var forceLoginParamsRegexp = regexp.MustCompile(`&?forceLogin=true`)

func removeForceLoginParams(str string) string {
	return forceLoginParamsRegexp.ReplaceAllString(str, "")
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

type OrgIDGetter func(c *contextmodel.ReqContext) (int64, error)

func AuthorizeInOrgMiddleware(ac AccessControl, authnService authn.Service) func(OrgIDGetter, Evaluator) web.Handler {
	return func(getTargetOrg OrgIDGetter, evaluator Evaluator) web.Handler {
		return func(c *contextmodel.ReqContext) {
			ctx, span := tracer.Start(c.Req.Context(), "accesscontrol.AuthorizeInOrgMiddleware")
			defer span.End()
			c.Req = c.Req.WithContext(ctx)

			targetOrgID, err := getTargetOrg(c)
			if err != nil {
				if errors.Is(err, ErrInvalidRequestBody) {
					c.JSON(http.StatusBadRequest, map[string]string{
						"message": err.Error(),
						"traceID": tracing.TraceIDFromContext(c.Req.Context(), false),
					})
					return
				}
				deny(c, nil, fmt.Errorf("failed to get target org: %w", err))
				return
			}

			var orgUser identity.Requester = c.SignedInUser
			if targetOrgID != c.GetOrgID() {
				orgUser, err = authnService.ResolveIdentity(c.Req.Context(), targetOrgID, c.GetID())
				if err == nil && orgUser.GetOrgID() == NoOrgID {
					// User is not a member of the target org, so only their global permissions are relevant
					orgUser, err = authnService.ResolveIdentity(c.Req.Context(), GlobalOrgID, c.GetID())
				}
				if err != nil {
					deny(c, nil, fmt.Errorf("failed to authenticate user in target org: %w", err))
					return
				}
			}
			authorize(c, ac, orgUser, evaluator)

			// guard against nil map
			if c.Permissions == nil {
				c.Permissions = make(map[int64]map[string][]string)
			}
			c.Permissions[orgUser.GetOrgID()] = orgUser.GetPermissions()
		}
	}
}

func UseOrgFromContextParams(c *contextmodel.ReqContext) (int64, error) {
	orgID, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)

	// Special case of macaron handling invalid params
	if err != nil {
		return 0, org.ErrOrgNotFound.Errorf("failed to get organization from context: %w", err)
	}

	if orgID == 0 {
		return 0, org.ErrOrgNotFound.Errorf("empty org ID")
	}

	return orgID, nil
}

func UseGlobalOrg(c *contextmodel.ReqContext) (int64, error) {
	return GlobalOrgID, nil
}

// UseGlobalOrSingleOrg returns the global organization or the current organization in a single organization setup
func UseGlobalOrSingleOrg(cfg *setting.Cfg) OrgIDGetter {
	return func(c *contextmodel.ReqContext) (int64, error) {
		if cfg.RBAC.SingleOrganization {
			return c.GetOrgID(), nil
		}
		return GlobalOrgID, nil
	}
}

// UseOrgFromRequestData returns the organization from the request data.
// If no org is specified, then the org where user is logged in is returned.
func UseOrgFromRequestData(c *contextmodel.ReqContext) (int64, error) {
	query, err := getOrgQueryFromRequest(c)
	if err != nil {
		// Special case of macaron handling invalid params
		return NoOrgID, org.ErrOrgNotFound.Errorf("failed to get organization from context: %w", err)
	}

	if query.OrgId == nil {
		return c.GetOrgID(), nil
	}

	return *query.OrgId, nil
}

// UseGlobalOrgFromRequestData returns global org if `global` flag is set or the org where user is logged in.
// If RBACSingleOrganization is set, the org where user is logged in is returned - this is intended only for cloud workflows, where instances are limited to a single organization.
func UseGlobalOrgFromRequestData(cfg *setting.Cfg) OrgIDGetter {
	return func(c *contextmodel.ReqContext) (int64, error) {
		query, err := getOrgQueryFromRequest(c)
		if err != nil {
			if errors.Is(err, ErrInvalidRequestBody) {
				return NoOrgID, err
			}
			// Special case of macaron handling invalid params
			return NoOrgID, org.ErrOrgNotFound.Errorf("failed to get organization from context: %w", err)
		}

		// We only check permissions in the global organization if we are not running a SingleOrganization setup
		// That allows Organization Admins to modify global roles and make global assignments.
		if query.Global && !cfg.RBAC.SingleOrganization {
			return GlobalOrgID, nil
		}

		return c.GetOrgID(), nil
	}
}

// UseGlobalOrgFromRequestParams returns global org if `global` flag is set or the org where user is logged in.
func UseGlobalOrgFromRequestParams(cfg *setting.Cfg) OrgIDGetter {
	return func(c *contextmodel.ReqContext) (int64, error) {
		// We only check permissions in the global organization if we are not running a SingleOrganization setup
		// That allows Organization Admins to modify global roles and make global assignments, and is intended for use in hosted Grafana.
		if c.QueryBool("global") && !cfg.RBAC.SingleOrganization {
			return GlobalOrgID, nil
		}

		return c.GetOrgID(), nil
	}
}

func getOrgQueryFromRequest(c *contextmodel.ReqContext) (*QueryWithOrg, error) {
	query := &QueryWithOrg{}

	req, err := CloneRequest(c.Req)
	if err != nil {
		return nil, err
	}

	if err := web.Bind(req, query); err != nil {
		if err.Error() == "unexpected EOF" {
			return nil, fmt.Errorf("%w: unexpected end of JSON input", ErrInvalidRequestBody)
		}
		return nil, err
	}

	return query, nil
}

// CloneRequest creates request copy including request body
func CloneRequest(req *http.Request) (*http.Request, error) {
	// Get copy of body to prevent error when reading closed body in request handler
	bodyCopy, err := CopyRequestBody(req)
	if err != nil {
		return nil, err
	}
	reqCopy := req.Clone(req.Context())
	reqCopy.Body = bodyCopy
	return reqCopy, nil
}

// CopyRequestBody returns copy of request body and keeps the original one to prevent error when reading closed body
func CopyRequestBody(req *http.Request) (io.ReadCloser, error) {
	if req.Body == nil {
		return nil, nil
	}

	body := req.Body
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(body); err != nil {
		return nil, err
	}
	if err := body.Close(); err != nil {
		return nil, err
	}
	req.Body = io.NopCloser(&buf)
	return io.NopCloser(bytes.NewReader(buf.Bytes())), nil
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

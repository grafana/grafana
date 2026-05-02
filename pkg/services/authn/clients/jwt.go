package clients

import (
	"context"
	"net/http"
	"strings"

	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social/connectors"
	"github.com/grafana/grafana/pkg/services/auth"
	authJWT "github.com/grafana/grafana/pkg/services/auth/jwt"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const authQueryParamName = "auth_token"

var _ authn.ContextAwareClient = new(JWT)

var (
	errJWTInvalid = errutil.Unauthorized(
		"jwt.invalid", errutil.WithPublicMessage("Failed to verify JWT"))
	errJWTMissingClaim = errutil.Unauthorized(
		"jwt.missing_claim", errutil.WithPublicMessage("Missing mandatory claim in JWT"))
	errJWTInvalidRole = errutil.Forbidden(
		"jwt.invalid_role", errutil.WithPublicMessage("Invalid Role in claim"))
)

func ProvideJWT(jwtService auth.JWTVerifierService, orgRoleMapper *connectors.OrgRoleMapper, tracer trace.Tracer) *JWT {
	return &JWT{
		log:           log.New(authn.ClientJWT),
		jwtService:    jwtService,
		orgRoleMapper: orgRoleMapper,
		tracer:        tracer,
	}
}

type JWT struct {
	orgRoleMapper *connectors.OrgRoleMapper
	log           log.Logger
	jwtService    auth.JWTVerifierService
	tracer        trace.Tracer
}

// settings returns the live JWT settings snapshot. Reading through the
// jwtService rather than s.cfg.JWTAuth ensures that updates pushed via the
// SSO settings API are picked up at auth time.
func (s *JWT) settings() setting.AuthJWTSettings {
	return s.jwtService.Settings()
}

func (s *JWT) Name() string {
	return authn.ClientJWT
}

func (s *JWT) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	ctx, span := s.tracer.Start(ctx, "authn.jwt.Authenticate")
	defer span.End()

	jwtSettings := s.settings()

	jwtToken := retrieveToken(r.HTTPRequest, jwtSettings)
	stripSensitiveParam(r.HTTPRequest, jwtSettings)

	claims, err := s.jwtService.Verify(ctx, jwtToken)
	if err != nil {
		s.log.FromContext(ctx).Debug("Failed to verify JWT", "error", err)
		return nil, errJWTInvalid.Errorf("failed to verify JWT: %w", err)
	}

	sub, _ := claims["sub"].(string)
	if sub == "" {
		return nil, errJWTMissingClaim.Errorf("missing mandatory 'sub' claim in JWT")
	}

	id := &authn.Identity{
		AuthenticatedBy: login.JWTModule,
		AuthID:          sub,
		OrgRoles:        map[int64]org.RoleType{},
		ClientParams: authn.ClientParams{
			SyncUser:        true,
			FetchSyncedUser: true,
			SyncPermissions: true,
			SyncOrgRoles:    !jwtSettings.SkipOrgRoleSync,
			AllowSignUp:     jwtSettings.AutoSignUp,
			SyncTeams:       jwtSettings.GroupsAttributePath != "",
		},
	}

	if key := jwtSettings.UsernameClaim; key != "" {
		id.Login, _ = claims[key].(string)
		id.ClientParams.LookUpParams.Login = &id.Login
	} else if key := jwtSettings.UsernameAttributePath; key != "" {
		id.Login, err = util.SearchJSONForStringAttr(key, claims)
		if err != nil {
			return nil, err
		}
		id.ClientParams.LookUpParams.Login = &id.Login
	}

	if key := jwtSettings.EmailClaim; key != "" {
		id.Email, _ = claims[key].(string)
		id.ClientParams.LookUpParams.Email = &id.Email
	} else if key := jwtSettings.EmailAttributePath; key != "" {
		id.Email, err = util.SearchJSONForStringAttr(key, claims)
		if err != nil {
			return nil, err
		}
		id.ClientParams.LookUpParams.Email = &id.Email
	}

	if name, _ := claims["name"].(string); name != "" {
		id.Name = name
	}

	id.Groups, err = extractGroups(claims, jwtSettings)
	if err != nil {
		return nil, err
	}

	if !jwtSettings.SkipOrgRoleSync {
		role, grafanaAdmin := extractRoleAndAdmin(claims, jwtSettings)

		if jwtSettings.AllowAssignGrafanaAdmin {
			id.IsGrafanaAdmin = &grafanaAdmin
		}

		externalOrgs, err := extractOrgs(claims, jwtSettings)
		if err != nil {
			s.log.Warn("Failed to extract orgs", "err", err)
			return nil, err
		}

		// Org mapping is parsed per-call so changes pushed via the SSO settings
		// API take effect at the next authentication.
		orgMappingCfg := s.orgRoleMapper.ParseOrgMappingSettings(ctx, jwtSettings.OrgMapping, jwtSettings.RoleAttributeStrict)
		id.OrgRoles = s.orgRoleMapper.MapOrgRoles(orgMappingCfg, externalOrgs, role)
		if jwtSettings.RoleAttributeStrict && len(id.OrgRoles) == 0 {
			return nil, errJWTInvalidRole.Errorf("could not evaluate any valid roles using IdP provided data")
		}
	}

	if id.Login == "" && id.Email == "" {
		s.log.FromContext(ctx).Debug("Failed to get an authentication claim from JWT",
			"login", id.Login, "email", id.Email)
		return nil, errJWTMissingClaim.Errorf("missing login and email claim in JWT")
	}

	return id, nil
}

func (s *JWT) IsEnabled() bool {
	return s.settings().Enabled
}

// stripSensitiveParam removes the auth_token query parameter when URL login is
// enabled, so it doesn't leak into logs or metrics.
func stripSensitiveParam(httpRequest *http.Request, settings setting.AuthJWTSettings) {
	if settings.URLLogin {
		params := httpRequest.URL.Query()
		if params.Has(authQueryParamName) {
			params.Del(authQueryParamName)
			httpRequest.URL.RawQuery = params.Encode()
		}
	}
}

// retrieveToken retrieves the JWT token from the request.
func retrieveToken(httpRequest *http.Request, settings setting.AuthJWTSettings) string {
	jwtToken := httpRequest.Header.Get(settings.HeaderName)
	if jwtToken == "" && settings.URLLogin {
		jwtToken = httpRequest.URL.Query().Get("auth_token")
	}
	// Strip the 'Bearer' prefix if it exists.
	return strings.TrimPrefix(jwtToken, "Bearer ")
}

func (s *JWT) Test(ctx context.Context, r *authn.Request) bool {
	jwtSettings := s.settings()
	if !jwtSettings.Enabled || jwtSettings.HeaderName == "" {
		return false
	}

	jwtToken := retrieveToken(r.HTTPRequest, jwtSettings)

	if jwtToken == "" {
		return false
	}

	// If the "sub" claim is missing or empty then pass the control to the next handler
	if !authJWT.HasSubClaim(jwtToken) {
		return false
	}

	return true
}

func (s *JWT) Priority() uint {
	return 20
}

const roleGrafanaAdmin = "GrafanaAdmin"

func extractRoleAndAdmin(claims map[string]any, settings setting.AuthJWTSettings) (org.RoleType, bool) {
	if settings.RoleAttributePath == "" {
		return "", false
	}

	role, err := util.SearchJSONForStringAttr(settings.RoleAttributePath, claims)
	if err != nil || role == "" {
		return "", false
	}

	if role == roleGrafanaAdmin {
		return org.RoleAdmin, true
	}
	return org.RoleType(role), false
}

func extractGroups(claims map[string]any, settings setting.AuthJWTSettings) ([]string, error) {
	if settings.GroupsAttributePath == "" {
		return []string{}, nil
	}

	return util.SearchJSONForStringSliceAttr(settings.GroupsAttributePath, claims)
}

// This code was copied from the social_base.go file and was adapted to match with the JWT structure
func extractOrgs(claims map[string]any, settings setting.AuthJWTSettings) ([]string, error) {
	if settings.OrgAttributePath == "" {
		return []string{}, nil
	}

	return util.SearchJSONForStringSliceAttr(settings.OrgAttributePath, claims)
}

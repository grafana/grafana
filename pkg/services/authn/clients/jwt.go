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

func ProvideJWT(jwtService auth.JWTVerifierService, orgRoleMapper *connectors.OrgRoleMapper, cfg *setting.Cfg, tracer trace.Tracer) *JWT {
	return &JWT{
		cfg:           cfg,
		log:           log.New(authn.ClientJWT),
		jwtService:    jwtService,
		orgRoleMapper: orgRoleMapper,
		orgMappingCfg: orgRoleMapper.ParseOrgMappingSettings(context.Background(), cfg.JWTAuth.OrgMapping, cfg.JWTAuth.RoleAttributeStrict),
		tracer:        tracer,
	}
}

type JWT struct {
	cfg           *setting.Cfg
	orgRoleMapper *connectors.OrgRoleMapper
	orgMappingCfg connectors.MappingConfiguration
	log           log.Logger
	jwtService    auth.JWTVerifierService
	tracer        trace.Tracer
}

func (s *JWT) Name() string {
	return authn.ClientJWT
}

func (s *JWT) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	ctx, span := s.tracer.Start(ctx, "authn.jwt.Authenticate")
	defer span.End()

	jwtToken := s.retrieveToken(r.HTTPRequest)
	s.stripSensitiveParam(r.HTTPRequest)

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
			SyncOrgRoles:    !s.cfg.JWTAuth.SkipOrgRoleSync,
			AllowSignUp:     s.cfg.JWTAuth.AutoSignUp,
			SyncTeams:       s.cfg.JWTAuth.GroupsAttributePath != "",
		},
	}

	if key := s.cfg.JWTAuth.UsernameClaim; key != "" {
		id.Login, _ = claims[key].(string)
		id.ClientParams.LookUpParams.Login = &id.Login
	} else if key := s.cfg.JWTAuth.UsernameAttributePath; key != "" {
		id.Login, err = util.SearchJSONForStringAttr(s.cfg.JWTAuth.UsernameAttributePath, claims)
		if err != nil {
			return nil, err
		}
		id.ClientParams.LookUpParams.Login = &id.Login
	}

	if key := s.cfg.JWTAuth.EmailClaim; key != "" {
		id.Email, _ = claims[key].(string)
		id.ClientParams.LookUpParams.Email = &id.Email
	} else if key := s.cfg.JWTAuth.EmailAttributePath; key != "" {
		id.Email, err = util.SearchJSONForStringAttr(s.cfg.JWTAuth.EmailAttributePath, claims)
		if err != nil {
			return nil, err
		}
		id.ClientParams.LookUpParams.Email = &id.Email
	}

	if name, _ := claims["name"].(string); name != "" {
		id.Name = name
	}

	id.Groups, err = s.extractGroups(claims)
	if err != nil {
		return nil, err
	}

	if !s.cfg.JWTAuth.SkipOrgRoleSync {
		role, grafanaAdmin := s.extractRoleAndAdmin(claims)

		if s.cfg.JWTAuth.AllowAssignGrafanaAdmin {
			id.IsGrafanaAdmin = &grafanaAdmin
		}

		externalOrgs, err := s.extractOrgs(claims)
		if err != nil {
			s.log.Warn("Failed to extract orgs", "err", err)
			return nil, err
		}

		id.OrgRoles = s.orgRoleMapper.MapOrgRoles(s.orgMappingCfg, externalOrgs, role)
		if s.cfg.JWTAuth.RoleAttributeStrict && len(id.OrgRoles) == 0 {
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
	return s.cfg.JWTAuth.Enabled
}

// remove sensitive query param
// avoid JWT URL login passing auth_token in URL
func (s *JWT) stripSensitiveParam(httpRequest *http.Request) {
	if s.cfg.JWTAuth.URLLogin {
		params := httpRequest.URL.Query()
		if params.Has(authQueryParamName) {
			params.Del(authQueryParamName)
			httpRequest.URL.RawQuery = params.Encode()
		}
	}
}

// retrieveToken retrieves the JWT token from the request.
func (s *JWT) retrieveToken(httpRequest *http.Request) string {
	jwtToken := httpRequest.Header.Get(s.cfg.JWTAuth.HeaderName)
	if jwtToken == "" && s.cfg.JWTAuth.URLLogin {
		jwtToken = httpRequest.URL.Query().Get("auth_token")
	}
	// Strip the 'Bearer' prefix if it exists.
	return strings.TrimPrefix(jwtToken, "Bearer ")
}

func (s *JWT) Test(ctx context.Context, r *authn.Request) bool {
	if !s.cfg.JWTAuth.Enabled || s.cfg.JWTAuth.HeaderName == "" {
		return false
	}

	jwtToken := s.retrieveToken(r.HTTPRequest)

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

func (s *JWT) extractRoleAndAdmin(claims map[string]any) (org.RoleType, bool) {
	if s.cfg.JWTAuth.RoleAttributePath == "" {
		return "", false
	}

	role, err := util.SearchJSONForStringAttr(s.cfg.JWTAuth.RoleAttributePath, claims)
	if err != nil || role == "" {
		return "", false
	}

	if role == roleGrafanaAdmin {
		return org.RoleAdmin, true
	}
	return org.RoleType(role), false
}

func (s *JWT) extractGroups(claims map[string]any) ([]string, error) {
	if s.cfg.JWTAuth.GroupsAttributePath == "" {
		return []string{}, nil
	}

	return util.SearchJSONForStringSliceAttr(s.cfg.JWTAuth.GroupsAttributePath, claims)
}

// This code was copied from the social_base.go file and was adapted to match with the JWT structure
func (s *JWT) extractOrgs(claims map[string]any) ([]string, error) {
	if s.cfg.JWTAuth.OrgAttributePath == "" {
		return []string{}, nil
	}

	return util.SearchJSONForStringSliceAttr(s.cfg.JWTAuth.OrgAttributePath, claims)
}

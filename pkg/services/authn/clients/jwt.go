package clients

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/jmespath/go-jmespath"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth"
	authJWT "github.com/grafana/grafana/pkg/services/auth/jwt"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var _ authn.ContextAwareClient = new(JWT)

var (
	errJWTInvalid = errutil.NewBase(errutil.StatusUnauthorized,
		"jwt.invalid", errutil.WithPublicMessage("Failed to verify JWT"))
	errJWTMissingClaim = errutil.NewBase(errutil.StatusUnauthorized,
		"jwt.missing_claim", errutil.WithPublicMessage("Missing mandatory claim in JWT"))
	errJWTInvalidRole = errutil.NewBase(errutil.StatusForbidden,
		"jwt.invalid_role", errutil.WithPublicMessage("Invalid Role in claim"))
)

func ProvideJWT(jwtService auth.JWTVerifierService, cfg *setting.Cfg) *JWT {
	return &JWT{
		cfg:        cfg,
		log:        log.New(authn.ClientJWT),
		jwtService: jwtService,
	}
}

type JWT struct {
	cfg        *setting.Cfg
	log        log.Logger
	jwtService auth.JWTVerifierService
}

func (s *JWT) Name() string {
	return authn.ClientJWT
}

func (s *JWT) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	jwtToken := s.retrieveToken(r.HTTPRequest)

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
		AuthModule: login.JWTModule,
		AuthID:     sub,
		OrgRoles:   map[int64]org.RoleType{},
		ClientParams: authn.ClientParams{
			SyncUser:        true,
			FetchSyncedUser: true,
			SyncPermissions: true,
			SyncOrgRoles:    !s.cfg.JWTAuthSkipOrgRoleSync,
			AllowSignUp:     s.cfg.JWTAuthAutoSignUp,
		}}

	if key := s.cfg.JWTAuthUsernameClaim; key != "" {
		id.Login, _ = claims[key].(string)
		id.ClientParams.LookUpParams.Login = &id.Login
	}
	if key := s.cfg.JWTAuthEmailClaim; key != "" {
		id.Email, _ = claims[key].(string)
		id.ClientParams.LookUpParams.Email = &id.Email
	}

	if name, _ := claims["name"].(string); name != "" {
		id.Name = name
	}

	orgRoles, isGrafanaAdmin, err := getRoles(s.cfg, func() (org.RoleType, *bool, error) {
		if s.cfg.JWTAuthSkipOrgRoleSync {
			return "", nil, nil
		}

		role, grafanaAdmin := s.extractRoleAndAdmin(claims)
		if s.cfg.JWTAuthRoleAttributeStrict && !role.IsValid() {
			return "", nil, errJWTInvalidRole.Errorf("invalid role claim in JWT: %s", role)
		}

		if !s.cfg.JWTAuthAllowAssignGrafanaAdmin {
			return role, nil, nil
		}

		return role, &grafanaAdmin, nil
	})

	if err != nil {
		return nil, err
	}

	id.OrgRoles = orgRoles
	id.IsGrafanaAdmin = isGrafanaAdmin

	if id.Login == "" && id.Email == "" {
		s.log.FromContext(ctx).Debug("Failed to get an authentication claim from JWT",
			"login", id.Login, "email", id.Email)
		return nil, errJWTMissingClaim.Errorf("missing login and email claim in JWT")
	}

	return id, nil
}

// retrieveToken retrieves the JWT token from the request.
func (s *JWT) retrieveToken(httpRequest *http.Request) string {
	jwtToken := httpRequest.Header.Get(s.cfg.JWTAuthHeaderName)
	if jwtToken == "" && s.cfg.JWTAuthURLLogin {
		jwtToken = httpRequest.URL.Query().Get("auth_token")
	}
	// Strip the 'Bearer' prefix if it exists.
	return strings.TrimPrefix(jwtToken, "Bearer ")
}

func (s *JWT) Test(ctx context.Context, r *authn.Request) bool {
	if !s.cfg.JWTAuthEnabled || s.cfg.JWTAuthHeaderName == "" {
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

func (s *JWT) extractRoleAndAdmin(claims map[string]interface{}) (org.RoleType, bool) {
	if s.cfg.JWTAuthRoleAttributePath == "" {
		return "", false
	}

	role, err := searchClaimsForStringAttr(s.cfg.JWTAuthRoleAttributePath, claims)
	if err != nil || role == "" {
		return "", false
	}

	if role == roleGrafanaAdmin {
		return org.RoleAdmin, true
	}
	return org.RoleType(role), false
}

func searchClaimsForStringAttr(attributePath string, claims map[string]interface{}) (string, error) {
	val, err := searchClaimsForAttr(attributePath, claims)
	if err != nil {
		return "", err
	}

	strVal, ok := val.(string)
	if ok {
		return strVal, nil
	}

	return "", nil
}

func searchClaimsForAttr(attributePath string, claims map[string]interface{}) (interface{}, error) {
	if attributePath == "" {
		return "", errors.New("no attribute path specified")
	}

	if len(claims) == 0 {
		return "", errors.New("empty claims provided")
	}

	val, err := jmespath.Search(attributePath, claims)
	if err != nil {
		return "", fmt.Errorf("failed to search claims with provided path: %q: %w", attributePath, err)
	}

	return val, nil
}

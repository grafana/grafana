package clients

import (
	"context"
	"crypto"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-jose/go-jose/v3/jwt"
	"golang.org/x/exp/slices"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/oauthserver/utils"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var _ authn.Client = new(ExtendedJWT)

var (
	acceptedSigningMethods = []string{"RS256", "ES256"}
	timeNow                = time.Now
)

const (
	rfc9068ShortMediaType = "at+jwt"
	rfc9068MediaType      = "application/at+jwt"

	subAttrEmail = "email"
	subAttrLogin = "login"
	subAttrID    = "id"
)

func ProvideExtendedJWT(userService user.Service, cfg *setting.Cfg, signingKeys signingkeys.Service, oauthServer oauthserver.OAuth2Server) *ExtendedJWT {
	return &ExtendedJWT{
		cfg:         cfg,
		log:         log.New(authn.ClientExtendedJWT),
		userService: userService,
		signingKeys: signingKeys,
		oauthServer: oauthServer,
	}
}

type ExtendedJWT struct {
	cfg         *setting.Cfg
	log         log.Logger
	userService user.Service
	signingKeys signingkeys.Service
	oauthServer oauthserver.OAuth2Server
}

type ExtendedJWTClaims struct {
	jwt.Claims
	Actor        string              `json:"actor"`
	Groups       []string            `json:"groups"`
	Email        string              `json:"email"`
	Name         string              `json:"name"`
	Login        string              `json:"login"`
	Scopes       []string            `json:"scope"`
	Entitlements map[string][]string `json:"entitlements"`
}

func (s *ExtendedJWT) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	jwtToken := s.retrieveToken(r.HTTPRequest)

	claims, err := s.verifyRFC9068Token(ctx, jwtToken)
	if err != nil {
		s.log.Error("Failed to verify JWT", "error", err)
		return nil, errJWTInvalid.Errorf("Failed to verify JWT: %w", err)
	}

	// FIXME: support multiple organizations
	defaultOrgID := s.getDefaultOrgID()
	if r.OrgID != defaultOrgID {
		s.log.Error("Failed to verify the Organization: OrgID is not the default")
		return nil, errJWTInvalid.Errorf("Failed to verify the Organization. Only the default org is supported")
	}

	// user:id:18
	parts := strings.Split(claims.Subject, ":")
	if len(parts) != 3 {
		s.log.Error("Odd subject found. It should be of three parts", "subject", claims.Subject)
		return nil, errJWTInvalid.Errorf("sub is not composed of three parts: '%s", claims.Subject)
	}
	namespace := parts[0]
	switch namespace {
	case identity.NamespaceUser:
		return s.AuthenticateImpersonatedUser(ctx, claims, r.OrgID, parts[1], parts[2])
	case identity.NamespaceExternalService:
		return s.AuthenticateExternalService(ctx, claims, r.OrgID, parts[1], parts[2])
	default:
		return nil, errJWTInvalid.Errorf("subject namespace is incorrect: %v", namespace)
	}
}

func (s *ExtendedJWT) AuthenticateExternalService(ctx context.Context, claims *ExtendedJWTClaims, orgID int64, subjAttr, subjID string) (*authn.Identity, error) {
	lookup := &user.GetSignedInUserQuery{}
	switch subjAttr {
	case subAttrID:
		id, errParse := strconv.ParseInt(subjID, 10, 64)
		if errParse != nil {
			s.log.Error("Could not parse ID", "subject", claims.Subject)
			return nil, errJWTInvalid.Errorf("could not parse id; %w", errParse)
		}
		lookup.UserID = id
	case subAttrLogin:
		lookup.Login = subjID
	case subAttrEmail:
		lookup.Email = subjID
	default:
		s.log.Error("Unknown subject attribute", "subjAttr", subjAttr)
		return nil, errJWTInvalid.Errorf("unknown subject attribute: %v", subjAttr)
	}

	dbUser, errGet := s.userService.GetSignedInUserWithCacheCtx(ctx, lookup)
	if errGet != nil {
		return nil, errGet // TODO wrap?
	}

	if len(claims.Entitlements) == 0 {
		s.log.Error("Entitlements claim is missing")
		return nil, errJWTInvalid.Errorf("Entitlements claim is missing")
	}

	// TODO populate teams?
	// if slices.Contains(claims.Scopes, "groups") {
	// }

	identity := authn.Identity{
		OrgID:           orgID,
		OrgName:         "",                                                    // TODO?
		OrgRoles:        map[int64]roletype.RoleType{orgID: roletype.RoleNone}, // With external auth: Role None => use permissions only
		ID:              authn.NamespacedID(identity.NamespaceUser, dbUser.UserID),
		Login:           dbUser.Login,
		Name:            dbUser.Name,
		Email:           dbUser.Email,
		IsGrafanaAdmin:  new(bool),
		AuthenticatedBy: login.ExtendedJWTModule,
		LastSeenAt:      timeNow(),
		Teams:           []int64{}, // TODO?
		Groups:          []string{},
		ClientParams: authn.ClientParams{
			SyncPermissions:     true,
			RestrictPermissions: claims.Entitlements,
		},
		Permissions: map[int64]map[string][]string{},
	}

	return &identity, nil
}

func (s *ExtendedJWT) AuthenticateImpersonatedUser(ctx context.Context, claims *ExtendedJWTClaims, orgID int64, subjAttr, subjID string) (*authn.Identity, error) {
	lookup := &user.GetSignedInUserQuery{}
	switch subjAttr {
	case subAttrID:
		id, errParse := strconv.ParseInt(subjID, 10, 64)
		if errParse != nil {
			s.log.Error("Could not parse ID", "subject", claims.Subject)
			return nil, errJWTInvalid.Errorf("could not parse id; %w", errParse)
		}
		lookup.UserID = id
	case subAttrLogin:
		lookup.Login = subjID
	case subAttrEmail:
		lookup.Email = subjID
	default:
		s.log.Error("Unknown subject attribute", "subjAttr", subjAttr)
		return nil, errJWTInvalid.Errorf("unknown subject attribute: %v", subjAttr)
	}

	dbUser, errGet := s.userService.GetSignedInUserWithCacheCtx(ctx, lookup)
	if errGet != nil {
		return nil, errGet // TODO wrap?
	}

	if len(claims.Entitlements) == 0 {
		s.log.Error("Entitlements claim is missing")
		return nil, errJWTInvalid.Errorf("Entitlements claim is missing")
	}

	// TODO populate teams?
	// if slices.Contains(claims.Scopes, "groups") {
	// }

	// TODO Track the actor for auditing purposes?
	s.log.Info("Authenticated impersonated user", "login", dbUser.Login, "name", dbUser.Name, "email", dbUser.Email, "actor", claims.Actor)

	identity := authn.Identity{
		OrgID:           orgID,
		OrgName:         "",                                                    // TODO?
		OrgRoles:        map[int64]roletype.RoleType{orgID: roletype.RoleNone}, // With external auth: Role None => use permissions only
		ID:              authn.NamespacedID(identity.NamespaceUser, dbUser.UserID),
		Login:           dbUser.Login,
		Name:            dbUser.Name,
		Email:           dbUser.Email,
		IsGrafanaAdmin:  new(bool),
		AuthenticatedBy: login.ExtendedJWTModule,
		LastSeenAt:      timeNow(),
		Teams:           []int64{}, // TODO?
		Groups:          []string{},
		ClientParams: authn.ClientParams{
			SyncPermissions:     true,
			RestrictPermissions: claims.Entitlements,
		},
		Permissions: map[int64]map[string][]string{},
	}

	return &identity, nil
}

func (s *ExtendedJWT) Test(ctx context.Context, r *authn.Request) bool {
	if !s.cfg.ExtendedJWTAuthEnabled {
		return false
	}

	rawToken := s.retrieveToken(r.HTTPRequest)
	if rawToken == "" {
		return false
	}

	parsedToken, err := jwt.ParseSigned(rawToken)
	if err != nil {
		return false
	}

	var claims jwt.Claims
	if err := parsedToken.UnsafeClaimsWithoutVerification(&claims); err != nil {
		return false
	}

	return claims.Issuer == s.cfg.ExtendedJWTExpectIssuer
}

func (s *ExtendedJWT) Name() string {
	return authn.ClientExtendedJWT
}

func (s *ExtendedJWT) Priority() uint {
	// This client should come before the normal JWT client, because it is more specific, because of the Issuer check
	return 15
}

// retrieveToken retrieves the JWT token from the request.
func (s *ExtendedJWT) retrieveToken(httpRequest *http.Request) string {
	jwtToken := httpRequest.Header.Get("Authorization")

	// Strip the 'Bearer' prefix if it exists.
	return strings.TrimPrefix(jwtToken, "Bearer ")
}

// verifyRFC9068Token verifies the token against the RFC 9068 specification.
func (s *ExtendedJWT) verifyRFC9068Token(ctx context.Context, rawToken string) (*ExtendedJWTClaims, error) {
	parsedToken, err := jwt.ParseSigned(rawToken)
	if err != nil {
		return nil, fmt.Errorf("failed to parse JWT: %w", err)
	}

	if len(parsedToken.Headers) != 1 {
		return nil, fmt.Errorf("only one header supported, got %d", len(parsedToken.Headers))
	}

	parsedHeader := parsedToken.Headers[0]

	typeHeader := parsedHeader.ExtraHeaders["typ"]
	if typeHeader == nil {
		return nil, fmt.Errorf("missing 'typ' field from the header")
	}

	jwtType := strings.ToLower(typeHeader.(string))
	if jwtType != rfc9068ShortMediaType && jwtType != rfc9068MediaType {
		return nil, fmt.Errorf("invalid JWT type: %s", jwtType)
	}

	if !slices.Contains(acceptedSigningMethods, parsedHeader.Algorithm) {
		return nil, fmt.Errorf("invalid algorithm: %s. Accepted algorithms: %s", parsedHeader.Algorithm, strings.Join(acceptedSigningMethods, ", "))
	}

	key, errGetKey := s.signingPublicKey()
	if errGetKey != nil {
		return nil, errGetKey
	}

	var claims ExtendedJWTClaims
	err = parsedToken.Claims(key, &claims)
	if err != nil {
		return nil, fmt.Errorf("failed to verify the signature: %w", err)
	}

	if claims.Expiry == nil {
		return nil, fmt.Errorf("missing 'exp' claim")
	}

	if claims.ID == "" {
		return nil, fmt.Errorf("missing 'jti' claim")
	}

	if claims.Subject == "" {
		return nil, fmt.Errorf("missing 'sub' claim")
	}

	if claims.IssuedAt == nil {
		return nil, fmt.Errorf("missing 'iat' claim")
	}

	err = claims.ValidateWithLeeway(jwt.Expected{
		Issuer:   s.cfg.ExtendedJWTExpectIssuer,
		Audience: jwt.Audience{s.cfg.ExtendedJWTExpectAudience},
		Time:     timeNow(),
	}, 0)

	if err != nil {
		return nil, fmt.Errorf("failed to validate JWT: %w", err)
	}

	if err := s.validateClientIdClaim(ctx, claims); err != nil {
		return nil, err
	}

	return &claims, nil
}

func (s *ExtendedJWT) signingPublicKey() (crypto.PublicKey, error) {
	if s.cfg.ExtendedJWTPublicKeyURL != "" {
		s.log.Debug("Fetching key", "url", s.cfg.ExtendedJWTPublicKeyURL)
		// TODO eventually cache result
		resp, errGetKey := http.Get(s.cfg.ExtendedJWTPublicKeyURL)
		if errGetKey != nil {
			return nil, fmt.Errorf("could not fetch remote key at '%s': %w", s.cfg.ExtendedJWTPublicKeyURL, errGetKey)
		}
		defer func() {
			if err := resp.Body.Close(); err != nil {
				s.log.Warn("could not clode key response body")
			}
		}()
		body, errReadBody := io.ReadAll(resp.Body)
		if errReadBody != nil {
			return nil, fmt.Errorf("could not read response from '%s': %w", s.cfg.ExtendedJWTPublicKeyURL, errReadBody)
		}
		remoteKey, errParse := utils.ParsePublicKeyPem(body)
		if errParse != nil {
			return nil, fmt.Errorf("could not read key returned by '%s': %w", s.cfg.ExtendedJWTPublicKeyURL, errParse)
		}
		return remoteKey, nil
	}
	return s.signingKeys.GetServerPublicKey(), nil
}

func (s *ExtendedJWT) validateClientIdClaim(ctx context.Context, claims ExtendedJWTClaims) error {
	if claims.Actor == "" {
		return fmt.Errorf("missing 'actor' claim")
	}

	// With MESA, we trust the client ID is legit
	// if _, err := s.oauthServer.GetExternalService(ctx, claims.ClientID); err != nil {
	// 	return fmt.Errorf("invalid 'client_id' claim: %s", claims.ClientID)
	// }

	return nil
}

func (s *ExtendedJWT) getDefaultOrgID() int64 {
	orgID := int64(1)
	if s.cfg.AutoAssignOrg && s.cfg.AutoAssignOrgId > 0 {
		orgID = int64(s.cfg.AutoAssignOrgId)
	}
	return orgID
}

package clients

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-jose/go-jose/v3/jwt"
	"golang.org/x/exp/slices"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/oauthserver"
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
	ClientID     string              `json:"client_id"`
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

	// user:id:18
	userID, err := strconv.ParseInt(strings.TrimPrefix(claims.Subject, fmt.Sprintf("%s:id:", authn.NamespaceUser)), 10, 64)
	if err != nil {
		s.log.Error("Failed to parse sub", "error", err)
		return nil, errJWTInvalid.Errorf("Failed to parse sub: %w", err)
	}

	// FIXME: support multiple organizations
	defaultOrgID := s.getDefaultOrgID()
	if r.OrgID != defaultOrgID {
		s.log.Error("Failed to verify the Organization: OrgID is not the default")
		return nil, errJWTInvalid.Errorf("Failed to verify the Organization. Only the default org is supported")
	}

	signedInUser, err := s.userService.GetSignedInUserWithCacheCtx(ctx, &user.GetSignedInUserQuery{OrgID: defaultOrgID, UserID: userID})
	if err != nil {
		s.log.Error("Failed to get user", "error", err)
		return nil, errJWTInvalid.Errorf("Failed to get user: %w", err)
	}

	if signedInUser.Permissions == nil {
		signedInUser.Permissions = make(map[int64]map[string][]string)
	}

	if len(claims.Entitlements) == 0 {
		s.log.Error("Entitlements claim is missing")
		return nil, errJWTInvalid.Errorf("Entitlements claim is missing")
	}

	signedInUser.Permissions[s.getDefaultOrgID()] = claims.Entitlements

	return authn.IdentityFromSignedInUser(authn.NamespacedID(authn.NamespaceUser, signedInUser.UserID), signedInUser, authn.ClientParams{SyncPermissions: false}), nil
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

	var claims ExtendedJWTClaims
	err = parsedToken.Claims(s.signingKeys.GetServerPublicKey(), &claims)
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

func (s *ExtendedJWT) validateClientIdClaim(ctx context.Context, claims ExtendedJWTClaims) error {
	if claims.ClientID == "" {
		return fmt.Errorf("missing 'client_id' claim")
	}

	if _, err := s.oauthServer.GetExternalService(ctx, claims.ClientID); err != nil {
		return fmt.Errorf("invalid 'client_id' claim: %s", claims.ClientID)
	}

	return nil
}

func (s *ExtendedJWT) getDefaultOrgID() int64 {
	orgID := int64(1)
	if s.cfg.AutoAssignOrg && s.cfg.AutoAssignOrgId > 0 {
		orgID = int64(s.cfg.AutoAssignOrgId)
	}
	return orgID
}

package clients

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var _ authn.Client = new(ExtendedJWT)

var (
	timeNow = time.Now
)

const (
	SigningMethodNone     = jose.SignatureAlgorithm("none")
	rfc9068ShortMediaType = "at+jwt"
	rfc9068MediaType      = "application/at+jwt"

	defaultOrgID = 1
)

func ProvideExtendedJWT(userService user.Service, cfg *setting.Cfg, signingKeys signingkeys.Service) *ExtendedJWT {
	return &ExtendedJWT{
		cfg:         cfg,
		log:         log.New(authn.ClientExtendedJWT),
		userService: userService,
		signingKeys: signingKeys,
	}
}

type ExtendedJWT struct {
	cfg         *setting.Cfg
	log         log.Logger
	userService user.Service
	signingKeys signingkeys.Service
}

func (s *ExtendedJWT) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	jwtToken := s.retrieveToken(r.HTTPRequest)

	claims, err := s.verifyRFC9068Token(ctx, jwtToken)
	if err != nil {
		s.log.Error("Failed to verify JWT", "error", err)
		return nil, errJWTInvalid.Errorf("Failed to verify JWT: %w", err)
	}

	// user:id:18
	userID, err := strconv.ParseInt(strings.TrimPrefix(claims["sub"].(string), fmt.Sprintf("%s:id:", authn.NamespaceUser)), 10, 64)
	if err != nil {
		s.log.Error("Failed to parse sub", "error", err)
		return nil, errJWTInvalid.Errorf("Failed to parse sub: %w", err)
	}

	signedInUser, err := s.userService.GetSignedInUserWithCacheCtx(ctx, &user.GetSignedInUserQuery{OrgID: r.OrgID, UserID: userID})
	if err != nil {
		s.log.Error("Failed to get user", "error", err)
		return nil, errJWTInvalid.Errorf("Failed to get user: %w", err)
	}

	if signedInUser.Permissions == nil {
		signedInUser.Permissions = make(map[int64]map[string][]string)
	}

	if claims["entitlements"] == nil {
		s.log.Error("Entitlements claim is missing")
		return nil, errJWTInvalid.Errorf("Entitlements claim is missing")
	} else {
		permissions, err := s.parseEntitlements(claims["entitlements"])
		if err != nil {
			return nil, errJWTInvalid.Errorf("Failed to parse permissions: %w", err)
		}
		signedInUser.Permissions[defaultOrgID] = permissions
	}

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

// parseEntitlements parses the entitlements claim.
func (s *ExtendedJWT) parseEntitlements(entitlementsClaimValue interface{}) (map[string][]string, error) {
	result := map[string][]string{}
	entitlements, ok := entitlementsClaimValue.(map[string]interface{})
	if !ok {
		s.log.Error("Entitlements claim cannot be parsed")
		return nil, fmt.Errorf("entitlements claim cannot be parsed")
	}

	for key, value := range entitlements {
		if value == nil {
			result[key] = []string{}
		} else {
			parsedScopeArray, err := s.parseScopesArray(value)
			if err != nil {
				s.log.Error("Failed to parse scopes for permission", "error", err, "permission", key, "scopes", value, "expectedFormat", []string{"folders:uid:general"})
				return nil, fmt.Errorf("failed to parse scopes for permission: %s", key)
			}
			result[key] = parsedScopeArray
		}
	}
	return result, nil
}

// parseScopesArray parses the scopes array of the current permission from the entitlements claim.
func (s *ExtendedJWT) parseScopesArray(scopes interface{}) ([]string, error) {
	result := []string{}
	if _, ok := scopes.([]interface{}); !ok {
		return nil, fmt.Errorf("permissions' scopes cannot be parsed")
	}
	for _, entitlement := range scopes.([]interface{}) {
		result = append(result, entitlement.(string))
	}
	return result, nil
}

// retrieveToken retrieves the JWT token from the request.
func (s *ExtendedJWT) retrieveToken(httpRequest *http.Request) string {
	jwtToken := httpRequest.Header.Get("Authorization")

	// Strip the 'Bearer' prefix if it exists.
	return strings.TrimPrefix(jwtToken, "Bearer ")
}

// verifyRFC9068Token verifies the token against the RFC 9068 specification.
func (s *ExtendedJWT) verifyRFC9068Token(ctx context.Context, rawToken string) (map[string]interface{}, error) {
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

	if parsedHeader.Algorithm == string(SigningMethodNone) {
		return nil, fmt.Errorf("invalid algorithm: %s", parsedHeader.Algorithm)
	}

	var claims jwt.Claims
	var allClaims map[string]interface{}
	err = parsedToken.Claims(s.signingKeys.GetServerPublicKey(), &claims, &allClaims)
	if err != nil {
		return nil, fmt.Errorf("failed to verify the signature: %w", err)
	}

	if _, expClaimExists := allClaims["exp"]; !expClaimExists {
		return nil, fmt.Errorf("missing 'exp' claim")
	}

	if _, jtiClaimExists := allClaims["jti"]; !jtiClaimExists {
		return nil, fmt.Errorf("missing 'jti' claim")
	}

	if _, subClaimExists := allClaims["sub"]; !subClaimExists {
		return nil, fmt.Errorf("missing 'sub' claim")
	}

	if _, iatClaimExists := allClaims["iat"]; !iatClaimExists {
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

	if err := s.validateClientIdClaim(ctx, allClaims); err != nil {
		return nil, err
	}

	return allClaims, nil
}

func (s *ExtendedJWT) validateClientIdClaim(ctx context.Context, claims map[string]interface{}) error {
	clientIdClaim, ok := claims["client_id"]
	if !ok {
		return fmt.Errorf("missing 'client_id' claim")
	}

	_, ok = clientIdClaim.(string)
	if !ok {
		return fmt.Errorf("invalid 'client_id' claim: %s", clientIdClaim)
	}

	// TODO: Implement the validation for client_id when the OAuth server is ready.
	// if _, err := s.oauthService.GetExternalService(ctx, clientId); err != nil {
	// 	return fmt.Errorf("invalid 'client_id' claim: %s", clientIdClaim)
	// }

	return nil
}

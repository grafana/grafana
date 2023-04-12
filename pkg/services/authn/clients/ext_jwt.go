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
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var _ authn.Client = new(ExtendedJWT)

var (
	ErrInvalidToken = errutil.NewBase(errutil.StatusUnauthorized,
		"invalid_token", errutil.WithPublicMessage("Failed to verify JWT"))

	timeNow = time.Now
)

const (
	SigningMethodNone = jose.SignatureAlgorithm("none")
)

func ProvideExtendedJWT(userService user.Service, cfg *setting.Cfg, features *featuremgmt.FeatureManager /*, oauthService oauthserver.OAuth2Service*/) *ExtendedJWT {
	return &ExtendedJWT{
		cfg:         cfg,
		features:    features,
		log:         log.New(authn.ClientJWT),
		userService: userService,
		// oauthService: oauthService,
		//publicKey: oauthService.GetServerPublicKey(),
	}
}

type ExtendedJWT struct {
	cfg         *setting.Cfg
	features    *featuremgmt.FeatureManager
	log         log.Logger
	userService user.Service
	// oauthService oauthserver.OAuth2Service
	publicKey interface{}
}

func (s *ExtendedJWT) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	jwtToken := s.retrieveToken(r.HTTPRequest)

	claims, err := s.VerifyRFC9068Token(ctx, jwtToken)
	if err != nil {
		s.log.FromContext(ctx).Error("failed to verify JWT", "error", err)
		return nil, ErrInvalidToken.Errorf("failed to verify JWT: %w", err)
	}

	// user:id:18
	userID, err := strconv.ParseInt(strings.TrimPrefix(claims["sub"].(string), fmt.Sprintf("%s:id:", authn.NamespaceUser)), 10, 64)
	if err != nil {
		s.log.FromContext(ctx).Debug("failed to parse sub", "error", err)
		return nil, errJWTInvalid.Errorf("failed to parse sub: %w", err)
	}

	signedInUser, err := s.userService.GetSignedInUserWithCacheCtx(ctx, &user.GetSignedInUserQuery{OrgID: r.OrgID, UserID: userID})
	if err != nil {
		return nil, err
	}

	if signedInUser.Permissions == nil {
		signedInUser.Permissions = make(map[int64]map[string][]string)
	}

	if claims["entitlements"] == nil {
		s.log.FromContext(ctx).Info("missing entitlements claim")
	} else {
		signedInUser.Permissions[1] = s.parseEntitlements(claims["entitlements"].(map[string]interface{}))
	}

	return authn.IdentityFromSignedInUser(authn.NamespacedID(authn.NamespaceUser, signedInUser.UserID), signedInUser, authn.ClientParams{SyncPermissions: false}), nil
}

func (s *ExtendedJWT) parseEntitlements(entitlements map[string]interface{}) map[string][]string {
	result := map[string][]string{}
	for key, value := range entitlements {
		if value == nil {
			result[key] = []string{}
		} else {
			result[key] = s.parseEntitlementsArray(value)
		}
	}
	return result
}

func (s *ExtendedJWT) parseEntitlementsArray(entitlements interface{}) []string {
	result := []string{}
	for _, entitlement := range entitlements.([]interface{}) {
		result = append(result, entitlement.(string))
	}
	return result
}

// retrieveToken retrieves the JWT token from the request.
func (s *ExtendedJWT) retrieveToken(httpRequest *http.Request) string {
	jwtToken := httpRequest.Header.Get("Authorization")

	// Strip the 'Bearer' prefix if it exists.
	return strings.TrimPrefix(jwtToken, "Bearer ")
}

func (s *ExtendedJWT) Test(ctx context.Context, r *authn.Request) bool {
	if !s.features.IsEnabled(featuremgmt.FlagExternalServiceAuth) {
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

	return claims.Issuer == s.cfg.AppURL
}

// VerifyRFC9068Token verifies the token against the RFC 9068 specification.
func (s *ExtendedJWT) VerifyRFC9068Token(ctx context.Context, rawToken string) (map[string]interface{}, error) {
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
	if jwtType != "at+jwt" && jwtType != "application/at+jwt" {
		return nil, fmt.Errorf("invalid JWT type: %s", jwtType)
	}

	if parsedHeader.Algorithm == string(SigningMethodNone) {
		return nil, fmt.Errorf("invalid algorithm: %s", parsedHeader.Algorithm)
	}

	var claims jwt.Claims
	var allClaims map[string]interface{}
	err = parsedToken.Claims(s.publicKey, &claims, &allClaims)
	if err != nil {
		return nil, fmt.Errorf("failed to verify JWT: %w", err)
	}

	err = claims.ValidateWithLeeway(jwt.Expected{
		Issuer: s.cfg.AppURL,
		// FIXME: Commented this out for the credential grant to work, but might not be safe
		// Audience: jwt.Audience{s.cfg.AppURL + "oauth2/token"},
		Time: timeNow(),
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

	// clientId
	_, ok = clientIdClaim.(string)
	if !ok {
		return fmt.Errorf("invalid 'client_id' claim: %s", clientIdClaim)
	}

	// TODO: Add an interface for GetExternalService to the oauth service
	// if _, err := s.oauthService.GetExternalService(ctx, clientId); err != nil {
	// 	return fmt.Errorf("invalid 'client_id' claim: %s", clientIdClaim)
	// }

	return nil
}

func (s *ExtendedJWT) Name() string {
	return "extended_jwt"
}

func (c *ExtendedJWT) Priority() uint {
	return 15
}

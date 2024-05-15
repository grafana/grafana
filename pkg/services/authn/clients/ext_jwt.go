package clients

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-jose/go-jose/v3/jwt"
	authlib "github.com/grafana/authlib/authn"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var _ authn.Client = new(ExtendedJWT)

const (
	extJWTAuthenticationHeaderName  = "X-Access-Token"
	extJWTAuthorizationHeaderName   = "X-Grafana-Id"
	extJWTAccessTokenExpectAudience = "grafana"
)

func ProvideExtendedJWT(userService user.Service, cfg *setting.Cfg,
	signingKeys signingkeys.Service) *ExtendedJWT {
	verifier := authlib.NewAccessTokenVerifier(authlib.VerifierConfig{
		SigningKeysURL:   cfg.ExtJWTAuth.JWKSUrl,
		AllowedAudiences: []string{extJWTAccessTokenExpectAudience},
	})

	// For ID tokens, we explicitly do not validate audience, hence an empty AllowedAudiences
	// Namespace claim will be checked
	idTokenVerifier := authlib.NewIDTokenVerifier(authlib.VerifierConfig{
		SigningKeysURL: cfg.ExtJWTAuth.JWKSUrl,
	})

	return &ExtendedJWT{
		cfg:                 cfg,
		log:                 log.New(authn.ClientExtendedJWT),
		userService:         userService,
		signingKeys:         signingKeys,
		accessTokenVerifier: verifier,
		namespaceMapper:     request.GetNamespaceMapper(cfg),

		idTokenVerifier: idTokenVerifier,
	}
}

type ExtendedJWT struct {
	cfg                 *setting.Cfg
	log                 log.Logger
	userService         user.Service
	signingKeys         signingkeys.Service
	accessTokenVerifier authlib.Verifier[authlib.AccessTokenClaims]
	idTokenVerifier     authlib.Verifier[authlib.IDTokenClaims]
	namespaceMapper     request.NamespaceMapper
}

func (s *ExtendedJWT) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	jwtToken := s.retrieveAuthenticationToken(r.HTTPRequest)

	claims, err := s.accessTokenVerifier.Verify(ctx, jwtToken)
	if err != nil {
		s.log.Error("Failed to verify access token", "error", err)
		return nil, errJWTInvalid.Errorf("Failed to verify access token: %w", err)
	}

	idToken := s.retrieveAuthorizationToken(r.HTTPRequest)
	if idToken != "" {
		idTokenClaims, err := s.idTokenVerifier.Verify(ctx, idToken)
		if err != nil {
			s.log.Error("Failed to verify id token", "error", err)
			return nil, errJWTInvalid.Errorf("Failed to verify id token: %w", err)
		}

		return s.authenticateAsUser(idTokenClaims, claims)
	}

	return s.authenticateAsService(claims)
}

func (s *ExtendedJWT) IsEnabled() bool {
	return s.cfg.ExtJWTAuth.Enabled
}

func (s *ExtendedJWT) authenticateAsUser(idTokenClaims *authlib.Claims[authlib.IDTokenClaims],
	accessTokenClaims *authlib.Claims[authlib.AccessTokenClaims]) (*authn.Identity, error) {
	// compare the incoming namespace claim against what namespaceMapper returns
	if allowedNamespace := s.namespaceMapper(s.getDefaultOrgID()); idTokenClaims.Rest.Namespace != allowedNamespace {
		return nil, errJWTDisallowedNamespaceClaim
	}
	// since id token claims can never have a wildcard ("*") namespace claim, the below comparison effectively
	// disallows wildcard claims in access tokens here in Grafana (they are only meant for service layer)
	if accessTokenClaims.Rest.Namespace != idTokenClaims.Rest.Namespace {
		return nil, errJWTMismatchedNamespaceClaims.Errorf("id token namespace: %s, access token namespace: %s", idTokenClaims.Rest.Namespace, accessTokenClaims.Rest.Namespace)
	}

	// Only allow access policies to impersonate
	if !strings.HasPrefix(accessTokenClaims.Subject, fmt.Sprintf("%s:", authn.NamespaceAccessPolicy)) {
		s.log.Error("Invalid subject", "subject", accessTokenClaims.Subject)
		return nil, errJWTInvalid.Errorf("Failed to parse sub: %s", "invalid subject format")
	}
	// Allow only user impersonation
	_, err := strconv.ParseInt(strings.TrimPrefix(idTokenClaims.Subject, fmt.Sprintf("%s:", authn.NamespaceUser)), 10, 64)
	if err != nil {
		s.log.Error("Failed to parse sub", "error", err)
		return nil, errJWTInvalid.Errorf("Failed to parse sub: %w", err)
	}

	id, err := authn.ParseNamespaceID(idTokenClaims.Subject)
	if err != nil {
		return nil, err
	}

	return &authn.Identity{
		ID:              id,
		OrgID:           s.getDefaultOrgID(),
		AuthenticatedBy: login.ExtendedJWTModule,
		AuthID:          accessTokenClaims.Subject,
		ClientParams: authn.ClientParams{
			SyncPermissions: true,
			FetchPermissionsParams: authn.FetchPermissionsParams{
				ActionsLookup: accessTokenClaims.Rest.DelegatedPermissions,
			},
			FetchSyncedUser: true,
		}}, nil
}

func (s *ExtendedJWT) authenticateAsService(claims *authlib.Claims[authlib.AccessTokenClaims]) (*authn.Identity, error) {
	if !strings.HasPrefix(claims.Subject, fmt.Sprintf("%s:", authn.NamespaceAccessPolicy)) {
		s.log.Error("Invalid subject", "subject", claims.Subject)
		return nil, errJWTInvalid.Errorf("Failed to parse sub: %s", "invalid subject format")
	}

	// same as asUser, disallows wildcard claims in access tokens here in Grafana (they are only meant for service layer)
	if allowedNamespace := s.namespaceMapper(s.getDefaultOrgID()); claims.Rest.Namespace != allowedNamespace {
		return nil, errJWTDisallowedNamespaceClaim
	}

	id, err := authn.ParseNamespaceID(claims.Subject)
	if err != nil {
		return nil, err
	}

	return &authn.Identity{
		ID:              id,
		UID:             id,
		OrgID:           s.getDefaultOrgID(),
		AuthenticatedBy: login.ExtendedJWTModule,
		AuthID:          claims.Subject,
		ClientParams: authn.ClientParams{
			SyncPermissions: true,
			FetchPermissionsParams: authn.FetchPermissionsParams{
				Roles: claims.Rest.Permissions,
			},
			FetchSyncedUser: false,
		},
	}, nil
}

func (s *ExtendedJWT) Test(ctx context.Context, r *authn.Request) bool {
	if !s.cfg.ExtJWTAuth.Enabled {
		return false
	}

	rawToken := s.retrieveAuthenticationToken(r.HTTPRequest)
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

	return true
}

func (s *ExtendedJWT) Name() string {
	return authn.ClientExtendedJWT
}

func (s *ExtendedJWT) Priority() uint {
	// This client should come before the normal JWT client, because it is more specific, because of the Issuer check
	return 15
}

// retrieveAuthenticationToken retrieves the JWT token from the request.
func (s *ExtendedJWT) retrieveAuthenticationToken(httpRequest *http.Request) string {
	jwtToken := httpRequest.Header.Get(extJWTAuthenticationHeaderName)

	// Strip the 'Bearer' prefix if it exists.
	return strings.TrimPrefix(jwtToken, "Bearer ")
}

// retrieveAuthorizationToken retrieves the JWT token from the request.
func (s *ExtendedJWT) retrieveAuthorizationToken(httpRequest *http.Request) string {
	jwtToken := httpRequest.Header.Get(extJWTAuthorizationHeaderName)

	// Strip the 'Bearer' prefix if it exists.
	return strings.TrimPrefix(jwtToken, "Bearer ")
}

func (s *ExtendedJWT) getDefaultOrgID() int64 {
	orgID := int64(1)
	if s.cfg.AutoAssignOrg && s.cfg.AutoAssignOrgId > 0 {
		orgID = int64(s.cfg.AutoAssignOrgId)
	}
	return orgID
}

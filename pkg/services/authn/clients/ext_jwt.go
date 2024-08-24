package clients

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-jose/go-jose/v3/jwt"
	authlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/authz"
	authlibclaims "github.com/grafana/authlib/claims"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/setting"
)

var _ authn.Client = new(ExtendedJWT)

const (
	ExtJWTAuthenticationHeaderName = "X-Access-Token"
	ExtJWTAuthorizationHeaderName  = "X-Grafana-Id"
)

var (
	errExtJWTInvalid = errutil.Unauthorized(
		"ext.jwt.invalid", errutil.WithPublicMessage("Failed to verify JWT"),
	)
	errExtJWTInvalidSubject = errutil.Unauthorized(
		"ext.jwt.invalid-subject", errutil.WithPublicMessage("Invalid token subject"),
	)
	errExtJWTNamespaceAccessCheckerDeniedAccess = errutil.Unauthorized(
		"ext.jwt.namespace-mismatch", errutil.WithPublicMessage("Namespace access checker denied access based on claims present"),
	)
)

func ProvideExtendedJWT(cfg *setting.Cfg) *ExtendedJWT {
	keys := authlib.NewKeyRetriever(authlib.KeyRetrieverConfig{
		SigningKeysURL: cfg.ExtJWTAuth.JWKSUrl,
	})

	accessTokenVerifier := authlib.NewAccessTokenVerifier(authlib.VerifierConfig{
		AllowedAudiences: cfg.ExtJWTAuth.Audiences,
	}, keys)

	// For ID tokens, we explicitly do not validate audience, hence an empty AllowedAudiences
	// Namespace claim will be checked
	idTokenVerifier := authlib.NewIDTokenVerifier(authlib.VerifierConfig{}, keys)

	return &ExtendedJWT{
		cfg:                     cfg,
		log:                     log.New(authn.ClientExtendedJWT),
		accessTokenVerifier:     accessTokenVerifier,
		idTokenVerifier:         idTokenVerifier,
		expectedNamespaceMapper: request.GetNamespaceMapper(cfg),
		namespaceAccessChecker: authz.NewNamespaceAccessChecker(
			request.GetNamespaceAccessCheckerType(cfg),
			authz.WithIDTokenNamespaceAccessCheckerOption(false),
		),
	}
}

type ExtendedJWT struct {
	cfg                     *setting.Cfg
	log                     log.Logger
	accessTokenVerifier     authlib.Verifier[authlib.AccessTokenClaims]
	idTokenVerifier         authlib.Verifier[authlib.IDTokenClaims]
	expectedNamespaceMapper request.NamespaceMapper
	namespaceAccessChecker  authz.NamespaceAccessChecker
}

func (s *ExtendedJWT) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	jwtToken := s.retrieveAuthenticationToken(r.HTTPRequest)

	claims, err := s.accessTokenVerifier.Verify(ctx, jwtToken)
	if err != nil {
		return nil, errExtJWTInvalid.Errorf("failed to verify access token: %w", err)
	}

	authInfo := authlib.AuthInfo{
		IdentityClaims: nil,
		AccessClaims:   authlib.NewAccessClaims(*claims),
	}

	if err != nil {
		return nil, err
	}

	idToken := s.retrieveAuthorizationToken(r.HTTPRequest)
	if idToken != "" {
		idTokenClaims, err := s.idTokenVerifier.Verify(ctx, idToken)
		if err != nil {
			return nil, errExtJWTInvalid.Errorf("failed to verify id token: %w", err)
		}

		authInfo.IdentityClaims = authlib.NewIdentityClaims(*idTokenClaims)

		return s.authenticateAsUser(idTokenClaims, claims)
	}

	return s.authenticateAsService(claims)
}

func (s *ExtendedJWT) IsEnabled() bool {
	return s.cfg.ExtJWTAuth.Enabled
}

func (s *ExtendedJWT) authenticateAsUser(
	idTokenClaims *authlib.Claims[authlib.IDTokenClaims],
	accessTokenClaims *authlib.Claims[authlib.AccessTokenClaims],
) (*authn.Identity, error) {
	authInfo := &authlib.AuthInfo{
		IdentityClaims: authlib.NewIdentityClaims(*idTokenClaims),
		AccessClaims:   authlib.NewAccessClaims(*accessTokenClaims),
	}

	if err := s.namespaceAccessChecker.CheckAccess(authInfo, s.expectedNamespaceMapper(s.getDefaultOrgID())); err != nil {
		return nil, errExtJWTNamespaceAccessCheckerDeniedAccess.Errorf(err.Error())
	}

	accessType, _, err := identity.ParseTypeAndID(accessTokenClaims.Subject)
	if err != nil {
		return nil, errExtJWTInvalidSubject.Errorf("unexpected identity: %s", accessTokenClaims.Subject)
	}

	if !authlibclaims.IsIdentityType(accessType, authlibclaims.TypeAccessPolicy) {
		return nil, errExtJWTInvalid.Errorf("unexpected identity: %s", accessTokenClaims.Subject)
	}

	t, id, err := identity.ParseTypeAndID(idTokenClaims.Subject)
	if err != nil {
		return nil, errExtJWTInvalid.Errorf("failed to parse id token subject: %w", err)
	}

	if !authlibclaims.IsIdentityType(t, authlibclaims.TypeUser) {
		return nil, errExtJWTInvalidSubject.Errorf("unexpected identity: %s", idTokenClaims.Subject)
	}

	// For use in service layer, allow higher privilege
	allowedKubernetesNamespace := accessTokenClaims.Rest.Namespace
	if len(s.cfg.StackID) > 0 {
		// For single-tenant cloud use, choose the lower of the two (id token will always have the specific namespace)
		allowedKubernetesNamespace = idTokenClaims.Rest.Namespace
	}

	return &authn.Identity{
		ID:                         id,
		Type:                       t,
		OrgID:                      s.getDefaultOrgID(),
		AuthenticatedBy:            login.ExtendedJWTModule,
		AuthID:                     accessTokenClaims.Subject,
		AllowedKubernetesNamespace: allowedKubernetesNamespace,
		ClientParams: authn.ClientParams{
			SyncPermissions: true,
			FetchPermissionsParams: authn.FetchPermissionsParams{
				ActionsLookup: accessTokenClaims.Rest.DelegatedPermissions,
			},
			FetchSyncedUser: true,
		}}, nil
}

func (s *ExtendedJWT) authenticateAsService(claims *authlib.Claims[authlib.AccessTokenClaims]) (*authn.Identity, error) {
	authInfo := &authlib.AuthInfo{
		IdentityClaims: nil,
		AccessClaims:   authlib.NewAccessClaims(*claims),
	}

	if err := s.namespaceAccessChecker.CheckAccess(authInfo, s.expectedNamespaceMapper(s.getDefaultOrgID())); err != nil {
		return nil, errExtJWTNamespaceAccessCheckerDeniedAccess.Errorf(err.Error())
	}

	t, id, err := identity.ParseTypeAndID(claims.Subject)
	if err != nil {
		return nil, fmt.Errorf("failed to parse access token subject: %w", err)
	}

	if !authlibclaims.IsIdentityType(t, authlibclaims.TypeAccessPolicy) {
		return nil, errExtJWTInvalidSubject.Errorf("unexpected identity: %s", claims.Subject)
	}

	return &authn.Identity{
		ID:                         id,
		UID:                        id,
		Type:                       t,
		OrgID:                      s.getDefaultOrgID(),
		AuthenticatedBy:            login.ExtendedJWTModule,
		AuthID:                     claims.Subject,
		AllowedKubernetesNamespace: claims.Rest.Namespace,
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
	jwtToken := httpRequest.Header.Get(ExtJWTAuthenticationHeaderName)

	// Strip the 'Bearer' prefix if it exists.
	return strings.TrimPrefix(jwtToken, "Bearer ")
}

// retrieveAuthorizationToken retrieves the JWT token from the request.
func (s *ExtendedJWT) retrieveAuthorizationToken(httpRequest *http.Request) string {
	jwtToken := httpRequest.Header.Get(ExtJWTAuthorizationHeaderName)

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

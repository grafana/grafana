package clients

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	jose "github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	authlib "github.com/grafana/authlib/authn"
	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginauth"
	"github.com/grafana/grafana/pkg/setting"
)

var _ authn.Client = (*ExtendedJWT)(nil)

const (
	ExtJWTAuthenticationHeaderName = "X-Access-Token"
	ExtJWTAuthorizationHeaderName  = "X-Grafana-Id"

	grafanaAppPrefix = "grafana.app"
)

var (
	errExtJWTInvalid = errutil.Unauthorized(
		"ext.jwt.invalid", errutil.WithPublicMessage("Failed to verify JWT"),
	)
	errExtJWTInvalidSubject = errutil.Unauthorized(
		"ext.jwt.invalid-subject", errutil.WithPublicMessage("Invalid token subject"),
	)
	errExtJWTMisMatchedNamespaceClaims = errutil.Unauthorized(
		"ext.jwt.namespace-mismatch", errutil.WithPublicMessage("Namespace claims didn't match between id token and access token"),
	)
	errExtJWTDisallowedNamespaceClaim = errutil.Unauthorized(
		"ext.jwt.namespace-disallowed", errutil.WithPublicMessage("Namespace claim doesn't allow access to requested namespace"),
	)
)

// ProvideExtendedJWT returns the client for access tokens from the signer
// configured in [auth.extended_jwt].
func ProvideExtendedJWT(cfg *setting.Cfg, tracer trace.Tracer) *ExtendedJWT {
	return ProvideExtendedJWTWithPluginAuth(cfg, tracer, nil)
}

// ProvideExtendedJWTWithPluginAuth returns the client that, when pluginAuth
// says Grafana signs plugin access tokens itself, also trusts the local plugin
// signing key, and is then enabled without [auth.extended_jwt].
func ProvideExtendedJWTWithPluginAuth(cfg *setting.Cfg, tracer trace.Tracer, pluginAuth *pluginauth.Config) *ExtendedJWT {
	logger := log.New(authn.ClientExtendedJWT)
	var keys authlib.KeyRetriever = authlib.NewKeyRetriever(authlib.KeyRetrieverConfig{
		SigningKeysURL: cfg.ExtJWTAuth.JWKSUrl,
	})
	// Without a real signer, the plugins Grafana starts call its API with
	// tokens from the local token exchange, which only this process can sign.
	localKeys := false
	// Without audiences the verifier skips the audience check, and would then
	// accept the tokens Grafana sends to plugins.
	if pluginAuth.LocalTokens() && len(cfg.ExtJWTAuth.Audiences) > 0 {
		local, err := v3.LocalKeyRetriever()
		if err != nil {
			logger.Error("Failed to get the local plugin signing key", "error", err)
		} else {
			keys = local
			localKeys = true
		}
	}

	accessTokenVerifier := authlib.NewAccessTokenVerifier(authlib.VerifierConfig{
		AllowedAudiences: cfg.ExtJWTAuth.Audiences,
	}, keys)

	// For ID tokens, we explicitly do not validate audience, hence an empty AllowedAudiences
	// Namespace claim will be checked
	idTokenVerifier := authlib.NewIDTokenVerifier(authlib.VerifierConfig{}, keys)

	return &ExtendedJWT{
		cfg:                 cfg,
		localKeys:           localKeys,
		log:                 logger,
		namespaceMapper:     request.GetNamespaceMapper(cfg),
		accessTokenVerifier: accessTokenVerifier,
		accessTokenKeys:     keys,
		idTokenVerifier:     idTokenVerifier,
		tracer:              tracer,
	}
}

type ExtendedJWT struct {
	cfg *setting.Cfg
	// localKeys is set when tokens are verified with the local plugin signing
	// key, which enables the client without [auth.extended_jwt] enabled.
	localKeys           bool
	log                 log.Logger
	accessTokenVerifier authlib.Verifier[authlib.AccessTokenClaims]
	accessTokenKeys     authlib.KeyRetriever
	idTokenVerifier     authlib.Verifier[authlib.IDTokenClaims]
	namespaceMapper     request.NamespaceMapper
	tracer              trace.Tracer
}

func (s *ExtendedJWT) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	ctx, span := s.tracer.Start(ctx, "authn.extjwt.Authenticate")
	defer span.End()

	jwtToken := s.retrieveAuthenticationToken(r.HTTPRequest)

	accessTokenClaims, err := authn.VerifyAccessTokenForRequest(ctx, jwtToken, r.HTTPRequest, s.accessTokenVerifier, s.accessTokenKeys)
	if err != nil {
		return nil, errExtJWTInvalid.Errorf("failed to verify access token: %w", err)
	}

	orgID := s.cfg.DefaultOrgID()
	if s.localKeys {
		orgID, err = s.localTokenOrgID(accessTokenClaims.Rest.Namespace, r.OrgID)
		if err != nil {
			return nil, err
		}
	}

	var identity *authn.Identity
	idToken := s.retrieveAuthorizationToken(r.HTTPRequest)
	if idToken != "" {
		idTokenClaims, verifyErr := s.idTokenVerifier.Verify(ctx, idToken)
		if verifyErr != nil {
			return nil, errExtJWTInvalid.Errorf("failed to verify id token: %w", verifyErr)
		}

		identity, err = s.authenticateAsUserViaIDToken(*idTokenClaims, *accessTokenClaims, jwtToken, orgID)
	} else if accessTokenClaims.Rest.IsOnBehalfOfUser() {
		identity, err = s.authenticateAsUserViaOBO(*accessTokenClaims, jwtToken, orgID)
	} else {
		identity, err = s.authenticateAsService(*accessTokenClaims, jwtToken, orgID)
	}
	if err == nil && s.localKeys {
		// User sync must use the signed tenant even when no org was supplied in the request.
		r.OrgID = orgID
	}
	return identity, err
}

// Local plugins serve all of this instance's organizations. Cloud tokens retain
// the configured stack boundary; only locally signed tokens use request orgs.
func (s *ExtendedJWT) localTokenOrgID(namespace string, requestedOrgID int64) (int64, error) {
	orgID := requestedOrgID
	if namespace != "*" {
		info, err := claims.ParseNamespace(namespace)
		if err != nil || info.OrgID < 1 || namespace != s.namespaceMapper(info.OrgID) {
			return 0, errExtJWTDisallowedNamespaceClaim.Errorf("unexpected access token namespace: %s", namespace)
		}
		if requestedOrgID > 0 && requestedOrgID != info.OrgID {
			return 0, errExtJWTDisallowedNamespaceClaim.Errorf("access token namespace does not match requested organization")
		}
		orgID = info.OrgID
	}
	if orgID <= 0 {
		orgID = s.cfg.DefaultOrgID()
	}
	if s.cfg.StackID != "" && orgID != s.cfg.DefaultOrgID() {
		return 0, errExtJWTDisallowedNamespaceClaim.Errorf("unexpected organization for configured stack")
	}
	return orgID, nil
}

func (s *ExtendedJWT) IsEnabled(context.Context) bool {
	return s.cfg.ExtJWTAuth.Enabled || s.localKeys
}

func (s *ExtendedJWT) authenticateAsUserViaIDToken(
	idTokenClaims authlib.Claims[authlib.IDTokenClaims],
	accessTokenClaims authlib.Claims[authlib.AccessTokenClaims],
	accessTokenInPlainText string,
	orgID int64,
) (*authn.Identity, error) {
	// Only allow id tokens signed for namespace configured for this instance.
	if allowedNamespace := s.namespaceMapper(orgID); !claims.NamespaceMatches(idTokenClaims.Rest.Namespace, allowedNamespace) {
		return nil, errExtJWTDisallowedNamespaceClaim.Errorf("unexpected id token namespace: %s", idTokenClaims.Rest.Namespace)
	}

	// Allow access tokens with either the same namespace as the validated id token namespace or wildcard (`*`).
	if !claims.NamespaceMatches(accessTokenClaims.Rest.Namespace, idTokenClaims.Rest.Namespace) {
		return nil, errExtJWTMisMatchedNamespaceClaims.Errorf("unexpected access token namespace: %s", accessTokenClaims.Rest.Namespace)
	}

	accessType, _, err := claims.ParseTypeID(accessTokenClaims.Subject)
	if err != nil {
		return nil, errExtJWTInvalidSubject.Errorf("unexpected identity: %s", accessTokenClaims.Subject)
	}

	// this check is common between authenticateAsUserViaIDToken and authenticateAsUserViaOBO
	// TypeAccessPolicy is the only current mechanism to authenticate as the user (whether through OBO token or separate ID token)
	if !claims.IsIdentityType(accessType, claims.TypeAccessPolicy) {
		return nil, errExtJWTInvalid.Errorf("unexpected identity: %s", accessTokenClaims.Subject)
	}

	t, id, err := claims.ParseTypeID(idTokenClaims.Subject)
	if err != nil {
		return nil, errExtJWTInvalid.Errorf("failed to parse id token subject: %w", err)
	}

	if !claims.IsIdentityType(t, claims.TypeUser, claims.TypeServiceAccount, claims.TypeRenderService, claims.TypeAnonymous) {
		return nil, errExtJWTInvalidSubject.Errorf("unexpected identity: %s", idTokenClaims.Subject)
	}

	fetchPermissionsParams := authn.FetchPermissionsParams{RestrictedActions: []string{}, K8sRestrictedActions: []string{}}
	for _, perm := range accessTokenClaims.Rest.DelegatedPermissions {
		if strings.Contains(perm, grafanaAppPrefix) {
			fetchPermissionsParams.K8sRestrictedActions = append(fetchPermissionsParams.K8sRestrictedActions, perm)
		} else {
			fetchPermissionsParams.RestrictedActions = append(fetchPermissionsParams.RestrictedActions, perm)
		}
	}

	identity := &authn.Identity{
		ID:                id,
		Type:              t,
		OrgID:             orgID,
		AccessToken:       accessTokenInPlainText,
		AccessTokenClaims: &accessTokenClaims,
		IDTokenClaims:     &idTokenClaims,
		AuthenticatedBy:   login.ExtendedJWTModule,
		AuthID:            accessTokenClaims.Subject,
		Namespace:         idTokenClaims.Rest.Namespace,
		ClientParams: authn.ClientParams{
			SyncPermissions:        true,
			FetchPermissionsParams: fetchPermissionsParams,
			FetchSyncedUser:        true,
		},
	}

	if t == claims.TypeAnonymous {
		identity.OrgRoles = map[int64]org.RoleType{
			orgID: org.RoleType(s.cfg.Anonymous.OrgRole),
		}
		identity.ClientParams.FetchSyncedUser = false
	}

	if t == claims.TypeRenderService {
		// RenderService always has Admin role (based on render.go logic)
		identity.OrgRoles = map[int64]org.RoleType{
			orgID: org.RoleAdmin,
		}
		identity.ClientParams.FetchSyncedUser = false
	}

	return identity, nil
}

func (s *ExtendedJWT) authenticateAsService(accessTokenClaims authlib.Claims[authlib.AccessTokenClaims], accessTokenInPlainText string, orgID int64) (*authn.Identity, error) {
	// Allow access tokens with that has a wildcard namespace or a namespace matching this instance.
	if allowedNamespace := s.namespaceMapper(orgID); !claims.NamespaceMatches(accessTokenClaims.Rest.Namespace, allowedNamespace) {
		return nil, errExtJWTDisallowedNamespaceClaim.Errorf("unexpected access token namespace: %s", accessTokenClaims.Rest.Namespace)
	}

	t, id, err := claims.ParseTypeID(accessTokenClaims.Subject)
	if err != nil {
		return nil, fmt.Errorf("failed to parse access token subject: %w", err)
	}

	if !claims.IsIdentityType(t, claims.TypeAccessPolicy) {
		return nil, errExtJWTInvalidSubject.Errorf("unexpected identity: %s", accessTokenClaims.Subject)
	}

	permissions := accessTokenClaims.Rest.Permissions
	fetchPermissionsParams := authn.FetchPermissionsParams{}
	if len(permissions) > 0 {
		fetchPermissionsParams.Roles = make([]string, 0, len(permissions))
		fetchPermissionsParams.AllowedActions = make([]string, 0, len(permissions))
		fetchPermissionsParams.K8s = make([]string, 0, len(permissions))

		for i := range permissions {
			if strings.HasPrefix(permissions[i], "fixed:") {
				fetchPermissionsParams.Roles = append(fetchPermissionsParams.Roles, permissions[i])
			} else if strings.Contains(permissions[i], grafanaAppPrefix) {
				// Check for pattern <resource>.grafana.app/<resource>:<action>
				fetchPermissionsParams.K8s = append(fetchPermissionsParams.K8s, permissions[i])
			} else {
				fetchPermissionsParams.AllowedActions = append(fetchPermissionsParams.AllowedActions, permissions[i])
			}
		}
	}

	return &authn.Identity{
		ID:                id,
		UID:               id,
		Name:              id,
		Type:              t,
		OrgID:             orgID,
		AccessToken:       accessTokenInPlainText,
		AccessTokenClaims: &accessTokenClaims,
		AuthenticatedBy:   login.ExtendedJWTModule,
		AuthID:            accessTokenClaims.Subject,
		Namespace:         accessTokenClaims.Rest.Namespace,
		ClientParams: authn.ClientParams{
			SyncPermissions:        true,
			FetchPermissionsParams: fetchPermissionsParams,
			FetchSyncedUser:        false,
		},
	}, nil
}

// authenticateAsUserViaOBO handles access tokens that carry an Actor (on-behalf-of)
// without a separate ID token. The effective identity is always the innermost actor
// in the chain, which is guaranteed to be a User or ServiceAccount by
// IsOnBehalfOfUser (authlib). DelegatedPermissions restrict the user's permissions
// the same way as when an explicit ID token is present.
func (s *ExtendedJWT) authenticateAsUserViaOBO(
	accessTokenClaims authlib.Claims[authlib.AccessTokenClaims],
	accessTokenInPlainText string,
	orgID int64,
) (*authn.Identity, error) {
	if allowedNamespace := s.namespaceMapper(orgID); !claims.NamespaceMatches(accessTokenClaims.Rest.Namespace, allowedNamespace) {
		return nil, errExtJWTDisallowedNamespaceClaim.Errorf("unexpected access token namespace: %s", accessTokenClaims.Rest.Namespace)
	}

	accessType, _, err := claims.ParseTypeID(accessTokenClaims.Subject)
	if err != nil {
		return nil, errExtJWTInvalidSubject.Errorf("unexpected identity: %s", accessTokenClaims.Subject)
	}
	// this check is common between authenticateAsUserViaIDToken and authenticateAsUserViaOBO
	// TypeAccessPolicy is the only current mechanism to authenticate as the user (whether through OBO token or separate ID token)
	if !claims.IsIdentityType(accessType, claims.TypeAccessPolicy) {
		return nil, errExtJWTInvalid.Errorf("unexpected identity: %s", accessTokenClaims.Subject)
	}

	// NewAccessTokenAuthInfo traverses the full actor chain to find the innermost
	// identity actor — correctly handles multi-hop OBO.
	authInfo := authlib.NewAccessTokenAuthInfo(accessTokenClaims)
	subject := authInfo.GetSubject()
	if subject == "" {
		return nil, errExtJWTInvalid.Errorf("access token has no actor subject")
	}

	t, id, err := claims.ParseTypeID(subject)
	if err != nil {
		return nil, errExtJWTInvalid.Errorf("failed to parse actor subject: %w", err)
	}
	if !claims.IsIdentityType(t, claims.TypeUser, claims.TypeServiceAccount, claims.TypeRenderService, claims.TypeAnonymous) {
		return nil, errExtJWTInvalidSubject.Errorf("unexpected actor identity: %s", subject)
	}

	fetchPermissionsParams := authn.FetchPermissionsParams{RestrictedActions: []string{}, K8sRestrictedActions: []string{}}
	for _, perm := range accessTokenClaims.Rest.DelegatedPermissions {
		if strings.Contains(perm, grafanaAppPrefix) {
			fetchPermissionsParams.K8sRestrictedActions = append(fetchPermissionsParams.K8sRestrictedActions, perm)
		} else {
			fetchPermissionsParams.RestrictedActions = append(fetchPermissionsParams.RestrictedActions, perm)
		}
	}

	identity := &authn.Identity{
		ID:                id,
		UID:               authInfo.GetIdentifier(),
		Type:              t,
		OrgID:             orgID,
		AccessToken:       accessTokenInPlainText,
		AccessTokenClaims: &accessTokenClaims,
		AuthenticatedBy:   login.ExtendedJWTModule,
		AuthID:            accessTokenClaims.Subject,
		Namespace:         accessTokenClaims.Rest.Namespace,
		ClientParams: authn.ClientParams{
			SyncPermissions:        true,
			FetchPermissionsParams: fetchPermissionsParams,
			FetchSyncedUser:        true,
		},
	}

	if t == claims.TypeAnonymous {
		identity.OrgRoles = map[int64]org.RoleType{
			orgID: org.RoleType(s.cfg.Anonymous.OrgRole),
		}
		identity.ClientParams.FetchSyncedUser = false
	}

	if t == claims.TypeRenderService {
		identity.OrgRoles = map[int64]org.RoleType{
			orgID: org.RoleAdmin,
		}
		identity.ClientParams.FetchSyncedUser = false
	}

	return identity, nil
}

func (s *ExtendedJWT) Test(ctx context.Context, r *authn.Request) bool {
	if !s.IsEnabled(ctx) {
		return false
	}

	rawToken := s.retrieveAuthenticationToken(r.HTTPRequest)
	if rawToken == "" {
		return false
	}

	parsedToken, err := jwt.ParseSigned(rawToken, []jose.SignatureAlgorithm{jose.ES256})
	if err != nil {
		return false
	}

	// With only the local key trusted, other tokens can never verify, so leave
	// them to other clients rather than fail them here.
	if s.localKeys && !s.cfg.ExtJWTAuth.Enabled &&
		(len(parsedToken.Headers) == 0 || parsedToken.Headers[0].KeyID != v3.LocalKeyID) {
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

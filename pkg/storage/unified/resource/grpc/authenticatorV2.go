package grpc

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-jose/go-jose/v3"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	authnlib "github.com/grafana/authlib/authn"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/setting"
)

const GRPCJWTModule = "grpcjwt"

var (
	ErrorMissingIDToken     = status.Error(codes.Unauthenticated, "unauthenticated: missing id token")
	ErrorMissingAccessToken = status.Error(codes.Unauthenticated, "unauthenticated: missing access token")
	ErrorInvalidIDToken     = status.Error(codes.PermissionDenied, "unauthorized: invalid id token")
	ErrorInvalidAccessToken = status.Error(codes.PermissionDenied, "unauthorized: invalid access token")
)

type AuthenticatorV2 struct {
	atVerifier      authnlib.Verifier[authnlib.AccessTokenClaims]
	authCfg         *authCfg
	cfg             *setting.Cfg
	idVerifier      authnlib.Verifier[authnlib.IDTokenClaims]
	logger          log.Logger
	namespaceMapper func(orgID int64) string
}

// keyServiceWrapper wraps a signingkeys.Service to implement the authnlib.KeyRetriever interface.
type keyServiceWrapper struct {
	signingkeys.Service
}

func (k *keyServiceWrapper) Get(ctx context.Context, keyID string) (*jose.JSONWebKey, error) {
	keys, err := k.Service.GetJWKS(ctx)
	if err != nil {
		return nil, err
	}

	for _, key := range keys.Keys {
		if key.KeyID == keyID {
			return &key, nil
		}
	}

	return nil, fmt.Errorf("key not found")
}

func ProvideAuthenticatorV2(cfg *setting.Cfg, audience string) (*AuthenticatorV2, error) {
	authCfg, err := readAuthConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to read auth config: %w", err)
	}
	authCfg.mode = remoteMode
	if authCfg.signingKeysURL == "" {
		return nil, fmt.Errorf("missing grpc_authentication.signing_keys_url in configuration file")
	}
	authCfg.allowedAudiences = []string{audience}
	return provideAuthenticatorV2(cfg, authCfg, nil)
}

func ProvideInProcessAuthenticatorV2(cfg *setting.Cfg, keysService signingkeys.Service) (*AuthenticatorV2, error) {
	// TODO: if the authCtx is already in, let's not verify the id token again.

	authCfg, err := readAuthConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to read auth config: %w", err)
	}
	authCfg.mode = inProcessMode
	// In-process mode does not require an audience
	authCfg.allowedAudiences = []string{}
	return provideAuthenticatorV2(cfg, authCfg, keysService)
}

func provideAuthenticatorV2(cfg *setting.Cfg, authCfg *authCfg, keysService signingkeys.Service) (*AuthenticatorV2, error) {
	// Create a key retriever based on the authentication mode
	var retriever authnlib.KeyRetriever
	if authCfg.mode == inProcessMode {
		// In-process mode no need to fetch keys from a remote server
		retriever = &keyServiceWrapper{Service: keysService}
	} else {
		// Remote mode
		retrieverClient := http.DefaultClient
		if cfg.Env == setting.Dev {
			// Allow insecure skip verify in dev mode
			retrieverClient = &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}
		}
		retriever = authnlib.NewKeyRetriever(authnlib.KeyRetrieverConfig{
			SigningKeysURL: authCfg.signingKeysURL,
		}, authnlib.WithHTTPClientKeyRetrieverOpt(retrieverClient))
	}

	// Create a idVerifier
	idVerifier := authnlib.NewIDTokenVerifier(authnlib.VerifierConfig{}, retriever)

	atVerifier := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{
		AllowedAudiences: authCfg.allowedAudiences,
	}, retriever)

	return &AuthenticatorV2{
		atVerifier:      atVerifier,
		authCfg:         authCfg,
		cfg:             cfg,
		idVerifier:      idVerifier,
		logger:          log.New("grpc-authenticator"),
		namespaceMapper: request.GetNamespaceMapper(cfg),
	}, nil
}

func (f *AuthenticatorV2) Authenticate(ctx context.Context) (context.Context, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ctx, fmt.Errorf("no metadata found")
	}

	// TODO (gamab) add orgID to claims ?
	grfOrgID, ok := getFirstMetadataValue(md, mdOrgID)
	if !ok {
		// TODO (gamab) maybe use default org id?
		return ctx, fmt.Errorf("no org id found")
	}
	orgID, err := strconv.ParseInt(grfOrgID, 10, 64)
	if err != nil {
		return ctx, fmt.Errorf("invalid org id: %w", err)
	}

	// In-process mode does not require an access token check
	if f.authCfg.mode == inProcessMode {
		return f.inProcAuthentication(ctx, orgID, md)
	}
	// FIXME: Once we have access-token support on-prem, we can remove this
	if f.cfg.Env == setting.Dev {
		f.logger.FromContext(ctx).Info("skipping access token verification in dev mode")
		return f.inProcAuthentication(ctx, orgID, md)
	}

	return f.remoteAuthentication(ctx, orgID, md)
}

// inProcAuthentication authenticates the user based on the id token in the metadata.
// it assumes that there is no access token
func (f *AuthenticatorV2) inProcAuthentication(ctx context.Context, orgID int64, md metadata.MD) (context.Context, error) {
	ctxLogger := f.logger.FromContext(ctx)
	ctxLogger.Debug("in-process authentication")

	idToken, ok := getFirstMetadataValue(md, mdToken)
	if !ok {
		ctxLogger.Error("missing id token")
		return ctx, ErrorMissingIDToken
	}

	idClaims, err := f.idVerifier.Verify(ctx, idToken)
	if err != nil {
		ctxLogger.Error("failed to verify id token", "error", err)
		return ctx, ErrorInvalidIDToken
	}

	usr, err := f.authenticateUser(orgID, idClaims)
	if err != nil {
		ctxLogger.Error("failed to authenticate user", "error", err)
		return ctx, fmt.Errorf("failed to authenticate user: %w", err)
	}

	ctxLogger.Info("user authenticated", "subject", idClaims.Subject, "org_id", orgID)
	ctx = appcontext.WithUser(ctx, usr.SignedInUser()) // TODO: I don't think it's necessary to have a requester since we have the claims
	return identity.WithAuthCtx(ctx, &identity.AuthCtx{OrgID: orgID, IDClaims: idClaims}), nil
}

func (f *AuthenticatorV2) remoteAuthentication(ctx context.Context, orgID int64, md metadata.MD) (context.Context, error) {
	ctxLogger := f.logger.FromContext(ctx)
	ctxLogger.Debug("remote authentication")

	accessToken, ok := getFirstMetadataValue(md, mdAccessToken)
	if !ok {
		ctxLogger.Error("missing access token")
		return ctx, ErrorMissingAccessToken
	}

	atClaims, err := f.atVerifier.Verify(ctx, accessToken)
	if err != nil {
		ctxLogger.Error("failed to verify access token", "error", err)
		return ctx, ErrorInvalidAccessToken
	}

	idToken, ok := getFirstMetadataValue(md, mdToken)
	if !ok {
		// Service authentication
		usr, err := f.authenticateService(orgID, atClaims)
		if err != nil {
			ctxLogger.Error("failed to authenticate service", "error", err)
			return ctx, fmt.Errorf("failed to authenticate service: %w", err)
		}

		ctxLogger.Info("service authenticated", "service", atClaims.Subject, "org_id", orgID)
		ctx = appcontext.WithUser(ctx, usr.SignedInUser()) // TODO: I don't think it's necessary to have a requester since we have the claims
		return identity.WithAuthCtx(ctx, &identity.AuthCtx{OrgID: orgID, AccessClaims: atClaims}), nil
	}

	// Validate ID token
	idClaims, err := f.idVerifier.Verify(ctx, idToken)
	if err != nil {
		ctxLogger.Error("failed to verify id token", "error", err)
		return ctx, ErrorInvalidIDToken
	}

	// User authentication
	usr, err := f.authenticateImpersonatedUser(orgID, idClaims, atClaims)
	if err != nil {
		ctxLogger.Error("failed to authenticate user", "error", err)
		return ctx, fmt.Errorf("failed to authenticate user: %w", err)
	}

	ctxLogger.Info("impersonated user authenticated", "service", atClaims.Subject, "subject", idClaims.Subject, "org_id", orgID)
	ctx = appcontext.WithUser(ctx, usr.SignedInUser()) // TODO: I don't think it's necessary to have a requester since we have the claims
	return identity.WithAuthCtx(ctx, &identity.AuthCtx{OrgID: orgID, AccessClaims: atClaims, IDClaims: idClaims}), nil
}

func (f *AuthenticatorV2) authenticateUser(orgID int64, idClaims *authnlib.Claims[authnlib.IDTokenClaims]) (*authn.Identity, error) {
	// Only allow id tokens signed for namespace configured for this instance.
	if allowedNamespace := f.namespaceMapper(orgID); idClaims.Rest.Namespace != allowedNamespace {
		return nil, fmt.Errorf("unexpected id token namespace: %s", idClaims.Rest.Namespace)
	}

	userID, err := authn.ParseNamespaceID(idClaims.Subject)
	if err != nil {
		return nil, fmt.Errorf("failed to parse id token subject: %w", err)
	}

	if !userID.IsNamespace(authn.NamespaceUser) && !userID.IsNamespace(authn.NamespaceServiceAccount) {
		return nil, fmt.Errorf("unexpected identity: %s", userID.String())
	}

	return &authn.Identity{
		ID:              userID,
		OrgID:           orgID,
		AuthenticatedBy: GRPCJWTModule,
		AuthID:          userID.String(), // TODO (gamab) what should this be?
		ClientParams:    authn.ClientParams{}}, nil
}

func (f *AuthenticatorV2) authenticateImpersonatedUser(
	orgID int64,
	idClaims *authnlib.Claims[authnlib.IDTokenClaims],
	atClaims *authnlib.Claims[authnlib.AccessTokenClaims],
) (*authn.Identity, error) {
	// Only allow id tokens signed for namespace configured for this instance.
	if allowedNamespace := f.namespaceMapper(orgID); idClaims.Rest.Namespace != allowedNamespace {
		return nil, fmt.Errorf("unexpected id token namespace: %s", idClaims.Rest.Namespace)
	}

	// Allow access tokens with either the same namespace as the validated id token namespace or wildcard (`*`).
	if !atClaims.Rest.NamespaceMatches(idClaims.Rest.Namespace) {
		return nil, fmt.Errorf("unexpected access token namespace: %s", atClaims.Rest.Namespace)
	}

	accessID, err := authn.ParseNamespaceID(atClaims.Subject)
	if err != nil {
		return nil, fmt.Errorf("unexpected identity: %s", accessID.String())
	}

	if !accessID.IsNamespace(authn.NamespaceAccessPolicy) {
		return nil, fmt.Errorf("unexpected identity: %s", accessID.String())
	}

	userID, err := authn.ParseNamespaceID(idClaims.Subject)
	if err != nil {
		return nil, fmt.Errorf("failed to parse id token subject: %w", err)
	}

	if !userID.IsNamespace(authn.NamespaceUser) && !userID.IsNamespace(authn.NamespaceServiceAccount) {
		return nil, fmt.Errorf("unexpected identity: %s", userID.String())
	}

	return &authn.Identity{
		ID:              userID,
		OrgID:           orgID,
		AuthenticatedBy: GRPCJWTModule,
		AuthID:          accessID.String(),
		ClientParams: authn.ClientParams{
			SyncPermissions: true,
			FetchPermissionsParams: authn.FetchPermissionsParams{
				ActionsLookup: atClaims.Rest.DelegatedPermissions,
			},
			FetchSyncedUser: true,
		}}, nil
}

func (a *AuthenticatorV2) authenticateService(orgID int64, claims *authnlib.Claims[authnlib.AccessTokenClaims]) (*authn.Identity, error) {
	// Allow access tokens with that has a wildcard namespace or a namespace matching this instance.
	if allowedNamespace := a.namespaceMapper(orgID); !claims.Rest.NamespaceMatches(allowedNamespace) {
		return nil, fmt.Errorf("unexpected access token namespace: %s", claims.Rest.Namespace)
	}

	id, err := authn.ParseNamespaceID(claims.Subject)
	if err != nil {
		return nil, fmt.Errorf("failed to parse access token subject: %w", err)
	}

	if !id.IsNamespace(authn.NamespaceAccessPolicy) {
		return nil, fmt.Errorf("unexpected identity: %s", id.String())
	}

	return &authn.Identity{
		ID:              id,
		UID:             id,
		OrgID:           orgID,
		AuthenticatedBy: GRPCJWTModule,
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

func getFirstMetadataValue(md metadata.MD, key string) (string, bool) {
	values := md.Get(key)
	if len(values) == 0 {
		return "", false
	}
	if len(values[0]) == 0 {
		return "", false
	}

	return values[0], true
}

var _ interceptors.Authenticator = (*AuthenticatorV2)(nil)

func UnaryClientInterceptorV2(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
	ctx, err := wrapContextV2(ctx)
	if err != nil {
		return err
	}
	return invoker(ctx, method, req, reply, cc, opts...)
}

var _ grpc.UnaryClientInterceptor = UnaryClientInterceptorV2

func StreamClientInterceptorV2(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	ctx, err := wrapContextV2(ctx)
	if err != nil {
		return nil, err
	}
	return streamer(ctx, desc, cc, method, opts...)
}

var _ grpc.StreamClientInterceptor = StreamClientInterceptorV2

func wrapContextV2(ctx context.Context) (context.Context, error) {
	md := metadata.Pairs()

	// Use auth context if available
	if authCtx, err := identity.GetAuthCtx(ctx); err == nil {
		if authCtx.IDClaims != nil {
			md.Append(mdToken, authCtx.IDToken)
		}
		if authCtx.AccessClaims != nil {
			md.Append(mdAccessToken, authCtx.AccessToken)
		}
		md.Append(mdOrgID, strconv.FormatInt(authCtx.OrgID, 10))

		return metadata.NewOutgoingContext(ctx, md), nil
	}

	// Fallback to user
	if user, err := identity.GetRequester(ctx); err == nil {
		// set grpc metadata into the context to pass to the grpc server
		return metadata.NewOutgoingContext(ctx, metadata.Pairs(
			mdToken, user.GetIDToken(),
			mdOrgID, strconv.FormatInt(user.GetOrgID(), 10),
			// "grafana-userid", strconv.FormatInt(user.UserID, 10),
			// "grafana-login", user.Login,
		)), nil
	}

	// No auth context or user found
	return ctx, fmt.Errorf("no auth context or user found")
}

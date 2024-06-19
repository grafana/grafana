package grpc

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-jose/go-jose/v3"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	authnlib "github.com/grafana/authlib/authn"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/setting"
)

type Authenticator struct {
	atVerifier authnlib.Verifier[authnlib.AccessTokenClaims]
	cfg        *authCfg
	idVerifier authnlib.Verifier[authnlib.IDTokenClaims]
	logger     log.Logger
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

func ProvideAuthenticator(cfg *setting.Cfg) (*Authenticator, error) {
	return provideAuthenticator(cfg, nil)
}

func ProvideInProcessAuthenticator(cfg *setting.Cfg, keysService signingkeys.Service) (*Authenticator, error) {
	return provideAuthenticator(cfg, keysService)
}

func provideAuthenticator(cfg *setting.Cfg, keysService signingkeys.Service) (*Authenticator, error) {
	authCfg, err := readAuthConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to read auth config: %w", err)
	}

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
	idVerifier := authnlib.NewIDTokenVerifier(authnlib.VerifierConfig{
		AllowedAudiences: authCfg.allowedAudiences,
	}, retriever)

	atVerifier := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{
		AllowedAudiences: authCfg.allowedAudiences,
	}, retriever)

	return &Authenticator{
		atVerifier: atVerifier,
		cfg:        authCfg,
		idVerifier: idVerifier,
		logger:     log.New("grpc-authenticator"),
	}, nil
}

func (f *Authenticator) Authenticate(ctx context.Context) (context.Context, error) {
	ctxLogger := f.logger.FromContext(ctx)

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, fmt.Errorf("no metadata found")
	}
	// In proc mode:
	//     Service Auth: no access token => user with all permissions?
	//     User Request: id token => user from token
	// If remote mode:
	//     Service Auth: access token => user from token
	//     User Request: access token + id token => user impersonation

	// Problem I foresee:
	//     inproc mode: is creating an admin user sufficient?
	//     remote mode: service auth needs the access control service to get the permissions
	//     remote mode: user request needs to downscope the user permissions
	// Maybe this is not actually something I have to do here, given the authorization service is the one actually interested in the user's permissions
	// Do I need to pass in the calling service token to the authorization server for it to restrict the permissions as it should?

	// Check if I can reuse authn ExtendedJWT Authenticate method

	// TODO remote mode

	// TODO (gamab) add orgID to claims ?
	orgID, err := strconv.ParseInt(md.Get("grafana-orgid")[0], 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid org id: %w", err)
	}

	// Extract tokens
	idToken := md.Get("x-grafana-id")[0]
	accessToken := md.Get("x-access-token")[0]

	atClaims, err := f.atVerifier.Verify(ctx, accessToken)
	if err != nil {
		return nil, fmt.Errorf("failed to verify access token: %w", err)
	}

	if idToken == "" {
		// Service authentication
		usr, err := f.authenticateService(orgID, atClaims)
		if err != nil {
			ctxLogger.Error("failed to authenticate service", "error", err)
			return nil, fmt.Errorf("failed to authenticate service: %w", err)
		}

		return identity.WithRequester(ctx, usr), nil
	}

	// Validate ID token
	idClaims, err := f.idVerifier.Verify(ctx, idToken)
	if err != nil {
		return nil, fmt.Errorf("failed to verify id token: %w", err)
	}

	// User authentication
	usr, err := f.authenticateUser(orgID, idClaims, atClaims)
	if err != nil {
		ctxLogger.Error("failed to authenticate user", "error", err)
		return nil, fmt.Errorf("failed to authenticate user: %w", err)
	}

	return identity.WithRequester(ctx, usr), nil
}

func (f *Authenticator) authenticateUser(orgID int64, idClaims *authnlib.Claims[authnlib.IDTokenClaims],
	atClaims *authnlib.Claims[authnlib.AccessTokenClaims],
) (*authn.Identity, error) {
	// TODO (gamab) namespace validation
	// // Only allow id tokens signed for namespace configured for this instance.
	// if allowedNamespace := a.namespaceMapper(a.getDefaultOrgID()); idTokenClaims.Rest.Namespace != allowedNamespace {
	// 	return nil, errExtJWTDisallowedNamespaceClaim.Errorf("unexpected id token namespace: %s", idTokenClaims.Rest.Namespace)
	// }
	//
	// // Allow access tokens with either the same namespace as the validated id token namespace or wildcard (`*`).
	// if !accessTokenClaims.Rest.NamespaceMatches(idTokenClaims.Rest.Namespace) {
	// 	return nil, errExtJWTMisMatchedNamespaceClaims.Errorf("unexpected access token namespace: %s", accessTokenClaims.Rest.Namespace)
	// }

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

	if !userID.IsNamespace(authn.NamespaceUser) {
		return nil, fmt.Errorf("unexpected identity: %s", userID.String())
	}

	return &authn.Identity{
		ID:              userID,
		OrgID:           orgID,
		AuthenticatedBy: login.ExtendedJWTModule,
		AuthID:          accessID.String(),
		ClientParams: authn.ClientParams{
			SyncPermissions: true,
			FetchPermissionsParams: authn.FetchPermissionsParams{
				ActionsLookup: atClaims.Rest.DelegatedPermissions,
			},
			FetchSyncedUser: true,
		}}, nil
}

func (a *Authenticator) authenticateService(orgID int64, claims *authnlib.Claims[authnlib.AccessTokenClaims]) (*authn.Identity, error) {
	// // Allow access tokens with that has a wildcard namespace or a namespace matching this instance.
	// if allowedNamespace := a.namespaceMapper(s.getDefaultOrgID()); !claims.Rest.NamespaceMatches(allowedNamespace) {
	// 	return nil, errExtJWTDisallowedNamespaceClaim.Errorf("unexpected access token namespace: %s", claims.Rest.Namespace)
	// }

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

var _ interceptors.Authenticator = (*Authenticator)(nil)

func UnaryClientInterceptor(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
	ctx, err := WrapContext(ctx)
	if err != nil {
		return err
	}
	return invoker(ctx, method, req, reply, cc, opts...)
}

var _ grpc.UnaryClientInterceptor = UnaryClientInterceptor

func StreamClientInterceptor(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	ctx, err := WrapContext(ctx)
	if err != nil {
		return nil, err
	}
	return streamer(ctx, desc, cc, method, opts...)
}

var _ grpc.StreamClientInterceptor = StreamClientInterceptor

func WrapContext(ctx context.Context) (context.Context, error) {
	user, err := appcontext.User(ctx)
	if err != nil {
		return ctx, err
	}

	// set grpc metadata into the context to pass to the grpc server
	return metadata.NewOutgoingContext(ctx, metadata.Pairs(
		"grafana-idtoken", user.IDToken,
		"grafana-userid", strconv.FormatInt(user.UserID, 10),
		"grafana-orgid", strconv.FormatInt(user.OrgID, 10),
		"grafana-login", user.Login,
		// "grafana-namespace", // TODO (gamab)
	)), nil
}

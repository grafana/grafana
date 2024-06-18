package interceptors

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-jose/go-jose/v3"
	"google.golang.org/grpc/metadata"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// TODO rework authentication
// There are currently two authenticators in the codebase:
// - pkg/services/grpcserver/interceptors/auth.go
// - pkg/services/store/entity/authz/interceptors.go.
// Difference is that one can access the user and the other has to rely on the JWTs

type mode string

var (
	inProcessMode mode = "inproc"
	remoteMode    mode = "remote"
)

func (m mode) isValid() bool {
	switch m {
	case inProcessMode, remoteMode:
		return true
	}
	return false
}

type authCfg struct {
	// mode is the authentication mode.
	// inproc: authentication is done in-process => no need to go fetch keys from a remote server.
	// remote: authentication relies on a remote server
	mode mode

	// signingKeysURL is the URL to fetch the signing keys from.
	// This is only used in remote mode.
	// Ex: https://localhost:3000/api/signing-keys/keys
	signingKeysURL string

	// allowedAudiences is the list of allowed audiences.
	allowedAudiences []string
}

func readAuthConfig(cfg *setting.Cfg) (*authCfg, error) {
	section := cfg.SectionWithEnvOverrides("grpc_auth")

	mode := mode(section.Key("mode").MustString(string(inProcessMode)))
	if !mode.isValid() {
		return nil, fmt.Errorf("invalid mode: %s", mode)
	}

	return &authCfg{
		mode:             mode,
		signingKeysURL:   section.Key("signing_keys_url").MustString(""),
		allowedAudiences: util.SplitString(section.Key("allowed_audiences").MustString("")),
	}, nil
}

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

var _ authnlib.KeyRetriever = (*keyServiceWrapper)(nil)

// authenticator can authenticate GRPC requests.
type jwtAuthenticator struct {
	atVerifier authnlib.Verifier[authnlib.AccessTokenClaims]
	cfg        *authCfg
	idVerifier authnlib.Verifier[authnlib.IDTokenClaims]
	logger     log.Logger
}

func ProvideAuthenticatorV2(cfg *setting.Cfg, keysService signingkeys.Service) (Authenticator, error) {
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

	return &jwtAuthenticator{
		atVerifier: atVerifier,
		cfg:        authCfg,
		idVerifier: idVerifier,
		logger:     log.New("grpc-authenticator"),
	}, nil
}

// Authenticate checks that a token exists and is valid, and then removes the token from the
// authorization header in the context.
func (a *jwtAuthenticator) Authenticate(ctx context.Context) (context.Context, error) {
	ctxLogger := a.logger.FromContext(ctx)

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

	// Validate access token when in remote mode
	if a.cfg.mode == remoteMode {
		accessToken := md.Get("x-access-token")[0]
		if accessToken == "" {
			return nil, fmt.Errorf("no access token found in context")
		}

		atClaims, err := a.atVerifier.Verify(ctx, accessToken)
		if err != nil {
			ctxLogger.Error("failed to verify access token", "err", err)
			return nil, fmt.Errorf("failed to verify access token: %w", err)
		}
	}

	// Validate ID token
	idToken := md.Get("x-grafana-id")[0]
	if idToken == "" {
		return nil, fmt.Errorf("no id token found in context")
	}

	claims, err := a.idVerifier.Verify(ctx, idToken)
	if err != nil {
		return nil, fmt.Errorf("failed to verify id token: %w", err)
	}

	id := authn.MustParseNamespaceID(claims.Subject)

	if !id.IsNamespace(authn.NamespaceUser, authn.NamespaceServiceAccount) {
		return nil, fmt.Errorf("invalid identity namespace: %s", id.Namespace().String())
	}

	userID, err := id.UserID()
	if err != nil {
		return nil, fmt.Errorf("invalid user id: %w", err)
	}

	// TODO add orgID to claims ?
	orgID, err := strconv.ParseInt(md.Get("grafana-orgid")[0], 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid org id: %w", err)
	}

	return appcontext.WithUser(ctx, &user.SignedInUser{
		NamespacedID: id,
		Login:        claims.Rest.Email,
		UserID:       userID,
		OrgID:        orgID,
	}), nil
}

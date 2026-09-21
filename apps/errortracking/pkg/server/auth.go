package server

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"
	authzlib "github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/user"
)

type requestAuthenticator struct {
	authenticator authnlib.Authenticator
	issuer        string
}

func newRequestAuthenticator(config Config) authenticator.Request {
	keys := authnlib.NewKeyRetriever(authnlib.KeyRetrieverConfig{SigningKeysURL: config.Auth.SigningKeysURL})
	return &requestAuthenticator{
		authenticator: authnlib.NewDefaultAuthenticator(
			authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{Audience}}, keys),
			authnlib.NewIDTokenVerifier(authnlib.VerifierConfig{}, keys),
		),
		issuer: config.Auth.Issuer,
	}
}

func (a *requestAuthenticator) AuthenticateRequest(request *http.Request) (*authenticator.Response, bool, error) {
	if isPublicPath(request.URL.Path) {
		return &authenticator.Response{User: &user.DefaultInfo{Name: user.Anonymous}}, true, nil
	}
	provider := authnlib.NewHTTPTokenProvider(request)
	info, err := a.authenticator.Authenticate(request.Context(), provider)
	if err != nil {
		return nil, false, err
	}
	accessToken, _ := provider.AccessToken(request.Context())
	if err := validateRegisteredClaims(accessToken, a.issuer, Audience); err != nil {
		return nil, false, err
	}
	if idToken, ok := provider.IDToken(request.Context()); ok {
		if err := validateRegisteredClaims(idToken, a.issuer, ""); err != nil {
			return nil, false, err
		}
	}
	if _, err := authlib.ParseNamespace(info.GetNamespace()); err != nil {
		return nil, false, fmt.Errorf("parse authenticated namespace: %w", err)
	}
	return &authenticator.Response{User: info}, true, nil
}

func validateRegisteredClaims(token, issuer, audience string) error {
	parsed, err := authnlib.Parse(token)
	if err != nil {
		return fmt.Errorf("parse signed token: %w", err)
	}
	var claims jwt.Claims
	if err := parsed.UnsafeClaimsWithoutVerification(&claims); err != nil {
		return fmt.Errorf("read verified token claims: %w", err)
	}
	if claims.Expiry == nil {
		return errors.New("signed token is missing expiry")
	}
	expected := jwt.Expected{Issuer: issuer, Time: time.Now()}
	if audience != "" {
		expected.AnyAudience = jwt.Audience{audience}
	}
	if err := claims.Validate(expected); err != nil {
		return fmt.Errorf("validate signed token claims: %w", err)
	}
	return nil
}

func newAuthzClient(config Config) (authlib.AccessClient, *grpc.ClientConn, error) {
	// The operator supplies this mounted Secret path in the server config.
	token, err := os.ReadFile(config.Auth.TokenExchangeTokenFile) //nolint:gosec
	if err != nil {
		return nil, nil, fmt.Errorf("read token exchange token: %w", err)
	}
	tokenValue := strings.TrimSpace(string(token))
	if tokenValue == "" {
		return nil, nil, fmt.Errorf("token exchange token file is empty")
	}
	exchanger, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		Token: tokenValue, TokenExchangeURL: config.Auth.TokenExchangeURL,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("create token exchange client: %w", err)
	}
	transport, err := credentials.NewClientTLSFromFile(config.Auth.AuthzCAFile, "")
	if err != nil {
		return nil, nil, fmt.Errorf("load AuthZ CA: %w", err)
	}
	connection, err := grpc.NewClient(config.Auth.AuthzAddress,
		grpc.WithTransportCredentials(transport),
		grpc.WithPerRPCCredentials(&tokenAuth{tokenClient: exchanger}),
	)
	if err != nil {
		return nil, nil, fmt.Errorf("create AuthZ connection: %w", err)
	}
	return authzlib.NewClient(connection), connection, nil
}

type tokenAuth struct{ tokenClient authnlib.TokenExchanger }

func (t *tokenAuth) GetRequestMetadata(ctx context.Context, _ ...string) (map[string]string, error) {
	token, err := t.tokenClient.Exchange(ctx, authnlib.TokenExchangeRequest{
		Namespace: "*", Audiences: []string{"authzService"},
	})
	if err != nil {
		return nil, err
	}
	return map[string]string{"X-Access-Token": token.Token}, nil
}

func (*tokenAuth) RequireTransportSecurity() bool { return true }

func isPublicPath(path string) bool {
	switch path {
	case "/healthz", "/readyz", "/livez", "/metrics", "/version", "/api", "/apis",
		"/apis/error-tracking.grafana.app", "/apis/error-tracking.grafana.app/v0alpha1",
		"/openapi/v2", "/openapi/v3":
		return true
	}
	return strings.HasPrefix(path, "/openapi/v3/")
}

package server

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
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

func isPublicPath(path string) bool {
	switch path {
	case "/healthz", "/readyz", "/livez", "/metrics", "/version", "/api", "/apis",
		"/apis/error-tracking.grafana.app", "/apis/error-tracking.grafana.app/v0alpha1",
		"/openapi/v2", "/openapi/v3":
		return true
	}
	return strings.HasPrefix(path, "/openapi/v3/")
}

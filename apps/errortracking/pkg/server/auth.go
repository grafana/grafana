package server

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"slices"
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

	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
	requester, err := newRequester(info)
	if err != nil {
		return nil, false, err
	}
	return &authenticator.Response{User: requester}, true, nil
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

type requester struct {
	authlib.AuthInfo
	orgID int64
}

func newRequester(info authlib.AuthInfo) (*requester, error) {
	namespace, err := authlib.ParseNamespace(info.GetNamespace())
	if err != nil {
		return nil, fmt.Errorf("parse authenticated namespace: %w", err)
	}
	return &requester{AuthInfo: info, orgID: namespace.OrgID}, nil
}

func (r *requester) IsIdentityType(expected ...authlib.IdentityType) bool {
	return authlib.IsIdentityType(r.GetIdentityType(), expected...)
}
func (r *requester) GetRawIdentifier() string                  { return r.GetIdentifier() }
func (r *requester) GetID() string                             { return r.GetSubject() }
func (r *requester) GetInternalID() (int64, error)             { return identity.IntIdentifier(r.GetSubject()) }
func (r *requester) GetIsGrafanaAdmin() bool                   { return false }
func (r *requester) GetLogin() string                          { return r.GetUsername() }
func (r *requester) GetOrgID() int64                           { return r.orgID }
func (r *requester) GetOrgRole() identity.RoleType             { return identity.RoleNone }
func (r *requester) GetPermissions() map[string][]string       { return map[string][]string{} }
func (r *requester) GetGlobalPermissions() map[string][]string { return map[string][]string{} }
func (r *requester) GetTeams() []int64                         { return nil }
func (r *requester) GetExternalGroups() []string               { return nil }
func (r *requester) GetOrgName() string                        { return "" }
func (r *requester) GetAuthID() string                         { return "" }
func (r *requester) HasRole(identity.RoleType) bool            { return false }
func (r *requester) GetCacheKey() string                       { return r.GetNamespace() + ":" + r.GetUID() }
func (r *requester) HasUniqueId() bool                         { return r.GetIdentifier() != "" }
func (r *requester) IsNil() bool                               { return r == nil }
func (r *requester) IsAuthenticatedBy(providers ...string) bool {
	return slices.Contains(providers, r.GetAuthenticatedBy())
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

var _ identity.Requester = (*requester)(nil)

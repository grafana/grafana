package router

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// newAuthenticatedRequest models requests already authenticated by Grafana middleware.
func newAuthenticatedRequest(method, target string, body io.Reader) *http.Request {
	req := httptest.NewRequest(method, target, body)
	return req.WithContext(authenticatedTestContext(req.Context()))
}

func authenticatedTestContext(ctx context.Context) context.Context {
	return identity.WithRequester(ctx, &identity.StaticRequester{
		Type: types.TypeUser, UserUID: "test-user", OrgID: 1, Namespace: "*",
	})
}

func TestRouterAuthentication(t *testing.T) {
	for _, tc := range []struct {
		name          string
		header        string
		authErr       error
		emptyIdentity bool
		noVerifier    bool
		trusted       bool
		status        int
		authCalls     int
	}{
		{name: "missing", status: http.StatusUnauthorized},
		{name: "authorization only", header: "Authorization", status: http.StatusUnauthorized},
		{name: "invalid", header: "X-Access-Token", authErr: apierrors.NewUnauthorized("invalid token"), status: http.StatusUnauthorized, authCalls: 2},
		{name: "unavailable", header: "X-Access-Token", authErr: errors.New("unavailable"), status: http.StatusInternalServerError, authCalls: 2},
		{name: "nil requester", header: "X-Access-Token", emptyIdentity: true, status: http.StatusUnauthorized, authCalls: 2},
		{name: "unconfigured", header: "X-Access-Token", noVerifier: true, status: http.StatusUnauthorized},
		{name: "valid", header: "X-Access-Token", authCalls: 2},
		{name: "existing", trusted: true},
	} {
		for _, path := range []string{"/apis", "/apis/", "/openapi/v3", "/openapi/v3/apis/example/v1", "/apis/example/v1/widgets", "/apis/unknown/v1/widgets"} {
			t.Run(tc.name+path, func(t *testing.T) {
				info := &identity.StaticRequester{Type: types.TypeUser, UserUID: "test-user"}
				calls := 0
				router := NewGrafanaRouter(stubLoader{}, tokenAuthenticatorFunc(func(ctx context.Context, token string) (identity.Requester, error) {
					calls++
					require.Equal(t, "test-token", token)
					if tc.emptyIdentity {
						return nil, tc.authErr
					}
					return info, tc.authErr
				}))
				if tc.noVerifier {
					router.authn = nil
				}
				handlerCalls := 0
				handler := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
					handlerCalls++
					got, err := identity.GetRequester(req.Context())
					require.NoError(t, err)
					require.Same(t, info, got)
					w.WriteHeader(http.StatusNoContent)
				})
				snapshot := map[string]servingEntry{"example": {handler: handler, breaker: newGroupBreaker("example")}}
				router.snapshot.Store(&snapshot)
				router.unregisteredGroupHandler = handler
				wantStatus := tc.status
				if wantStatus == 0 {
					wantStatus = http.StatusNoContent
					if path == "/apis" || path == "/apis/" || path == "/openapi/v3" {
						wantStatus = http.StatusOK
					}
				}
				for range 2 {
					req := httptest.NewRequest(http.MethodGet, path, nil)
					if tc.header != "" {
						req.Header.Set(tc.header, "test-token")
					}
					if tc.trusted {
						req = req.WithContext(identity.WithRequester(req.Context(), info))
					}
					rec := httptest.NewRecorder()
					router.HandleFunc(rec, req)
					require.Equal(t, wantStatus, rec.Code)
					if !tc.trusted {
						_, err := identity.GetRequester(req.Context())
						require.Error(t, err)
					}
				}
				require.Equal(t, tc.authCalls, calls)
				if tc.status == 0 {
					require.Equal(t, 2, handlerCalls)
				} else {
					require.Zero(t, handlerCalls)
				}
			})
		}
	}
}

func TestRouterAuthorizesNamespace(t *testing.T) {
	user := &identity.StaticRequester{Type: types.TypeUser, UserUID: "u", OrgID: 1, Namespace: "stacks-1"}
	for _, tc := range []struct {
		name      string
		requester *identity.StaticRequester
		path      string
		allowed   bool
	}{
		{"own namespace", user, "/apis/example/v1/namespaces/stacks-1/widgets", true},
		{"own namespace, watch", user, "/apis/example/v1/namespaces/stacks-1/widgets?watch=true", true},
		{"other namespace", user, "/apis/example/v1/namespaces/stacks-2/widgets", false},
		{"other namespace, watch", user, "/apis/example/v1/namespaces/stacks-2/widgets?watch=true", false},
		{"other namespace, object", user, "/apis/example/v1/namespaces/stacks-2/widgets/a/status", false},
		{"other namespace, fallback", user, "/apis/unknown/v1/namespaces/stacks-2/widgets", false},
		{"cluster-scoped", user, "/apis/example/v1/widgets", true},
		{"group discovery", user, "/apis/example/v1", true},
		{"wildcard", &identity.StaticRequester{Type: types.TypeAccessPolicy, Namespace: "*"}, "/apis/example/v1/namespaces/stacks-2/widgets", true},
		{"no namespace", &identity.StaticRequester{Type: types.TypeAccessPolicy}, "/apis/example/v1/namespaces/stacks-2/widgets", false},
		{"grafana admin", &identity.StaticRequester{Type: types.TypeUser, OrgID: 1, Namespace: "default", IsGrafanaAdmin: true}, "/apis/example/v1/namespaces/org-2/widgets", true},
		{"anonymous, own namespace", &identity.StaticRequester{Type: types.TypeAnonymous, OrgID: 1, Namespace: "default"}, "/apis/example/v1/namespaces/default/widgets", true},
		{"anonymous, other namespace", &identity.StaticRequester{Type: types.TypeAnonymous, OrgID: 1, Namespace: "default"}, "/apis/example/v1/namespaces/org-2/widgets", false},
		{"namespace object", user, "/apis/example/v1/namespaces/stacks-2", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			router := NewGrafanaRouter(stubLoader{}, nil)
			served := 0
			handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				served++
				w.WriteHeader(http.StatusNoContent)
			})
			snapshot := map[string]servingEntry{"example": {handler: handler, breaker: newGroupBreaker("example")}}
			router.snapshot.Store(&snapshot)
			router.unregisteredGroupHandler = handler
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			req = req.WithContext(identity.WithRequester(req.Context(), tc.requester))
			rec := httptest.NewRecorder()
			router.HandleFunc(rec, req)
			if tc.allowed {
				require.Equal(t, http.StatusNoContent, rec.Code)
				require.Equal(t, 1, served)
				return
			}
			require.Equal(t, http.StatusForbidden, rec.Code)
			require.Zero(t, served, "a backend must not see a request for another namespace")
			var status metav1.Status
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &status))
			require.Equal(t, metav1.StatusReasonForbidden, status.Reason)
		})
	}
}

// The standalone router gets its requester from a verified access token, not
// from Grafana's middleware, and must check its namespace the same way.
func TestRouterAuthorizesTokenNamespace(t *testing.T) {
	for _, tc := range []struct {
		name      string
		namespace string
		allowed   bool
	}{
		{"own namespace", "stacks-1", true},
		{"other namespace", "stacks-2", false},
		{"wildcard", "*", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			router := NewGrafanaRouter(stubLoader{}, tokenAuthenticatorFunc(func(context.Context, string) (identity.Requester, error) {
				return &identity.StaticRequester{Type: types.TypeAccessPolicy, UserUID: "policy", Namespace: tc.namespace}, nil
			}))
			served := false
			handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				served = true
				w.WriteHeader(http.StatusNoContent)
			})
			snapshot := map[string]servingEntry{"example": {handler: handler, breaker: newGroupBreaker("example")}}
			router.snapshot.Store(&snapshot)
			req := httptest.NewRequest(http.MethodGet, "/apis/example/v1/namespaces/stacks-1/widgets", nil)
			req.Header.Set("X-Access-Token", "test-token")
			rec := httptest.NewRecorder()
			router.HandleFunc(rec, req)
			if tc.allowed {
				require.Equal(t, http.StatusNoContent, rec.Code)
				require.True(t, served)
				return
			}
			require.Equal(t, http.StatusForbidden, rec.Code)
			require.False(t, served, "a backend must not see a request for another namespace")
		})
	}
}

// The namespace check reads the namespace from the request info, which must
// name it only where the apiserver reads it.
func TestRequestInfoNamespace(t *testing.T) {
	for path, want := range map[string]string{
		"/apis/g/v1/namespaces/ns/things":          "ns",
		"/apis/g/v1/namespaces/ns/things/a/status": "ns",
		"/apis/g/v1/namespaces/ns":                 "ns",
		"/apis/g/v1/namespaces/":                   "",
		"/apis/g/v1/namespaces":                    "",
		"/apis/g/v1/things":                        "",
		"/apis/g/v1/things/namespaces/ns":          "",
		"/apis/g/v1":                               "",
		"/apis/g":                                  "",
		"/apis":                                    "",
		"/openapi/v3/apis/g/v1":                    "",
		"/api/namespaces/ns":                       "",
	} {
		info, err := utils.NewRequestInfo(httptest.NewRequest(http.MethodGet, path, nil))
		require.NoError(t, err, path)
		require.Equal(t, want, info.Namespace, path)
	}
}

func TestProvideStandaloneServiceRequiresTokenVerificationConfig(t *testing.T) {
	for _, jwks := range []string{"", "https://jwks.invalid/keys"} {
		cfg := setting.NewCfg()
		cfg.Target = []string{"router"}
		cfg.ExtJWTAuth.JWKSUrl = jwks
		svc, err := provideTestService(cfg, featuremgmt.WithFeatures(), stubLoader{})
		require.Error(t, err)
		require.Nil(t, svc)
	}
}

func TestStandaloneRouterGroupAudience(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &key.PublicKey, KeyID: "test-key", Algorithm: string(jose.ES256), Use: "sig"}}}))
	}))
	t.Cleanup(server.Close)
	cfg := setting.NewCfg()
	cfg.Target = []string{"router"}
	cfg.ExtJWTAuth.JWKSUrl = server.URL
	cfg.ExtJWTAuth.Audiences = []string{"grafana"}
	router, err := ProvideGrafanaRouter(cfg)
	require.NoError(t, err)
	svc, err := ProvideService(cfg, featuremgmt.WithFeatures(), stubLoader{}, prometheus.NewRegistry(), router)
	require.NoError(t, err)
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key}, (&jose.SignerOptions{}).WithType(jose.ContentType(authnlib.TokenTypeAccess)).WithHeader("kid", "test-key"))
	require.NoError(t, err)
	handler := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		requester, err := identity.GetRequester(req.Context())
		require.NoError(t, err)
		require.Equal(t, "access-policy:policy-1", requester.GetUID())
		w.WriteHeader(http.StatusNoContent)
	})
	snapshot := map[string]servingEntry{"iam.grafana.app": {handler: handler, breaker: newGroupBreaker("iam.grafana.app")}}
	svc.router.snapshot.Store(&snapshot)
	svc.router.unregisteredGroupHandler = handler

	for _, audience := range []string{"grafana", "iam.grafana.app"} {
		claims := authnlib.Claims[authnlib.AccessTokenClaims]{
			Claims: jwt.Claims{Subject: "access-policy:policy-1", Audience: jwt.Audience{audience}, Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour))},
			Rest:   authnlib.AccessTokenClaims{Namespace: "stacks-5457"},
		}
		token, err := jwt.Signed(signer).Claims(claims).Serialize()
		require.NoError(t, err)
		for _, target := range []string{"/apis/iam.grafana.app/v0alpha1/whoami", "/apis/folder.grafana.app/v1/folders", "/apis", "/apis/discovery", "/openapi/v3"} {
			t.Run(audience+target, func(t *testing.T) {
				req := httptest.NewRequest(http.MethodGet, target, nil)
				req.Header.Set("X-Access-Token", token)
				rec := httptest.NewRecorder()
				svc.router.HandleFunc(rec, req)
				want := http.StatusUnauthorized
				if audience == "grafana" || target == "/apis/iam.grafana.app/v0alpha1/whoami" {
					want = http.StatusNoContent
					if target == "/apis" || target == "/apis/discovery" || target == "/openapi/v3" {
						want = http.StatusOK
					}
				}
				require.Equal(t, want, rec.Code, rec.Body.String())
			})
		}
	}
}

type tokenAuthenticatorFunc func(context.Context, string) (identity.Requester, error)

func (f tokenAuthenticatorFunc) AuthenticateToken(ctx context.Context, token string) (identity.Requester, error) {
	return f(ctx, token)
}

func TestRouterAuthenticationPreservesCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	info := &identity.StaticRequester{Type: types.TypeUser, UserUID: "test-user"}
	router := NewGrafanaRouter(stubLoader{}, tokenAuthenticatorFunc(func(authCtx context.Context, _ string) (identity.Requester, error) {
		require.Equal(t, ctx.Done(), authCtx.Done())
		return info, nil
	}))
	req := httptest.NewRequest(http.MethodGet, "/apis/unknown/v1/resources", nil).WithContext(ctx)
	req.Header.Set("X-Access-Token", "test-token")
	rec := httptest.NewRecorder()
	router.HandleFunc(rec, req)
	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestRouterAuthenticationSkipsPathsOutsideItsTrees(t *testing.T) {
	router := NewGrafanaRouter(stubLoader{}, tokenAuthenticatorFunc(func(context.Context, string) (identity.Requester, error) {
		t.Fatal("paths outside the router's trees must not invoke router authentication")
		return nil, nil
	}))
	rec := httptest.NewRecorder()
	router.HandleFunc(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestRouterAuthenticatesOpenAPICacheHits(t *testing.T) {
	upstream := &countingHandler{body: `{"openapi":"3.0.0"}`}
	router := buildRouterWithBackend("example", "revision", upstream)
	authCalls := 0
	router.authn = tokenAuthenticatorFunc(func(context.Context, string) (identity.Requester, error) {
		authCalls++
		return &identity.StaticRequester{Type: types.TypeUser, UserUID: "test-user"}, nil
	})
	for _, token := range []string{"valid", "", "valid"} {
		req := httptest.NewRequest(http.MethodGet, "/openapi/v3/apis/example/v1", nil)
		req.Header.Set("X-Access-Token", token)
		rec := httptest.NewRecorder()
		router.HandleFunc(rec, req)
		if token == "" {
			require.Equal(t, http.StatusUnauthorized, rec.Code)
		} else {
			require.Equal(t, http.StatusOK, rec.Code)
			require.Equal(t, upstream.body, rec.Body.String())
		}
	}
	require.Equal(t, 2, authCalls)
	require.EqualValues(t, 1, upstream.hits.Load())
}

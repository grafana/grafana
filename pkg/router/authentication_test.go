package router

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
		Type: types.TypeUser, UserUID: "test-user", OrgID: 1, Namespace: "default",
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
					router.HandleFunc(rec, req, handler)
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

func TestProvideStandaloneServiceRequiresTokenVerificationConfig(t *testing.T) {
	for _, jwks := range []string{"", "https://jwks.invalid/keys"} {
		cfg := setting.NewCfg()
		cfg.Target = []string{"router"}
		cfg.ExtJWTAuth.JWKSUrl = jwks
		svc, err := ProvideService(cfg, featuremgmt.WithFeatures(), stubLoader{}, prometheus.NewRegistry())
		require.Error(t, err)
		require.Nil(t, svc)
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
	router.HandleFunc(rec, req, http.HandlerFunc(func(w http.ResponseWriter, got *http.Request) {
		require.Equal(t, ctx.Done(), got.Context().Done())
		authInfo, ok := types.AuthInfoFrom(got.Context())
		require.True(t, ok)
		require.Same(t, info, authInfo)
		cancel()
		require.ErrorIs(t, got.Context().Err(), context.Canceled)
		w.WriteHeader(http.StatusNoContent)
	}))
	require.Equal(t, http.StatusNoContent, rec.Code)
}

func TestRouterAuthenticationLeavesUnownedPathsToNext(t *testing.T) {
	router := NewGrafanaRouter(stubLoader{}, tokenAuthenticatorFunc(func(context.Context, string) (identity.Requester, error) {
		t.Fatal("unowned paths must not invoke router authentication")
		return nil, nil
	}))
	rec := httptest.NewRecorder()
	router.HandleFunc(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil), http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	require.Equal(t, http.StatusNoContent, rec.Code)
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
		router.HandleFunc(rec, req, http.NotFoundHandler())
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

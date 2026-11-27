package router

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestRemoteServiceAudience(t *testing.T) {
	for group, want := range map[string]string{
		"foo.plugins.grafana.com":     "*.plugins.grafana.com",
		"prom.datasource.grafana.app": "*.datasource.grafana.app",
		"mimir.ext.grafana.com":       "*.ext.grafana.com",
		"widgets.ext.grafana.app":     "apiextensions.k8s.io",
		"folder.grafana.app":          "folder.grafana.app",
	} {
		require.Equal(t, want, remoteServiceAudience(group), group)
	}
}

// signedRequest is what a remote service received from the signer.
type signedRequest struct {
	header http.Header
}

func TestRemoteServiceSigner(t *testing.T) {
	const stack = "stacks-1"
	user := &identity.StaticRequester{Type: types.TypeUser, UserUID: "u", OrgID: 1, Namespace: stack, IDToken: "id", AccessToken: "at"}
	expiry := remoteResourceTokenExpiry
	for _, tc := range []struct {
		name      string
		method    string
		path      string
		requester func(context.Context) context.Context
		want      *authnlib.TokenExchangeRequest // nil when the request is refused
		status    int                            // the refusal's status
	}{
		{
			name: "user, namespaced", path: "/apis/folder.grafana.app/v1/namespaces/stacks-1/folders",
			want: &authnlib.TokenExchangeRequest{Namespace: stack, Audiences: []string{"folder.grafana.app"}, SubjectToken: "id", ExpiresIn: &expiry},
		},
		{
			name: "user, cluster-scoped read", path: "/apis/mimir.ext.grafana.com/v1alpha1/rules?watch=true",
			want: &authnlib.TokenExchangeRequest{Namespace: stack, Audiences: []string{"*.ext.grafana.com"}, SubjectToken: "id", ExpiresIn: &expiry},
		},
		{
			name: "user, cluster-scoped write", method: http.MethodPost, path: "/apis/mimir.ext.grafana.com/v1alpha1/rules",
			status: http.StatusForbidden,
		},
		{
			name: "user without an ID token", path: "/apis/folder.grafana.app/v1/namespaces/stacks-1/folders",
			requester: func(ctx context.Context) context.Context {
				return identity.WithRequester(ctx, &identity.StaticRequester{Type: types.TypeUser, UserUID: "u", OrgID: 1, Namespace: stack})
			},
			status: http.StatusUnauthorized,
		},
		{
			name: "service identity, stack namespace", path: "/apis/folder.grafana.app/v1/namespaces/stacks-1/folders",
			requester: func(ctx context.Context) context.Context { return identity.WithServiceIdentityContext(ctx, 1) },
			want:      &authnlib.TokenExchangeRequest{Namespace: stack, Audiences: []string{"folder.grafana.app"}, ExpiresIn: &expiry},
		},
		{
			name: "service identity, other namespace", path: "/apis/folder.grafana.app/v1/namespaces/stacks-2/folders",
			requester: func(ctx context.Context) context.Context { return identity.WithServiceIdentityContext(ctx, 1) },
			status:    http.StatusForbidden,
		},
		{
			name: "group discovery", path: "/apis/folder.grafana.app/v1",
			want: &authnlib.TokenExchangeRequest{Namespace: stack, Audiences: []string{"cloudAppPlatformDiscovery"}},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			method := tc.method
			if method == "" {
				method = http.MethodGet
			}
			req := httptest.NewRequest(method, tc.path, nil)
			req.Header.Set("X-Grafana-Id", "id")
			req.Header.Set(accessTokenHeader, "Bearer at")
			req.Header.Set("Authorization", "Bearer at")
			ctx := identity.WithRequester(req.Context(), user)
			if tc.requester != nil {
				ctx = tc.requester(req.Context())
			}
			info, err := utils.NewRequestInfo(req)
			require.NoError(t, err)
			req = req.WithContext(request.WithRequestInfo(ctx, info))

			exchanger := &recordingExchanger{}
			var got *signedRequest
			next := fallbackRoundTripper(func(r *http.Request) (*http.Response, error) {
				got = &signedRequest{header: r.Header}
				return &http.Response{StatusCode: http.StatusOK, Header: http.Header{}, Body: http.NoBody, Request: r}, nil
			})
			rsp, err := newRemoteServiceSigner(exchanger, stack, defaultRemoteServicesAudience)(next).RoundTrip(req)
			if rsp != nil {
				require.NoError(t, rsp.Body.Close())
			}

			if tc.want == nil {
				var local *localProxyError
				require.ErrorAs(t, err, &local)
				require.EqualValues(t, tc.status, local.status.Status().Code)
				require.Empty(t, local.reason, "a refused request is not a failure")
				require.Nil(t, got, "a refused request must not reach the backend")
				require.Empty(t, exchanger.reqs)
				return
			}
			require.NoError(t, err)
			require.Equal(t, []authnlib.TokenExchangeRequest{*tc.want}, exchanger.reqs)
			require.Equal(t, "Bearer exchanged", got.header.Get("Authorization"))
			require.Empty(t, got.header.Get("X-Grafana-Id"))
			require.Empty(t, got.header.Get(accessTokenHeader))
			require.Equal(t, "Bearer at", req.Header.Get("Authorization"), "the caller's request must not be modified")
		})
	}
}

// Through the router: a request the signer refuses, or can't sign, gets the
// signer's status, never reaches the remote service, and doesn't count
// against its breaker.
func TestRemoteServiceSignerFailuresSkipTheBreaker(t *testing.T) {
	const group = "folder.grafana.app"
	for _, tc := range []struct {
		name       string
		method     string
		exchange   error
		status     int
		retryAfter string
	}{
		{name: "exchange fails", method: http.MethodGet, exchange: errors.New("signer down"), status: http.StatusServiceUnavailable, retryAfter: "1"},
		{name: "cluster-scoped write", method: http.MethodPost, status: http.StatusForbidden},
	} {
		t.Run(tc.name, func(t *testing.T) {
			sent := 0
			remote := fallbackRoundTripper(func(r *http.Request) (*http.Response, error) {
				sent++
				return &http.Response{StatusCode: http.StatusOK, Header: http.Header{}, Body: http.NoBody, Request: r}, nil
			})
			base, err := url.Parse("https://mt.invalid")
			require.NoError(t, err)
			signer := newRemoteServiceSigner(&recordingExchanger{err: tc.exchange}, "stacks-1", defaultRemoteServicesAudience)
			backend, err := newAggregateBackend("remote_mt", metav1.APIGroup{
				Name:     group,
				Versions: []metav1.GroupVersionForDiscovery{{GroupVersion: group + "/v1", Version: "v1"}},
			}, base, signer(remote))
			require.NoError(t, err)
			router := NewGrafanaRouter(&mutableLoader{backends: []Backend{backend}}, nil)
			require.NoError(t, router.reconcile(t.Context()))

			path := "/apis/" + group + "/v1/namespaces/stacks-1/folders"
			if tc.method == http.MethodPost {
				path = "/apis/" + group + "/v1/folders"
			}
			req := newRequestAs(tc.method, path, &identity.StaticRequester{
				Type: types.TypeUser, UserUID: "u", OrgID: 1, Namespace: "stacks-1", IDToken: "id",
			})
			rec := httptest.NewRecorder()
			router.HandleFunc(rec, req)

			require.Equal(t, tc.status, rec.Code)
			require.Equal(t, tc.retryAfter, rec.Header().Get("Retry-After"))
			var status metav1.Status
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &status))
			require.EqualValues(t, tc.status, status.Code)
			require.Zero(t, sent)
			require.Zero(t, router.served[group].breaker.Counts().TotalFailures)
		})
	}
}

func TestRemoteServiceFailureReason(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/apis/g/v1", nil)
	refused := remoteForbidden(&request.RequestInfo{APIGroup: "g"}, errors.New("no"))
	require.Empty(t, failureReason(req, refused))
	require.NoError(t, breakerOutcome(req, http.StatusForbidden, &backendCall{proxyErr: refused}))

	unsigned := &localProxyError{status: apierrors.NewServiceUnavailable("signer down"), reason: failureAuth}
	require.Equal(t, failureAuth, failureReason(req, unsigned))
	require.NoError(t, breakerOutcome(req, http.StatusServiceUnavailable, &backendCall{proxyErr: unsigned}))
}

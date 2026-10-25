package utils

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apiserver/pkg/endpoints/request"
)

// NewRequestInfo must parse every resource request as the apiserver does.
func TestNewRequestInfoMatchesAPIServer(t *testing.T) {
	factory := &request.RequestInfoFactory{
		APIPrefixes:          sets.NewString("apis"),
		GrouplessAPIPrefixes: sets.NewString(),
	}
	for _, tc := range []struct{ method, target string }{
		{http.MethodGet, "/apis"},
		{http.MethodGet, "/healthz"},
		{http.MethodGet, "/api/v1/pods"},
		{http.MethodGet, "/openapi/v3/apis/example.grafana.app/v1"},
		{http.MethodGet, "/apis/example.grafana.app/v1/widgets"},
		{http.MethodGet, "/apis/example.grafana.app/v1/widgets?watch=true"},
		{http.MethodGet, "/apis/example.grafana.app/v1/widgets?watch=1"},
		{http.MethodGet, "/apis/example.grafana.app/v1/widgets?watch=0"},
		{http.MethodGet, "/apis/example.grafana.app/v1/widgets?watch=False"},
		{http.MethodGet, "/apis/example.grafana.app/v1/widgets?watch="},
		{http.MethodHead, "/apis/example.grafana.app/v1/widgets/foo"},
		{http.MethodGet, "/apis/example.grafana.app/v1/namespaces/default/widgets"},
		{http.MethodGet, "/apis/example.grafana.app/v1/namespaces/default/widgets/foo"},
		{http.MethodGet, "/apis/example.grafana.app/v1/namespaces/default/widgets/foo/status"},
		{http.MethodGet, "/apis/example.grafana.app/v1/namespaces/default/widgets/foo/status/extra"},
		{http.MethodGet, "/apis/example.grafana.app/v1/namespaces/default/widgets?fieldSelector=metadata.name%3Dfoo&labelSelector=a%3Db"},
		{http.MethodGet, "/apis/example.grafana.app/v1/widgets?fieldSelector=metadata.name%3Dfoo%2Fbar"},
		{http.MethodGet, "/apis/example.grafana.app/v1/widgets?fieldSelector=spec.x%3Dy"},
		{http.MethodGet, "/apis/example.grafana.app/v1/namespaces"},
		{http.MethodGet, "/apis/example.grafana.app/v1/namespaces/default"},
		{http.MethodPut, "/apis/example.grafana.app/v1/namespaces/default/status"},
		{http.MethodPut, "/apis/example.grafana.app/v1/namespaces/default/finalize"},
		{http.MethodPost, "/apis/example.grafana.app/v1/namespaces/default/widgets"},
		{http.MethodPut, "/apis/example.grafana.app/v1/namespaces/default/widgets/foo"},
		{http.MethodPatch, "/apis/example.grafana.app/v1/namespaces/default/widgets/foo"},
		{http.MethodDelete, "/apis/example.grafana.app/v1/namespaces/default/widgets/foo"},
		{http.MethodDelete, "/apis/example.grafana.app/v1/namespaces/default/widgets?labelSelector=a%3Db"},
		{http.MethodOptions, "/apis/example.grafana.app/v1/namespaces/default/widgets"},
		{http.MethodGet, "/apis/example.grafana.app/v1/proxy/namespaces/default/widgets/foo/a/b"},
		{http.MethodGet, "/apis/example.grafana.app/v1/proxy"},
		{http.MethodGet, "/apis/example.grafana.app/v1/widgets/"},
	} {
		t.Run(tc.method+" "+tc.target, func(t *testing.T) {
			want, wantErr := factory.NewRequestInfo(httptest.NewRequest(tc.method, tc.target, nil))
			got, err := NewRequestInfo(httptest.NewRequest(tc.method, tc.target, nil))
			require.Equal(t, wantErr, err)
			require.Equal(t, want, got)
		})
	}
}

// The deprecated /watch/ path form is rejected, where the apiserver would
// parse it as a watch.
func TestNewRequestInfoRejectsLegacyWatch(t *testing.T) {
	for _, target := range []string{
		"/apis/example.grafana.app/v1/watch/namespaces/default/widgets?labelSelector=a%3Db",
		"/apis/example.grafana.app/v1/watch/widgets/foo",
		"/apis/example.grafana.app/v1/watch",
	} {
		t.Run(target, func(t *testing.T) {
			_, err := NewRequestInfo(httptest.NewRequest(http.MethodGet, target, nil))
			require.True(t, apierrors.IsBadRequest(err), err)
		})
	}

	// A resource or object named watch is not the deprecated form.
	for _, target := range []string{
		"/apis/example.grafana.app/v1/namespaces/default/watch",
		"/apis/example.grafana.app/v1/namespaces/default/widgets/watch",
	} {
		info, err := NewRequestInfo(httptest.NewRequest(http.MethodGet, target, nil))
		require.NoError(t, err, target)
		require.True(t, info.IsResourceRequest, target)
	}
}

// Group and version discovery stay non-resource requests, but name their
// group and version, unlike the apiserver's.
func TestNewRequestInfoGroupDiscovery(t *testing.T) {
	for target, want := range map[string]request.RequestInfo{
		"/apis/example.grafana.app": {
			Path: "/apis/example.grafana.app", Verb: "get", APIPrefix: "apis", APIGroup: "example.grafana.app",
		},
		"/apis/example.grafana.app/": {
			Path: "/apis/example.grafana.app/", Verb: "get", APIPrefix: "apis", APIGroup: "example.grafana.app",
		},
		"/apis/example.grafana.app/v1": {
			Path: "/apis/example.grafana.app/v1", Verb: "get", APIPrefix: "apis", APIGroup: "example.grafana.app", APIVersion: "v1",
		},
	} {
		t.Run(target, func(t *testing.T) {
			got, err := NewRequestInfo(httptest.NewRequest(http.MethodGet, target, nil))
			require.NoError(t, err)
			require.Equal(t, &want, got)
		})
	}
}

// The apiserver loses the field selector's name when another list option is
// malformed; NewRequestInfo keeps it.
func TestNewRequestInfoNameWithMalformedListOptions(t *testing.T) {
	got, err := NewRequestInfo(httptest.NewRequest(http.MethodGet, "/apis/example.grafana.app/v1/widgets?fieldSelector=metadata.name%3Dfoo&labelSelector=a%3D%3D%3Db&watch=true", nil))
	require.NoError(t, err)
	require.Equal(t, "watch", got.Verb)
	require.Equal(t, "foo", got.Name)
	require.Equal(t, "a===b", got.LabelSelector)
}

func BenchmarkNewRequestInfo(b *testing.B) {
	for _, target := range []string{
		"/apis/example.grafana.app/v1/namespaces/default/widgets/foo",
		"/apis/example.grafana.app/v1/namespaces/default/widgets",
		"/apis/example.grafana.app/v1/namespaces/default/widgets?watch=true&labelSelector=a%3Db",
		"/apis/example.grafana.app",
	} {
		b.Run(target, func(b *testing.B) {
			req := httptest.NewRequest(http.MethodGet, target, nil)
			b.ReportAllocs()
			for b.Loop() {
				_, _ = NewRequestInfo(req)
			}
		})
	}
}

package utils

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"path"
	"strings"
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

// The deprecated /watch/ and the /proxy/ path forms are rejected, where the
// apiserver would parse them as the watch and proxy verbs.
func TestNewRequestInfoRejectsVerbPaths(t *testing.T) {
	for _, target := range []string{
		"/apis/example.grafana.app/v1/watch/namespaces/default/widgets?labelSelector=a%3Db",
		"/apis/example.grafana.app/v1/watch/widgets/foo",
		"/apis/example.grafana.app/v1/watch",
		"/apis/example.grafana.app/v1/proxy/namespaces/other/widgets/foo",
		"/apis/example.grafana.app/v1/proxy/widgets/foo",
		"/apis/example.grafana.app/v1/proxy",
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

// Only the /proxy/ path form is rejected: in a namespace, proxy is a resource,
// object or subresource name like any other.
func TestNewRequestInfoProxyNames(t *testing.T) {
	for target, want := range map[string]struct{ verb, resource, name, subresource string }{
		"/apis/example.grafana.app/v1/namespaces/default/proxy":           {verb: VerbList, resource: "proxy"},
		"/apis/example.grafana.app/v1/namespaces/default/widgets/proxy":   {verb: VerbGet, resource: "widgets", name: "proxy"},
		"/apis/example.grafana.app/v1/namespaces/default/widgets/a/proxy": {verb: VerbGet, resource: "widgets", name: "a", subresource: "proxy"},
	} {
		info, err := NewRequestInfo(httptest.NewRequest(http.MethodGet, target, nil))
		require.NoError(t, err, target)
		require.Equal(t, want.verb, info.Verb, target)
		require.Equal(t, want.resource, info.Resource, target)
		require.Equal(t, want.name, info.Name, target)
		require.Equal(t, want.subresource, info.Subresource, target)
	}
}

// A group that is not a valid API group name is rejected, from the group
// discovery path on. A request that parses always names a valid group.
func TestNewRequestInfoRejectsInvalidGroups(t *testing.T) {
	for _, target := range []string{
		"/apis/Not_A.Group/v1/namespaces/default/widgets",
		"/apis/UPPER.grafana.app/v1",
		"/apis/-leading.grafana.app",
		"/apis/trailing-.grafana.app/v1/widgets",
		"/apis/under_score/v1",
		"/apis/double..dot/v1",
	} {
		_, err := NewRequestInfo(httptest.NewRequest(http.MethodGet, target, nil))
		require.True(t, apierrors.IsBadRequest(err), target)
	}

	// Dotted API groups and hyphenated plugin IDs are both valid.
	for target, group := range map[string]string{
		"/apis/dashboard.grafana.app/v1/namespaces/default/dashboards": "dashboard.grafana.app",
		"/apis/example-app/v1":               "example-app",
		"/apis/discovery/v1alpha2/manifests": "discovery",
		"/apis/apiregistration.k8s.io":       "apiregistration.k8s.io",
	} {
		info, err := NewRequestInfo(httptest.NewRequest(http.MethodGet, target, nil))
		require.NoError(t, err, target)
		require.Equal(t, group, info.APIGroup, target)
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

func TestLowerMethod(t *testing.T) {
	for _, method := range []string{
		http.MethodGet, http.MethodHead, http.MethodPost, http.MethodPut, http.MethodPatch,
		http.MethodDelete, http.MethodOptions, http.MethodConnect, http.MethodTrace,
		"PROPFIND", "get", "",
	} {
		require.Equal(t, strings.ToLower(method), LowerMethod(method), method)
	}
	require.Zero(t, testing.AllocsPerRun(100, func() { _ = LowerMethod(http.MethodGet) }))
}

func TestIsCanonicalAPIPath(t *testing.T) {
	for target, want := range map[string]bool{
		"/apis":                           true,
		"/apis/":                          true,
		"/apis/g/v1/":                     true,
		"/apis/g/v1/namespaces/ns/things": true,
		"/apis/g/v1/namespaces/ns/things?watch=1": true,
		"/openapi/v3/apis/g/v1?hash=abc":          true,
		"/apis/g/v1/namespaces/ns/things/a%20b":   true,
		"/apis//v1/things":                        false,
		"/apis/g/./v1/things":                     false,
		"/apis/g/../other/v1/things":              false,
		"/apis/g/v1/..":                           false,
		"/apis/g%2Fother/v1/things":               false,
		"/apis/g%2fother/v1/things":               false,
		"/openapi/v3/apis/g/../other/v1":          false,
		"/apis/g//":                               false,
		"/apis/g/v1/.":                            false,
		"/apis/g/v1/.hidden":                      true,
		"/apis/g/v1/a..b":                         true,
		"/apis/g/v1/a%252fb":                      true,
		"/apis/g/v1/%2e%2e/x":                     false,
		"/openapi/v3/":                            true,
	} {
		require.Equal(t, want, IsCanonicalAPIPath(httptest.NewRequest(http.MethodGet, target, nil).URL), target)
	}
}

// isCanonicalAPIPathReference is the definition canonicalAPIPath implements
// without building a cleaned path or lowercasing the escaped one.
func isCanonicalAPIPathReference(u *url.URL) bool {
	p := strings.TrimSuffix(u.Path, "/")
	if path.Clean(p) != p {
		return false
	}
	return !strings.Contains(strings.ToLower(u.EscapedPath()), "%2f")
}

func TestCanonicalAPIPathStaleRawPath(t *testing.T) {
	// RawPath is ignored when it no longer encodes Path, as after a rewrite.
	u := &url.URL{Path: "/apis/g/v1/things", RawPath: "/apis/other%2Fv1/things"}
	require.True(t, IsCanonicalAPIPath(u))
	require.Equal(t, isCanonicalAPIPathReference(u), IsCanonicalAPIPath(u))
}

func FuzzIsCanonicalAPIPath(f *testing.F) {
	for _, target := range []string{
		"/apis", "/apis/", "/apis/g/v1/things", "/apis//v1", "/apis/g/./v1", "/apis/g/../v1", "/apis/g/v1/..",
		"/apis/g//", "/apis/g%2Fv1", "/apis/g/v1/a%252fb", "/openapi/v3/apis/g/v1", "/apis/g/v1/.hidden",
	} {
		u, err := url.Parse(target)
		if err != nil {
			f.Fatal(err)
		}
		f.Add(u.Path, u.RawPath)
	}
	f.Fuzz(func(t *testing.T, decoded, raw string) {
		// Paths reaching the router are absolute.
		if !strings.HasPrefix(decoded, "/") {
			return
		}
		u := &url.URL{Path: decoded, RawPath: raw}
		want := isCanonicalAPIPathReference(u)
		if got := IsCanonicalAPIPath(u); got != want {
			t.Fatalf("Path=%q RawPath=%q: got %v, want %v", decoded, raw, got, want)
		}
		// NewRequestInfo checks the segments while splitting them.
		if _, got := canonicalPathParts(u, nil); got != want {
			t.Fatalf("canonicalPathParts(Path=%q RawPath=%q): got %v, want %v", decoded, raw, got, want)
		}
	})
}

// A path in the /apis tree that isn't canonical is rejected, since a backend
// could serve another group or namespace than the one it parses as.
func TestNewRequestInfoRejectsNonCanonicalPaths(t *testing.T) {
	for _, target := range []string{
		"/apis/g/../other/v1/things",
		"/apis/g/v1/namespaces/allowed/../other/things",
		"/apis/g%2Fother/v1/things",
		"/apis/g/v1/namespaces//things",
		"/apis/g/./v1/things",
		"/apis/g/v1/things//",
	} {
		_, err := NewRequestInfo(httptest.NewRequest(http.MethodGet, target, nil))
		require.True(t, apierrors.IsBadRequest(err), target)
	}
}

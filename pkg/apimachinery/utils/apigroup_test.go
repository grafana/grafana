package utils

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"path"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAPIGroupFromRequest(t *testing.T) {
	for target, want := range map[string]string{
		"/apis/iam.grafana.app/v0alpha1/whoami":         "iam.grafana.app",
		"/apis/folder.grafana.app":                      "folder.grafana.app",
		"/apis/folder.grafana.app/":                     "folder.grafana.app",
		"/apis/appsdktest.ext.grafana.app/v1alpha1/foo": "appsdktest.ext.grafana.app",
		"/apis":                        "",
		"/apis/":                       "",
		"/apis/example-app/v1":         "example-app",
		"/apis/example-aisdk-app/v1":   "example-aisdk-app",
		"/apis/github-datasource/v1":   "github-datasource",
		"/apis/example-aisdk-app%2fv1": "",
		"/apis/example-aisdk-app/../github-datasource/v1": "",
		"/api/user": "",
		"/api/plugins/example-app/resources/apis/x.y.z/foo":  "",
		"/openapi/v3/apis/iam.grafana.app/v0alpha1":          "",
		"/apis/iam.grafana.app/../folder.grafana.app/v1":     "",
		"/apis/iam.grafana.app/%2e%2e/folder.grafana.app/v1": "",
		"/apis/iam.grafana.app//v1":                          "",
		"/apis/iam.grafana.app%2fv1":                         "",
		"/apis/./v1":                                         "",
		"/apis/../v1":                                        "",
		"/apis/iam.grafana.app//":                            "",
		"/apis/iam.grafana.app/v1//":                         "",
		"/apis/iam.grafana.app/v1/.":                         "",
		"/apis/iam.grafana.app/v1/../":                       "",
		"/apis/iam.grafana.app/v1/%2E":                       "",
		"/apis/iam.grafana.app/v1/%2E%2e/":                   "",
		"/apis/iam.grafana.app%2Fv1":                         "",
		"/apis/iam.grafana.app/v1/a%2fb":                     "",
		"/apis%2Fiam.grafana.app/v1":                         "",
		"/apis/iam.grafana.app/v1/folders/":                  "iam.grafana.app",
		"/apis/iam.grafana.app/v1/.hidden":                   "iam.grafana.app",
		"/apis/iam.grafana.app/v1/...":                       "iam.grafana.app",
		"/apis/iam.grafana.app/v1/a..b":                      "iam.grafana.app",
		"/apis/iam.grafana.app/v1/AbCd":                      "iam.grafana.app",
		"/apis/iam.grafana.app/v1/my%20folder":               "iam.grafana.app",
		"/apis/iam%2egrafana.app/v1":                         "iam.grafana.app",
		"/apis/iam.grafana.app/v1/%252f":                     "iam.grafana.app",
		"/apis/iam.grafana.app/v1?next=%2F":                  "iam.grafana.app",
	} {
		t.Run(target, func(t *testing.T) {
			require.Equal(t, want, APIGroupFromRequest(httptest.NewRequest(http.MethodGet, target, nil)))
		})
	}
	require.Empty(t, APIGroupFromRequest(&http.Request{}))
	require.Empty(t, APIGroupFromRequest(nil))
}

func TestAPIGroupFromRequestRawPath(t *testing.T) {
	// RawPath is only a hint. As with URL.EscapedPath, ignore it when it is
	// malformed or no longer matches Path after a request rewrite.
	for _, raw := range []string{
		"/apis/other.grafana.app%2Fv1",
		"/apis/iam.grafana.app%2Fv1%zz",
		"/apis/iam.grafana.app%2Fv1%",
	} {
		t.Run(raw, func(t *testing.T) {
			req := &http.Request{URL: &url.URL{Path: "/apis/iam.grafana.app/v1", RawPath: raw}}
			require.Equal(t, "iam.grafana.app", APIGroupFromRequest(req))
		})
	}
}

func FuzzAPIGroupFromRequest(f *testing.F) {
	// Independent oracle matching Kubernetes' DNS1123 subdomain expression.
	groupPattern := regexp.MustCompile(`^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$`)
	for _, target := range []string{
		"/api/user",
		"/apis/",
		"/apis/iam.grafana.app",
		"/apis/example-app/v1/",
		"/apis/iam.grafana.app/v1//",
		"/apis/iam.grafana.app/../other.grafana.app/v1",
		"/apis/iam.grafana.app/%2E/",
		"/apis/iam.grafana.app%2fv1",
		"/apis/iam.grafana.app/v1/a%2Fb",
		"/apis%2Fiam.grafana.app/v1",
		"/apis/iam%2egrafana.app/v1",
		"/apis/iam.grafana.app/v1/%252f",
		"/apis/grafana/v1",
		"/apis/0/v1",
		"/apis/a..b/v1",
		"/apis/a.-b/v1",
		"/apis/a-.b/v1",
		"/apis/UPPER.app/v1",
		"/apis/" + strings.Repeat("a", 253) + "/v1",
		"/apis/" + strings.Repeat("a", 254) + "/v1",
	} {
		u, err := url.Parse(target)
		if err != nil {
			f.Fatal(err)
		}
		f.Add(u.Path, u.RawPath)
	}
	f.Add("/apis/iam.grafana.app/v1", "/apis/other.grafana.app%2Fv1")
	f.Fuzz(func(t *testing.T, decoded, raw string) {
		u := &url.URL{Path: decoded, RawPath: raw}
		want := ""
		// Use path.Clean as an independent check of canonical segments.
		if strings.HasPrefix(decoded, "/apis/") &&
			path.Clean(decoded) == strings.TrimSuffix(decoded, "/") &&
			!strings.Contains(strings.ToLower(u.EscapedPath()), "%2f") {
			group, _, _ := strings.Cut(decoded[len("/apis/"):], "/")
			if len(group) <= 253 && groupPattern.MatchString(group) {
				want = group
			}
		}
		if got := APIGroupFromRequest(&http.Request{URL: u}); got != want {
			t.Fatalf("Path=%q RawPath=%q: got %q, want %q", decoded, raw, got, want)
		}
	})
}

func BenchmarkAPIGroupFromRequest(b *testing.B) {
	for _, tc := range []struct {
		name string
		path string
		want string
	}{
		{"non_api", "/api/user", ""},
		{"group_only", "/apis/folder.grafana.app", "folder.grafana.app"},
		{"resource", "/apis/folder.grafana.app/v1/folders", "folder.grafana.app"},
		{"plugin", "/apis/example-aisdk-app/v1/resources", "example-aisdk-app"},
		{"namespaced", "/apis/folder.grafana.app/v1/namespaces/stacks-1/folders/abcdef123456", "folder.grafana.app"},
		{"uppercase", "/apis/folder.grafana.app/v1/folders/AbCdEf123456", "folder.grafana.app"},
		{"escaped_space", "/apis/folder.grafana.app/v1/folders/my%20folder", "folder.grafana.app"},
		{"escaped_group", "/apis/folder%2egrafana.app/v1/folders", "folder.grafana.app"},
		{"encoded_slash", "/apis/folder.grafana.app%2Fv1/folders", ""},
		{"dot_segment", "/apis/folder.grafana.app/../iam.grafana.app/v1", ""},
	} {
		b.Run(tc.name, func(b *testing.B) {
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			b.ReportAllocs()
			for b.Loop() {
				if got := APIGroupFromRequest(req); got != tc.want {
					b.Fatalf("APIGroupFromRequest() = %q, want %q", got, tc.want)
				}
			}
		})
	}
}

func TestIsAPIGroup(t *testing.T) {
	for name, want := range map[string]bool{
		"folder.grafana.app":             true,
		"appsdktest.ext.grafana.app":     true,
		"apiextensions.k8s.io":           true,
		"grafana":                        true,
		"a":                              true,
		"0":                              true,
		"123":                            true,
		"0.a-1.2":                        true,
		"a--b":                           true,
		"example-app":                    true,
		"example-aisdk-app":              true,
		"github-datasource":              true,
		"example-aisdk-app/v1":           false,
		"github-datasource/v1":           false,
		"":                               false,
		"a.b/c":                          false,
		".":                              false,
		"..":                             false,
		"-":                              false,
		".a":                             false,
		"a.":                             false,
		"-a":                             false,
		"a-":                             false,
		"a..b":                           false,
		"a.-b":                           false,
		"a-.b":                           false,
		"A":                              false,
		"A.b":                            false,
		"aB.c":                           false,
		"a.B":                            false,
		"a_b":                            false,
		"a b":                            false,
		"a\tb":                           false,
		"a\nb":                           false,
		"a\x00b":                         false,
		"a%b":                            false,
		"a*b":                            false,
		"a\\b":                           false,
		"a.é.b":                          false,
		strings.Repeat("a", 253):         true,
		strings.Repeat("a", 254):         false,
		strings.Repeat("a.", 126) + "0":  true,
		strings.Repeat("a.", 126) + "00": false,
	} {
		t.Run(name, func(t *testing.T) {
			require.Equal(t, want, IsAPIGroup(name))
			// Check the same cases through HTTP parsing, including escaped
			// invalid characters and the decoded group length.
			wantGroup := ""
			if want {
				wantGroup = name
			}
			req := httptest.NewRequest(http.MethodGet, "/apis/"+url.PathEscape(name)+"/v1", nil)
			require.Equal(t, wantGroup, APIGroupFromRequest(req))
		})
	}
}

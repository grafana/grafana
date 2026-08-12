package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/web"
)

func TestIsProvisioningPreviewPath(t *testing.T) {
	tests := []struct {
		path     string
		expected bool
	}{
		{"/admin/provisioning/my-repo/dashboard/preview/path/to/file.json", true},
		{"/admin/provisioning/my-repo/dashboard/preview/nested/dir/dash.json", true},
		{"/admin/provisioning/repo-name/dashboard/preview/file.json", true},
		{"/admin/provisioning/my-repo/dashboard/preview/path/with spaces/file.json", true},

		{"/admin/provisioning", false},
		{"/admin/provisioning/", false},
		{"/admin/provisioning/my-repo", false},
		{"/admin/provisioning/my-repo/edit", false},
		{"/admin/provisioning/my-repo/file/something", false},
		{"/admin/provisioning/my-repo/dashboard/preview", false},
		{"/admin/provisioning/my-repo/dashboard/preview/", true},
		{"/dashboard/provisioning/my-repo/preview/file.json", false},
		{"/other/path", false},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			assert.Equal(t, tt.expected, isProvisioningPreviewPath(tt.path))
		})
	}
}

func TestProvisioningAuth(t *testing.T) {
	tests := []struct {
		desc       string
		url        string
		isSignedIn bool
		orgRole    org.RoleType
		expCode    int
		expReached bool
	}{
		{
			desc:       "preview path with signed-in viewer should be allowed",
			url:        "/admin/provisioning/my-repo/dashboard/preview/path/to/file.json",
			isSignedIn: true,
			orgRole:    org.RoleViewer,
			expCode:    http.StatusOK,
			expReached: true,
		},
		{
			desc:       "preview path with signed-in editor should be allowed",
			url:        "/admin/provisioning/my-repo/dashboard/preview/path/to/file.json",
			isSignedIn: true,
			orgRole:    org.RoleEditor,
			expCode:    http.StatusOK,
			expReached: true,
		},
		{
			desc:       "preview path with signed-in admin should be allowed",
			url:        "/admin/provisioning/my-repo/dashboard/preview/path/to/file.json",
			isSignedIn: true,
			orgRole:    org.RoleAdmin,
			expCode:    http.StatusOK,
			expReached: true,
		},
		{
			desc:       "preview path with anonymous user should redirect to login",
			url:        "/admin/provisioning/my-repo/dashboard/preview/path/to/file.json",
			isSignedIn: false,
			orgRole:    org.RoleViewer,
			expCode:    http.StatusFound,
			expReached: false,
		},
		{
			desc:       "non-preview path with admin should be allowed",
			url:        "/admin/provisioning/my-repo",
			isSignedIn: true,
			orgRole:    org.RoleAdmin,
			expCode:    http.StatusOK,
			expReached: true,
		},
		{
			desc:       "non-preview path with viewer should be forbidden",
			url:        "/admin/provisioning/my-repo",
			isSignedIn: true,
			orgRole:    org.RoleViewer,
			expCode:    http.StatusFound,
			expReached: false,
		},
		{
			desc:       "non-preview path with editor should be forbidden",
			url:        "/admin/provisioning/my-repo/edit",
			isSignedIn: true,
			orgRole:    org.RoleEditor,
			expCode:    http.StatusFound,
			expReached: false,
		},
		{
			desc:       "preview path with query params should be allowed for viewer",
			url:        "/admin/provisioning/my-repo/dashboard/preview/file.json?ref=abc&pull_request_url=http%3A%2F%2Fgithub.com",
			isSignedIn: true,
			orgRole:    org.RoleViewer,
			expCode:    http.StatusOK,
			expReached: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			var reached bool
			server := web.New()
			server.UseMiddleware(web.Renderer("../../public/views", "[[", "]]"))
			server.Use(contextProvider(func(c *contextmodel.ReqContext) {
				c.IsSignedIn = tt.isSignedIn
				c.OrgRole = tt.orgRole
			}))
			server.Use(ProvisioningAuth(ReqOrgAdmin))
			server.Get("/admin/provisioning/*", func(c *contextmodel.ReqContext) {
				reached = true
				c.Resp.WriteHeader(http.StatusOK)
			})

			request, err := http.NewRequest(http.MethodGet, tt.url, nil)
			require.NoError(t, err)
			recorder := httptest.NewRecorder()

			server.ServeHTTP(recorder, request)

			res := recorder.Result()
			assert.Equal(t, tt.expCode, res.StatusCode)
			assert.Equal(t, tt.expReached, reached)
			require.NoError(t, res.Body.Close())
		})
	}
}

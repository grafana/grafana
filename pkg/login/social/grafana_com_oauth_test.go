package social

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

const (
	UserInfoURL  = "/api/oauth2/user"
	userResponse = `{
		"id": 123,
		"name": "grafana name",
		"login": "grafanalogin",
		"username": "grafanalogin",
		"email": "grafana@grafana.com",
		"role": "Admin",
		"orgs": [    {      "login": "grafana",      "role": "Admin"    } ]
	}`
)

func TestSocialGrafanaCom_UserInfo(t *testing.T) {
	provider, err := NewGrafanaComProvider(map[string]any{}, &setting.Cfg{}, featuremgmt.WithFeatures())
	require.NoError(t, err)

	type conf struct {
		skipOrgRoleSync bool
	}

	tests := []struct {
		Name          string
		Cfg           conf
		userInfoResp  string
		want          *BasicUserInfo
		ExpectedError error
	}{
		{
			Name:         "should return empty role as userInfo when Skip Org Role Sync Enabled",
			userInfoResp: userResponse,
			Cfg:          conf{skipOrgRoleSync: true},
			want: &BasicUserInfo{
				Id:    "1",
				Name:  "Eric Leijonmarck",
				Email: "octocat@github.com",
				Login: "octocat",
				Role:  "",
			},
		},
		{
			Name:         "should return role as userInfo when Skip Org Role Sync Enabled",
			userInfoResp: userResponse,
			Cfg:          conf{skipOrgRoleSync: false},
			want: &BasicUserInfo{
				Id:    "1",
				Name:  "Eric Leijonmarck",
				Email: "octocat@github.com",
				Login: "octocat",
				Role:  "Admin",
			},
		},
	}

	for _, test := range tests {
		provider.skipOrgRoleSync = test.Cfg.skipOrgRoleSync

		t.Run(test.Name, func(t *testing.T) {
			ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Header().Set("Content-Type", "application/json")
				switch r.RequestURI {
				case UserInfoURL:
					_, err := w.Write([]byte(test.userInfoResp))
					require.NoError(t, err)
				default:
					w.WriteHeader(http.StatusNotFound)
				}
			}))
			provider.url = ts.URL
			actualResult, err := provider.UserInfo(context.Background(), ts.Client(), nil)
			if test.ExpectedError != nil {
				require.Equal(t, err, test.ExpectedError)
				return
			}

			require.NoError(t, err)
			require.Equal(t, test.want.Role, actualResult.Role)
		})
	}
}

func TestSocialGrafanaCom_InitializeExtraFields(t *testing.T) {
	type settingFields struct {
		allowedOrganizations []string
	}
	testCases := []struct {
		name     string
		settings map[string]any
		want     settingFields
	}{
		{
			name:     "allowedOrganizations is not set",
			settings: map[string]any{},
			want: settingFields{
				allowedOrganizations: []string{},
			},
		},
		{
			name: "allowedOrganizations is set",
			settings: map[string]any{
				"allowed_organizations": "uuid-1234,uuid-5678",
			},
			want: settingFields{
				allowedOrganizations: []string{"uuid-1234", "uuid-5678"},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s, err := NewGrafanaComProvider(tc.settings, &setting.Cfg{}, featuremgmt.WithFeatures())
			require.NoError(t, err)

			require.Equal(t, tc.want.allowedOrganizations, s.allowedOrganizations)
		})
	}
}

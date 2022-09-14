package social

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/stretchr/testify/require"
)

const (
	apiURI    = "/api/v4"
	userURI   = "/api/v4/user"
	groupsURI = "/api/v4/groups"

	gitlabAttrPath = `[login == root] && 'GrafanaAdmin' || contains(groups[*], 'admins') && 'Admin' || contains(groups[*], 'editors') && 'Editor' || contains(groups[*], 'viewers') && 'Viewer'`

	rootUserRespBody = `{"id":1,"username":"root","name":"Administrator","state":"active","email":"root@example.org","is_admin":true,"namespace_id":1}`

	adminGroup       = `{"id":4,"web_url":"http://grafana-gitlab.local/groups/admins","name":"Admins","path":"admins","project_creation_level":"developer","full_name":"Admins","full_path":"admins","created_at":"2022-09-13T19:38:04.891Z"}`
	editorGroup      = `{"id":5,"web_url":"http://grafana-gitlab.local/groups/editors","name":"Editors","path":"editors","project_creation_level":"developer","full_name":"Editors","full_path":"editors","created_at":"2022-09-13T19:38:15.074Z"}`
	viewerGroup      = `{"id":6,"web_url":"http://grafana-gitlab.local/groups/viewers","name":"Viewers","path":"viewers","project_creation_level":"developer","full_name":"Viewers","full_path":"viewers","created_at":"2022-09-13T19:38:25.777Z"}`
	serverAdminGroup = `{"id":7,"web_url":"http://grafana-gitlab.local/groups/serveradmins","name":"ServerAdmins","path":"serveradmins","project_creation_level":"developer","full_name":"ServerAdmins","full_path":"serveradmins","created_at":"2022-09-13T19:38:36.227Z"}`
)

func TestSocialGitlab_UserInfo(t *testing.T) {
	provider := SocialGitlab{
		SocialBase: &SocialBase{
			log: newLogger("gitlab_oauth_test", "debug"),
		},
	}

	tests := []struct {
		Name                    string
		AllowAssignGrafanaAdmin bool
		UserRespBody            string
		GroupsRespBody          string
		RoleAttributePath       string
		ExpectedLogin           string
		ExpectedEmail           string
		ExpectedRole            org.RoleType
		ExpectedGrafanaAdmin    *bool
	}{
		{
			Name:                    "Server Admin",
			AllowAssignGrafanaAdmin: true,
			UserRespBody:            rootUserRespBody,
			GroupsRespBody:          "[" + strings.Join([]string{adminGroup, editorGroup, viewerGroup, serverAdminGroup}, ",") + "]",
			RoleAttributePath:       gitlabAttrPath,
			ExpectedLogin:           "root",
			ExpectedEmail:           "root@example.org",
			ExpectedRole:            "Admin",
			ExpectedGrafanaAdmin:    trueBoolPtr(),
		},
	}

	for _, test := range tests {
		provider.roleAttributePath = test.RoleAttributePath
		provider.allowAssignGrafanaAdmin = test.AllowAssignGrafanaAdmin

		t.Run(test.Name, func(t *testing.T) {
			ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Header().Set("Content-Type", "application/json")
				switch r.RequestURI {
				case userURI:
					_, err := w.Write([]byte(test.UserRespBody))
					require.NoError(t, err)
				case groupsURI:
					_, err := w.Write([]byte(test.GroupsRespBody))
					require.NoError(t, err)
				default:
					w.WriteHeader(http.StatusNotFound)
				}
			}))
			provider.apiUrl = ts.URL + apiURI
			actualResult, err := provider.UserInfo(ts.Client(), nil)
			require.NoError(t, err)
			require.Equal(t, test.ExpectedEmail, actualResult.Email)
			require.Equal(t, test.ExpectedLogin, actualResult.Login)
			require.Equal(t, test.ExpectedRole, actualResult.Role)
			require.Equal(t, test.ExpectedGrafanaAdmin, actualResult.IsGrafanaAdmin)
		})
	}
}

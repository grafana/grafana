package social

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/org"
)

const (
	apiURI    = "/api/v4"
	userURI   = "/api/v4/user"
	groupsURI = "/api/v4/groups"

	gitlabAttrPath = `is_admin && 'GrafanaAdmin' || contains(groups[*], 'admins') && 'Admin' || contains(groups[*], 'editors') && 'Editor' || contains(groups[*], 'viewers') && 'Viewer'`

	rootUserRespBody   = `{"id":1,"username":"root","name":"Administrator","state":"active","email":"root@example.org","is_admin":true,"namespace_id":1}`
	editorUserRespBody = `{"id":3,"username":"gitlab-editor","name":"Gitlab Editor","state":"active","email":"gitlab-editor@example.org","is_admin":false,"namespace_id":1}`

	adminGroup  = `{"id":4,"web_url":"http://grafana-gitlab.local/groups/admins","name":"Admins","path":"admins","project_creation_level":"developer","full_name":"Admins","full_path":"admins","created_at":"2022-09-13T19:38:04.891Z"}`
	editorGroup = `{"id":5,"web_url":"http://grafana-gitlab.local/groups/editors","name":"Editors","path":"editors","project_creation_level":"developer","full_name":"Editors","full_path":"editors","created_at":"2022-09-13T19:38:15.074Z"}`
	viewerGroup = `{"id":6,"web_url":"http://grafana-gitlab.local/groups/viewers","name":"Viewers","path":"viewers","project_creation_level":"developer","full_name":"Viewers","full_path":"viewers","created_at":"2022-09-13T19:38:25.777Z"}`
	// serverAdminGroup = `{"id":7,"web_url":"http://grafana-gitlab.local/groups/serveradmins","name":"ServerAdmins","path":"serveradmins","project_creation_level":"developer","full_name":"ServerAdmins","full_path":"serveradmins","created_at":"2022-09-13T19:38:36.227Z"}`
)

func TestSocialGitlab_UserInfo(t *testing.T) {
	var nilPointer *bool
	provider := SocialGitlab{
		SocialBase: &SocialBase{
			log: newLogger("gitlab_oauth_test", "debug"),
		},
		skipOrgRoleSync: false,
	}

	type conf struct {
		AllowAssignGrafanaAdmin bool
		RoleAttributeStrict     bool
		AutoAssignOrgRole       org.RoleType
		SkipOrgRoleSync         bool
	}

	tests := []struct {
		Name                 string
		Cfg                  conf
		UserRespBody         string
		GroupsRespBody       string
		RoleAttributePath    string
		ExpectedLogin        string
		ExpectedEmail        string
		ExpectedRole         org.RoleType
		ExpectedGrafanaAdmin *bool
		ExpectedError        error
	}{
		{
			Name:                 "Server Admin Allowed",
			Cfg:                  conf{AllowAssignGrafanaAdmin: true},
			UserRespBody:         rootUserRespBody,
			GroupsRespBody:       "[" + strings.Join([]string{adminGroup, editorGroup, viewerGroup}, ",") + "]",
			RoleAttributePath:    gitlabAttrPath,
			ExpectedLogin:        "root",
			ExpectedEmail:        "root@example.org",
			ExpectedRole:         "Admin",
			ExpectedGrafanaAdmin: trueBoolPtr(),
		},
		{ // Edge case, user in Viewer Group, Server Admin disabled but attribute path contains a condition for Server Admin => User has the Admin role
			Name:              "Server Admin Disabled",
			Cfg:               conf{AllowAssignGrafanaAdmin: false},
			UserRespBody:      rootUserRespBody,
			GroupsRespBody:    "[" + strings.Join([]string{viewerGroup}, ",") + "]",
			RoleAttributePath: gitlabAttrPath,
			ExpectedLogin:     "root",
			ExpectedEmail:     "root@example.org",
			ExpectedRole:      "Admin",
		},
		{
			Name:                 "Editor",
			Cfg:                  conf{AllowAssignGrafanaAdmin: true},
			UserRespBody:         editorUserRespBody,
			GroupsRespBody:       "[" + strings.Join([]string{viewerGroup, editorGroup}, ",") + "]",
			RoleAttributePath:    gitlabAttrPath,
			ExpectedLogin:        "gitlab-editor",
			ExpectedEmail:        "gitlab-editor@example.org",
			ExpectedRole:         "Editor",
			ExpectedGrafanaAdmin: falseBoolPtr(),
		},
		{
			Name:                 "Should not sync role, return empty role and nil pointer for GrafanaAdmin for skip org role sync set to true",
			Cfg:                  conf{SkipOrgRoleSync: true},
			UserRespBody:         editorUserRespBody,
			GroupsRespBody:       "[" + strings.Join([]string{viewerGroup, editorGroup}, ",") + "]",
			RoleAttributePath:    gitlabAttrPath,
			ExpectedLogin:        "gitlab-editor",
			ExpectedEmail:        "gitlab-editor@example.org",
			ExpectedRole:         "",
			ExpectedGrafanaAdmin: nilPointer,
		},
		{ // Case that's going to change with Grafana 10
			Name:              "No fallback to default org role (will change in Grafana 10)",
			Cfg:               conf{AutoAssignOrgRole: org.RoleViewer},
			UserRespBody:      editorUserRespBody,
			GroupsRespBody:    "[" + strings.Join([]string{}, ",") + "]",
			RoleAttributePath: gitlabAttrPath,
			ExpectedLogin:     "gitlab-editor",
			ExpectedEmail:     "gitlab-editor@example.org",
			ExpectedRole:      "",
		},
		{
			Name:              "Strict mode prevents fallback to default",
			Cfg:               conf{RoleAttributeStrict: true, AutoAssignOrgRole: org.RoleViewer},
			UserRespBody:      editorUserRespBody,
			GroupsRespBody:    "[" + strings.Join([]string{}, ",") + "]",
			RoleAttributePath: gitlabAttrPath,
			ExpectedError:     &InvalidBasicRoleError{idP: "Gitlab"},
		},
		{ // Edge case, no match, no strict mode and no fallback => User has an empty role
			Name:              "Fallback with no default will create a user with an empty role",
			Cfg:               conf{},
			UserRespBody:      editorUserRespBody,
			GroupsRespBody:    "[" + strings.Join([]string{}, ",") + "]",
			RoleAttributePath: gitlabAttrPath,
			ExpectedLogin:     "gitlab-editor",
			ExpectedEmail:     "gitlab-editor@example.org",
			ExpectedRole:      "",
		},
		{ // Edge case, no attribute path with strict mode => User has an empty role
			Name:              "Strict mode with no attribute path",
			Cfg:               conf{RoleAttributeStrict: true, AutoAssignOrgRole: org.RoleViewer},
			UserRespBody:      editorUserRespBody,
			GroupsRespBody:    "[" + strings.Join([]string{editorGroup}, ",") + "]",
			RoleAttributePath: "",
			ExpectedError:     &InvalidBasicRoleError{idP: "Gitlab"},
		},
	}

	for _, test := range tests {
		provider.roleAttributePath = test.RoleAttributePath
		provider.allowAssignGrafanaAdmin = test.Cfg.AllowAssignGrafanaAdmin
		provider.autoAssignOrgRole = string(test.Cfg.AutoAssignOrgRole)
		provider.roleAttributeStrict = test.Cfg.RoleAttributeStrict
		provider.skipOrgRoleSync = test.Cfg.SkipOrgRoleSync

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
			if test.ExpectedError != nil {
				require.Equal(t, err, test.ExpectedError)
				return
			}

			require.NoError(t, err)
			require.Equal(t, test.ExpectedEmail, actualResult.Email)
			require.Equal(t, test.ExpectedLogin, actualResult.Login)
			require.Equal(t, test.ExpectedRole, actualResult.Role)
			require.Equal(t, test.ExpectedGrafanaAdmin, actualResult.IsGrafanaAdmin)
		})
	}
}

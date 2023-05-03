package api

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestOrgInvitesAPIEndpoint_RBAC(t *testing.T) {
	type testCase struct {
		desc         string
		body         string
		permissions  []accesscontrol.Permission
		expectedCode int
	}

	tests := []testCase{
		{
			desc: "should be able to invite user to org with correct permissions",
			body: `{"loginOrEmail": "new user", "role": "Viewer"}`,
			permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionOrgUsersAdd, Scope: "users:id:1"},
			},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "should not be able to invite user to org without correct permissions",
			body:         `{"loginOrEmail": "new user", "role": "Viewer"}`,
			permissions:  []accesscontrol.Permission{},
			expectedCode: http.StatusForbidden,
		},
		{
			desc: "should not be able to invite user to org with wrong scope",
			body: `{"loginOrEmail": "new user", "role": "Viewer"}`,
			permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionOrgUsersAdd, Scope: "users:id:2"},
			},
			expectedCode: http.StatusForbidden,
		},
		{
			desc: "should not be able to invite user to org with higher role then requester",
			body: `{"loginOrEmail": "new user", "role": "Admin"}`,
			permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionOrgUsersAdd, Scope: "users:id:1"},
			},
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.orgService = orgtest.NewOrgServiceFake()
				hs.userService = &usertest.FakeUserService{
					ExpectedUser: &user.User{ID: 1},
				}
			})

			req := webtest.RequestWithSignedInUser(server.NewPostRequest("/api/org/invites", strings.NewReader(tt.body)), userWithPermissions(1, tt.permissions))
			res, err := server.SendJSON(req)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

package api

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
)

func TestOrgInvitesAPIEndpointAccess(t *testing.T) {
	type accessControlTestCase2 struct {
		expectedCode int
		desc         string
		url          string
		method       string
		permissions  []accesscontrol.Permission
		input        string
	}
	tests := []accessControlTestCase2{
		{
			expectedCode: http.StatusOK,
			desc:         "org viewer with the correct permissions can invite an existing user to his org",
			url:          "/api/org/invites",
			method:       http.MethodPost,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersAdd, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"loginOrEmail": "` + testAdminOrg2.Login + `", "role": "` + string(models.ROLE_VIEWER) + `"}`,
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "org viewer with missing permissions cannot invite an existing user to his org",
			url:          "/api/org/invites",
			method:       http.MethodPost,
			permissions:  []accesscontrol.Permission{},
			input:        `{"loginOrEmail": "` + testAdminOrg2.Login + `", "role": "` + string(models.ROLE_VIEWER) + `"}`,
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "org viewer with the wrong scope cannot invite an existing user to his org",
			url:          "/api/org/invites",
			method:       http.MethodPost,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersAdd, Scope: "users:id:100"}},
			input:        `{"loginOrEmail": "` + testAdminOrg2.Login + `", "role": "` + string(models.ROLE_VIEWER) + `"}`,
		},
		{
			expectedCode: http.StatusOK,
			desc:         "org viewer with the correct permissions can invite a new user to his org",
			url:          "/api/org/invites",
			method:       http.MethodPost,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersAdd, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"loginOrEmail": "new user", "role": "` + string(models.ROLE_VIEWER) + `"}`,
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "org viewer with missing permissions cannot invite a new user to his org",
			url:          "/api/org/invites",
			method:       http.MethodPost,
			permissions:  []accesscontrol.Permission{},
			input:        `{"loginOrEmail": "new user", "role": "` + string(models.ROLE_VIEWER) + `"}`,
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			sc := setupHTTPServer(t, true, true)
			userService := usertest.NewUserServiceFake()
			userService.ExpectedUser = &user.User{ID: 2}
			sc.hs.userService = userService
			setInitCtxSignedInViewer(sc.initCtx)
			setupOrgUsersDBForAccessControlTests(t, sc.db)
			setAccessControlPermissions(sc.acmock, test.permissions, sc.initCtx.OrgId)

			input := strings.NewReader(test.input)
			response := callAPI(sc.server, test.method, test.url, input, t)
			assert.Equal(t, test.expectedCode, response.Code)
		})
	}
}

package api

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
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
			desc:         "org viewer with the correct permissions can invite and existing user to his org",
			url:          "/api/org/invites",
			method:       http.MethodPost,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersAdd, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"loginOrEmail": "` + testAdminOrg2.Login + `", "role": "` + string(models.ROLE_VIEWER) + `"}`,
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "org viewer with missing permissions cannot invite and existing user to his org",
			url:          "/api/org/invites",
			method:       http.MethodPost,
			permissions:  []accesscontrol.Permission{},
			input:        `{"loginOrEmail": "` + testAdminOrg2.Login + `", "role": "` + string(models.ROLE_VIEWER) + `"}`,
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "org viewer with the wrong scope cannot invite and existing user to his org",
			url:          "/api/org/invites",
			method:       http.MethodPost,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersAdd, Scope: "users:id:100"}},
			input:        `{"loginOrEmail": "` + testAdminOrg2.Login + `", "role": "` + string(models.ROLE_VIEWER) + `"}`,
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "org viewer with user add permission cannot invite a new user to his org",
			url:          "/api/org/invites",
			method:       http.MethodPost,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersAdd, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"loginOrEmail": "new user", "role": "` + string(models.ROLE_VIEWER) + `"}`,
		},
		{
			expectedCode: http.StatusOK,
			desc:         "org viewer with the correct permissions can invite a new user to his org",
			url:          "/api/org/invites",
			method:       http.MethodPost,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionUsersCreate}},
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
			setInitCtxSignedInViewer(sc.initCtx)
			setupOrgUsersDBForAccessControlTests(t, sc.db)
			setAccessControlPermissions(sc.acmock, test.permissions, sc.initCtx.OrgId)

			input := strings.NewReader(test.input)
			response := callAPI(sc.server, test.method, test.url, input, t)
			assert.Equal(t, test.expectedCode, response.Code)
		})
	}
}

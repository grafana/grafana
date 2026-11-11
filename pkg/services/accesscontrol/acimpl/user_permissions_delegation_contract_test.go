package acimpl

import (
	"errors"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationGetUserPermissions_ContractDelegationPrecedence(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	remoteError := errors.New("AuthZ unavailable")
	for _, route := range []struct {
		name                string
		single, api, remote bool
		orgID               int64
	}{
		{"delegated", true, true, true, 1},
		{"startup-api-disabled", true, false, false, 1},
		{"multi-org", false, true, false, 1},
		{"global-org", true, true, false, 0},
	} {
		t.Run(route.name, func(t *testing.T) {
			for _, response := range []struct {
				name        string
				permissions []ac.Permission
				err         error
				missing     bool
			}{
				{name: "permissions", permissions: []ac.Permission{{Action: "reports:read", Scope: "reports:*"}}},
				{name: "empty"},
				{name: "error", err: remoteError},
				{name: "missing-client", missing: true},
			} {
				t.Run(response.name, func(t *testing.T) {
					s := setupTestEnv(t, false)
					s.cfg.RBAC.SingleOrganization = route.single
					s.userPermissionsAPIEnabled = route.api
					localGrant := ac.Permission{Action: "dashboards:write", Scope: "dashboards:uid:local-only"}
					addContractUserGrant(t, s.sql, "managed:local-only", 0, 7, localGrant)
					client := &fakeUserPermissionsClient{permissions: response.permissions, err: response.err}
					if response.missing {
						s.SetUserPermissionsClient(nil)
					} else {
						s.SetUserPermissionsClient(client)
					}
					requester := &identity.StaticRequester{Type: types.TypeUser, UserID: 7, UserUID: "seven", OrgID: route.orgID}
					options := ac.Options{ReloadCache: true, SkipZanzanaCache: true}
					got, err := s.GetUserPermissions(t.Context(), requester, options)
					if !route.remote {
						require.NoError(t, err)
						require.ElementsMatch(t, []ac.Permission{SharedWithMeFolderPermission, localGrant}, rawPermissions(got))
						require.Zero(t, client.calls)
						return
					}
					if response.missing {
						require.ErrorContains(t, err, "AuthZ user permissions client is not configured")
						require.Empty(t, got)
						return
					}
					if response.err != nil {
						require.ErrorIs(t, err, remoteError)
						require.Empty(t, got)
					} else {
						require.NoError(t, err)
						require.Equal(t, response.permissions, got)
					}
					require.Equal(t, 1, client.calls)
					require.Same(t, requester, client.user)
					require.Equal(t, options, client.options)
				})
			}
		})
	}
}

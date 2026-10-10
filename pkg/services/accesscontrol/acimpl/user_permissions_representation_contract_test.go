package acimpl

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationGetUserPermissions_ContractRepresentation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, cache := range []bool{false, true} {
		t.Run(fmt.Sprintf("cache=%t", cache), func(t *testing.T) {
			s := setupTestEnv(t, false)
			s.cfg.RBAC.PermissionCache = cache
			resolver := s.actionResolver.(resourcepermissions.ActionSetService)
			resolver.StoreActionSet("folders:view", []string{"folders:read", "dashboards:read"})
			resolver.StoreActionSet("folders:inspect", []string{"folders:read"})
			for i, permission := range []accesscontrol.Permission{
				{Action: "users:create"},
				{Action: "dashboards:read", Scope: "*"},
				{Action: "dashboards:read", Scope: "dashboards:*"},
				{Action: "dashboards:read", Scope: "dashboards:uid:*"},
				{Action: "dashboards:read", Scope: "dashboards:uid:one"},
				{Action: "folders:view", Scope: "folders:uid:one"},
				{Action: "folders:inspect", Scope: "folders:uid:one"},
				{Action: "folders:read", Scope: "folders:uid:one"},
				{Action: "folders:unknown", Scope: "folders:uid:one"},
				{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
			} {
				addContractUserGrant(t, s.sql, fmt.Sprintf("managed:representation-%d", i), 1, 7, permission)
			}
			requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleNone}
			want := []accesscontrol.Permission{
				{Action: "users:create"},
				{Action: "dashboards:read", Scope: "*"},
				{Action: "dashboards:read", Scope: "dashboards:*"},
				{Action: "dashboards:read", Scope: "dashboards:uid:*"},
				{Action: "dashboards:read", Scope: "dashboards:uid:one"},
				{Action: "folders:read", Scope: "folders:uid:one"},
				{Action: "dashboards:read", Scope: "folders:uid:one"},
				{Action: "folders:read", Scope: "folders:uid:one"},
				{Action: "folders:read", Scope: "folders:uid:one"},
				{Action: "folders:unknown", Scope: "folders:uid:one"},
				{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
				{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
			}
			check := func(options accesscontrol.Options, expected []accesscontrol.Permission) {
				t.Helper()
				got, err := s.GetUserPermissions(context.Background(), requester, options)
				require.NoError(t, err)
				require.ElementsMatch(t, expected, got)
			}
			check(accesscontrol.Options{}, want)
			// Plugin registration can extend an existing action set after a user's
			// expanded permissions have already been cached.
			resolver.StoreActionSet("folders:view", []string{"contract-app:read"})
			extended := append(append([]accesscontrol.Permission{}, want...), accesscontrol.Permission{Action: "contract-app:read", Scope: "folders:uid:one"})
			if cache {
				check(accesscontrol.Options{}, want)
			} else {
				check(accesscontrol.Options{}, extended)
			}
			check(accesscontrol.Options{ReloadCache: true}, extended)
			check(accesscontrol.Options{}, extended)
		})
	}
}

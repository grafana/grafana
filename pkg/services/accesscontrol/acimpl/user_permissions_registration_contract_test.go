package acimpl

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationGetUserPermissions_ContractRegistrations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, cache := range []bool{false, true} {
		t.Run(fmt.Sprintf("cache=%t", cache), func(t *testing.T) {
			s := setupTestEnv(t, false)
			s.cfg.RBAC.PermissionCache = cache
			ctx := context.Background()
			requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleViewer}
			baseline := accesscontrol.Permission{Action: "folders:read", Scope: "folders:uid:sharedwithme"}
			fixed := accesscontrol.Permission{Action: "users:create"}
			plugin := accesscontrol.Permission{Action: "contract-app:read", Scope: "contract-app:*"}
			check := func(options accesscontrol.Options, want []accesscontrol.Permission) {
				t.Helper()
				got, err := s.GetUserPermissions(ctx, requester, options)
				require.NoError(t, err)
				raw := make([]accesscontrol.Permission, len(got))
				for i := range got {
					raw[i] = accesscontrol.Permission{Action: got[i].Action, Scope: got[i].Scope}
				}
				require.ElementsMatch(t, want, raw)
			}
			require.NoError(t, s.DeclareFixedRoles(accesscontrol.RoleRegistration{
				Role:   accesscontrol.RoleDTO{Name: "fixed:contract:reader", Permissions: []accesscontrol.Permission{fixed}},
				Grants: []string{"Viewer"},
			}))
			check(accesscontrol.Options{}, []accesscontrol.Permission{baseline})
			require.NoError(t, s.RegisterFixedRoles(ctx))
			check(accesscontrol.Options{ReloadCache: true}, []accesscontrol.Permission{baseline, fixed})
			require.NoError(t, s.DeclarePluginRoles(ctx, "contract-app", "Contract", []plugins.RoleRegistration{{
				Role:   plugins.Role{Name: "Reader", Permissions: []plugins.Permission{{Action: plugin.Action, Scope: plugin.Scope}}},
				Grants: []string{"Viewer"},
			}}))
			check(accesscontrol.Options{}, []accesscontrol.Permission{baseline, fixed, plugin})
			check(accesscontrol.Options{ReloadCache: true}, []accesscontrol.Permission{baseline, fixed, plugin})
		})
	}
}

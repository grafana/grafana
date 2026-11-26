package acimpl

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationManagedPermissionFiltering(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, enabled := range []bool{false, true} {
		for _, cached := range []bool{false, true} {
			for _, route := range []string{"local", "loader", "embedded"} {
				t.Run(fmt.Sprintf("flag=%t/cache=%t/%s", enabled, cached, route), func(t *testing.T) {
					// Each route and decision starts cold so shared cache entries cannot hide a mismatch.
					s := setupTestEnv(t, false)
					s.cfg.RBAC.PermissionCache = cached
					s.features = featuremgmt.WithFeatures(featuremgmt.FlagExcludeRedundantManagedPermissions, enabled)
					s.actionResolver.(resourcepermissions.ActionSetService).StoreActionSet("dashboards:view", []string{"dashboards:read"})

					const userID = 7
					const teamID = 11
					requester := &user.SignedInUser{UserID: userID, UserUID: "seven", OrgID: accesscontrol.GlobalOrgID, OrgRole: org.RoleNone}
					requester.TeamIDs = []int64{teamID} //nolint:staticcheck // Legacy permission queries use numeric team memberships.
					for _, grant := range []struct{ action, scope string }{
						{"dashboards:read", "dashboards:uid:individual"},
						{"dashboards:view", "dashboards:uid:action-set"},
					} {
						addContractUserGrant(t, s.sql, fmt.Sprintf("managed:%s", grant.action), requester.OrgID, userID,
							accesscontrol.Permission{Action: grant.action, Scope: grant.scope, Kind: "dashboards"})
					}
					addContractUserGrant(t, s.sql, "managed:team", requester.OrgID, userID+1,
						accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:team", Kind: "dashboards"})

					require.NoError(t, s.sql.WithDbSession(t.Context(), func(sess *db.Session) error {
						var role accesscontrol.Role
						found, err := sess.Where("name = ?", "managed:team").Get(&role)
						if err != nil {
							return err
						}
						if !found {
							return fmt.Errorf("managed team role was not created")
						}
						_, err = sess.Insert(&accesscontrol.TeamRole{OrgID: requester.OrgID, TeamID: teamID, RoleID: role.ID, Created: time.Now()})
						return err
					}))

					ctx := t.Context()
					var got []accesscontrol.Permission
					var err error
					switch route {
					case "local":
						got, err = s.GetLocalUserPermissions(ctx, requester, accesscontrol.Options{})
					case "loader":
						got, err = newContractLoader(s, localcache.New(0, 0)).GetUserPermissions(ctx, requester, accesscontrol.Options{})
					case "embedded":
						client := legacypermissions.NewEmbeddedClient(newContractLoader(s, localcache.New(0, 0)), s.cfg)
						got, err = GetLegacyUserPermissions(ctx, client, requester, accesscontrol.Options{}, s.cfg)
					}
					require.NoError(t, err)

					want := []accesscontrol.Permission{SharedWithMeFolderPermission, {Action: "dashboards:read", Scope: "dashboards:uid:action-set"}}
					if !enabled {
						want = append(want, accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:individual"}, accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:team"})
					}
					require.ElementsMatch(t, want, rawPermissions(got))
				})
			}
		}
	}
}

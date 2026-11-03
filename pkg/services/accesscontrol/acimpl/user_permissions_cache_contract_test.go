package acimpl

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationGetUserPermissions_ContractDirectCache(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, cache := range []bool{false, true} {
		for _, refresh := range []struct {
			name    string
			clear   bool
			options accesscontrol.Options
		}{
			{name: "reload", options: accesscontrol.Options{ReloadCache: true}},
			{name: "clear", clear: true},
			{name: "skip-zanzana", options: accesscontrol.Options{SkipZanzanaCache: true}},
			{name: "reload-and-skip-zanzana", options: accesscontrol.Options{ReloadCache: true, SkipZanzanaCache: true}},
		} {
			t.Run(fmt.Sprintf("cache=%t/%s", cache, refresh.name), func(t *testing.T) {
				s := setupTestEnv(t, false)
				s.cfg.RBAC.PermissionCache = cache
				ctx := context.Background()
				requester := &user.SignedInUser{UserID: 7, UserUID: "user-seven", OrgID: 1, OrgRole: org.RoleNone}
				addContractUserGrant(t, s.sql, "managed:changing", 1, 7,
					accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:a"})
				assertScope := func(options accesscontrol.Options, scope string) {
					t.Helper()
					got, err := s.GetUserPermissions(ctx, requester, options)
					require.NoError(t, err)
					require.ElementsMatch(t, []accesscontrol.Permission{
						{Action: "dashboards:read", Scope: scope},
						{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
					}, got)
				}
				assertScope(accesscontrol.Options{}, "dashboards:uid:a")
				// Change the source without invoking a mutation's invalidation, to
				// distinguish cache reads from explicit refresh behavior.
				require.NoError(t, s.sql.WithDbSession(ctx, func(sess *db.Session) error {
					_, err := sess.Exec("UPDATE permission SET scope = ? WHERE scope = ?", "dashboards:uid:b", "dashboards:uid:a")
					return err
				}))
				want := "dashboards:uid:b"
				if cache {
					want = "dashboards:uid:a"
				}
				assertScope(accesscontrol.Options{}, want)
				if refresh.clear {
					s.ClearUserPermissionCache(requester)
				}
				if refresh.clear || refresh.options.ReloadCache {
					want = "dashboards:uid:b"
				}
				assertScope(refresh.options, want)
				assertScope(accesscontrol.Options{}, want)
			})
		}
	}
}

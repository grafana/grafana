package acimpl

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationGetUserPermissions_ContractFailedRefresh(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, cache := range []bool{false, true} {
		t.Run(fmt.Sprintf("cache=%t", cache), func(t *testing.T) {
			s := setupTestEnv(t, false)
			s.cfg.RBAC.PermissionCache = cache
			seedContractSources(t, s.sql)
			requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleViewer, TeamIDs: []int64{10}} //nolint:staticcheck // Exercise failure handling for numeric legacy RBAC memberships.
			want := []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:shared"},
				{Action: "dashboards:read", Scope: "dashboards:uid:shared"},
				{Action: "dashboards:read", Scope: "dashboards:uid:shared"},
				{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
			}
			got, err := s.GetUserPermissions(context.Background(), requester, accesscontrol.Options{})
			require.NoError(t, err)
			require.ElementsMatch(t, want, got)
			ctx, cancel := context.WithCancel(context.Background())
			cancel()
			got, err = s.GetUserPermissions(ctx, requester, accesscontrol.Options{ReloadCache: true})
			require.ErrorIs(t, err, context.Canceled)
			require.Empty(t, got, "a failed legacy load must not return partial grants")
			for _, options := range []accesscontrol.Options{{}, {ReloadCache: true}, {}} {
				got, err = s.GetUserPermissions(context.Background(), requester, options)
				require.NoError(t, err)
				require.ElementsMatch(t, want, got)
			}
		})
	}
}

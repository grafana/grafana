package acimpl

import (
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationGetUserPermissions_ContractConcurrentIsolation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	s := setupTestEnv(t, false)
	s.cfg.RBAC.PermissionCache = true
	seedContractSources(t, s.sql)
	baseline := accesscontrol.Permission{Action: "folders:read", Scope: "folders:uid:sharedwithme"}
	grant := accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:shared"}
	cases := []struct {
		requester user.SignedInUser
		want      []accesscontrol.Permission
	}{
		{user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleViewer, TeamIDs: []int64{10}}, []accesscontrol.Permission{baseline, grant, grant, grant}}, //nolint:staticcheck // Exercise numeric legacy RBAC memberships, not contextual team UIDs.
		{user.SignedInUser{UserID: 8, OrgID: 1, OrgRole: org.RoleNone}, []accesscontrol.Permission{baseline}},
		{user.SignedInUser{UserID: 7, OrgID: 3, OrgRole: org.RoleViewer}, []accesscontrol.Permission{baseline}},
	}
	for _, phase := range []string{"cold", "warm"} {
		t.Run(phase, func(t *testing.T) {
			const workers = 24
			results := make([][]accesscontrol.Permission, workers)
			errs := make([]error, workers)
			var ready, done sync.WaitGroup
			ready.Add(workers)
			done.Add(workers)
			start := make(chan struct{})
			for i := range workers {
				go func() {
					defer done.Done()
					ready.Done()
					<-start
					results[i], errs[i] = s.GetUserPermissions(context.Background(), &cases[i%len(cases)].requester, accesscontrol.Options{})
				}()
			}
			ready.Wait()
			close(start)
			done.Wait()
			for i := range workers {
				require.NoError(t, errs[i])
				require.ElementsMatch(t, cases[i%len(cases)].want, results[i])
			}
		})
	}
}

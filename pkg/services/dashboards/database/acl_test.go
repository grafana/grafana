package database

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
)

func TestIntegrationDashboardACLDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore *sqlstore.SQLStore
	var currentUser user.User
	var savedFolder, childDash *dashboards.Dashboard
	var dashboardStore dashboards.Store

	setup := func(t *testing.T) int64 {
		sqlStore = db.InitTestDB(t)
		quotaService := quotatest.New(false, nil)
		var err error
		dashboardStore, err = ProvideDashboardStore(sqlStore, sqlStore.Cfg, testFeatureToggles, tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
		require.NoError(t, err)
		currentUser = createUser(t, sqlStore, "viewer", "Viewer", false)
		savedFolder = insertTestDashboard(t, dashboardStore, "1 test dash folder", 1, 0, true, "prod", "webapp")
		childDash = insertTestDashboard(t, dashboardStore, "2 test dash", 1, savedFolder.ID, false, "prod", "webapp")
		return currentUser.OrgID
	}

	t.Run("Dashboard permission with userId and teamId set to 0", func(t *testing.T) {
		orgID := setup(t)
		err := updateDashboardACL(t, dashboardStore, savedFolder.ID, dashboards.DashboardACL{
			OrgID:       orgID,
			DashboardID: savedFolder.ID,
			Permission:  dashboards.PERMISSION_EDIT,
		})
		require.Equal(t, dashboards.ErrDashboardACLInfoMissing, err)
	})

	t.Run("Folder acl should include default acl", func(t *testing.T) {
		orgID := setup(t)
		query := dashboards.GetDashboardACLInfoListQuery{DashboardID: savedFolder.ID, OrgID: orgID}

		queryResult, err := dashboardStore.GetDashboardACLInfoList(context.Background(), &query)
		require.Nil(t, err)

		require.Equal(t, 2, len(queryResult))
		defaultPermissionsId := int64(-1)
		require.Equal(t, defaultPermissionsId, queryResult[0].DashboardID)
		require.Equal(t, org.RoleViewer, *queryResult[0].Role)
		require.False(t, queryResult[0].Inherited)
		require.Equal(t, defaultPermissionsId, queryResult[1].DashboardID)
		require.Equal(t, org.RoleEditor, *queryResult[1].Role)
		require.False(t, queryResult[1].Inherited)
	})

	t.Run("Dashboard acl should include acl for parent folder", func(t *testing.T) {
		orgID := setup(t)
		query := dashboards.GetDashboardACLInfoListQuery{DashboardID: childDash.ID, OrgID: orgID}

		queryResult, err := dashboardStore.GetDashboardACLInfoList(context.Background(), &query)
		require.Nil(t, err)

		require.Equal(t, 2, len(queryResult))
		defaultPermissionsId := int64(-1)
		require.Equal(t, defaultPermissionsId, queryResult[0].DashboardID)
		require.Equal(t, org.RoleViewer, *queryResult[0].Role)
		require.True(t, queryResult[0].Inherited)
		require.Equal(t, defaultPermissionsId, queryResult[1].DashboardID)
		require.Equal(t, org.RoleEditor, *queryResult[1].Role)
		require.True(t, queryResult[1].Inherited)
	})

	t.Run("Folder with removed default permissions returns no acl items", func(t *testing.T) {
		orgID := setup(t)
		err := dashboardStore.UpdateDashboardACL(context.Background(), savedFolder.ID, nil)
		require.Nil(t, err)

		query := dashboards.GetDashboardACLInfoListQuery{DashboardID: childDash.ID, OrgID: orgID}
		queryResult, err := dashboardStore.GetDashboardACLInfoList(context.Background(), &query)
		require.Nil(t, err)

		require.Equal(t, 0, len(queryResult))
	})

	t.Run("Given a dashboard folder and a user", func(t *testing.T) {
		t.Run("Given dashboard folder permission", func(t *testing.T) {
			orgID := setup(t)
			err := updateDashboardACL(t, dashboardStore, savedFolder.ID, dashboards.DashboardACL{
				OrgID:       orgID,
				UserID:      currentUser.ID,
				DashboardID: savedFolder.ID,
				Permission:  dashboards.PERMISSION_EDIT,
			})
			require.Nil(t, err)

			t.Run("When reading dashboard acl should include acl for parent folder", func(t *testing.T) {
				query := dashboards.GetDashboardACLInfoListQuery{DashboardID: childDash.ID, OrgID: orgID}

				queryResult, err := dashboardStore.GetDashboardACLInfoList(context.Background(), &query)
				require.Nil(t, err)

				require.Equal(t, 1, len(queryResult))
				require.Equal(t, savedFolder.ID, queryResult[0].DashboardID)
			})

			t.Run("Given child dashboard permission", func(t *testing.T) {
				err := updateDashboardACL(t, dashboardStore, childDash.ID, dashboards.DashboardACL{
					OrgID:       orgID,
					UserID:      currentUser.ID,
					DashboardID: childDash.ID,
					Permission:  dashboards.PERMISSION_EDIT,
				})
				require.Nil(t, err)

				t.Run("When reading dashboard acl should include acl for parent folder and child", func(t *testing.T) {
					query := dashboards.GetDashboardACLInfoListQuery{OrgID: orgID, DashboardID: childDash.ID}

					queryResult, err := dashboardStore.GetDashboardACLInfoList(context.Background(), &query)
					require.Nil(t, err)

					require.Equal(t, 2, len(queryResult))
					require.Equal(t, savedFolder.ID, queryResult[0].DashboardID)
					require.True(t, queryResult[0].Inherited)
					require.Equal(t, childDash.ID, queryResult[1].DashboardID)
					require.False(t, queryResult[1].Inherited)
				})
			})
		})

		t.Run("Reading dashboard acl should include default acl for parent folder and the child acl", func(t *testing.T) {
			orgID := setup(t)
			err := updateDashboardACL(t, dashboardStore, childDash.ID, dashboards.DashboardACL{
				OrgID:       1,
				UserID:      currentUser.ID,
				DashboardID: childDash.ID,
				Permission:  dashboards.PERMISSION_EDIT,
			})
			require.Nil(t, err)

			query := dashboards.GetDashboardACLInfoListQuery{OrgID: orgID, DashboardID: childDash.ID}

			queryResult, err := dashboardStore.GetDashboardACLInfoList(context.Background(), &query)
			require.Nil(t, err)

			defaultPermissionsId := int64(-1)
			require.Equal(t, 3, len(queryResult))
			require.Equal(t, defaultPermissionsId, queryResult[0].DashboardID)
			require.Equal(t, org.RoleViewer, *queryResult[0].Role)
			require.True(t, queryResult[0].Inherited)
			require.Equal(t, defaultPermissionsId, queryResult[1].DashboardID)
			require.Equal(t, org.RoleEditor, *queryResult[1].Role)
			require.True(t, queryResult[1].Inherited)
			require.Equal(t, childDash.ID, queryResult[2].DashboardID)
			require.False(t, queryResult[2].Inherited)
		})

		t.Run("Add and delete dashboard permission", func(t *testing.T) {
			orgID := setup(t)
			err := updateDashboardACL(t, dashboardStore, savedFolder.ID, dashboards.DashboardACL{
				OrgID:       1,
				UserID:      currentUser.ID,
				DashboardID: savedFolder.ID,
				Permission:  dashboards.PERMISSION_EDIT,
			})
			require.Nil(t, err)

			q1 := &dashboards.GetDashboardACLInfoListQuery{DashboardID: savedFolder.ID, OrgID: orgID}
			q1Result, err := dashboardStore.GetDashboardACLInfoList(context.Background(), q1)
			require.Nil(t, err)

			require.Equal(t, savedFolder.ID, q1Result[0].DashboardID)
			require.Equal(t, dashboards.PERMISSION_EDIT, q1Result[0].Permission)
			require.Equal(t, "Edit", q1Result[0].PermissionName)
			require.Equal(t, currentUser.ID, q1Result[0].UserID)
			require.Equal(t, currentUser.Login, q1Result[0].UserLogin)
			require.Equal(t, currentUser.Email, q1Result[0].UserEmail)

			err = updateDashboardACL(t, dashboardStore, savedFolder.ID)
			require.Nil(t, err)

			q3 := &dashboards.GetDashboardACLInfoListQuery{DashboardID: savedFolder.ID, OrgID: orgID}
			q3Result, err := dashboardStore.GetDashboardACLInfoList(context.Background(), q3)
			require.Nil(t, err)
			require.Equal(t, 0, len(q3Result))
		})

		t.Run("Should be able to add a user permission for a team", func(t *testing.T) {
			orgID := setup(t)
			teamSvc := teamimpl.ProvideService(sqlStore, sqlStore.Cfg)
			team1, err := teamSvc.CreateTeam("group1 name", "", 1)
			require.Nil(t, err)

			err = updateDashboardACL(t, dashboardStore, savedFolder.ID, dashboards.DashboardACL{
				OrgID:       1,
				TeamID:      team1.ID,
				DashboardID: savedFolder.ID,
				Permission:  dashboards.PERMISSION_EDIT,
			})
			require.Nil(t, err)

			q1 := &dashboards.GetDashboardACLInfoListQuery{DashboardID: savedFolder.ID, OrgID: orgID}
			q1Result, err := dashboardStore.GetDashboardACLInfoList(context.Background(), q1)
			require.Nil(t, err)
			require.Equal(t, savedFolder.ID, q1Result[0].DashboardID)
			require.Equal(t, dashboards.PERMISSION_EDIT, q1Result[0].Permission)
			require.Equal(t, team1.ID, q1Result[0].TeamID)
		})

		t.Run("Should be able to update an existing permission for a team", func(t *testing.T) {
			orgID := setup(t)
			teamSvc := teamimpl.ProvideService(sqlStore, sqlStore.Cfg)
			team1, err := teamSvc.CreateTeam("group1 name", "", 1)
			require.Nil(t, err)
			err = updateDashboardACL(t, dashboardStore, savedFolder.ID, dashboards.DashboardACL{
				OrgID:       1,
				TeamID:      team1.ID,
				DashboardID: savedFolder.ID,
				Permission:  dashboards.PERMISSION_ADMIN,
			})
			require.Nil(t, err)

			q3 := &dashboards.GetDashboardACLInfoListQuery{DashboardID: savedFolder.ID, OrgID: orgID}
			q3Result, err := dashboardStore.GetDashboardACLInfoList(context.Background(), q3)
			require.Nil(t, err)
			require.Equal(t, 1, len(q3Result))
			require.Equal(t, savedFolder.ID, q3Result[0].DashboardID)
			require.Equal(t, dashboards.PERMISSION_ADMIN, q3Result[0].Permission)
			require.Equal(t, team1.ID, q3Result[0].TeamID)
		})
	})

	t.Run("Default permissions for root folder dashboards", func(t *testing.T) {
		orgID := setup(t)
		var rootFolderId int64 = 0
		//sqlStore := db.InitTestDB(t)

		query := dashboards.GetDashboardACLInfoListQuery{DashboardID: rootFolderId, OrgID: orgID}

		queryResult, err := dashboardStore.GetDashboardACLInfoList(context.Background(), &query)
		require.Nil(t, err)

		require.Equal(t, 2, len(queryResult))
		defaultPermissionsId := int64(-1)
		require.Equal(t, defaultPermissionsId, queryResult[0].DashboardID)
		require.Equal(t, org.RoleViewer, *queryResult[0].Role)
		require.False(t, queryResult[0].Inherited)
		require.Equal(t, defaultPermissionsId, queryResult[1].DashboardID)
		require.Equal(t, org.RoleEditor, *queryResult[1].Role)
		require.False(t, queryResult[1].Inherited)
	})

	t.Run("Delete acl by user", func(t *testing.T) {
		setup(t)
		err := dashboardStore.DeleteACLByUser(context.Background(), currentUser.ID)
		require.NoError(t, err)
	})
}

func createUser(t *testing.T, sqlStore *sqlstore.SQLStore, name string, role string, isAdmin bool) user.User {
	t.Helper()
	sqlStore.Cfg.AutoAssignOrg = true
	sqlStore.Cfg.AutoAssignOrgId = 1
	sqlStore.Cfg.AutoAssignOrgRole = role

	qs := quotaimpl.ProvideService(sqlStore, sqlStore.Cfg)
	orgService, err := orgimpl.ProvideService(sqlStore, sqlStore.Cfg, qs)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(sqlStore, orgService, sqlStore.Cfg, nil, nil, qs, &usagestats.UsageStatsMock{}, supportbundlestest.NewFakeBundleService())
	require.NoError(t, err)

	o, err := orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: fmt.Sprintf("test org %d", time.Now().UnixNano())})
	require.NoError(t, err)

	currentUserCmd := user.CreateUserCommand{Login: name, Email: name + "@test.com", Name: "a " + name, IsAdmin: isAdmin, OrgID: o.ID}
	currentUser, err := usrSvc.Create(context.Background(), &currentUserCmd)
	require.NoError(t, err)
	orgs, err := orgService.GetUserOrgList(context.Background(), &org.GetUserOrgListQuery{UserID: currentUser.ID})
	require.NoError(t, err)
	require.Equal(t, org.RoleType(role), orgs[0].Role)
	require.Equal(t, o.ID, orgs[0].OrgID)
	return *currentUser
}

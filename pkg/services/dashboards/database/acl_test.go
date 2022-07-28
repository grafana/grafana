package database

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

func TestIntegrationDashboardACLDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore *sqlstore.SQLStore
	var currentUser user.User
	var savedFolder, childDash *models.Dashboard
	var dashboardStore *DashboardStore

	setup := func(t *testing.T) {
		sqlStore = sqlstore.InitTestDB(t)
		dashboardStore = ProvideDashboardStore(sqlStore)
		currentUser = createUser(t, sqlStore, "viewer", "Viewer", false)
		savedFolder = insertTestDashboard(t, dashboardStore, "1 test dash folder", 1, 0, true, "prod", "webapp")
		childDash = insertTestDashboard(t, dashboardStore, "2 test dash", 1, savedFolder.Id, false, "prod", "webapp")
	}

	t.Run("Dashboard permission with userId and teamId set to 0", func(t *testing.T) {
		setup(t)
		err := updateDashboardACL(t, dashboardStore, savedFolder.Id, models.DashboardACL{
			OrgID:       1,
			DashboardID: savedFolder.Id,
			Permission:  models.PERMISSION_EDIT,
		})
		require.Equal(t, models.ErrDashboardACLInfoMissing, err)
	})

	t.Run("Folder acl should include default acl", func(t *testing.T) {
		setup(t)
		query := models.GetDashboardACLInfoListQuery{DashboardID: savedFolder.Id, OrgID: 1}

		err := dashboardStore.GetDashboardACLInfoList(context.Background(), &query)
		require.Nil(t, err)

		require.Equal(t, 2, len(query.Result))
		defaultPermissionsId := int64(-1)
		require.Equal(t, defaultPermissionsId, query.Result[0].DashboardId)
		require.Equal(t, models.ROLE_VIEWER, *query.Result[0].Role)
		require.False(t, query.Result[0].Inherited)
		require.Equal(t, defaultPermissionsId, query.Result[1].DashboardId)
		require.Equal(t, models.ROLE_EDITOR, *query.Result[1].Role)
		require.False(t, query.Result[1].Inherited)
	})

	t.Run("Dashboard acl should include acl for parent folder", func(t *testing.T) {
		setup(t)
		query := models.GetDashboardACLInfoListQuery{DashboardID: childDash.Id, OrgID: 1}

		err := dashboardStore.GetDashboardACLInfoList(context.Background(), &query)
		require.Nil(t, err)

		require.Equal(t, 2, len(query.Result))
		defaultPermissionsId := int64(-1)
		require.Equal(t, defaultPermissionsId, query.Result[0].DashboardId)
		require.Equal(t, models.ROLE_VIEWER, *query.Result[0].Role)
		require.True(t, query.Result[0].Inherited)
		require.Equal(t, defaultPermissionsId, query.Result[1].DashboardId)
		require.Equal(t, models.ROLE_EDITOR, *query.Result[1].Role)
		require.True(t, query.Result[1].Inherited)
	})

	t.Run("Folder with removed default permissions returns no acl items", func(t *testing.T) {
		setup(t)
		err := dashboardStore.UpdateDashboardACL(context.Background(), savedFolder.Id, nil)
		require.Nil(t, err)

		query := models.GetDashboardACLInfoListQuery{DashboardID: childDash.Id, OrgID: 1}
		err = dashboardStore.GetDashboardACLInfoList(context.Background(), &query)
		require.Nil(t, err)

		require.Equal(t, 0, len(query.Result))
	})

	t.Run("Given a dashboard folder and a user", func(t *testing.T) {
		t.Run("Given dashboard folder permission", func(t *testing.T) {
			setup(t)
			err := updateDashboardACL(t, dashboardStore, savedFolder.Id, models.DashboardACL{
				OrgID:       1,
				UserID:      currentUser.ID,
				DashboardID: savedFolder.Id,
				Permission:  models.PERMISSION_EDIT,
			})
			require.Nil(t, err)

			t.Run("When reading dashboard acl should include acl for parent folder", func(t *testing.T) {
				query := models.GetDashboardACLInfoListQuery{DashboardID: childDash.Id, OrgID: 1}

				err := dashboardStore.GetDashboardACLInfoList(context.Background(), &query)
				require.Nil(t, err)

				require.Equal(t, 1, len(query.Result))
				require.Equal(t, savedFolder.Id, query.Result[0].DashboardId)
			})

			t.Run("Given child dashboard permission", func(t *testing.T) {
				err := updateDashboardACL(t, dashboardStore, childDash.Id, models.DashboardACL{
					OrgID:       1,
					UserID:      currentUser.ID,
					DashboardID: childDash.Id,
					Permission:  models.PERMISSION_EDIT,
				})
				require.Nil(t, err)

				t.Run("When reading dashboard acl should include acl for parent folder and child", func(t *testing.T) {
					query := models.GetDashboardACLInfoListQuery{OrgID: 1, DashboardID: childDash.Id}

					err := dashboardStore.GetDashboardACLInfoList(context.Background(), &query)
					require.Nil(t, err)

					require.Equal(t, 2, len(query.Result))
					require.Equal(t, savedFolder.Id, query.Result[0].DashboardId)
					require.True(t, query.Result[0].Inherited)
					require.Equal(t, childDash.Id, query.Result[1].DashboardId)
					require.False(t, query.Result[1].Inherited)
				})
			})
		})

		t.Run("Reading dashboard acl should include default acl for parent folder and the child acl", func(t *testing.T) {
			setup(t)
			err := updateDashboardACL(t, dashboardStore, childDash.Id, models.DashboardACL{
				OrgID:       1,
				UserID:      currentUser.ID,
				DashboardID: childDash.Id,
				Permission:  models.PERMISSION_EDIT,
			})
			require.Nil(t, err)

			query := models.GetDashboardACLInfoListQuery{OrgID: 1, DashboardID: childDash.Id}

			err = dashboardStore.GetDashboardACLInfoList(context.Background(), &query)
			require.Nil(t, err)

			defaultPermissionsId := int64(-1)
			require.Equal(t, 3, len(query.Result))
			require.Equal(t, defaultPermissionsId, query.Result[0].DashboardId)
			require.Equal(t, models.ROLE_VIEWER, *query.Result[0].Role)
			require.True(t, query.Result[0].Inherited)
			require.Equal(t, defaultPermissionsId, query.Result[1].DashboardId)
			require.Equal(t, models.ROLE_EDITOR, *query.Result[1].Role)
			require.True(t, query.Result[1].Inherited)
			require.Equal(t, childDash.Id, query.Result[2].DashboardId)
			require.False(t, query.Result[2].Inherited)
		})

		t.Run("Add and delete dashboard permission", func(t *testing.T) {
			setup(t)
			err := updateDashboardACL(t, dashboardStore, savedFolder.Id, models.DashboardACL{
				OrgID:       1,
				UserID:      currentUser.ID,
				DashboardID: savedFolder.Id,
				Permission:  models.PERMISSION_EDIT,
			})
			require.Nil(t, err)

			q1 := &models.GetDashboardACLInfoListQuery{DashboardID: savedFolder.Id, OrgID: 1}
			err = dashboardStore.GetDashboardACLInfoList(context.Background(), q1)
			require.Nil(t, err)

			require.Equal(t, savedFolder.Id, q1.Result[0].DashboardId)
			require.Equal(t, models.PERMISSION_EDIT, q1.Result[0].Permission)
			require.Equal(t, "Edit", q1.Result[0].PermissionName)
			require.Equal(t, currentUser.ID, q1.Result[0].UserId)
			require.Equal(t, currentUser.Login, q1.Result[0].UserLogin)
			require.Equal(t, currentUser.Email, q1.Result[0].UserEmail)

			err = updateDashboardACL(t, dashboardStore, savedFolder.Id)
			require.Nil(t, err)

			q3 := &models.GetDashboardACLInfoListQuery{DashboardID: savedFolder.Id, OrgID: 1}
			err = dashboardStore.GetDashboardACLInfoList(context.Background(), q3)
			require.Nil(t, err)
			require.Equal(t, 0, len(q3.Result))
		})

		t.Run("Should be able to add a user permission for a team", func(t *testing.T) {
			setup(t)
			team1, err := sqlStore.CreateTeam("group1 name", "", 1)
			require.Nil(t, err)

			err = updateDashboardACL(t, dashboardStore, savedFolder.Id, models.DashboardACL{
				OrgID:       1,
				TeamID:      team1.Id,
				DashboardID: savedFolder.Id,
				Permission:  models.PERMISSION_EDIT,
			})
			require.Nil(t, err)

			q1 := &models.GetDashboardACLInfoListQuery{DashboardID: savedFolder.Id, OrgID: 1}
			err = dashboardStore.GetDashboardACLInfoList(context.Background(), q1)
			require.Nil(t, err)
			require.Equal(t, savedFolder.Id, q1.Result[0].DashboardId)
			require.Equal(t, models.PERMISSION_EDIT, q1.Result[0].Permission)
			require.Equal(t, team1.Id, q1.Result[0].TeamId)
		})

		t.Run("Should be able to update an existing permission for a team", func(t *testing.T) {
			setup(t)
			team1, err := sqlStore.CreateTeam("group1 name", "", 1)
			require.Nil(t, err)
			err = updateDashboardACL(t, dashboardStore, savedFolder.Id, models.DashboardACL{
				OrgID:       1,
				TeamID:      team1.Id,
				DashboardID: savedFolder.Id,
				Permission:  models.PERMISSION_ADMIN,
			})
			require.Nil(t, err)

			q3 := &models.GetDashboardACLInfoListQuery{DashboardID: savedFolder.Id, OrgID: 1}
			err = dashboardStore.GetDashboardACLInfoList(context.Background(), q3)
			require.Nil(t, err)
			require.Equal(t, 1, len(q3.Result))
			require.Equal(t, savedFolder.Id, q3.Result[0].DashboardId)
			require.Equal(t, models.PERMISSION_ADMIN, q3.Result[0].Permission)
			require.Equal(t, team1.Id, q3.Result[0].TeamId)
		})
	})

	t.Run("Default permissions for root folder dashboards", func(t *testing.T) {
		setup(t)
		var rootFolderId int64 = 0
		//sqlStore := sqlstore.InitTestDB(t)

		query := models.GetDashboardACLInfoListQuery{DashboardID: rootFolderId, OrgID: 1}

		err := dashboardStore.GetDashboardACLInfoList(context.Background(), &query)
		require.Nil(t, err)

		require.Equal(t, 2, len(query.Result))
		defaultPermissionsId := int64(-1)
		require.Equal(t, defaultPermissionsId, query.Result[0].DashboardId)
		require.Equal(t, models.ROLE_VIEWER, *query.Result[0].Role)
		require.False(t, query.Result[0].Inherited)
		require.Equal(t, defaultPermissionsId, query.Result[1].DashboardId)
		require.Equal(t, models.ROLE_EDITOR, *query.Result[1].Role)
		require.False(t, query.Result[1].Inherited)
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
	currentUserCmd := user.CreateUserCommand{Login: name, Email: name + "@test.com", Name: "a " + name, IsAdmin: isAdmin}
	currentUser, err := sqlStore.CreateUser(context.Background(), currentUserCmd)
	require.NoError(t, err)
	q1 := models.GetUserOrgListQuery{UserId: currentUser.ID}
	err = sqlStore.GetUserOrgList(context.Background(), &q1)
	require.NoError(t, err)
	require.Equal(t, models.RoleType(role), q1.Result[0].Role)
	return *currentUser
}

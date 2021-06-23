// +build integration

package sqlstore

import (
	"testing"

	"github.com/grafana/grafana/pkg/models"
)

func TestDashboardAclDataAccess(t *testing.T) {
	t.Run("Testing DB", func(t *testing.T) {
		sqlStore := InitTestDB(t)

		t.Run("Given a dashboard folder and a user", func(t *testing.T) {
			currentUser := createUser(t, sqlStore, "viewer", "Viewer", false)
			savedFolder := insertTestDashboard(t, sqlStore, "1 test dash folder", 1, 0, true, "prod", "webapp")
			childDash := insertTestDashboard(t, sqlStore, "2 test dash", 1, savedFolder.Id, false, "prod", "webapp")

			t.Run("When adding dashboard permission with userId and teamId set to 0", func(t *testing.T) {
				err := testHelperUpdateDashboardAcl(t, sqlStore, savedFolder.Id, models.DashboardAcl{
					OrgID:       1,
					DashboardID: savedFolder.Id,
					Permission:  models.PERMISSION_EDIT,
				})
				require.Equal(t, models.ErrDashboardAclInfoMissing, err)
			})

			t.Run("Given dashboard folder with default permissions", func(t *testing.T) {
				t.Run("When reading folder acl should include default acl", func(t *testing.T) {
					query := models.GetDashboardAclInfoListQuery{DashboardID: savedFolder.Id, OrgID: 1}

					err := GetDashboardAclInfoList(&query)
					require.NoError(t, err)

					require.Equal(t, 2, len(query.Result))
					defaultPermissionsId := -1
					require.Equal(t, defaultPermissionsId, query.Result[0].DashboardId)
					require.Equal(t, models.ROLE_VIEWER, *query.Result[0].Role)
					require.False(t, query.Result[0].Inherited)
					require.Equal(t, defaultPermissionsId, query.Result[1].DashboardId)
					require.Equal(t, models.ROLE_EDITOR, *query.Result[1].Role)
					require.False(t, query.Result[1].Inherited)
				})

				t.Run("When reading dashboard acl should include acl for parent folder", func(t *testing.T) {
					query := models.GetDashboardAclInfoListQuery{DashboardID: childDash.Id, OrgID: 1}

					err := GetDashboardAclInfoList(&query)
					require.NoError(t, err)

					require.Equal(t, 2, len(query.Result))
					defaultPermissionsId := -1
					require.Equal(t, defaultPermissionsId, query.Result[0].DashboardId)
					require.Equal(t, models.ROLE_VIEWER, *query.Result[0].Role)
					require.True(t, query.Result[0].Inherited)
					require.Equal(t, defaultPermissionsId, query.Result[1].DashboardId)
					require.Equal(t, models.ROLE_EDITOR, *query.Result[1].Role)
					require.True(t, query.Result[1].Inherited)
				})
			})

			t.Run("Given dashboard folder with removed default permissions", func(t *testing.T) {
				err := sqlStore.UpdateDashboardACL(savedFolder.Id, nil)
				require.NoError(t, err)

				t.Run("When reading dashboard acl should return no acl items", func(t *testing.T) {
					query := models.GetDashboardAclInfoListQuery{DashboardID: childDash.Id, OrgID: 1}

					err := GetDashboardAclInfoList(&query)
					require.NoError(t, err)

					require.Equal(t, 0, len(query.Result))
				})
			})

			t.Run("Given dashboard folder permission", func(t *testing.T) {
				err := testHelperUpdateDashboardAcl(t, sqlStore, savedFolder.Id, models.DashboardAcl{
					OrgID:       1,
					UserID:      currentUser.Id,
					DashboardID: savedFolder.Id,
					Permission:  models.PERMISSION_EDIT,
				})
				require.NoError(t, err)

				t.Run("When reading dashboard acl should include acl for parent folder", func(t *testing.T) {
					query := models.GetDashboardAclInfoListQuery{DashboardID: childDash.Id, OrgID: 1}

					err := GetDashboardAclInfoList(&query)
					require.NoError(t, err)

					require.Equal(t, 1, len(query.Result))
					require.Equal(t, savedFolder.Id, query.Result[0].DashboardId)
				})

				t.Run("Given child dashboard permission", func(t *testing.T) {
					err := testHelperUpdateDashboardAcl(t, sqlStore, childDash.Id, models.DashboardAcl{
						OrgID:       1,
						UserID:      currentUser.Id,
						DashboardID: childDash.Id,
						Permission:  models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					t.Run("When reading dashboard acl should include acl for parent folder and child", func(t *testing.T) {
						query := models.GetDashboardAclInfoListQuery{OrgID: 1, DashboardID: childDash.Id}

						err := GetDashboardAclInfoList(&query)
						require.NoError(t, err)

						require.Equal(t, 2, len(query.Result))
						require.Equal(t, savedFolder.Id, query.Result[0].DashboardId)
						require.True(t, query.Result[0].Inherited)
						require.Equal(t, childDash.Id, query.Result[1].DashboardId)
						require.False(t, query.Result[1].Inherited)
					})
				})
			})

			t.Run("Given child dashboard permission in folder with no permissions", func(t *testing.T) {
				err := testHelperUpdateDashboardAcl(t, sqlStore, childDash.Id, models.DashboardAcl{
					OrgID:       1,
					UserID:      currentUser.Id,
					DashboardID: childDash.Id,
					Permission:  models.PERMISSION_EDIT,
				})
				require.NoError(t, err)

				t.Run("When reading dashboard acl should include default acl for parent folder and the child acl", func(t *testing.T) {
					query := models.GetDashboardAclInfoListQuery{OrgID: 1, DashboardID: childDash.Id}

					err := GetDashboardAclInfoList(&query)
					require.NoError(t, err)

					defaultPermissionsId := -1
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
			})

			t.Run("Should be able to add dashboard permission", func(t *testing.T) {
				err := testHelperUpdateDashboardAcl(t, sqlStore, savedFolder.Id, models.DashboardAcl{
					OrgID:       1,
					UserID:      currentUser.Id,
					DashboardID: savedFolder.Id,
					Permission:  models.PERMISSION_EDIT,
				})
				require.NoError(t, err)

				q1 := &models.GetDashboardAclInfoListQuery{DashboardID: savedFolder.Id, OrgID: 1}
				err = GetDashboardAclInfoList(q1)
				require.NoError(t, err)

				require.Equal(t, savedFolder.Id, q1.Result[0].DashboardId)
				require.Equal(t, models.PERMISSION_EDIT, q1.Result[0].Permission)
				require.Equal(t, "Edit", q1.Result[0].PermissionName)
				require.Equal(t, currentUser.Id, q1.Result[0].UserId)
				require.Equal(t, currentUser.Login, q1.Result[0].UserLogin)
				require.Equal(t, currentUser.Email, q1.Result[0].UserEmail)

				t.Run("Should be able to delete an existing permission", func(t *testing.T) {
					err := testHelperUpdateDashboardAcl(t, sqlStore, savedFolder.Id)
					require.NoError(t, err)

					q3 := &models.GetDashboardAclInfoListQuery{DashboardID: savedFolder.Id, OrgID: 1}
					err = GetDashboardAclInfoList(q3)
					require.NoError(t, err)
					require.Equal(t, 0, len(q3.Result))
				})
			})

			t.Run("Given a team", func(t *testing.T) {
				team1, err := sqlStore.CreateTeam("group1 name", "", 1)
				require.NoError(t, err)

				t.Run("Should be able to add a user permission for a team", func(t *testing.T) {
					err := testHelperUpdateDashboardAcl(t, sqlStore, savedFolder.Id, models.DashboardAcl{
						OrgID:       1,
						TeamID:      team1.Id,
						DashboardID: savedFolder.Id,
						Permission:  models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					q1 := &models.GetDashboardAclInfoListQuery{DashboardID: savedFolder.Id, OrgID: 1}
					err = GetDashboardAclInfoList(q1)
					require.NoError(t, err)
					require.Equal(t, savedFolder.Id, q1.Result[0].DashboardId)
					require.Equal(t, models.PERMISSION_EDIT, q1.Result[0].Permission)
					require.Equal(t, team1.Id, q1.Result[0].TeamId)
				})

				t.Run("Should be able to update an existing permission for a team", func(t *testing.T) {
					err := testHelperUpdateDashboardAcl(t, sqlStore, savedFolder.Id, models.DashboardAcl{
						OrgID:       1,
						TeamID:      team1.Id,
						DashboardID: savedFolder.Id,
						Permission:  models.PERMISSION_ADMIN,
					})
					require.NoError(t, err)

					q3 := &models.GetDashboardAclInfoListQuery{DashboardID: savedFolder.Id, OrgID: 1}
					err = GetDashboardAclInfoList(q3)
					require.NoError(t, err)
					require.Equal(t, 1, len(q3.Result))
					require.Equal(t, savedFolder.Id, q3.Result[0].DashboardId)
					require.Equal(t, models.PERMISSION_ADMIN, q3.Result[0].Permission)
					require.Equal(t, team1.Id, q3.Result[0].TeamId)
				})
			})
		})

		t.Run("Given a root folder", func(t *testing.T) {
			var rootFolderId int64 = 0

			t.Run("When reading dashboard acl should return default permissions", func(t *testing.T) {
				query := models.GetDashboardAclInfoListQuery{DashboardID: rootFolderId, OrgID: 1}

				err := GetDashboardAclInfoList(&query)
				require.NoError(t, err)

				require.Equal(t, 2, len(query.Result))
				defaultPermissionsId := -1
				require.Equal(t, defaultPermissionsId, query.Result[0].DashboardId)
				require.Equal(t, models.ROLE_VIEWER, *query.Result[0].Role)
				require.False(t, query.Result[0].Inherited)
				require.Equal(t, defaultPermissionsId, query.Result[1].DashboardId)
				require.Equal(t, models.ROLE_EDITOR, *query.Result[1].Role)
				require.False(t, query.Result[1].Inherited)
			})
		})
	})
}

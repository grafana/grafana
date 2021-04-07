package tests

import (
	"fmt"
	"math/rand"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/stretchr/testify/require"
)

func TestRuleGroupUpdate(t *testing.T) {
	origNewGuardian := guardian.New
	t.Cleanup(func() {
		guardian.New = origNewGuardian
	})
	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
		CanAdminValue: true,
		CanSaveValue:  true,
		CanViewValue:  true,
	})

	dbstore := setupTestEnv(t, 1)

	var orgID int64 = 1
	var userId int64 = 1
	signedInUser := models.SignedInUser{OrgId: orgID, UserId: userId}

	t.Run("when namespace does not exist it should create it", func(t *testing.T) {
		namespace := fmt.Sprintf("namespace-%d", rand.Intn(1000))
		err := dbstore.UpdateRuleGroup(store.UpdateRuleGroupCmd{
			OrgID:       orgID,
			RequestedBy: &signedInUser,
			Namespace:   namespace,
		})
		require.NoError(t, err)

		folderSrv := dashboards.NewFolderService(orgID, &signedInUser, dbstore.SQLStore)
		_, err = folderSrv.GetFolderBySlug(namespace)
		require.NoError(t, err)
	})

	t.Run("when namespace does not exist and ACLs are provided", func(t *testing.T) {
		roleAdmin := models.ROLE_ADMIN
		testCases := []struct {
			desc             string
			g                *guardian.FakeDashboardGuardian
			permissions      []dtos.DashboardAclUpdateItem
			shouldErr        require.ErrorAssertionFunc
			expectedErr      error
			namespaceCreated bool
		}{
			{
				desc: "when invalid permission; violates ValidatePermissionsUpdate",
				g: &guardian.FakeDashboardGuardian{
					CanAdminValue: true,
					CanSaveValue:  true,
					CanViewValue:  true,
				},
				permissions: []dtos.DashboardAclUpdateItem{
					{
						UserID: 42,
						Role:   &roleAdmin,
					},
				},
				expectedErr: models.ErrPermissionsWithRoleNotAllowed,
				shouldErr:   require.Error,
			},
			{
				desc: "when checking permissions before update returns error",
				g: &guardian.FakeDashboardGuardian{
					CanAdminValue:                    true,
					CanSaveValue:                     true,
					CanViewValue:                     true,
					CheckPermissionBeforeUpdateError: guardian.ErrGuardianPermissionExists,
				},
				permissions: []dtos.DashboardAclUpdateItem{
					{
						UserID:     42,
						Permission: models.PERMISSION_ADMIN,
					},
				},
				expectedErr: guardian.ErrGuardianPermissionExists,
				shouldErr:   require.Error,
			},
			{
				desc: "when checking permissions before update is not ok to update",
				g: &guardian.FakeDashboardGuardian{
					CanAdminValue:                    true,
					CanSaveValue:                     true,
					CanViewValue:                     true,
					CheckPermissionBeforeUpdateValue: false,
				},
				permissions: []dtos.DashboardAclUpdateItem{
					{
						UserID:     42,
						Permission: models.PERMISSION_ADMIN,
					},
				},
				shouldErr: require.Error,
			},
			{
				desc: "when checking permissions before update is ok to update",
				g: &guardian.FakeDashboardGuardian{
					CanAdminValue:                    true,
					CanSaveValue:                     true,
					CanViewValue:                     true,
					CheckPermissionBeforeUpdateValue: true,
				},
				permissions: []dtos.DashboardAclUpdateItem{
					{
						UserID:     42,
						Permission: models.PERMISSION_ADMIN,
					},
				},
				shouldErr:        require.NoError,
				namespaceCreated: true,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				guardian.MockDashboardGuardian(tc.g)

				namespace := fmt.Sprintf("namespace-%d", rand.Intn(1000))
				err := dbstore.UpdateRuleGroup(store.UpdateRuleGroupCmd{
					OrgID:         orgID,
					RequestedBy:   &signedInUser,
					Namespace:     namespace,
					NamespaceACLs: tc.permissions,
				})
				tc.shouldErr(t, err)
				if tc.expectedErr != nil {
					require.ErrorIs(t, err, tc.expectedErr)
				}

				if tc.namespaceCreated {
					folderSrv := dashboards.NewFolderService(orgID, &signedInUser, dbstore.SQLStore)
					_, err = folderSrv.GetFolderBySlug(namespace)
					require.NoError(t, err)
				} else {
					folderSrv := dashboards.NewFolderService(orgID, &signedInUser, dbstore.SQLStore)
					_, err = folderSrv.GetFolderBySlug(namespace)
					require.ErrorIs(t, err, models.ErrFolderNotFound)
				}
			})
		}
	})
}

package dashboards

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/dashboards"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/guardian"
)

func TestFolderService(t *testing.T) {
	t.Run("Folder service tests", func(t *testing.T) {
		service := dashboardServiceImpl{
			orgId:          1,
			user:           &models.SignedInUser{UserId: 1},
			dashboardStore: &fakeDashboardStore{},
		}

		t.Run("Given user has no permissions", func(t *testing.T) {
			origNewGuardian := guardian.New
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{})

			bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
				query.Result = models.NewDashboardFolder("Folder")
				return nil
			})

			origStore := service.dashboardStore
			t.Cleanup(func() {
				service.dashboardStore = origStore
			})
			service.dashboardStore = &fakeDashboardStore{
				validationError: models.ErrDashboardUpdateAccessDenied,
			}

			t.Run("When get folder by id should return access denied error", func(t *testing.T) {
				_, err := service.GetFolderByID(1)
				require.Equal(t, err, models.ErrFolderAccessDenied)
			})

			t.Run("When get folder by id, with id = 0 should return default folder", func(t *testing.T) {
				folder, err := service.GetFolderByID(0)
				require.NoError(t, err)
				require.Equal(t, folder, &models.Folder{Id: 0, Title: "General"})
			})

			t.Run("When get folder by uid should return access denied error", func(t *testing.T) {
				_, err := service.GetFolderByUID("uid")
				require.Equal(t, err, models.ErrFolderAccessDenied)
			})

			t.Run("When creating folder should return access denied error", func(t *testing.T) {
				_, err := service.CreateFolder("Folder", "")
				require.Equal(t, err, models.ErrFolderAccessDenied)
			})

			t.Run("When updating folder should return access denied error", func(t *testing.T) {
				err := service.UpdateFolder("uid", &models.UpdateFolderCommand{
					Uid:   "uid",
					Title: "Folder",
				})
				require.Equal(t, err, models.ErrFolderAccessDenied)
			})

			t.Run("When deleting folder by uid should return access denied error", func(t *testing.T) {
				_, err := service.DeleteFolder("uid")
				require.Error(t, err)
				require.Equal(t, err, models.ErrFolderAccessDenied)
			})

			t.Cleanup(func() {
				guardian.New = origNewGuardian
			})
		})

		t.Run("Given user has permission to save", func(t *testing.T) {
			origNewGuardian := guardian.New
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanSaveValue: true})

			dash := models.NewDashboardFolder("Folder")
			dash.Id = 1

			bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
				query.Result = dash
				return nil
			})

			origUpdateAlerting := UpdateAlerting
			t.Cleanup(func() {
				UpdateAlerting = origUpdateAlerting
			})
			UpdateAlerting = func(store dashboards.Store, orgID int64, dashboard *models.Dashboard,
				user *models.SignedInUser) error {
				return nil
			}

			bus.AddHandler("test", func(cmd *models.SaveDashboardCommand) error {
				cmd.Result = dash
				return nil
			})

			bus.AddHandler("test", func(cmd *models.DeleteDashboardCommand) error {
				return nil
			})

			t.Run("When creating folder should not return access denied error", func(t *testing.T) {
				_, err := service.CreateFolder("Folder", "")
				require.NoError(t, err)
			})

			t.Run("When updating folder should not return access denied error", func(t *testing.T) {
				err := service.UpdateFolder("uid", &models.UpdateFolderCommand{
					Uid:   "uid",
					Title: "Folder",
				})
				require.NoError(t, err)
			})

			t.Run("When deleting folder by uid should not return access denied error", func(t *testing.T) {
				_, err := service.DeleteFolder("uid")
				require.NoError(t, err)
			})

			t.Cleanup(func() {
				guardian.New = origNewGuardian
			})
		})

		t.Run("Given user has permission to view", func(t *testing.T) {
			origNewGuardian := guardian.New
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanViewValue: true})

			dashFolder := models.NewDashboardFolder("Folder")
			dashFolder.Id = 1
			dashFolder.Uid = "uid-abc"

			bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
				query.Result = dashFolder
				return nil
			})

			t.Run("When get folder by id should return folder", func(t *testing.T) {
				f, _ := service.GetFolderByID(1)
				require.Equal(t, f.Id, dashFolder.Id)
				require.Equal(t, f.Uid, dashFolder.Uid)
				require.Equal(t, f.Title, dashFolder.Title)
			})

			t.Run("When get folder by uid should return folder", func(t *testing.T) {
				f, _ := service.GetFolderByUID("uid")
				require.Equal(t, f.Id, dashFolder.Id)
				require.Equal(t, f.Uid, dashFolder.Uid)
				require.Equal(t, f.Title, dashFolder.Title)
			})

			t.Cleanup(func() {
				guardian.New = origNewGuardian
			})
		})

		t.Run("Should map errors correct", func(t *testing.T) {
			testCases := []struct {
				ActualError   error
				ExpectedError error
			}{
				{ActualError: models.ErrDashboardTitleEmpty, ExpectedError: models.ErrFolderTitleEmpty},
				{ActualError: models.ErrDashboardUpdateAccessDenied, ExpectedError: models.ErrFolderAccessDenied},
				{ActualError: models.ErrDashboardWithSameNameInFolderExists, ExpectedError: models.ErrFolderSameNameExists},
				{ActualError: models.ErrDashboardWithSameUIDExists, ExpectedError: models.ErrFolderWithSameUIDExists},
				{ActualError: models.ErrDashboardVersionMismatch, ExpectedError: models.ErrFolderVersionMismatch},
				{ActualError: models.ErrDashboardNotFound, ExpectedError: models.ErrFolderNotFound},
				{ActualError: models.ErrDashboardFailedGenerateUniqueUid, ExpectedError: models.ErrFolderFailedGenerateUniqueUid},
				{ActualError: models.ErrDashboardInvalidUid, ExpectedError: models.ErrDashboardInvalidUid},
			}

			for _, tc := range testCases {
				actualError := toFolderError(tc.ActualError)
				assert.EqualErrorf(t, actualError, tc.ExpectedError.Error(),
					"For error '%s' expected error '%s', actual '%s'", tc.ActualError, tc.ExpectedError, actualError)
			}
		})
	})
}

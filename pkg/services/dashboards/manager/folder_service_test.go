//go:build integration
// +build integration

package service

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

var orgID = int64(1)
var user = &models.SignedInUser{UserId: 1}

func TestFolderService(t *testing.T) {
	t.Run("Folder service tests", func(t *testing.T) {
		store := &database.FakeDashboardStore{}
		defer store.AssertExpectations(t)
		service := ProvideFolderService(
			&dashboards.FakeDashboardService{DashboardService: ProvideDashboardService(store)},
			store,
			nil,
		)

		t.Run("Given user has no permissions", func(t *testing.T) {
			origNewGuardian := guardian.New
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{})

			bus.AddHandler("test", func(ctx context.Context, query *models.GetDashboardQuery) error {
				query.Result = models.NewDashboardFolder("Folder")
				return nil
			})

			t.Run("When get folder by id should return access denied error", func(t *testing.T) {
				_, err := service.GetFolderByID(context.Background(), user, 1, orgID)
				require.Equal(t, err, models.ErrFolderAccessDenied)
			})

			t.Run("When get folder by id, with id = 0 should return default folder", func(t *testing.T) {
				folder, err := service.GetFolderByID(context.Background(), user, 0, orgID)
				require.NoError(t, err)
				require.Equal(t, folder, &models.Folder{Id: 0, Title: "General"})
			})

			t.Run("When get folder by uid should return access denied error", func(t *testing.T) {
				_, err := service.GetFolderByUID(context.Background(), user, orgID, "uid")
				require.Equal(t, err, models.ErrFolderAccessDenied)
			})

			t.Run("When creating folder should return access denied error", func(t *testing.T) {
				store.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything).Return(true, nil).Times(2)
				_, err := service.CreateFolder(context.Background(), user, orgID, "Folder", "")
				require.Equal(t, err, models.ErrFolderAccessDenied)
			})

			t.Run("When updating folder should return access denied error", func(t *testing.T) {
				err := service.UpdateFolder(context.Background(), user, orgID, "uid", &models.UpdateFolderCommand{
					Uid:   "uid",
					Title: "Folder",
				})
				require.Equal(t, err, models.ErrFolderAccessDenied)
			})

			t.Run("When deleting folder by uid should return access denied error", func(t *testing.T) {
				_, err := service.DeleteFolder(context.Background(), user, orgID, "uid", false)
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

			bus.AddHandler("test", func(ctx context.Context, query *models.GetDashboardQuery) error {
				query.Result = dash
				return nil
			})

			bus.AddHandler("test", func(ctx context.Context, cmd *models.SaveDashboardCommand) error {
				cmd.Result = dash
				return nil
			})

			bus.AddHandler("test", func(ctx context.Context, cmd *models.DeleteDashboardCommand) error {
				return nil
			})

			t.Run("When creating folder should not return access denied error", func(t *testing.T) {
				store.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything).Return(true, nil).Times(2)
				store.On("SaveDashboard", mock.Anything).Return(&models.Dashboard{Id: 1}, nil).Once()
				_, err := service.CreateFolder(context.Background(), user, orgID, "Folder", "")
				require.NoError(t, err)
			})

			t.Run("When updating folder should not return access denied error", func(t *testing.T) {
				store.On("SaveDashboard", mock.Anything).Return(&models.Dashboard{Id: 1}, nil).Once()
				err := service.UpdateFolder(context.Background(), user, orgID, "uid", &models.UpdateFolderCommand{
					Uid:   "uid",
					Title: "Folder",
				})
				require.NoError(t, err)
			})

			t.Run("When deleting folder by uid should not return access denied error", func(t *testing.T) {
				_, err := service.DeleteFolder(context.Background(), user, orgID, "uid", false)
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

			bus.AddHandler("test", func(ctx context.Context, query *models.GetDashboardQuery) error {
				query.Result = dashFolder
				return nil
			})

			t.Run("When get folder by id should return folder", func(t *testing.T) {
				f, _ := service.GetFolderByID(context.Background(), user, orgID, 1)
				require.Equal(t, f.Id, dashFolder.Id)
				require.Equal(t, f.Uid, dashFolder.Uid)
				require.Equal(t, f.Title, dashFolder.Title)
			})

			t.Run("When get folder by uid should return folder", func(t *testing.T) {
				f, _ := service.GetFolderByUID(context.Background(), user, orgID, "uid")
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

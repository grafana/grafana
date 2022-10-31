package folderimpl

import (
	"context"
	"math/rand"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardsvc "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var orgID = int64(1)
var usr = &user.SignedInUser{UserID: 1}

func TestIntegrationProvideFolderService(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Run("should register scope resolvers", func(t *testing.T) {
		cfg := setting.NewCfg()
		ac := acmock.New()
		ProvideService(ac, bus.ProvideBus(tracing.InitializeTracerForTest()), cfg, nil, nil, nil, nil, nil)

		require.Len(t, ac.Calls.RegisterAttributeScopeResolver, 2)
	})
}

func TestIntegrationFolderService(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Run("Folder service tests", func(t *testing.T) {
		store := &dashboards.FakeDashboardStore{}
		cfg := setting.NewCfg()
		cfg.RBACEnabled = false
		features := featuremgmt.WithFeatures()
		cfg.IsFeatureToggleEnabled = features.IsEnabled
		folderPermissions := acmock.NewMockedPermissionsService()
		dashboardPermissions := acmock.NewMockedPermissionsService()
		dashboardService := dashboardsvc.ProvideDashboardService(cfg, store, nil, features, folderPermissions, dashboardPermissions, acmock.New())

		service := &Service{
			cfg:              cfg,
			log:              log.New("test-folder-service"),
			dashboardService: dashboardService,
			dashboardStore:   store,
			searchService:    nil,
			features:         features,
			permissions:      folderPermissions,
			bus:              bus.ProvideBus(tracing.InitializeTracerForTest()),
		}

		t.Run("Given user has no permissions", func(t *testing.T) {
			origNewGuardian := guardian.New
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{})

			folderId := rand.Int63()
			folderUID := util.GenerateShortUID()

			newFolder := folder.NewFolder("Folder", "Description")
			newFolder.ID = folderId
			newFolder.UID = folderUID

			store.On("GetFolderByID", mock.Anything, orgID, folderId).Return(newFolder, nil)
			store.On("GetFolderByUID", mock.Anything, orgID, folderUID).Return(newFolder, nil)

			t.Run("When get folder by id should return access denied error", func(t *testing.T) {
				_, err := service.GetFolderByID(context.Background(), usr, folderId, orgID)
				require.Equal(t, err, dashboards.ErrFolderAccessDenied)
			})

			t.Run("When get folder by id, with id = 0 should return default folder", func(t *testing.T) {
				folder, err := service.GetFolderByID(context.Background(), usr, 0, orgID)
				require.NoError(t, err)
				require.Equal(t, folder, &models.Folder{Id: 0, Title: "General"})
			})

			t.Run("When get folder by uid should return access denied error", func(t *testing.T) {
				_, err := service.GetFolderByUID(context.Background(), usr, orgID, folderUID)
				require.Equal(t, err, dashboards.ErrFolderAccessDenied)
			})

			t.Run("When creating folder should return access denied error", func(t *testing.T) {
				store.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything).Return(true, nil).Times(2)
				ctx := context.Background()
				ctx = appcontext.WithUser(ctx, usr)
				_, err := service.CreateFolder(ctx, &folder.CreateFolderCommand{
					UID:   folderUID,
					Title: newFolder.Title,
				})
				require.Equal(t, err, dashboards.ErrFolderAccessDenied)
			})

			t.Run("When updating folder should return access denied error", func(t *testing.T) {
				store.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Run(func(args mock.Arguments) {
					folder := args.Get(1).(*models.GetDashboardQuery)
					folder.Result = models.NewDashboard("dashboard-test")
					folder.Result.IsFolder = true
				}).Return(&models.Dashboard{}, nil)
				ctx := context.Background()
				ctx = appcontext.WithUser(ctx, usr)
				newTitle := "Folder-TEST"
				_, err := service.UpdateFolder(context.Background(), &folder.UpdateFolderCommand{
					NewUID:   &folderUID,
					NewTitle: &newTitle,
				})
				require.Equal(t, err, dashboards.ErrFolderAccessDenied)
			})

			t.Run("When deleting folder by uid should return access denied error", func(t *testing.T) {
				_, err := service.DeleteFolder(context.Background(), usr, orgID, folderUID, false)
				require.Error(t, err)
				require.Equal(t, err, dashboards.ErrFolderAccessDenied)
			})

			t.Cleanup(func() {
				guardian.New = origNewGuardian
			})
		})

		t.Run("Given user has permission to save", func(t *testing.T) {
			origNewGuardian := guardian.New
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanSaveValue: true})

			t.Run("When creating folder should not return access denied error", func(t *testing.T) {
				dash := models.NewDashboardFolder("Test-Folder")
				dash.Id = rand.Int63()
				f := models.DashboardToFolder(dash)

				store.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything).Return(true, nil)
				store.On("SaveDashboard", mock.Anything).Return(dash, nil).Once()
				store.On("GetFolderByID", mock.Anything, orgID, dash.Id).Return(f, nil)

				ctx := context.Background()
				ctx = appcontext.WithUser(ctx, usr)
				actualFolder, err := service.CreateFolder(ctx, &folder.CreateFolderCommand{
					Title: dash.Title,
				})
				require.NoError(t, err)
				require.Equal(t, f, actualFolder)
			})

			t.Run("When creating folder should return error if uid is general", func(t *testing.T) {
				dash := models.NewDashboardFolder("Test-Folder")
				dash.Id = rand.Int63()

				ctx := context.Background()
				ctx = appcontext.WithUser(ctx, usr)
				_, err := service.CreateFolder(ctx, &folder.CreateFolderCommand{
					Title: dash.Title,
					UID:   "general",
				})
				require.ErrorIs(t, err, dashboards.ErrFolderInvalidUID)
			})

			t.Run("When updating folder should not return access denied error", func(t *testing.T) {
				dashboardFolder := models.NewDashboardFolder("Folder")
				dashboardFolder.Id = rand.Int63()
				dashboardFolder.Uid = util.GenerateShortUID()
				f := models.DashboardToFolder(dashboardFolder)

				store.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything).Return(true, nil)
				store.On("SaveDashboard", mock.Anything).Return(dashboardFolder, nil)
				store.On("GetFolderByID", mock.Anything, orgID, dashboardFolder.Id).Return(f, nil)

				req := &models.UpdateFolderCommand{
					Uid:   dashboardFolder.Uid,
					Title: "TEST-Folder",
				}
				ctx := context.Background()
				ctx = appcontext.WithUser(ctx, usr)
				UID := dashboardFolder.Uid
				_, err := service.UpdateFolder(ctx, &folder.UpdateFolderCommand{
					NewUID: &UID,
				})
				require.NoError(t, err)
				require.Equal(t, f, req.Result)
			})

			t.Run("When deleting folder by uid should not return access denied error", func(t *testing.T) {
				f := models.NewFolder(util.GenerateShortUID())
				f.Id = rand.Int63()
				f.Uid = util.GenerateShortUID()
				store.On("GetFolderByUID", mock.Anything, orgID, f.Uid).Return(f, nil)

				var actualCmd *models.DeleteDashboardCommand
				store.On("DeleteDashboard", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
					actualCmd = args.Get(1).(*models.DeleteDashboardCommand)
				}).Return(nil).Once()

				expectedForceDeleteRules := rand.Int63()%2 == 0
				_, err := service.DeleteFolder(context.Background(), usr, orgID, f.Uid, expectedForceDeleteRules)
				require.NoError(t, err)
				require.NotNil(t, actualCmd)
				require.Equal(t, f.Id, actualCmd.Id)
				require.Equal(t, orgID, actualCmd.OrgId)
				require.Equal(t, expectedForceDeleteRules, actualCmd.ForceDeleteFolderRules)
			})

			t.Cleanup(func() {
				guardian.New = origNewGuardian
			})
		})

		t.Run("Given user has permission to view", func(t *testing.T) {
			origNewGuardian := guardian.New
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanViewValue: true})

			t.Run("When get folder by id should return folder", func(t *testing.T) {
				expected := models.NewFolder(util.GenerateShortUID())
				expected.Id = rand.Int63()

				store.On("GetFolderByID", mock.Anything, orgID, expected.Id).Return(expected, nil)

				actual, err := service.GetFolderByID(context.Background(), usr, expected.Id, orgID)
				require.Equal(t, expected, actual)
				require.NoError(t, err)
			})

			t.Run("When get folder by uid should return folder", func(t *testing.T) {
				expected := models.NewFolder(util.GenerateShortUID())
				expected.Uid = util.GenerateShortUID()

				store.On("GetFolderByUID", mock.Anything, orgID, expected.Uid).Return(expected, nil)

				actual, err := service.GetFolderByUID(context.Background(), usr, orgID, expected.Uid)
				require.Equal(t, expected, actual)
				require.NoError(t, err)
			})

			t.Run("When get folder by title should return folder", func(t *testing.T) {
				expected := models.NewFolder("TEST-" + util.GenerateShortUID())

				store.On("GetFolderByTitle", mock.Anything, orgID, expected.Title).Return(expected, nil)

				actual, err := service.GetFolderByTitle(context.Background(), usr, orgID, expected.Title)
				require.Equal(t, expected, actual)
				require.NoError(t, err)
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
				{ActualError: dashboards.ErrDashboardTitleEmpty, ExpectedError: dashboards.ErrFolderTitleEmpty},
				{ActualError: dashboards.ErrDashboardUpdateAccessDenied, ExpectedError: dashboards.ErrFolderAccessDenied},
				{ActualError: dashboards.ErrDashboardWithSameNameInFolderExists, ExpectedError: dashboards.ErrFolderSameNameExists},
				{ActualError: dashboards.ErrDashboardWithSameUIDExists, ExpectedError: dashboards.ErrFolderWithSameUIDExists},
				{ActualError: dashboards.ErrDashboardVersionMismatch, ExpectedError: dashboards.ErrFolderVersionMismatch},
				{ActualError: dashboards.ErrDashboardNotFound, ExpectedError: dashboards.ErrFolderNotFound},
				{ActualError: dashboards.ErrDashboardFailedGenerateUniqueUid, ExpectedError: dashboards.ErrFolderFailedGenerateUniqueUid},
				{ActualError: dashboards.ErrDashboardInvalidUid, ExpectedError: dashboards.ErrDashboardInvalidUid},
			}

			for _, tc := range testCases {
				actualError := toFolderError(tc.ActualError)
				assert.EqualErrorf(t, actualError, tc.ExpectedError.Error(),
					"For error '%s' expected error '%s', actual '%s'", tc.ActualError, tc.ExpectedError, actualError)
			}
		})
	})
}

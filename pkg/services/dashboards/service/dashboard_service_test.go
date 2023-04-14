package service

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestDashboardService(t *testing.T) {
	t.Run("Dashboard service tests", func(t *testing.T) {
		fakeStore := dashboards.FakeDashboardStore{}
		defer fakeStore.AssertExpectations(t)

		folderSvc := foldertest.NewFakeService()

		service := &DashboardServiceImpl{
			cfg:                setting.NewCfg(),
			log:                log.New("test.logger"),
			dashboardStore:     &fakeStore,
			folderService:      folderSvc,
			dashAlertExtractor: &dummyDashAlertExtractor{},
		}

		origNewDashboardGuardian := guardian.New
		defer func() { guardian.New = origNewDashboardGuardian }()
		guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanSaveValue: true})

		t.Run("Save dashboard validation", func(t *testing.T) {
			dto := &dashboards.SaveDashboardDTO{}

			t.Run("When saving a dashboard with empty title it should return error", func(t *testing.T) {
				titles := []string{"", " ", "   \t   "}

				for _, title := range titles {
					dto.Dashboard = dashboards.NewDashboard(title)
					_, err := service.SaveDashboard(context.Background(), dto, false)
					require.Equal(t, err, dashboards.ErrDashboardTitleEmpty)
				}
			})

			t.Run("Should return validation error if it's a folder and have a folder id", func(t *testing.T) {
				dto.Dashboard = dashboards.NewDashboardFolder("Folder")
				dto.Dashboard.FolderID = 1
				_, err := service.SaveDashboard(context.Background(), dto, false)
				require.Equal(t, err, dashboards.ErrDashboardFolderCannotHaveParent)
			})

			t.Run("Should return validation error if folder is named General", func(t *testing.T) {
				dto.Dashboard = dashboards.NewDashboardFolder("General")
				_, err := service.SaveDashboard(context.Background(), dto, false)
				require.Equal(t, err, dashboards.ErrDashboardFolderNameExists)
			})

			t.Run("When saving a dashboard should validate uid", func(t *testing.T) {
				testCases := []struct {
					Uid   string
					Error error
				}{
					{Uid: "", Error: nil},
					{Uid: "   ", Error: nil},
					{Uid: "  \t  ", Error: nil},
					{Uid: "asdf90_-", Error: nil},
					{Uid: "asdf/90", Error: dashboards.ErrDashboardInvalidUid},
					{Uid: "   asdfghjklqwertyuiopzxcvbnmasdfghjklqwer   ", Error: nil},
					{Uid: "asdfghjklqwertyuiopzxcvbnmasdfghjklqwertyuiopzxcvbnmasdfghjklqwertyuiopzxcvbnm", Error: dashboards.ErrDashboardUidTooLong},
				}

				for _, tc := range testCases {
					dto.Dashboard = dashboards.NewDashboard("title")
					dto.Dashboard.SetUID(tc.Uid)
					dto.User = &user.SignedInUser{}

					if tc.Error == nil {
						fakeStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything, mock.AnythingOfType("bool")).Return(true, nil).Once()
					}
					_, err := service.BuildSaveDashboardCommand(context.Background(), dto, true, false)
					require.Equal(t, err, tc.Error)
				}
			})

			t.Run("Should return validation error if dashboard is provisioned", func(t *testing.T) {
				fakeStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything, mock.AnythingOfType("bool")).Return(true, nil).Once()
				fakeStore.On("GetProvisionedDataByDashboardID", mock.Anything, mock.AnythingOfType("int64")).Return(&dashboards.DashboardProvisioning{}, nil).Once()

				dto.Dashboard = dashboards.NewDashboard("Dash")
				dto.Dashboard.SetID(3)
				dto.User = &user.SignedInUser{UserID: 1}
				_, err := service.SaveDashboard(context.Background(), dto, false)
				require.Equal(t, err, dashboards.ErrDashboardCannotSaveProvisionedDashboard)
			})

			t.Run("Should not return validation error if dashboard is provisioned but UI updates allowed", func(t *testing.T) {
				fakeStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything, mock.AnythingOfType("bool")).Return(true, nil).Once()
				fakeStore.On("SaveDashboard", mock.Anything, mock.AnythingOfType("dashboards.SaveDashboardCommand")).Return(&dashboards.Dashboard{Data: simplejson.New()}, nil).Once()

				dto.Dashboard = dashboards.NewDashboard("Dash")
				dto.Dashboard.SetID(3)
				dto.User = &user.SignedInUser{UserID: 1}
				_, err := service.SaveDashboard(context.Background(), dto, true)
				require.NoError(t, err)
			})

			t.Run("Should return validation error if alert data is invalid", func(t *testing.T) {
				origAlertingEnabledSet := setting.AlertingEnabled != nil
				origAlertingEnabledVal := false
				if origAlertingEnabledSet {
					origAlertingEnabledVal = *setting.AlertingEnabled
				}
				setting.AlertingEnabled = util.Pointer(true)
				t.Cleanup(func() {
					if !origAlertingEnabledSet {
						setting.AlertingEnabled = nil
					} else {
						setting.AlertingEnabled = &origAlertingEnabledVal
					}
				})

				fakeStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything, mock.AnythingOfType("bool")).Return(true, nil).Once()
				fakeStore.On("GetProvisionedDataByDashboardID", mock.Anything, mock.AnythingOfType("int64")).Return(nil, nil).Once()
				fakeStore.On("SaveDashboard", mock.Anything, mock.AnythingOfType("dashboards.SaveDashboardCommand")).Return(&dashboards.Dashboard{Data: simplejson.New()}, nil).Once()
				fakeStore.On("SaveAlerts", mock.Anything, mock.Anything, mock.Anything).Return(errors.New("alert validation error")).Once()

				dto.Dashboard = dashboards.NewDashboard("Dash")
				dto.User = &user.SignedInUser{UserID: 1}
				_, err := service.SaveDashboard(context.Background(), dto, false)
				require.Error(t, err)
				require.Equal(t, err.Error(), "alert validation error")
			})
		})

		t.Run("Save provisioned dashboard validation", func(t *testing.T) {
			dto := &dashboards.SaveDashboardDTO{}

			t.Run("Should not return validation error if dashboard is provisioned", func(t *testing.T) {
				fakeStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything, mock.AnythingOfType("bool")).Return(true, nil).Once()
				fakeStore.On("SaveProvisionedDashboard", mock.Anything, mock.AnythingOfType("dashboards.SaveDashboardCommand"), mock.AnythingOfType("*dashboards.DashboardProvisioning")).Return(&dashboards.Dashboard{Data: simplejson.New()}, nil).Once()

				dto.Dashboard = dashboards.NewDashboard("Dash")
				dto.Dashboard.SetID(3)
				dto.User = &user.SignedInUser{UserID: 1}
				_, err := service.SaveProvisionedDashboard(context.Background(), dto, nil)
				require.NoError(t, err)
			})

			t.Run("Should override invalid refresh interval if dashboard is provisioned", func(t *testing.T) {
				fakeStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything, mock.AnythingOfType("bool")).Return(true, nil).Once()
				fakeStore.On("SaveProvisionedDashboard", mock.Anything, mock.AnythingOfType("dashboards.SaveDashboardCommand"), mock.AnythingOfType("*dashboards.DashboardProvisioning")).Return(&dashboards.Dashboard{Data: simplejson.New()}, nil).Once()

				oldRefreshInterval := setting.MinRefreshInterval
				setting.MinRefreshInterval = "5m"
				defer func() { setting.MinRefreshInterval = oldRefreshInterval }()

				dto.Dashboard = dashboards.NewDashboard("Dash")
				dto.Dashboard.SetID(3)
				dto.User = &user.SignedInUser{UserID: 1}
				dto.Dashboard.Data.Set("refresh", "1s")
				_, err := service.SaveProvisionedDashboard(context.Background(), dto, nil)
				require.NoError(t, err)
				require.Equal(t, dto.Dashboard.Data.Get("refresh").MustString(), "5m")
			})
		})

		t.Run("Import dashboard validation", func(t *testing.T) {
			dto := &dashboards.SaveDashboardDTO{}

			t.Run("Should return validation error if dashboard is provisioned", func(t *testing.T) {
				fakeStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything, mock.AnythingOfType("bool")).Return(true, nil).Once()
				fakeStore.On("GetProvisionedDataByDashboardID", mock.Anything, mock.AnythingOfType("int64")).Return(&dashboards.DashboardProvisioning{}, nil).Once()

				dto.Dashboard = dashboards.NewDashboard("Dash")
				dto.Dashboard.SetID(3)
				dto.User = &user.SignedInUser{UserID: 1}
				_, err := service.ImportDashboard(context.Background(), dto)
				require.Equal(t, err, dashboards.ErrDashboardCannotSaveProvisionedDashboard)
			})
		})

		t.Run("Given provisioned dashboard", func(t *testing.T) {
			t.Run("DeleteProvisionedDashboard should delete it", func(t *testing.T) {
				args := &dashboards.DeleteDashboardCommand{OrgID: 1, ID: 1}
				fakeStore.On("DeleteDashboard", mock.Anything, args).Return(nil).Once()
				err := service.DeleteProvisionedDashboard(context.Background(), 1, 1)
				require.NoError(t, err)
			})

			t.Run("DeleteDashboard should fail to delete it when provisioning information is missing", func(t *testing.T) {
				fakeStore.On("GetProvisionedDataByDashboardID", mock.Anything, mock.AnythingOfType("int64")).Return(&dashboards.DashboardProvisioning{}, nil).Once()
				err := service.DeleteDashboard(context.Background(), 1, 1)
				require.Equal(t, err, dashboards.ErrDashboardCannotDeleteProvisionedDashboard)
			})
		})

		t.Run("Given non provisioned dashboard", func(t *testing.T) {
			t.Run("DeleteProvisionedDashboard should delete the dashboard", func(t *testing.T) {
				args := &dashboards.DeleteDashboardCommand{OrgID: 1, ID: 1, ForceDeleteFolderRules: false}
				fakeStore.On("DeleteDashboard", mock.Anything, args).Return(nil).Once()
				err := service.DeleteProvisionedDashboard(context.Background(), 1, 1)
				require.NoError(t, err)
			})

			t.Run("DeleteDashboard should delete it", func(t *testing.T) {
				args := &dashboards.DeleteDashboardCommand{OrgID: 1, ID: 1}
				fakeStore.On("DeleteDashboard", mock.Anything, args).Return(nil).Once()
				fakeStore.On("GetProvisionedDataByDashboardID", mock.Anything, mock.AnythingOfType("int64")).Return(nil, nil).Once()
				err := service.DeleteDashboard(context.Background(), 1, 1)
				require.NoError(t, err)
			})

			// t.Run("Delete ACL by user", func(t *testing.T) {
			// 	fakeStore := dashboards.FakeDashboardStore{}
			// 	args := 1
			// 	fakeStore.On("DeleteACLByUser", mock.Anything, args).Return(nil).Once()
			// 	err := service.DeleteACLByUser(context.Background(), 1)
			// 	require.NoError(t, err)
			// })
		})

		t.Run("Count dashboards in folder", func(t *testing.T) {
			fakeStore.On("CountDashboardsInFolder", mock.Anything, mock.AnythingOfType("*dashboards.CountDashboardsInFolderRequest")).Return(int64(3), nil)
			folderSvc.ExpectedFolder = &folder.Folder{ID: 1}
			// set up a ctx with signed in user
			usr := &user.SignedInUser{OrgID: 1, UserID: 1}
			ctx := appcontext.WithUser(context.Background(), usr)

			count, err := service.CountInFolder(ctx, 1, "i am a folder")
			require.NoError(t, err)
			require.Equal(t, int64(3), count)
		})

		t.Run("Delete dashboards in folder", func(t *testing.T) {
			args := &dashboards.DeleteDashboardsInFolderRequest{OrgID: 1, FolderUID: "uid"}
			fakeStore.On("DeleteDashboardsInFolder", mock.Anything, args).Return(nil).Once()
			err := service.DeleteInFolder(context.Background(), 1, "uid")
			require.NoError(t, err)
		})
	})

	t.Run("Delete user by acl", func(t *testing.T) {
		fakeStore := dashboards.FakeDashboardStore{}
		fakeStore.On("DeleteACLByUser", mock.Anything, mock.AnythingOfType("int64")).Return(nil)
		defer fakeStore.AssertExpectations(t)

		service := &DashboardServiceImpl{
			cfg:                setting.NewCfg(),
			log:                log.New("test.logger"),
			dashboardStore:     &fakeStore,
			dashAlertExtractor: &dummyDashAlertExtractor{},
		}
		err := service.DeleteACLByUser(context.Background(), 1)
		require.NoError(t, err)
	})

	t.Run("When org user is deleted", func(t *testing.T) {
		fakeStore := dashboards.FakeDashboardStore{}
		fakeStore.On("GetDashboardACLInfoList", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardACLInfoListQuery")).Return(nil, nil)
		t.Run("Should remove dependent permissions for deleted org user", func(t *testing.T) {
			permQuery := &dashboards.GetDashboardACLInfoListQuery{DashboardID: 1, OrgID: 1}

			permQueryResult, err := fakeStore.GetDashboardACLInfoList(context.Background(), permQuery)
			require.NoError(t, err)

			require.Equal(t, len(permQueryResult), 0)
		})

		t.Run("Should not remove dashboard permissions for same user in another org", func(t *testing.T) {
			fakeStore := dashboards.FakeDashboardStore{}
			fakeStore.On("GetDashboardACLInfoList", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardACLInfoListQuery")).Return(nil, nil)
			permQuery := &dashboards.GetDashboardACLInfoListQuery{DashboardID: 2, OrgID: 3}

			_, err := fakeStore.GetDashboardACLInfoList(context.Background(), permQuery)
			require.NoError(t, err)
		})
	})
}

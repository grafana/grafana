package service

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/xorcare/pointer"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/setting"
)

func TestDashboardService(t *testing.T) {
	t.Run("Dashboard service tests", func(t *testing.T) {
		fakeStore := dashboards.FakeDashboardStore{}
		defer fakeStore.AssertExpectations(t)

		service := &DashboardServiceImpl{
			cfg:                setting.NewCfg(),
			log:                log.New("test.logger"),
			dashboardStore:     &fakeStore,
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
					dto.Dashboard = models.NewDashboard(title)
					_, err := service.SaveDashboard(context.Background(), dto, false)
					require.Equal(t, err, dashboards.ErrDashboardTitleEmpty)
				}
			})

			t.Run("Should return validation error if it's a folder and have a folder id", func(t *testing.T) {
				dto.Dashboard = models.NewDashboardFolder("Folder")
				dto.Dashboard.FolderId = 1
				_, err := service.SaveDashboard(context.Background(), dto, false)
				require.Equal(t, err, dashboards.ErrDashboardFolderCannotHaveParent)
			})

			t.Run("Should return validation error if folder is named General", func(t *testing.T) {
				dto.Dashboard = models.NewDashboardFolder("General")
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
					dto.Dashboard = models.NewDashboard("title")
					dto.Dashboard.SetUid(tc.Uid)
					dto.User = &models.SignedInUser{}

					if tc.Error == nil {
						fakeStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything).Return(true, nil).Once()
					}
					_, err := service.BuildSaveDashboardCommand(context.Background(), dto, true, false)
					require.Equal(t, err, tc.Error)
				}
			})

			t.Run("Should return validation error if dashboard is provisioned", func(t *testing.T) {
				fakeStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything).Return(true, nil).Once()
				fakeStore.On("GetProvisionedDataByDashboardID", mock.Anything).Return(&models.DashboardProvisioning{}, nil).Once()

				dto.Dashboard = models.NewDashboard("Dash")
				dto.Dashboard.SetId(3)
				dto.User = &models.SignedInUser{UserId: 1}
				_, err := service.SaveDashboard(context.Background(), dto, false)
				require.Equal(t, err, dashboards.ErrDashboardCannotSaveProvisionedDashboard)
			})

			t.Run("Should not return validation error if dashboard is provisioned but UI updates allowed", func(t *testing.T) {
				fakeStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything).Return(true, nil).Once()
				fakeStore.On("SaveDashboard", mock.Anything).Return(&models.Dashboard{Data: simplejson.New()}, nil).Once()

				dto.Dashboard = models.NewDashboard("Dash")
				dto.Dashboard.SetId(3)
				dto.User = &models.SignedInUser{UserId: 1}
				_, err := service.SaveDashboard(context.Background(), dto, true)
				require.NoError(t, err)
			})

			t.Run("Should return validation error if alert data is invalid", func(t *testing.T) {
				origAlertingEnabledSet := setting.AlertingEnabled != nil
				origAlertingEnabledVal := false
				if origAlertingEnabledSet {
					origAlertingEnabledVal = *setting.AlertingEnabled
				}
				setting.AlertingEnabled = pointer.Bool(true)
				t.Cleanup(func() {
					if !origAlertingEnabledSet {
						setting.AlertingEnabled = nil
					} else {
						setting.AlertingEnabled = &origAlertingEnabledVal
					}
				})

				fakeStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything).Return(true, nil).Once()
				fakeStore.On("GetProvisionedDataByDashboardID", mock.Anything).Return(nil, nil).Once()
				fakeStore.On("SaveDashboard", mock.Anything).Return(&models.Dashboard{Data: simplejson.New()}, nil).Once()
				fakeStore.On("SaveAlerts", mock.Anything, mock.Anything, mock.Anything).Return(errors.New("alert validation error")).Once()

				dto.Dashboard = models.NewDashboard("Dash")
				dto.User = &models.SignedInUser{UserId: 1}
				_, err := service.SaveDashboard(context.Background(), dto, false)
				require.Error(t, err)
				require.Equal(t, err.Error(), "alert validation error")
			})
		})

		t.Run("Save provisioned dashboard validation", func(t *testing.T) {
			dto := &dashboards.SaveDashboardDTO{}

			t.Run("Should not return validation error if dashboard is provisioned", func(t *testing.T) {
				fakeStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything).Return(true, nil).Once()
				fakeStore.On("SaveProvisionedDashboard", mock.Anything, mock.Anything).Return(&models.Dashboard{Data: simplejson.New()}, nil).Once()

				dto.Dashboard = models.NewDashboard("Dash")
				dto.Dashboard.SetId(3)
				dto.User = &models.SignedInUser{UserId: 1}
				_, err := service.SaveProvisionedDashboard(context.Background(), dto, nil)
				require.NoError(t, err)
			})

			t.Run("Should override invalid refresh interval if dashboard is provisioned", func(t *testing.T) {
				fakeStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything).Return(true, nil).Once()
				fakeStore.On("SaveProvisionedDashboard", mock.Anything, mock.Anything).Return(&models.Dashboard{Data: simplejson.New()}, nil).Once()

				oldRefreshInterval := setting.MinRefreshInterval
				setting.MinRefreshInterval = "5m"
				defer func() { setting.MinRefreshInterval = oldRefreshInterval }()

				dto.Dashboard = models.NewDashboard("Dash")
				dto.Dashboard.SetId(3)
				dto.User = &models.SignedInUser{UserId: 1}
				dto.Dashboard.Data.Set("refresh", "1s")
				_, err := service.SaveProvisionedDashboard(context.Background(), dto, nil)
				require.NoError(t, err)
				require.Equal(t, dto.Dashboard.Data.Get("refresh").MustString(), "5m")
			})
		})

		t.Run("Import dashboard validation", func(t *testing.T) {
			dto := &dashboards.SaveDashboardDTO{}

			t.Run("Should return validation error if dashboard is provisioned", func(t *testing.T) {
				fakeStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.Anything).Return(true, nil).Once()
				fakeStore.On("GetProvisionedDataByDashboardID", mock.Anything).Return(&models.DashboardProvisioning{}, nil).Once()

				dto.Dashboard = models.NewDashboard("Dash")
				dto.Dashboard.SetId(3)
				dto.User = &models.SignedInUser{UserId: 1}
				_, err := service.ImportDashboard(context.Background(), dto)
				require.Equal(t, err, dashboards.ErrDashboardCannotSaveProvisionedDashboard)
			})
		})

		t.Run("Given provisioned dashboard", func(t *testing.T) {
			t.Run("DeleteProvisionedDashboard should delete it", func(t *testing.T) {
				args := &models.DeleteDashboardCommand{OrgId: 1, Id: 1}
				fakeStore.On("DeleteDashboard", mock.Anything, args).Return(nil).Once()
				err := service.DeleteProvisionedDashboard(context.Background(), 1, 1)
				require.NoError(t, err)
			})

			t.Run("DeleteDashboard should fail to delete it when provisioning information is missing", func(t *testing.T) {
				fakeStore.On("GetProvisionedDataByDashboardID", mock.Anything).Return(&models.DashboardProvisioning{}, nil).Once()
				err := service.DeleteDashboard(context.Background(), 1, 1)
				require.Equal(t, err, dashboards.ErrDashboardCannotDeleteProvisionedDashboard)
			})
		})

		t.Run("Given non provisioned dashboard", func(t *testing.T) {
			t.Run("DeleteProvisionedDashboard should delete the dashboard", func(t *testing.T) {
				args := &models.DeleteDashboardCommand{OrgId: 1, Id: 1, ForceDeleteFolderRules: false}
				fakeStore.On("DeleteDashboard", mock.Anything, args).Return(nil).Once()
				err := service.DeleteProvisionedDashboard(context.Background(), 1, 1)
				require.NoError(t, err)
			})

			t.Run("DeleteDashboard should delete it", func(t *testing.T) {
				args := &models.DeleteDashboardCommand{OrgId: 1, Id: 1}
				fakeStore.On("DeleteDashboard", mock.Anything, args).Return(nil).Once()
				fakeStore.On("GetProvisionedDataByDashboardID", mock.Anything).Return(nil, nil).Once()
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
	})

	t.Run("Delete user by acl", func(t *testing.T) {
		fakeStore := dashboards.FakeDashboardStore{}
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
}

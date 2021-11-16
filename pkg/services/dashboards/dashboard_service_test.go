package dashboards

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/dashboards"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"

	"github.com/stretchr/testify/require"
)

func TestDashboardService(t *testing.T) {
	t.Run("Dashboard service tests", func(t *testing.T) {
		bus.ClearBusHandlers()

		fakeStore := fakeDashboardStore{}
		service := &dashboardServiceImpl{
			log:            log.New("test.logger"),
			dashboardStore: &fakeStore,
		}

		origNewDashboardGuardian := guardian.New
		defer func() { guardian.New = origNewDashboardGuardian }()
		guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanSaveValue: true})

		t.Run("Save dashboard validation", func(t *testing.T) {
			dto := &SaveDashboardDTO{}

			t.Run("When saving a dashboard with empty title it should return error", func(t *testing.T) {
				titles := []string{"", " ", "   \t   "}

				for _, title := range titles {
					dto.Dashboard = models.NewDashboard(title)
					_, err := service.SaveDashboard(context.Background(), dto, false)
					require.Equal(t, err, models.ErrDashboardTitleEmpty)
				}
			})

			t.Run("Should return validation error if it's a folder and have a folder id", func(t *testing.T) {
				dto.Dashboard = models.NewDashboardFolder("Folder")
				dto.Dashboard.FolderId = 1
				_, err := service.SaveDashboard(context.Background(), dto, false)
				require.Equal(t, err, models.ErrDashboardFolderCannotHaveParent)
			})

			t.Run("Should return validation error if folder is named General", func(t *testing.T) {
				dto.Dashboard = models.NewDashboardFolder("General")
				_, err := service.SaveDashboard(context.Background(), dto, false)
				require.Equal(t, err, models.ErrDashboardFolderNameExists)
			})

			t.Run("When saving a dashboard should validate uid", func(t *testing.T) {
				origValidateAlerts := validateAlerts
				t.Cleanup(func() {
					validateAlerts = origValidateAlerts
				})
				validateAlerts = func(ctx context.Context, dash *models.Dashboard, user *models.SignedInUser) error {
					return nil
				}

				testCases := []struct {
					Uid   string
					Error error
				}{
					{Uid: "", Error: nil},
					{Uid: "   ", Error: nil},
					{Uid: "  \t  ", Error: nil},
					{Uid: "asdf90_-", Error: nil},
					{Uid: "asdf/90", Error: models.ErrDashboardInvalidUid},
					{Uid: "   asdfghjklqwertyuiopzxcvbnmasdfghjklqwer   ", Error: nil},
					{Uid: "asdfghjklqwertyuiopzxcvbnmasdfghjklqwertyuiopzxcvbnmasdfghjklqwertyuiopzxcvbnm", Error: models.ErrDashboardUidTooLong},
				}

				for _, tc := range testCases {
					dto.Dashboard = models.NewDashboard("title")
					dto.Dashboard.SetUid(tc.Uid)
					dto.User = &models.SignedInUser{}

					_, err := service.buildSaveDashboardCommand(context.Background(), dto, true, false)
					require.Equal(t, err, tc.Error)
				}
			})

			t.Run("Should return validation error if dashboard is provisioned", func(t *testing.T) {
				t.Cleanup(func() {
					fakeStore.provisionedData = nil
				})
				fakeStore.provisionedData = &models.DashboardProvisioning{}

				origValidateAlerts := validateAlerts
				t.Cleanup(func() {
					validateAlerts = origValidateAlerts
				})
				validateAlerts = func(ctx context.Context, dash *models.Dashboard, user *models.SignedInUser) error {
					return nil
				}

				dto.Dashboard = models.NewDashboard("Dash")
				dto.Dashboard.SetId(3)
				dto.User = &models.SignedInUser{UserId: 1}
				_, err := service.SaveDashboard(context.Background(), dto, false)
				require.Equal(t, err, models.ErrDashboardCannotSaveProvisionedDashboard)
			})

			t.Run("Should not return validation error if dashboard is provisioned but UI updates allowed", func(t *testing.T) {
				origValidateAlerts := validateAlerts
				t.Cleanup(func() {
					validateAlerts = origValidateAlerts
				})
				validateAlerts = func(ctx context.Context, dash *models.Dashboard, user *models.SignedInUser) error {
					return nil
				}

				dto.Dashboard = models.NewDashboard("Dash")
				dto.Dashboard.SetId(3)
				dto.User = &models.SignedInUser{UserId: 1}
				_, err := service.SaveDashboard(context.Background(), dto, true)
				require.NoError(t, err)
			})

			t.Run("Should return validation error if alert data is invalid", func(t *testing.T) {
				origValidateAlerts := validateAlerts
				t.Cleanup(func() {
					validateAlerts = origValidateAlerts
				})
				validateAlerts = func(ctx context.Context, dash *models.Dashboard, user *models.SignedInUser) error {
					return fmt.Errorf("alert validation error")
				}

				dto.Dashboard = models.NewDashboard("Dash")
				_, err := service.SaveDashboard(context.Background(), dto, false)
				require.Equal(t, err.Error(), "alert validation error")
			})
		})

		t.Run("Save provisioned dashboard validation", func(t *testing.T) {
			dto := &SaveDashboardDTO{}

			t.Run("Should not return validation error if dashboard is provisioned", func(t *testing.T) {
				origUpdateAlerting := UpdateAlerting
				t.Cleanup(func() {
					UpdateAlerting = origUpdateAlerting
				})
				UpdateAlerting = func(ctx context.Context, store dashboards.Store, orgID int64, dashboard *models.Dashboard,
					user *models.SignedInUser) error {
					return nil
				}

				origValidateAlerts := validateAlerts
				t.Cleanup(func() {
					validateAlerts = origValidateAlerts
				})
				validateAlerts = func(ctx context.Context, dash *models.Dashboard, user *models.SignedInUser) error {
					return nil
				}

				dto.Dashboard = models.NewDashboard("Dash")
				dto.Dashboard.SetId(3)
				dto.User = &models.SignedInUser{UserId: 1}
				_, err := service.SaveProvisionedDashboard(context.Background(), dto, nil)
				require.NoError(t, err)
			})

			t.Run("Should override invalid refresh interval if dashboard is provisioned", func(t *testing.T) {
				oldRefreshInterval := setting.MinRefreshInterval
				setting.MinRefreshInterval = "5m"
				defer func() { setting.MinRefreshInterval = oldRefreshInterval }()

				origValidateAlerts := validateAlerts
				t.Cleanup(func() {
					validateAlerts = origValidateAlerts
				})
				validateAlerts = func(ctx context.Context, dash *models.Dashboard, user *models.SignedInUser) error {
					return nil
				}

				origUpdateAlerting := UpdateAlerting
				t.Cleanup(func() {
					UpdateAlerting = origUpdateAlerting
				})
				UpdateAlerting = func(ctx context.Context, store dashboards.Store, orgID int64, dashboard *models.Dashboard,
					user *models.SignedInUser) error {
					return nil
				}

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
			dto := &SaveDashboardDTO{}

			t.Run("Should return validation error if dashboard is provisioned", func(t *testing.T) {
				t.Cleanup(func() {
					fakeStore.provisionedData = nil
				})
				fakeStore.provisionedData = &models.DashboardProvisioning{}

				origValidateAlerts := validateAlerts
				t.Cleanup(func() {
					validateAlerts = origValidateAlerts
				})
				validateAlerts = func(ctx context.Context, dash *models.Dashboard, user *models.SignedInUser) error {
					return nil
				}

				origUpdateAlerting := UpdateAlerting
				t.Cleanup(func() {
					UpdateAlerting = origUpdateAlerting
				})
				UpdateAlerting = func(ctx context.Context, store dashboards.Store, orgID int64, dashboard *models.Dashboard,
					user *models.SignedInUser) error {
					return nil
				}

				dto.Dashboard = models.NewDashboard("Dash")
				dto.Dashboard.SetId(3)
				dto.User = &models.SignedInUser{UserId: 1}
				_, err := service.ImportDashboard(context.Background(), dto)
				require.Equal(t, err, models.ErrDashboardCannotSaveProvisionedDashboard)
			})
		})

		t.Run("Given provisioned dashboard", func(t *testing.T) {
			t.Run("DeleteProvisionedDashboard should delete it", func(t *testing.T) {
				result := setupDeleteHandlers(t, &fakeStore, true)
				err := service.DeleteProvisionedDashboard(1, 1)
				require.NoError(t, err)
				require.True(t, result.deleteWasCalled)
			})

			t.Run("DeleteDashboard should fail to delete it", func(t *testing.T) {
				result := setupDeleteHandlers(t, &fakeStore, true)
				err := service.DeleteDashboard(1, 1)
				require.Equal(t, err, models.ErrDashboardCannotDeleteProvisionedDashboard)
				require.False(t, result.deleteWasCalled)
			})
		})

		t.Run("Given non provisioned dashboard", func(t *testing.T) {
			result := setupDeleteHandlers(t, &fakeStore, false)

			t.Run("DeleteProvisionedDashboard should delete it", func(t *testing.T) {
				err := service.DeleteProvisionedDashboard(1, 1)
				require.NoError(t, err)
				require.True(t, result.deleteWasCalled)
			})

			t.Run("DeleteDashboard should delete it", func(t *testing.T) {
				err := service.DeleteDashboard(1, 1)
				require.NoError(t, err)
				require.True(t, result.deleteWasCalled)
			})
		})
	})
}

type Result struct {
	deleteWasCalled bool
}

func setupDeleteHandlers(t *testing.T, fakeStore *fakeDashboardStore, provisioned bool) *Result {
	t.Helper()

	t.Cleanup(func() {
		fakeStore.provisionedData = nil
	})
	if provisioned {
		fakeStore.provisionedData = &models.DashboardProvisioning{}
	}

	result := &Result{}
	bus.AddHandler("test", func(cmd *models.DeleteDashboardCommand) error {
		require.Equal(t, cmd.Id, int64(1))
		require.Equal(t, cmd.OrgId, int64(1))
		result.deleteWasCalled = true
		return nil
	})

	return result
}

type fakeDashboardStore struct {
	dashboards.Store

	validationError error
	provisionedData *models.DashboardProvisioning
}

func (s *fakeDashboardStore) ValidateDashboardBeforeSave(dashboard *models.Dashboard, overwrite bool) (
	bool, error) {
	return false, s.validationError
}

func (s *fakeDashboardStore) GetProvisionedDataByDashboardID(int64) (*models.DashboardProvisioning, error) {
	return s.provisionedData, nil
}

func (s *fakeDashboardStore) SaveProvisionedDashboard(models.SaveDashboardCommand,
	*models.DashboardProvisioning) (*models.Dashboard, error) {
	return nil, nil
}

func (s *fakeDashboardStore) SaveDashboard(cmd models.SaveDashboardCommand) (*models.Dashboard, error) {
	return cmd.GetDashboardModel(), nil
}

func (s *fakeDashboardStore) SaveAlerts(ctx context.Context, dashID int64, alerts []*models.Alert) error {
	return nil
}

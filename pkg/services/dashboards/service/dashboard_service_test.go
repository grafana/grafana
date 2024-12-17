package service

import (
	"context"
	"reflect"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestDashboardService(t *testing.T) {
	t.Run("Dashboard service tests", func(t *testing.T) {
		fakeStore := dashboards.FakeDashboardStore{}
		defer fakeStore.AssertExpectations(t)

		folderSvc := foldertest.NewFakeService()

		service := &DashboardServiceImpl{
			cfg:            setting.NewCfg(),
			log:            log.New("test.logger"),
			dashboardStore: &fakeStore,
			folderService:  folderSvc,
			features:       featuremgmt.WithFeatures(),
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
					_, err := service.BuildSaveDashboardCommand(context.Background(), dto, false)
					require.Equal(t, err, tc.Error)
				}
			})

			t.Run("Should return validation error if a folder that is specified can't be found", func(t *testing.T) {
				dto.Dashboard = dashboards.NewDashboard("Dash")
				dto.Dashboard.FolderUID = "non-existing-folder"
				folderStore := foldertest.FakeFolderStore{}
				folderStore.On("GetFolderByUID", mock.Anything, mock.AnythingOfType("int64"), mock.AnythingOfType("string")).Return(nil, dashboards.ErrFolderNotFound).Once()
				service.folderStore = &folderStore
				_, err := service.SaveDashboard(context.Background(), dto, false)
				require.Equal(t, err, dashboards.ErrFolderNotFound)
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

				oldRefreshInterval := service.cfg.MinRefreshInterval
				service.cfg.MinRefreshInterval = "5m"
				defer func() { service.cfg.MinRefreshInterval = oldRefreshInterval }()

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
				args := &dashboards.DeleteDashboardCommand{OrgID: 1, ID: 1}
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
		})

		t.Run("Count dashboards in folder", func(t *testing.T) {
			fakeStore.On("CountDashboardsInFolders", mock.Anything, mock.AnythingOfType("*dashboards.CountDashboardsInFolderRequest")).Return(int64(3), nil)
			folderSvc.ExpectedFolder = &folder.Folder{UID: "i am a folder"}
			// set up a ctx with signed in user
			usr := &user.SignedInUser{UserID: 1}
			ctx := identity.WithRequester(context.Background(), usr)

			count, err := service.CountInFolders(ctx, 1, []string{"i am a folder"}, usr)
			require.NoError(t, err)
			require.Equal(t, int64(3), count)
		})

		t.Run("Delete dashboards in folder", func(t *testing.T) {
			args := &dashboards.DeleteDashboardsInFolderRequest{OrgID: 1, FolderUIDs: []string{"uid"}}
			fakeStore.On("DeleteDashboardsInFolders", mock.Anything, args).Return(nil).Once()
			err := service.DeleteInFolders(context.Background(), 1, []string{"uid"}, nil)
			require.NoError(t, err)
		})

		t.Run("Soft Delete dashboards in folder", func(t *testing.T) {
			service.features = featuremgmt.WithFeatures(featuremgmt.FlagDashboardRestore)
			fakeStore.On("SoftDeleteDashboardsInFolders", mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()
			err := service.DeleteInFolders(context.Background(), 1, []string{"uid"}, nil)
			require.NoError(t, err)
		})
	})
}

type mockDashK8sCli struct {
	mock.Mock
}

func (m *mockDashK8sCli) getClient(ctx context.Context, orgID int64) (dynamic.ResourceInterface, bool) {
	args := m.Called(ctx, orgID)
	return args.Get(0).(dynamic.ResourceInterface), args.Bool(1)
}

type mockResourceInterface struct {
	mock.Mock
	dynamic.ResourceInterface
}

func (m *mockResourceInterface) Get(ctx context.Context, name string, options metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, name, options, subresources)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func TestGetDashboard(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
	}

	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		query := &dashboards.GetDashboardQuery{
			UID:   "test-uid",
			OrgID: 1,
		}

		fakeStore.On("GetDashboard", mock.Anything, query).Return(&dashboards.Dashboard{}, nil).Once()
		dashboard, err := service.GetDashboard(context.Background(), query)
		require.NoError(t, err)
		require.NotNil(t, dashboard)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled", func(t *testing.T) {
		k8sClientMock := new(mockDashK8sCli)
		k8sResourceMock := new(mockResourceInterface)
		service.k8sclient = k8sClientMock
		service.features = featuremgmt.WithFeatures(featuremgmt.FlagKubernetesCliDashboards)
		query := &dashboards.GetDashboardQuery{
			UID:   "test-uid",
			OrgID: 1,
		}

		dashboardUnstructured := unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"name": "uid",
			},
			"spec": map[string]any{
				"test":  "test",
				"title": "testing slugify",
			},
		}}

		dashboardExpected := dashboards.Dashboard{
			UID:   "uid", // uid is the name of the k8s object
			Title: "testing slugify",
			Slug:  "testing-slugify", // slug is taken from title
			OrgID: 1,                 // orgID is populated from the query
			Data:  simplejson.NewFromAny(map[string]any{"test": "test", "title": "testing slugify"}),
		}

		ctx := context.Background()
		userCtx := &user.SignedInUser{UserID: 1}
		ctx = identity.WithRequester(ctx, userCtx)
		k8sClientMock.On("getClient", mock.Anything, int64(1)).Return(k8sResourceMock, true).Once()
		k8sResourceMock.On("Get", mock.Anything, query.UID, mock.Anything, mock.Anything).Return(&dashboardUnstructured, nil).Once()

		dashboard, err := service.GetDashboard(ctx, query)
		require.NoError(t, err)
		require.NotNil(t, dashboard)
		k8sClientMock.AssertExpectations(t)
		// make sure the conversion is working
		require.True(t, reflect.DeepEqual(dashboard, &dashboardExpected))
	})

	t.Run("Should return error when Kubernetes client fails", func(t *testing.T) {
		k8sClientMock := new(mockDashK8sCli)
		k8sResourceMock := new(mockResourceInterface)
		service.k8sclient = k8sClientMock
		service.features = featuremgmt.WithFeatures(featuremgmt.FlagKubernetesCliDashboards)
		query := &dashboards.GetDashboardQuery{
			UID:   "test-uid",
			OrgID: 1,
		}

		ctx := context.Background()
		userCtx := &user.SignedInUser{UserID: 1}
		ctx = identity.WithRequester(ctx, userCtx)
		k8sClientMock.On("getClient", mock.Anything, int64(1)).Return(k8sResourceMock, true).Once()
		k8sResourceMock.On("Get", mock.Anything, query.UID, mock.Anything, mock.Anything).Return(nil, assert.AnError).Once()

		dashboard, err := service.GetDashboard(ctx, query)
		require.Error(t, err)
		require.Nil(t, dashboard)
		k8sClientMock.AssertExpectations(t)
	})

	t.Run("Should return dashboard not found if Kubernetes client returns nil", func(t *testing.T) {
		k8sClientMock := new(mockDashK8sCli)
		k8sResourceMock := new(mockResourceInterface)
		service.k8sclient = k8sClientMock
		service.features = featuremgmt.WithFeatures(featuremgmt.FlagKubernetesCliDashboards)
		query := &dashboards.GetDashboardQuery{
			UID:   "test-uid",
			OrgID: 1,
		}

		ctx := context.Background()
		userCtx := &user.SignedInUser{UserID: 1}
		ctx = identity.WithRequester(ctx, userCtx)
		k8sClientMock.On("getClient", mock.Anything, int64(1)).Return(k8sResourceMock, true).Once()
		k8sResourceMock.On("Get", mock.Anything, query.UID, mock.Anything, mock.Anything).Return(nil, nil).Once()

		dashboard, err := service.GetDashboard(ctx, query)
		require.Error(t, err)
		require.Equal(t, dashboards.ErrDashboardNotFound, err)
		require.Nil(t, dashboard)
		k8sClientMock.AssertExpectations(t)
	})
}

package service

import (
	"context"
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/dashboard"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestDashboardService(t *testing.T) {
	t.Run("Dashboard service tests", func(t *testing.T) {
		fakeStore := dashboards.FakeDashboardStore{}
		fakePublicDashboardService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)
		defer fakeStore.AssertExpectations(t)

		folderSvc := foldertest.NewFakeService()
		service := &DashboardServiceImpl{
			cfg:                    setting.NewCfg(),
			log:                    log.New("test.logger"),
			dashboardStore:         &fakeStore,
			folderService:          folderSvc,
			features:               featuremgmt.WithFeatures(),
			publicDashboardService: fakePublicDashboardService,
		}
		folderStore := foldertest.FakeFolderStore{}
		folderStore.On("GetFolderByUID", mock.Anything, mock.AnythingOfType("int64"), mock.AnythingOfType("string")).Return(nil, dashboards.ErrFolderNotFound).Once()
		service.folderStore = &folderStore

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

			t.Run("Should return validation error if message is too long", func(t *testing.T) {
				dto.Dashboard = dashboards.NewDashboard("Dash")
				dto.Message = `Here we go, 500+ characters for testing. I'm sorry that you're
				having to read this. I spent too long trying to come up with something clever
				to say or a funny joke. Unforuntately, nothing came to mind. So instead, I'm
				will share this with you, as a form of payment for having to read this:
				https://youtu.be/dQw4w9WgXcQ?si=KeoTIpn9tUtQnOBk! Enjoy :) Now lets see if
				this test passes or if the result is more exciting than these 500 characters
				I wrote. Best of luck to the both of us!`
				_, err := service.SaveDashboard(context.Background(), dto, false)
				require.Equal(t, err, dashboards.ErrDashboardMessageTooLong)

				// set to a shorter message for the rest of the tests
				dto.Message = `message`
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
						fakeStore.On("GetDashboard", mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil).Once()
					}
					_, err := service.BuildSaveDashboardCommand(context.Background(), dto, false)
					require.Equal(t, err, tc.Error)
				}
			})

			t.Run("Should return validation error if a folder that is specified can't be found", func(t *testing.T) {
				dto.Dashboard = dashboards.NewDashboard("Dash")
				dto.Dashboard.FolderUID = "non-existing-folder"
				folderSvc := foldertest.FakeService{ExpectedError: dashboards.ErrFolderNotFound}
				service.folderService = &folderSvc
				_, err := service.SaveDashboard(context.Background(), dto, false)
				require.Equal(t, err, dashboards.ErrFolderNotFound)
			})

			t.Run("Should return validation error if dashboard is provisioned", func(t *testing.T) {
				fakeStore.On("GetDashboard", mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil).Once()
				fakeStore.On("GetProvisionedDataByDashboardID", mock.Anything, mock.AnythingOfType("int64")).Return(&dashboards.DashboardProvisioning{}, nil).Once()

				dto.Dashboard = dashboards.NewDashboard("Dash")
				dto.Dashboard.SetID(3)
				dto.User = &user.SignedInUser{UserID: 1}
				_, err := service.SaveDashboard(context.Background(), dto, false)
				require.Equal(t, err, dashboards.ErrDashboardCannotSaveProvisionedDashboard)
			})

			t.Run("Should not return validation error if dashboard is provisioned but UI updates allowed", func(t *testing.T) {
				fakeStore.On("GetDashboard", mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil).Once()
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
				fakeStore.On("SaveProvisionedDashboard", mock.Anything, mock.Anything, mock.AnythingOfType("*dashboards.DashboardProvisioning")).Return(nil).Once()
				fakeStore.On("SaveDashboard", mock.Anything, mock.AnythingOfType("dashboards.SaveDashboardCommand")).Return(&dashboards.Dashboard{Data: simplejson.New()}, nil).Once()

				dto.Dashboard = dashboards.NewDashboard("Dash")
				dto.Dashboard.SetID(3)
				dto.User = &user.SignedInUser{UserID: 1}
				_, err := service.SaveProvisionedDashboard(context.Background(), dto, nil)
				require.NoError(t, err)
			})

			t.Run("Should override invalid refresh interval if dashboard is provisioned", func(t *testing.T) {
				fakeStore.On("SaveProvisionedDashboard", mock.Anything, mock.Anything, mock.AnythingOfType("*dashboards.DashboardProvisioning")).Return(nil).Once()
				fakeStore.On("SaveDashboard", mock.Anything, mock.AnythingOfType("dashboards.SaveDashboardCommand")).Return(&dashboards.Dashboard{Data: simplejson.New()}, nil).Once()

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
				fakePublicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()
				err := service.DeleteProvisionedDashboard(context.Background(), 1, 1)
				require.NoError(t, err)
			})

			t.Run("DeleteDashboard should fail to delete it when provisioning information is missing", func(t *testing.T) {
				fakeStore.On("GetProvisionedDataByDashboardID", mock.Anything, mock.AnythingOfType("int64")).Return(&dashboards.DashboardProvisioning{}, nil).Once()
				err := service.DeleteDashboard(context.Background(), 1, "", 1)
				require.Equal(t, err, dashboards.ErrDashboardCannotDeleteProvisionedDashboard)
			})
		})

		t.Run("Given non provisioned dashboard", func(t *testing.T) {
			t.Run("DeleteProvisionedDashboard should delete the dashboard", func(t *testing.T) {
				args := &dashboards.DeleteDashboardCommand{OrgID: 1, ID: 1}
				fakeStore.On("DeleteDashboard", mock.Anything, args).Return(nil).Once()
				fakePublicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()
				err := service.DeleteProvisionedDashboard(context.Background(), 1, 1)
				require.NoError(t, err)
			})

			t.Run("DeleteDashboard should delete it", func(t *testing.T) {
				args := &dashboards.DeleteDashboardCommand{OrgID: 1, ID: 1}
				fakeStore.On("DeleteDashboard", mock.Anything, args).Return(nil).Once()
				fakeStore.On("GetProvisionedDataByDashboardID", mock.Anything, mock.AnythingOfType("int64")).Return(nil, nil).Once()
				fakePublicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()
				err := service.DeleteDashboard(context.Background(), 1, "", 1)
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
			fakeStore.On("FindDashboards", mock.Anything, mock.Anything).Return([]dashboards.DashboardSearchProjection{}, nil).Once()
			fakePublicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()
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

func setupK8sDashboardTests(service *DashboardServiceImpl) (context.Context, *client.MockK8sHandler) {
	mockCli := new(client.MockK8sHandler)
	service.k8sclient = mockCli
	service.features = featuremgmt.WithFeatures(featuremgmt.FlagKubernetesClientDashboardsFolders)

	ctx := context.Background()
	userCtx := &user.SignedInUser{UserID: 1, OrgID: 1}
	ctx = identity.WithRequester(ctx, userCtx)

	return ctx, mockCli
}

func TestGetDashboard(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
	}
	query := &dashboards.GetDashboardQuery{
		UID:   "test-uid",
		OrgID: 1,
	}

	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("GetDashboard", mock.Anything, query).Return(&dashboards.Dashboard{}, nil).Once()
		dashboard, err := service.GetDashboard(context.Background(), query)
		require.NoError(t, err)
		require.NotNil(t, dashboard)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		dashboardUnstructured := unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"name": "uid",
			},
			"spec": map[string]any{
				"test":    "test",
				"version": int64(1),
				"title":   "testing slugify",
			},
		}}

		dashboardExpected := dashboards.Dashboard{
			UID:     "uid", // uid is the name of the k8s object
			Title:   "testing slugify",
			Slug:    "testing-slugify", // slug is taken from title
			OrgID:   1,                 // orgID is populated from the query
			Version: 1,
			Data:    simplejson.NewFromAny(map[string]any{"test": "test", "title": "testing slugify", "uid": "uid", "version": int64(1)}),
		}
		k8sCliMock.On("Get", mock.Anything, query.UID, mock.Anything, mock.Anything, mock.Anything).Return(&dashboardUnstructured, nil).Once()
		k8sCliMock.On("GetUserFromMeta", mock.Anything, mock.Anything).Return(&user.User{}, nil)

		dashboard, err := service.GetDashboard(ctx, query)
		require.NoError(t, err)
		require.NotNil(t, dashboard)
		k8sCliMock.AssertExpectations(t)
		// make sure the conversion is working
		require.True(t, reflect.DeepEqual(dashboard, &dashboardExpected))
	})

	t.Run("Should get uid if not passed in at first", func(t *testing.T) {
		query := &dashboards.GetDashboardQuery{
			ID:    1,
			UID:   "",
			OrgID: 1,
		}
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
		dashboardUnstructured := unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"name": "uid",
			},
			"spec": map[string]any{
				"test":    "test",
				"version": int64(1),
				"title":   "testing slugify",
			},
		}}

		dashboardExpected := dashboards.Dashboard{
			UID:     "uid", // uid is the name of the k8s object
			Title:   "testing slugify",
			Slug:    "testing-slugify", // slug is taken from title
			OrgID:   1,                 // orgID is populated from the query
			Version: 1,
			Data:    simplejson.NewFromAny(map[string]any{"test": "test", "title": "testing slugify", "uid": "uid", "version": int64(1)}),
		}
		k8sCliMock.On("Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&dashboardUnstructured, nil).Once()
		k8sCliMock.On("GetUserFromMeta", mock.Anything, mock.Anything).Return(&user.User{}, nil)
		k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key: &resource.ResourceKey{
							Name:     "uid",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 1"),
							[]byte("folder1"),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil)

		dashboard, err := service.GetDashboard(ctx, query)
		require.NoError(t, err)
		require.NotNil(t, dashboard)
		k8sCliMock.AssertExpectations(t)
		k8sCliMock.AssertExpectations(t)
		// make sure the conversion is working
		require.True(t, reflect.DeepEqual(dashboard, &dashboardExpected))
	})

	t.Run("Should return error when Kubernetes client fails", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("Get", mock.Anything, query.UID, mock.Anything, mock.Anything, mock.Anything).Return(nil, assert.AnError).Once()

		dashboard, err := service.GetDashboard(ctx, query)
		require.Error(t, err)
		require.Nil(t, dashboard)
		k8sCliMock.AssertExpectations(t)
	})

	t.Run("Should return dashboard not found if Kubernetes client returns nil", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("Get", mock.Anything, query.UID, mock.Anything, mock.Anything, mock.Anything).Return(nil, nil).Once()
		dashboard, err := service.GetDashboard(ctx, query)
		require.Error(t, err)
		require.Equal(t, dashboards.ErrDashboardNotFound, err)
		require.Nil(t, dashboard)
		k8sCliMock.AssertExpectations(t)
	})
}

func TestGetAllDashboards(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
	}

	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("GetAllDashboards", mock.Anything).Return([]*dashboards.Dashboard{}, nil).Once()
		dashboard, err := service.GetAllDashboards(context.Background())
		require.NoError(t, err)
		require.NotNil(t, dashboard)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)

		dashboardUnstructured := unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"name": "uid",
			},
			"spec": map[string]any{
				"test":    "test",
				"version": int64(1),
				"title":   "testing slugify",
			},
		}}

		dashboardExpected := dashboards.Dashboard{
			UID:     "uid", // uid is the name of the k8s object
			Title:   "testing slugify",
			Slug:    "testing-slugify", // slug is taken from title
			OrgID:   1,                 // orgID is populated from the query
			Version: 1,                 // default to version 1
			Data:    simplejson.NewFromAny(map[string]any{"test": "test", "title": "testing slugify", "uid": "uid", "version": int64(1)}),
		}

		k8sCliMock.On("GetUserFromMeta", mock.Anything, mock.Anything).Return(&user.User{}, nil)
		k8sCliMock.On("List", mock.Anything, mock.Anything, mock.Anything).Return(&unstructured.UnstructuredList{Items: []unstructured.Unstructured{dashboardUnstructured}}, nil).Once()

		dashes, err := service.GetAllDashboards(ctx)
		require.NoError(t, err)
		require.NotNil(t, dashes)
		k8sCliMock.AssertExpectations(t)
		// make sure the conversion is working
		require.True(t, reflect.DeepEqual(dashes, []*dashboards.Dashboard{&dashboardExpected}))
	})
}

func TestGetAllDashboardsByOrgId(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
	}

	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("GetAllDashboardsByOrgId", mock.Anything, int64(1)).Return([]*dashboards.Dashboard{}, nil).Once()
		dashboard, err := service.GetAllDashboardsByOrgId(context.Background(), 1)
		require.NoError(t, err)
		require.NotNil(t, dashboard)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)

		dashboardUnstructured := unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"name": "uid",
			},
			"spec": map[string]any{
				"test":    "test",
				"version": int64(1),
				"title":   "testing slugify",
			},
		}}

		dashboardExpected := dashboards.Dashboard{
			UID:     "uid", // uid is the name of the k8s object
			Title:   "testing slugify",
			Slug:    "testing-slugify", // slug is taken from title
			OrgID:   1,                 // orgID is populated from the query
			Version: 1,                 // default to version 1
			Data:    simplejson.NewFromAny(map[string]any{"test": "test", "title": "testing slugify", "uid": "uid", "version": int64(1)}),
		}

		k8sCliMock.On("GetUserFromMeta", mock.Anything, mock.Anything).Return(&user.User{}, nil)
		k8sCliMock.On("List", mock.Anything, mock.Anything, mock.Anything).Return(&unstructured.UnstructuredList{Items: []unstructured.Unstructured{dashboardUnstructured}}, nil).Once()

		dashes, err := service.GetAllDashboardsByOrgId(ctx, 1)
		require.NoError(t, err)
		require.NotNil(t, dashes)
		k8sCliMock.AssertExpectations(t)
		// make sure the conversion is working
		require.True(t, reflect.DeepEqual(dashes, []*dashboards.Dashboard{&dashboardExpected}))
	})
}

func TestGetProvisionedDashboardData(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
		orgService: &orgtest.FakeOrgService{
			ExpectedOrgs: []*org.OrgDTO{{ID: 1}, {ID: 2}},
		},
	}

	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("GetProvisionedDashboardData", mock.Anything, "test").Return([]*dashboards.DashboardProvisioning{}, nil).Once()
		dashboard, err := service.GetProvisionedDashboardData(context.Background(), "test")
		require.NoError(t, err)
		require.NotNil(t, dashboard)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled and get from relevant org", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
		k8sCliMock.On("Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"name": "uid",
				"labels": map[string]any{
					utils.LabelKeyDeprecatedInternalID: "1", // nolint:staticcheck
				},
				"annotations": map[string]any{
					utils.AnnoKeyRepoName:      dashboard.ProvisionedFileNameWithPrefix("test"),
					utils.AnnoKeyRepoHash:      "hash",
					utils.AnnoKeyRepoPath:      "path/to/file",
					utils.AnnoKeyRepoTimestamp: "2025-01-01T00:00:00Z",
				},
			},
			"spec": map[string]any{
				"test":    "test",
				"version": int64(1),
				"title":   "testing slugify",
			},
		}}, nil).Once()
		repo := "test"
		k8sCliMock.On("Search", mock.Anything, int64(1),
			mock.MatchedBy(func(req *resource.ResourceSearchRequest) bool {
				// ensure the prefix is added to the query
				return req.Options.Fields[0].Values[0] == dashboard.ProvisionedFileNameWithPrefix(repo)
			})).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{},
				Rows:    []*resource.ResourceTableRow{},
			},
			TotalHits: 0,
		}, nil).Once()
		k8sCliMock.On("Search", mock.Anything, int64(2), mock.MatchedBy(func(req *resource.ResourceSearchRequest) bool {
			// ensure the prefix is added to the query
			return req.Options.Fields[0].Values[0] == dashboard.ProvisionedFileNameWithPrefix(repo)
		})).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key: &resource.ResourceKey{
							Name:     "uid",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 1"),
							[]byte("folder 1"),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil).Once()
		dashes, err := service.GetProvisionedDashboardData(ctx, repo)
		require.NoError(t, err)
		require.Len(t, dashes, 1)
		require.Equal(t, dashes[0], &dashboards.DashboardProvisioning{
			ID:          0,
			DashboardID: 1,
			Name:        "test",
			ExternalID:  "path/to/file",
			CheckSum:    "hash",
			Updated:     1735689600,
		})
		k8sCliMock.AssertExpectations(t)
	})
}

func TestGetProvisionedDashboardDataByDashboardID(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
		orgService: &orgtest.FakeOrgService{
			ExpectedOrgs: []*org.OrgDTO{{ID: 1}, {ID: 2}},
		},
	}

	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("GetProvisionedDataByDashboardID", mock.Anything, int64(1)).Return(&dashboards.DashboardProvisioning{}, nil).Once()
		dashboard, err := service.GetProvisionedDashboardDataByDashboardID(context.Background(), 1)
		require.NoError(t, err)
		require.NotNil(t, dashboard)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled and get from whatever org it is in", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
		k8sCliMock.On("Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"name": "uid",
				"labels": map[string]any{
					utils.LabelKeyDeprecatedInternalID: "1", // nolint:staticcheck
				},
				"annotations": map[string]any{
					utils.AnnoKeyRepoName:      dashboard.ProvisionedFileNameWithPrefix("test"),
					utils.AnnoKeyRepoHash:      "hash",
					utils.AnnoKeyRepoPath:      "path/to/file",
					utils.AnnoKeyRepoTimestamp: "2025-01-01T00:00:00Z",
				},
			},
			"spec": map[string]any{
				"test":    "test",
				"version": int64(1),
				"title":   "testing slugify",
			},
		}}, nil)
		k8sCliMock.On("Search", mock.Anything, int64(1), mock.Anything).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{},
				Rows:    []*resource.ResourceTableRow{},
			},
			TotalHits: 0,
		}, nil)
		k8sCliMock.On("Search", mock.Anything, int64(2), mock.Anything).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key: &resource.ResourceKey{
							Name:     "uid",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 1"),
							[]byte("folder 1"),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil)
		dash, err := service.GetProvisionedDashboardDataByDashboardID(ctx, 1)
		require.NoError(t, err)
		require.Equal(t, dash, &dashboards.DashboardProvisioning{
			ID:          0,
			DashboardID: 1,
			Name:        "test",
			ExternalID:  "path/to/file",
			CheckSum:    "hash",
			Updated:     1735689600,
		})
		k8sCliMock.AssertExpectations(t)
	})
}

func TestGetProvisionedDashboardDataByDashboardUID(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
		orgService: &orgtest.FakeOrgService{
			ExpectedOrgs: []*org.OrgDTO{{ID: 1}, {ID: 2}},
		},
	}

	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("GetProvisionedDataByDashboardUID", mock.Anything, int64(1), "test").Return(&dashboards.DashboardProvisioning{}, nil).Once()
		dashboard, err := service.GetProvisionedDashboardDataByDashboardUID(context.Background(), 1, "test")
		require.NoError(t, err)
		require.NotNil(t, dashboard)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
		k8sCliMock.On("Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"name": "uid",
				"labels": map[string]any{
					utils.LabelKeyDeprecatedInternalID: "1", // nolint:staticcheck
				},
				"annotations": map[string]any{
					utils.AnnoKeyRepoName:      dashboard.ProvisionedFileNameWithPrefix("test"),
					utils.AnnoKeyRepoHash:      "hash",
					utils.AnnoKeyRepoPath:      "path/to/file",
					utils.AnnoKeyRepoTimestamp: "2025-01-01T00:00:00Z",
				},
			},
			"spec": map[string]any{
				"test":    "test",
				"version": int64(1),
				"title":   "testing slugify",
			},
		}}, nil).Once()
		k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key: &resource.ResourceKey{
							Name:     "uid",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 1"),
							[]byte("folder 1"),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil).Once()
		dash, err := service.GetProvisionedDashboardDataByDashboardUID(ctx, 1, "uid")
		require.NoError(t, err)
		require.Equal(t, dash, &dashboards.DashboardProvisioning{
			ID:          0,
			DashboardID: 1,
			Name:        "test",
			ExternalID:  "path/to/file",
			CheckSum:    "hash",
			Updated:     1735689600,
		})
		k8sCliMock.AssertExpectations(t)
	})
}

func TestDeleteOrphanedProvisionedDashboards(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	fakePublicDashboardService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
		orgService: &orgtest.FakeOrgService{
			ExpectedOrgs: []*org.OrgDTO{{ID: 1}, {ID: 2}},
		},
		publicDashboardService: fakePublicDashboardService,
	}

	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("DeleteOrphanedProvisionedDashboards", mock.Anything, &dashboards.DeleteOrphanedProvisionedDashboardsCommand{
			ReaderNames: []string{"test"},
		}).Return(nil).Once()
		err := service.DeleteOrphanedProvisionedDashboards(context.Background(), &dashboards.DeleteOrphanedProvisionedDashboardsCommand{
			ReaderNames: []string{"test"},
		})
		require.NoError(t, err)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled, delete across all orgs, but only delete file based provisioned dashboards", func(t *testing.T) {
		_, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
		k8sCliMock.On("Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
		fakeStore.On("CleanupAfterDelete", mock.Anything, &dashboards.DeleteDashboardCommand{UID: "uid", OrgID: 1}).Return(nil).Once()
		fakeStore.On("CleanupAfterDelete", mock.Anything, &dashboards.DeleteDashboardCommand{UID: "uid3", OrgID: 2}).Return(nil).Once()
		fakePublicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, mock.Anything, mock.Anything).Return(nil)
		k8sCliMock.On("Get", mock.Anything, "uid", mock.Anything, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"name": "uid",
				"annotations": map[string]any{
					utils.AnnoKeyRepoName:      dashboard.ProvisionedFileNameWithPrefix("orphaned"),
					utils.AnnoKeyRepoHash:      "hash",
					utils.AnnoKeyRepoPath:      "path/to/file",
					utils.AnnoKeyRepoTimestamp: "2025-01-01T00:00:00Z",
				},
			},
			"spec": map[string]any{},
		}}, nil).Once()
		// should not delete this one, because it does not start with "file:"
		k8sCliMock.On("Get", mock.Anything, "uid2", mock.Anything, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"name": "uid2",
				"annotations": map[string]any{
					utils.AnnoKeyRepoName: dashboard.PluginIDRepoName,
					utils.AnnoKeyRepoHash: "app",
				},
			},
			"spec": map[string]any{},
		}}, nil).Once()

		k8sCliMock.On("Get", mock.Anything, "uid3", mock.Anything, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"name": "uid3",
				"annotations": map[string]any{
					utils.AnnoKeyRepoName:      dashboard.ProvisionedFileNameWithPrefix("orphaned"),
					utils.AnnoKeyRepoHash:      "hash",
					utils.AnnoKeyRepoPath:      "path/to/file",
					utils.AnnoKeyRepoTimestamp: "2025-01-01T00:00:00Z",
				},
			},
			"spec": map[string]any{},
		}}, nil).Once()
		k8sCliMock.On("Search", mock.Anything, int64(1), mock.MatchedBy(func(req *resource.ResourceSearchRequest) bool {
			return req.Options.Fields[0].Key == "repo.name" && req.Options.Fields[0].Values[0] == dashboard.ProvisionedFileNameWithPrefix("test") && req.Options.Fields[0].Operator == "notin"
		})).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key: &resource.ResourceKey{
							Name:     "uid",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 1"),
							[]byte("folder 1"),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil).Once()

		k8sCliMock.On("Search", mock.Anything, int64(2), mock.MatchedBy(func(req *resource.ResourceSearchRequest) bool {
			return req.Options.Fields[0].Key == "repo.name" && req.Options.Fields[0].Values[0] == dashboard.ProvisionedFileNameWithPrefix("test") && req.Options.Fields[0].Operator == "notin"
		})).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key: &resource.ResourceKey{
							Name:     "uid2",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 2"),
							[]byte("folder 2"),
						},
					},
					{
						Key: &resource.ResourceKey{
							Name:     "uid3",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 3"),
							[]byte("folder 3"),
						},
					},
				},
			},
			TotalHits: 2,
		}, nil).Once()
		err := service.DeleteOrphanedProvisionedDashboards(context.Background(), &dashboards.DeleteOrphanedProvisionedDashboardsCommand{
			ReaderNames: []string{"test"},
		})
		require.NoError(t, err)
		k8sCliMock.AssertExpectations(t)
	})
}

func TestUnprovisionDashboard(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
		orgService: &orgtest.FakeOrgService{
			ExpectedOrgs: []*org.OrgDTO{{ID: 1}, {ID: 2}},
		},
	}

	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("UnprovisionDashboard", mock.Anything, int64(1)).Return(nil).Once()
		err := service.UnprovisionDashboard(context.Background(), 1)
		require.NoError(t, err)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled - should remove annotations", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		dash := &unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"name": "uid",
				"annotations": map[string]any{
					utils.AnnoKeyRepoName:      dashboard.ProvisionedFileNameWithPrefix("test"),
					utils.AnnoKeyRepoHash:      "hash",
					utils.AnnoKeyRepoPath:      "path/to/file",
					utils.AnnoKeyRepoTimestamp: "2025-01-01T00:00:00Z",
				},
			},
			"spec": map[string]any{},
		}}
		k8sCliMock.On("Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(dash, nil)
		dashWithoutAnnotations := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "Dashboard",
			"metadata": map[string]any{
				"name":        "uid",
				"namespace":   "default",
				"annotations": map[string]any{},
			},
			"spec": map[string]any{
				"uid":     "uid",
				"version": 1,
			},
		}}
		// should update it to be without annotations
		k8sCliMock.On("Update", mock.Anything, dashWithoutAnnotations, mock.Anything, mock.Anything).Return(dashWithoutAnnotations, nil)
		k8sCliMock.On("GetNamespace", mock.Anything).Return("default")
		k8sCliMock.On("GetUserFromMeta", mock.Anything, mock.Anything).Return(&user.User{}, nil)
		k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key: &resource.ResourceKey{
							Name:     "uid",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 1"),
							[]byte("folder 1"),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil)
		err := service.UnprovisionDashboard(ctx, 1)
		require.NoError(t, err)
		k8sCliMock.AssertExpectations(t)
	})
}

func TestGetDashboardsByPluginID(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
	}

	query := &dashboards.GetDashboardsByPluginIDQuery{
		PluginID: "testing",
		OrgID:    1,
	}
	uidUnstructured := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{
			"name": "uid1",
		},
		"spec": map[string]any{
			"title": "Dashboard 1",
		},
	}}

	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("GetDashboardsByPluginID", mock.Anything, mock.Anything).Return([]*dashboards.Dashboard{}, nil).Once()
		_, err := service.GetDashboardsByPluginID(context.Background(), query)
		require.NoError(t, err)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
		k8sCliMock.On("Get", mock.Anything, "uid", mock.Anything, mock.Anything, mock.Anything).Return(uidUnstructured, nil)
		k8sCliMock.On("GetUserFromMeta", mock.Anything, mock.Anything).Return(&user.User{}, nil)
		k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.MatchedBy(func(req *resource.ResourceSearchRequest) bool {
			return req.Options.Fields[0].Key == "repo.name" && req.Options.Fields[0].Values[0] == dashboard.PluginIDRepoName &&
				req.Options.Fields[1].Key == "repo.path" && req.Options.Fields[1].Values[0] == "testing"
		})).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key: &resource.ResourceKey{
							Name:     "uid",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 1"),
							[]byte("folder 1"),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil)
		dashes, err := service.GetDashboardsByPluginID(ctx, query)
		require.NoError(t, err)
		require.Len(t, dashes, 1)
		k8sCliMock.AssertExpectations(t)
	})
}

func TestSaveProvisionedDashboard(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
		folderService: &foldertest.FakeService{
			ExpectedFolder: &folder.Folder{
				ID:  0,
				UID: "general",
			},
		},
		log: log.NewNopLogger(),
	}

	origNewDashboardGuardian := guardian.New
	defer func() { guardian.New = origNewDashboardGuardian }()
	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanSaveValue: true})

	query := &dashboards.SaveDashboardDTO{
		OrgID: 1,
		User:  &user.SignedInUser{UserID: 1},
		Dashboard: &dashboards.Dashboard{
			UID:   "uid",
			Title: "testing slugify",
			Slug:  "testing-slugify",
			OrgID: 1,
			Data:  simplejson.NewFromAny(map[string]any{"test": "test", "title": "testing slugify", "uid": "uid"}),
		},
	}

	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("GetDashboard", mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil)
		fakeStore.On("SaveProvisionedDashboard", mock.Anything, mock.Anything, mock.Anything).Return(nil)
		fakeStore.On("SaveDashboard", mock.Anything, mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil)
		dashboard, err := service.SaveProvisionedDashboard(context.Background(), query, &dashboards.DashboardProvisioning{})
		require.NoError(t, err)
		require.NotNil(t, dashboard)
		fakeStore.AssertExpectations(t)
	})

	dashboardUnstructured := unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{
			"name": "uid",
		},
		"spec": map[string]any{
			"test":    "test",
			"version": int64(1),
			"title":   "testing slugify",
		},
	}}

	t.Run("Should use Kubernetes create if feature flags are enabled", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		fakeStore.On("SaveProvisionedDashboard", mock.Anything, mock.Anything, mock.Anything).Return(nil)
		k8sCliMock.On("Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, nil)
		k8sCliMock.On("GetUserFromMeta", mock.Anything, mock.Anything).Return(&user.User{}, nil)
		k8sCliMock.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&dashboardUnstructured, nil)
		k8sCliMock.On("GetNamespace", mock.Anything).Return("default")

		dashboard, err := service.SaveProvisionedDashboard(ctx, query, &dashboards.DashboardProvisioning{})
		require.NoError(t, err)
		require.NotNil(t, dashboard)
		k8sCliMock.AssertExpectations(t)
		// ensure the provisioning data is still saved to the db
		fakeStore.AssertExpectations(t)
	})
}

func TestSaveDashboard(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
		folderService: &foldertest.FakeService{
			ExpectedFolder: &folder.Folder{},
		},
	}

	origNewDashboardGuardian := guardian.New
	defer func() { guardian.New = origNewDashboardGuardian }()
	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanSaveValue: true})

	query := &dashboards.SaveDashboardDTO{
		OrgID: 1,
		User:  &user.SignedInUser{UserID: 1},
		Dashboard: &dashboards.Dashboard{
			UID:   "uid", // uid is the name of the k8s object
			Title: "testing slugify",
			Slug:  "testing-slugify", // slug is taken from title
			OrgID: 1,                 // orgID is populated from the query
			Data:  simplejson.NewFromAny(map[string]any{"test": "test", "title": "testing slugify", "uid": "uid"}),
		},
	}

	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("GetProvisionedDataByDashboardID", mock.Anything, mock.Anything).Return(nil, nil)
		fakeStore.On("GetDashboard", mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil)
		fakeStore.On("SaveDashboard", mock.Anything, mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil)
		dashboard, err := service.SaveDashboard(context.Background(), query, false)
		require.NoError(t, err)
		require.NotNil(t, dashboard)
		fakeStore.AssertExpectations(t)
	})

	dashboardUnstructured := unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{
			"name": "uid",
		},
		"spec": map[string]any{
			"test":    "test",
			"version": int64(1),
			"title":   "testing slugify",
		},
	}}

	t.Run("Should use Kubernetes create if feature flags are enabled and dashboard doesn't exist", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, nil)
		k8sCliMock.On("GetUserFromMeta", mock.Anything, mock.Anything).Return(&user.User{}, nil)
		k8sCliMock.On("GetNamespace", mock.Anything).Return("default")
		k8sCliMock.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&dashboardUnstructured, nil)

		dashboard, err := service.SaveDashboard(ctx, query, false)
		require.NoError(t, err)
		require.NotNil(t, dashboard)
	})

	t.Run("Should use Kubernetes update if feature flags are enabled and dashboard exists", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&dashboardUnstructured, nil)
		k8sCliMock.On("GetUserFromMeta", mock.Anything, mock.Anything).Return(&user.User{}, nil)
		k8sCliMock.On("GetNamespace", mock.Anything).Return("default")
		k8sCliMock.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&dashboardUnstructured, nil)

		dashboard, err := service.SaveDashboard(ctx, query, false)
		require.NoError(t, err)
		require.NotNil(t, dashboard)
	})

	t.Run("Should return an error if uid is invalid", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, nil)
		k8sCliMock.On("GetNamespace", mock.Anything).Return("default")
		k8sCliMock.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&dashboardUnstructured, nil)

		query.Dashboard.UID = "invalid/uid"
		_, err := service.SaveDashboard(ctx, query, false)
		require.Error(t, err)
	})
}

func TestDeleteDashboard(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	fakePublicDashboardService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:                    setting.NewCfg(),
		dashboardStore:         &fakeStore,
		publicDashboardService: fakePublicDashboardService,
	}

	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("DeleteDashboard", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()
		fakeStore.On("GetProvisionedDataByDashboardID", mock.Anything, mock.Anything).Return(nil, nil).Once()
		fakePublicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()

		err := service.DeleteDashboard(context.Background(), 1, "uid", 1)
		require.NoError(t, err)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()
		fakeStore.On("CleanupAfterDelete", mock.Anything, mock.Anything).Return(nil).Once()
		fakePublicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()

		err := service.DeleteDashboard(ctx, 1, "uid", 1)
		require.NoError(t, err)
		k8sCliMock.AssertExpectations(t)
	})

	t.Run("If UID is not passed in, it should retrieve that first", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
		k8sCliMock.On("Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()
		fakeStore.On("CleanupAfterDelete", mock.Anything, mock.Anything).Return(nil).Once()
		fakePublicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()
		k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key: &resource.ResourceKey{
							Name:     "uid",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 1"),
							[]byte("folder1"),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil)
		err := service.DeleteDashboard(ctx, 1, "", 1)
		require.NoError(t, err)
		k8sCliMock.AssertExpectations(t)
		k8sCliMock.AssertExpectations(t)
	})
}

func TestDeleteAllDashboards(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
	}

	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("DeleteAllDashboards", mock.Anything, mock.Anything).Return(nil).Once()
		err := service.DeleteAllDashboards(context.Background(), 1)
		require.NoError(t, err)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()

		err := service.DeleteAllDashboards(ctx, 1)
		require.NoError(t, err)
		k8sCliMock.AssertExpectations(t)
	})
}

func TestSearchDashboards(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	fakeFolders := foldertest.NewFakeService()
	fakeFolders.ExpectedFolder = &folder.Folder{
		Title: "testing-folder-1",
		UID:   "f1",
	}
	fakeFolders.ExpectedFolders = []*folder.Folder{fakeFolders.ExpectedFolder}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
		folderService:  fakeFolders,
	}

	expectedResult := model.HitList{
		{
			UID:   "uid1",
			OrgID: 1,
			Title: "Dashboard 1",
			Type:  "dash-db",
			URI:   "db/dashboard-1",
			URL:   "/d/uid1/dashboard-1",
			Tags: []string{
				"tag1",
				"tag2",
			},
			FolderTitle: "testing-folder-1",
			FolderUID:   "f1",
		},
		{
			UID:         "uid2",
			OrgID:       1,
			Title:       "Dashboard 2",
			Type:        "dash-db",
			URI:         "db/dashboard-2",
			URL:         "/d/uid2/dashboard-2",
			Tags:        []string{},
			FolderTitle: "testing-folder-1",
			FolderUID:   "f1",
		},
	}
	query := dashboards.FindPersistedDashboardsQuery{
		DashboardUIDs: []string{"uid1", "uid2"},
	}
	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("FindDashboards", mock.Anything, mock.Anything).Return([]dashboards.DashboardSearchProjection{
			{
				UID:         "uid1",
				Slug:        "dashboard-1",
				OrgID:       1,
				Title:       "Dashboard 1",
				Tags:        []string{"tag1", "tag2"},
				FolderTitle: "testing-folder-1",
				FolderUID:   "f1",
			},
			{
				UID:         "uid2",
				Slug:        "dashboard-2",
				OrgID:       1,
				Title:       "Dashboard 2",
				FolderTitle: "testing-folder-1",
				FolderUID:   "f1",
			},
		}, nil).Once()
		result, err := service.SearchDashboards(context.Background(), &query)
		require.NoError(t, err)
		require.Equal(t, expectedResult, result)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		expectedFolders := model.HitList{
			{
				UID:   "f1",
				Title: "testing-folder-1",
			},
		}
		fakeFolders.ExpectedHitList = expectedFolders
		k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
		k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "tags",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key: &resource.ResourceKey{
							Name:     "uid1",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 1"),
							[]byte("f1"),
							[]byte("[\"tag1\", \"tag2\"]"),
						},
					},
					{
						Key: &resource.ResourceKey{
							Name:     "uid2",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 2"),
							[]byte("f1"),
							[]byte(""),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil)

		result, err := service.SearchDashboards(ctx, &query)
		require.NoError(t, err)
		require.Equal(t, expectedResult, result)
		k8sCliMock.AssertExpectations(t)
	})
}

func TestGetDashboards(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
	}

	expectedResult := []*dashboards.Dashboard{
		{
			UID:   "uid1",
			Slug:  "dashboard-1",
			OrgID: 1,
			Title: "Dashboard 1",
			Data:  simplejson.NewFromAny(map[string]any{"title": "Dashboard 1", "uid": "uid1"}),
		},
		{
			UID:   "uid2",
			Slug:  "dashboard-2",
			OrgID: 1,
			Title: "Dashboard 2",
			Data:  simplejson.NewFromAny(map[string]any{"title": "Dashboard 2", "uid": "uid2"}),
		},
	}
	uid1Unstructured := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{
			"name": "uid1",
		},
		"spec": map[string]any{
			"title": "Dashboard 1",
		},
	}}
	uid2Unstructured := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{
			"name": "uid2",
		},
		"spec": map[string]any{
			"title": "Dashboard 2",
		},
	}}
	queryByIDs := &dashboards.GetDashboardsQuery{
		DashboardIDs: []int64{1, 2},
		OrgID:        1,
	}
	queryByUIDs := &dashboards.GetDashboardsQuery{
		DashboardUIDs: []string{"uid1", "uid2"},
		OrgID:         1,
	}
	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()

		// by ids
		fakeStore.On("GetDashboards", mock.Anything, queryByIDs).Return(expectedResult, nil).Once()
		result, err := service.GetDashboards(context.Background(), queryByIDs)
		require.NoError(t, err)
		require.Equal(t, expectedResult, result)
		fakeStore.AssertExpectations(t)

		// by uids
		fakeStore.On("GetDashboards", mock.Anything, queryByUIDs).Return(expectedResult, nil).Once()
		result, err = service.GetDashboards(context.Background(), queryByUIDs)
		require.NoError(t, err)
		require.Equal(t, expectedResult, result)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
		k8sCliMock.On("Get", mock.Anything, "uid1", mock.Anything, mock.Anything, mock.Anything).Return(uid1Unstructured, nil)
		k8sCliMock.On("Get", mock.Anything, "uid2", mock.Anything, mock.Anything, mock.Anything).Return(uid2Unstructured, nil)
		k8sCliMock.On("GetUserFromMeta", mock.Anything, mock.Anything).Return(&user.User{}, nil)
		k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key: &resource.ResourceKey{
							Name:     "uid1",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 1"),
							[]byte(""),
						},
					},
					{
						Key: &resource.ResourceKey{
							Name:     "uid2",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 2"),
							[]byte(""),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil)

		// by ids
		result, err := service.GetDashboards(ctx, queryByIDs)
		require.NoError(t, err)
		require.Equal(t, expectedResult, result)
		k8sCliMock.AssertExpectations(t)

		// by uids
		result, err = service.GetDashboards(ctx, queryByUIDs)
		require.NoError(t, err)
		require.Equal(t, expectedResult, result)
		k8sCliMock.AssertExpectations(t)
	})
}

func TestGetDashboardUIDByID(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
	}

	expectedResult := &dashboards.DashboardRef{
		UID:  "uid1",
		Slug: "dashboard-1",
	}
	query := &dashboards.GetDashboardRefByIDQuery{
		ID: 1,
	}
	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("GetDashboardUIDByID", mock.Anything, query).Return(expectedResult, nil).Once()

		result, err := service.GetDashboardUIDByID(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, expectedResult, result)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
		k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key: &resource.ResourceKey{
							Name:     "uid1",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 1"),
							[]byte("folder1"),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil)
		result, err := service.GetDashboardUIDByID(ctx, query)
		require.NoError(t, err)
		require.Equal(t, expectedResult, result)
		k8sCliMock.AssertExpectations(t)
	})
}

func TestUnstructuredToLegacyDashboard(t *testing.T) {
	k8sCliMock := new(client.MockK8sHandler)
	k8sCliMock.On("GetUserFromMeta", mock.Anything, mock.Anything).Return(&user.User{ID: 10, UID: "useruid"}, nil)
	dr := &DashboardServiceImpl{
		k8sclient: k8sCliMock,
	}
	t.Run("successfully converts unstructured to legacy dashboard", func(t *testing.T) {
		uid := "36b7c825-79cc-435e-acf6-c78bd96a4510"
		orgID := int64(123)
		title := "Test Dashboard"
		now := metav1.Now()
		item := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"spec": map[string]interface{}{
					"title":   title,
					"version": int64(1),
				},
			},
		}

		obj, err := utils.MetaAccessor(item)
		require.NoError(t, err)
		obj.SetCreationTimestamp(now)
		obj.SetName(uid)
		obj.SetCreatedBy("user:useruid")
		obj.SetUpdatedBy("user:useruid")
		obj.SetDeprecatedInternalID(1) // nolint:staticcheck
		result, err := dr.UnstructuredToLegacyDashboard(context.Background(), item, orgID)
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, uid, result.UID)
		assert.Equal(t, title, result.Title)
		assert.Equal(t, orgID, result.OrgID)
		assert.Equal(t, "test-dashboard", result.Slug) // should slugify the title
		assert.Equal(t, false, result.HasACL)
		assert.Equal(t, false, result.IsFolder)
		assert.Equal(t, int64(1), result.ID)
		assert.Equal(t, now.Time.Format(time.RFC3339), result.Created.Format(time.RFC3339))
		assert.Equal(t, int64(10), result.CreatedBy)
		assert.Equal(t, now.Time.Format(time.RFC3339), result.Updated.Format(time.RFC3339)) // updated should default to created
		assert.Equal(t, int64(10), result.UpdatedBy)
	})

	t.Run("returns error if spec is missing", func(t *testing.T) {
		item := &unstructured.Unstructured{
			Object: map[string]interface{}{},
		}
		_, err := (&DashboardServiceImpl{}).UnstructuredToLegacyDashboard(context.Background(), item, int64(123))
		assert.Error(t, err)
		assert.Equal(t, "error parsing dashboard from k8s response", err.Error())
	})
}

func TestGetDashboardTags(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
	}

	expectedResult := []*dashboards.DashboardTagCloudItem{
		{
			Term:  "tag1",
			Count: 1,
		},
		{
			Term:  "tag2",
			Count: 3,
		},
	}
	query := &dashboards.GetDashboardTagsQuery{
		OrgID: 1,
	}
	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("GetDashboardTags", mock.Anything, query).Return(expectedResult, nil).Once()
		result, err := service.GetDashboardTags(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, expectedResult, result)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resource.ResourceSearchResponse{
			Facet: map[string]*resource.ResourceSearchResponse_Facet{
				"tags": {
					Terms: []*resource.ResourceSearchResponse_TermFacet{
						{
							Term:  "tag1",
							Count: 1,
						},
						{
							Term:  "tag2",
							Count: 3,
						},
					},
				},
			},
		}, nil)

		result, err := service.GetDashboardTags(ctx, query)
		require.NoError(t, err)
		require.Equal(t, expectedResult, result)
		fakeStore.AssertExpectations(t)
	})
}

func TestQuotaCount(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
	}

	orgs := []*org.OrgDTO{
		{
			ID: 1,
		},
		{
			ID: 2,
		},
	}

	countOrg1 := resource.ResourceStatsResponse{
		Stats: []*resource.ResourceStatsResponse_Stats{
			{
				Count: 1,
			},
		},
	}
	countOrg2 := resource.ResourceStatsResponse{
		Stats: []*resource.ResourceStatsResponse_Stats{
			{
				Count: 2,
			},
		},
	}

	query := &quota.ScopeParameters{
		OrgID: 1,
	}
	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("Count", mock.Anything, mock.Anything).Return(nil, nil).Once()
		_, err := service.Count(context.Background(), query)
		require.NoError(t, err)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		orgSvc := orgtest.FakeOrgService{ExpectedOrgs: orgs}
		service.orgService = &orgSvc
		k8sCliMock.On("GetStats", mock.Anything, mock.Anything).Return(&countOrg2, nil).Once()
		k8sCliMock.On("GetStats", mock.Anything, mock.Anything).Return(&countOrg1, nil).Once()

		result, err := service.Count(ctx, query)
		require.NoError(t, err)

		orgTag, err := quota.NewTag(dashboards.QuotaTargetSrv, dashboards.QuotaTarget, quota.OrgScope)
		require.NoError(t, err)
		c, _ := result.Get(orgTag)
		require.Equal(t, c, int64(1))

		globalTag, err := quota.NewTag(dashboards.QuotaTargetSrv, dashboards.QuotaTarget, quota.GlobalScope)
		require.NoError(t, err)
		c, _ = result.Get(globalTag)
		require.Equal(t, c, int64(3))

		fakeStore.AssertExpectations(t)
	})
}

func TestCountDashboardsInOrg(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
	}
	count := resource.ResourceStatsResponse{
		Stats: []*resource.ResourceStatsResponse_Stats{
			{
				Count: 3,
			},
		},
	}

	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("CountInOrg", mock.Anything, mock.Anything).Return(nil, nil).Once()
		_, err := service.CountDashboardsInOrg(context.Background(), 1)
		require.NoError(t, err)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("GetStats", mock.Anything, mock.Anything).Return(&count, nil).Once()
		result, err := service.CountDashboardsInOrg(ctx, 1)
		require.NoError(t, err)
		require.Equal(t, result, int64(3))
	})
}

func TestCountInFolders(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)
	service := &DashboardServiceImpl{
		cfg:            setting.NewCfg(),
		dashboardStore: &fakeStore,
	}
	dashs := &resource.ResourceSearchResponse{
		Results: &resource.ResourceTable{
			Columns: []*resource.ResourceTableColumnDefinition{
				{
					Name: "title",
					Type: resource.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: "folder",
					Type: resource.ResourceTableColumnDefinition_STRING,
				},
			},
			Rows: []*resource.ResourceTableRow{
				{
					Key: &resource.ResourceKey{
						Name:     "uid",
						Resource: "dashboard",
					},
					Cells: [][]byte{
						[]byte("Dashboard 1"),
						[]byte("folder 1"),
					},
				},
				{
					Key: &resource.ResourceKey{
						Name:     "uid2",
						Resource: "dashboard",
					},
					Cells: [][]byte{
						[]byte("Dashboard 2"),
						[]byte("folder 1"),
					},
				},
			},
		},
		TotalHits: 2,
	}

	t.Run("Should fallback to dashboard store if Kubernetes feature flags are not enabled", func(t *testing.T) {
		service.features = featuremgmt.WithFeatures()
		fakeStore.On("CountDashboardsInFolders", mock.Anything, mock.Anything).Return(int64(1), nil).Once()
		_, err := service.CountInFolders(context.Background(), 1, []string{"folder1"}, &user.SignedInUser{})
		require.NoError(t, err)
		fakeStore.AssertExpectations(t)
	})

	t.Run("Should use Kubernetes client if feature flags are enabled", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
		k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(dashs, nil).Once()
		result, err := service.CountInFolders(ctx, 1, []string{"folder1"}, &user.SignedInUser{})
		require.NoError(t, err)
		require.Equal(t, result, int64(2))
	})
}

func TestSearchDashboardsThroughK8sRaw(t *testing.T) {
	ctx := context.Background()
	k8sCliMock := new(client.MockK8sHandler)
	service := &DashboardServiceImpl{k8sclient: k8sCliMock}
	query := &dashboards.FindPersistedDashboardsQuery{
		OrgId: 1,
	}
	k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
	k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resource.ResourceSearchResponse{
		Results: &resource.ResourceTable{
			Columns: []*resource.ResourceTableColumnDefinition{
				{
					Name: "title",
					Type: resource.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: "folder",
					Type: resource.ResourceTableColumnDefinition_STRING,
				},
			},
			Rows: []*resource.ResourceTableRow{
				{
					Key: &resource.ResourceKey{
						Name:     "uid",
						Resource: "dashboard",
					},
					Cells: [][]byte{
						[]byte("Dashboard 1"),
						[]byte("folder1"),
					},
				},
			},
		},
		TotalHits: 1,
	}, nil)
	res, err := service.searchDashboardsThroughK8s(ctx, query)
	require.NoError(t, err)
	assert.Equal(t, []*dashboards.Dashboard{
		{
			UID:       "uid",
			OrgID:     1,
			FolderUID: "folder1",
			Title:     "Dashboard 1",
			Slug:      "dashboard-1", // should be slugified
		},
	}, res)
	assert.Equal(t, "dash-db", query.Type) // query type should be added
}

func TestSearchProvisionedDashboardsThroughK8sRaw(t *testing.T) {
	ctx := context.Background()
	k8sCliMock := new(client.MockK8sHandler)
	service := &DashboardServiceImpl{k8sclient: k8sCliMock}
	query := &dashboards.FindPersistedDashboardsQuery{
		OrgId: 1,
	}
	dashboardUnstructuredProvisioned := unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{
			"name": "uid",
			"annotations": map[string]any{
				utils.AnnoKeyRepoName:      dashboard.ProvisionedFileNameWithPrefix("test"),
				utils.AnnoKeyRepoHash:      "hash",
				utils.AnnoKeyRepoPath:      "path/to/file",
				utils.AnnoKeyRepoTimestamp: "2025-01-01T00:00:00Z",
			},
		},
		"spec": map[string]any{},
	}}
	dashboardUnstructuredNotProvisioned := unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{
			"name": "uid2",
		},
		"spec": map[string]any{},
	}}
	k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
	k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resource.ResourceSearchResponse{
		Results: &resource.ResourceTable{
			Columns: []*resource.ResourceTableColumnDefinition{
				{
					Name: "title",
					Type: resource.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: "folder",
					Type: resource.ResourceTableColumnDefinition_STRING,
				},
			},
			Rows: []*resource.ResourceTableRow{
				{
					Key: &resource.ResourceKey{
						Name:     "uid",
						Resource: "dashboard",
					},
					Cells: [][]byte{
						[]byte("Dashboard 1"),
						[]byte("folder1"),
					},
				},
				{
					Key: &resource.ResourceKey{
						Name:     "uid2",
						Resource: "dashboard",
					},
					Cells: [][]byte{
						[]byte("Dashboard 2"),
						[]byte("folder2"),
					},
				},
			},
		},
		TotalHits: 1,
	}, nil)
	k8sCliMock.On("Get", mock.Anything, "uid", mock.Anything, mock.Anything, mock.Anything).Return(&dashboardUnstructuredProvisioned, nil).Once()
	k8sCliMock.On("Get", mock.Anything, "uid2", mock.Anything, mock.Anything, mock.Anything).Return(&dashboardUnstructuredNotProvisioned, nil).Once()
	res, err := service.searchProvisionedDashboardsThroughK8s(ctx, query)
	require.NoError(t, err)
	assert.Equal(t, []*dashboardProvisioningWithUID{
		{
			DashboardUID: "uid",
			DashboardProvisioning: dashboards.DashboardProvisioning{
				Name:       "test",
				ExternalID: "path/to/file",
				CheckSum:   "hash",
				Updated:    1735689600,
			},
		},
	}, res) // only should return the one provisioned dashboard
	assert.Equal(t, "dash-db", query.Type) // query type should be added as dashboards only
}

func TestLegacySaveCommandToUnstructured(t *testing.T) {
	namespace := "test-namespace"
	t.Run("successfully converts save command to unstructured", func(t *testing.T) {
		cmd := &dashboards.SaveDashboardCommand{
			FolderUID: "folder-uid",
			Message:   "saving this dashboard",
			Dashboard: simplejson.NewFromAny(map[string]any{"test": "test", "title": "testing slugify", "uid": "test-uid"}),
		}

		result, err := LegacySaveCommandToUnstructured(cmd, namespace)
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "test-uid", result.GetName())
		assert.Equal(t, "test-namespace", result.GetNamespace())
		spec := result.Object["spec"].(map[string]any)
		assert.Equal(t, spec["version"], 1)
		assert.Equal(t, result.GetAnnotations(), map[string]string{utils.AnnoKeyFolder: "folder-uid", utils.AnnoKeyMessage: "saving this dashboard"})
	})

	t.Run("should increase version when called", func(t *testing.T) {
		cmd := &dashboards.SaveDashboardCommand{
			Dashboard: simplejson.NewFromAny(map[string]any{"test": "test", "title": "testing slugify", "uid": "test-uid", "version": int64(1)}),
		}
		result, err := LegacySaveCommandToUnstructured(cmd, namespace)
		assert.NoError(t, err)
		assert.NotNil(t, result)
		spec := result.Object["spec"].(map[string]any)
		assert.Equal(t, spec["version"], float64(2))
		// folder annotation should not be set if not inside a folder
		assert.Equal(t, result.GetAnnotations(), map[string]string(nil))
	})
}

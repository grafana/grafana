package dashverimpl

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// createMockRequester creates a mock StaticRequester for testing
func createMockRequester(orgID, userID int64) identity.Requester {
	return &identity.StaticRequester{
		Type:   claims.TypeUser,
		UserID: userID,
		OrgID:  orgID,
		Login:  "testuser",
		Name:   "Test User",
		Email:  "test@example.com",
	}
}

func TestDashboardVersionService(t *testing.T) {
	t.Run("Get dashboard versions", func(t *testing.T) {
		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardVersionService := Service{dashSvc: dashboardService, features: featuremgmt.WithFeatures()}
		mockCli := new(client.MockK8sHandler)
		dashboardVersionService.k8sclient = mockCli
		dashboardVersionService.features = featuremgmt.WithFeatures()
		dashboardService.On("GetDashboardUIDByID", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardRefByIDQuery")).Return(&dashboards.DashboardRef{UID: "uid"}, nil)

		creationTimestamp := time.Now().Add(time.Hour * -24).UTC()
		updatedTimestamp := time.Now().UTC().Truncate(time.Second)
		dash := &unstructured.Unstructured{
			Object: map[string]any{
				"metadata": map[string]any{
					"name":            "uid",
					"resourceVersion": "12",
					"generation":      int64(10),
					"labels": map[string]any{
						utils.LabelKeyDeprecatedInternalID: "42", // nolint:staticcheck
					},
					"annotations": map[string]any{
						utils.AnnoKeyCreatedBy: "user:1",
					},
				},
				"spec": map[string]any{
					"hello": "world",
				},
			}}
		dash.SetCreationTimestamp(v1.NewTime(creationTimestamp))
		obj, err := utils.MetaAccessor(dash)
		require.NoError(t, err)
		obj.SetUpdatedTimestamp(&updatedTimestamp)
		mockCli.On("GetUsersFromMeta", mock.Anything, []string{"user:1", ""}).Return(map[string]*user.User{"user:1": {ID: 1}}, nil)
		mockCli.On("List", mock.Anything, int64(1), mock.Anything).Return(&unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{*dash}}, nil).Once()
		res, err := dashboardVersionService.Get(context.Background(), &dashver.GetDashboardVersionQuery{
			DashboardID: 42,
			OrgID:       1,
			Version:     10,
		})
		require.Nil(t, err)
		require.Equal(t, res, &dashver.DashboardVersionDTO{
			ID:            10,
			Version:       10,
			ParentVersion: 9,
			DashboardID:   42,
			DashboardUID:  "uid",
			CreatedBy:     1,
			Created:       updatedTimestamp,
			Data:          simplejson.NewFromAny(map[string]any{"uid": "uid", "version": int64(10), "hello": "world"}),
		})

		mockCli.On("GetUsersFromMeta", mock.Anything, []string{"user:1", "user:2"}).Return(map[string]*user.User{"user:1": {ID: 1}, "user:2": {ID: 2}}, nil)
		mockCli.On("List", mock.Anything, int64(1), mock.Anything).Return(&unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{{
				Object: map[string]any{
					"metadata": map[string]any{
						"name":            "uid",
						"resourceVersion": "11",
						"generation":      int64(11),
						"labels": map[string]any{
							utils.LabelKeyDeprecatedInternalID: "42", // nolint:staticcheck
						},
						"annotations": map[string]any{
							utils.AnnoKeyCreatedBy: "user:1",
							utils.AnnoKeyUpdatedBy: "user:2", // if updated by is set, that is the version creator
						},
					},
					"spec": map[string]any{},
				}}}}, nil).Once()
		res, err = dashboardVersionService.Get(context.Background(), &dashver.GetDashboardVersionQuery{
			DashboardID: 42,
			OrgID:       1,
			Version:     11,
		})
		require.Nil(t, err)
		require.Equal(t, res, &dashver.DashboardVersionDTO{
			ID:            11,
			Version:       11,
			ParentVersion: 10,
			DashboardID:   42,
			DashboardUID:  "uid",
			CreatedBy:     2,
			Data:          simplejson.NewFromAny(map[string]any{"uid": "uid", "version": int64(11)}),
		})
	})

	t.Run("should dashboard not found error when k8s returns not found", func(t *testing.T) {
		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardVersionService := Service{dashSvc: dashboardService, features: featuremgmt.WithFeatures()}
		mockCli := new(client.MockK8sHandler)
		dashboardVersionService.k8sclient = mockCli
		dashboardVersionService.features = featuremgmt.WithFeatures()
		dashboardService.On("GetDashboardUIDByID", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardRefByIDQuery")).Return(&dashboards.DashboardRef{UID: "uid"}, nil)
		mockCli.On("List", mock.Anything, int64(1), mock.Anything).Return(nil, apierrors.NewNotFound(schema.GroupResource{Group: "dashboards.dashboard.grafana.app", Resource: "dashboard"}, "uid"))

		_, err := dashboardVersionService.Get(context.Background(), &dashver.GetDashboardVersionQuery{
			DashboardID: 42,
			OrgID:       1,
			Version:     10,
		})
		require.ErrorIs(t, err, dashboards.ErrDashboardNotFound)
	})
}

func TestDeleteExpiredVersions(t *testing.T) {
	versionsToKeep := 5
	cfg := setting.NewCfg()
	cfg.DashboardVersionsToKeep = versionsToKeep

	dashboardVersionStore := newDashboardVersionStoreFake()
	dashboardService := dashboards.NewFakeDashboardService(t)
	dashboardVersionService := Service{
		cfg: cfg, store: dashboardVersionStore, dashSvc: dashboardService, features: featuremgmt.WithFeatures()}

	t.Run("Don't delete anything if there are no expired versions", func(t *testing.T) {
		err := dashboardVersionService.DeleteExpired(context.Background(), &dashver.DeleteExpiredVersionsCommand{DeletedRows: 4})
		require.Nil(t, err)
	})

	t.Run("Clean up old dashboard versions successfully", func(t *testing.T) {
		dashboardVersionStore.ExptectedDeletedVersions = 4
		dashboardVersionStore.ExpectedVersions = []any{1, 2, 3, 4}
		err := dashboardVersionService.DeleteExpired(context.Background(), &dashver.DeleteExpiredVersionsCommand{DeletedRows: 4})
		require.Nil(t, err)
	})

	t.Run("Clean up old dashboard versions with error", func(t *testing.T) {
		dashboardVersionStore.ExpectedError = errors.New("some error")
		err := dashboardVersionService.DeleteExpired(context.Background(), &dashver.DeleteExpiredVersionsCommand{DeletedRows: 4})
		require.NotNil(t, err)
	})
}

func TestListDashboardVersions(t *testing.T) {
	t.Run("List all versions for a given Dashboard ID through k8s", func(t *testing.T) {
		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardVersionService := Service{dashSvc: dashboardService, features: featuremgmt.WithFeatures()}
		mockCli := new(client.MockK8sHandler)
		dashboardVersionService.k8sclient = mockCli
		dashboardVersionService.features = featuremgmt.WithFeatures()

		dashboardService.On("GetDashboardUIDByID", mock.Anything,
			mock.AnythingOfType("*dashboards.GetDashboardRefByIDQuery")).
			Return(&dashboards.DashboardRef{UID: "uid"}, nil)

		query := dashver.ListDashboardVersionsQuery{DashboardID: 42}
		mockCli.On("GetUsersFromMeta", mock.Anything, mock.Anything).Return(map[string]*user.User{}, nil)
		mockCli.On("List", mock.Anything, mock.Anything, mock.Anything).Return(&unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{{Object: map[string]any{
				"metadata": map[string]any{
					"name":            "uid",
					"resourceVersion": "12",
					"generation":      int64(5),
					"labels": map[string]any{
						utils.LabelKeyDeprecatedInternalID: "42", // nolint:staticcheck
					},
				},
				"spec": map[string]any{},
			}}}}, nil).Once()
		res, err := dashboardVersionService.List(context.Background(), &query)
		require.Nil(t, err)
		require.Equal(t, 1, len(res.Versions))
		require.EqualValues(t, &dashver.DashboardVersionResponse{
			Versions: []*dashver.DashboardVersionDTO{{
				ID:            5,
				DashboardID:   42,
				ParentVersion: 4,
				Version:       5, // should take from spec
				DashboardUID:  "uid",
				Data:          simplejson.NewFromAny(map[string]any{"uid": "uid", "version": int64(5)}),
			}}}, res)
	})

	t.Run("List returns correct continue token across multiple pages", func(t *testing.T) {
		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardVersionService := Service{dashSvc: dashboardService, features: featuremgmt.WithFeatures()}
		mockCli := new(client.MockK8sHandler)
		dashboardVersionService.k8sclient = mockCli
		dashboardVersionService.features = featuremgmt.WithFeatures()

		dashboardService.On("GetDashboardUIDByID", mock.Anything,
			mock.AnythingOfType("*dashboards.GetDashboardRefByIDQuery")).
			Return(&dashboards.DashboardRef{UID: "uid"}, nil)
		query := dashver.ListDashboardVersionsQuery{DashboardID: 42, Limit: 3}
		mockCli.On("GetUsersFromMeta", mock.Anything, mock.Anything).Return(map[string]*user.User{}, nil)
		firstPage := &unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{
				{Object: map[string]any{
					"metadata": map[string]any{
						"name":            "uid",
						"resourceVersion": "11",
						"generation":      int64(4),
						"labels": map[string]any{
							utils.LabelKeyDeprecatedInternalID: "42", // nolint:staticcheck
						},
					},
					"spec": map[string]any{},
				}},
				{Object: map[string]any{
					"metadata": map[string]any{
						"name":            "uid",
						"resourceVersion": "12",
						"generation":      int64(5),
						"labels": map[string]any{
							utils.LabelKeyDeprecatedInternalID: "42", // nolint:staticcheck
						},
					},
					"spec": map[string]any{},
				}},
			},
		}
		firstMeta, err := meta.ListAccessor(firstPage)
		require.NoError(t, err)
		firstMeta.SetContinue("t1")
		secondPage := &unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{
				{Object: map[string]any{
					"metadata": map[string]any{
						"name":            "uid",
						"resourceVersion": "13",
						"generation":      int64(6),
						"labels": map[string]any{
							utils.LabelKeyDeprecatedInternalID: "42", // nolint:staticcheck
						},
					},
					"spec": map[string]any{},
				}},
			},
		}
		secondMeta, err := meta.ListAccessor(secondPage)
		require.NoError(t, err)
		secondMeta.SetContinue("") // No more pages
		mockCli.On("List", mock.Anything, mock.Anything, mock.Anything).Return(firstPage, nil).Once()
		mockCli.On("List", mock.Anything, mock.Anything, mock.Anything).Return(secondPage, nil).Once()

		res, err := dashboardVersionService.List(context.Background(), &query)
		require.Nil(t, err)
		require.Equal(t, 3, len(res.Versions))
		require.Equal(t, "t1", res.ContinueToken) // Implementation returns continue token from first page
		mockCli.AssertNumberOfCalls(t, "List", 2)
	})

	t.Run("should return dashboard not found error when k8s client says not found", func(t *testing.T) {
		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardVersionService := Service{dashSvc: dashboardService, features: featuremgmt.WithFeatures()}
		mockCli := new(client.MockK8sHandler)
		dashboardVersionService.k8sclient = mockCli
		dashboardVersionService.features = featuremgmt.WithFeatures()
		dashboardService.On("GetDashboardUIDByID", mock.Anything,
			mock.AnythingOfType("*dashboards.GetDashboardRefByIDQuery")).
			Return(&dashboards.DashboardRef{UID: "uid"}, nil)
		mockCli.On("List", mock.Anything, mock.Anything, mock.Anything).Return(nil, apierrors.NewNotFound(schema.GroupResource{Group: "dashboards.dashboard.grafana.app", Resource: "dashboard"}, "uid"))
		query := dashver.ListDashboardVersionsQuery{DashboardID: 42}
		_, err := dashboardVersionService.List(context.Background(), &query)
		require.ErrorIs(t, dashboards.ErrDashboardNotFound, err)
	})
}

func TestRestoreVersion(t *testing.T) {
	t.Run("should use k8s restoration when feature toggles are enabled", func(t *testing.T) {
		dashboardService := dashboards.NewFakeDashboardService(t)
		features := featuremgmt.WithFeatures(featuremgmt.FlagKubernetesDashboards, featuremgmt.FlagDashboardNewLayouts)
		dashboardVersionService := Service{
			dashSvc:  dashboardService,
			features: features,
			log:      log.New("dashboard-version"),
		}
		mockCli := new(client.MockK8sHandler)
		dashboardVersionService.k8sclient = mockCli

		// Mock version data
		versionObj := &unstructured.Unstructured{
			Object: map[string]any{
				"apiVersion": "dashboard.grafana.app/v2alpha1",
				"metadata": map[string]any{
					"name":       "test-uid",
					"generation": int64(3),
				},
				"spec": map[string]any{
					"title": "Version 3 Dashboard",
					"data":  map[string]any{"panels": []any{}},
				},
			},
		}

		// Mock k8s client calls
		currentObj := &unstructured.Unstructured{
			Object: map[string]any{
				"apiVersion": "dashboard.grafana.app/v2alpha1",
				"metadata": map[string]any{
					"name":       "test-uid",
					"generation": int64(5),
				},
				"spec": map[string]any{
					"title": "Current Dashboard",
					"data":  map[string]any{"panels": []any{"panel2"}},
				},
			},
		}
		mockCli.On("Get", mock.Anything, "test-uid", int64(1), mock.Anything, mock.Anything).Return(currentObj, nil)
		mockCli.On("List", mock.Anything, int64(1), mock.Anything).Return(&unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{*versionObj},
		}, nil)
		mockCli.On("Update", mock.Anything, mock.AnythingOfType("*unstructured.Unstructured"), int64(1), mock.Anything).Return(versionObj, nil)

		// Mock conversion methods
		dashboardService.On("UnstructuredToLegacyDashboard", mock.Anything, mock.AnythingOfType("*unstructured.Unstructured"), int64(1)).Return(&dashboards.Dashboard{
			ID:      1,
			UID:     "test-uid",
			Version: 6,
			Data:    simplejson.NewFromAny(map[string]any{"title": "Restored Dashboard"}),
		}, nil)

		cmd := &dashver.RestoreVersionCommand{
			Requester:    createMockRequester(1, 1),
			DashboardUID: "test-uid",
			Version:      3,
		}

		result, err := dashboardVersionService.RestoreVersion(context.Background(), cmd)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, "test-uid", result.UID)
		require.Equal(t, 6, result.Version)

		dashboardService.AssertExpectations(t)
		mockCli.AssertExpectations(t)
	})

	t.Run("should use legacy restoration when k8s feature toggles are disabled", func(t *testing.T) {
		dashboardService := dashboards.NewFakeDashboardService(t)
		features := featuremgmt.WithFeatures() // No k8s features enabled
		dashboardVersionService := Service{
			dashSvc:  dashboardService,
			features: features,
			log:      log.New("dashboard-version"),
		}

		// Mock dashboard service calls
		dashboardService.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(&dashboards.Dashboard{
			ID:      1,
			UID:     "test-uid",
			Version: 5,
			Data:    simplejson.NewFromAny(map[string]any{"title": "Current Dashboard"}),
		}, nil)

		// Mock version data
		versionObj := &unstructured.Unstructured{
			Object: map[string]any{
				"apiVersion": "dashboard.grafana.app/v2alpha1",
				"metadata": map[string]any{
					"name":       "test-uid",
					"generation": int64(3),
				},
				"spec": map[string]any{
					"title": "Version 3 Dashboard",
					"data":  map[string]any{"panels": []any{}},
				},
			},
		}

		// Mock k8s client calls
		mockCli := new(client.MockK8sHandler)
		dashboardVersionService.k8sclient = mockCli
		mockCli.On("List", mock.Anything, int64(1), mock.Anything).Return(&unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{*versionObj},
		}, nil)
		mockCli.On("GetUsersFromMeta", mock.Anything, mock.AnythingOfType("[]string")).Return(map[string]*user.User{}, nil)

		// Mock legacy restoration - this would call the existing postDashboard logic
		dashboardService.On("SaveDashboard", mock.Anything, mock.AnythingOfType("*dashboards.SaveDashboardDTO"), mock.AnythingOfType("bool")).Return(&dashboards.Dashboard{
			ID:      1,
			UID:     "test-uid",
			Version: 6,
			Data:    simplejson.NewFromAny(map[string]any{"title": "Legacy Restored Dashboard"}),
		}, nil)

		cmd := &dashver.RestoreVersionCommand{
			Requester:    createMockRequester(1, 1),
			DashboardUID: "test-uid",
			Version:      3,
		}

		result, err := dashboardVersionService.RestoreVersion(context.Background(), cmd)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, "test-uid", result.UID)

		dashboardService.AssertExpectations(t)
	})

	t.Run("should return error when dashboard not found", func(t *testing.T) {
		dashboardService := dashboards.NewFakeDashboardService(t)
		features := featuremgmt.WithFeatures(featuremgmt.FlagKubernetesDashboards, featuremgmt.FlagDashboardNewLayouts)
		dashboardVersionService := Service{
			dashSvc:  dashboardService,
			features: features,
			log:      log.New("dashboard-version"),
		}
		mockCli := new(client.MockK8sHandler)
		dashboardVersionService.k8sclient = mockCli

		// Mock k8s client to return not found error
		mockCli.On("Get", mock.Anything, "nonexistent-uid", int64(1), mock.Anything, mock.Anything).Return(nil, apierrors.NewNotFound(schema.GroupResource{Group: "dashboards.dashboard.grafana.app", Resource: "dashboard"}, "nonexistent-uid"))
		mockCli.On("List", mock.Anything, int64(1), mock.Anything).Return(nil, apierrors.NewNotFound(schema.GroupResource{Group: "dashboards.dashboard.grafana.app", Resource: "dashboard"}, "nonexistent-uid"))

		cmd := &dashver.RestoreVersionCommand{
			Requester:    createMockRequester(1, 1),
			DashboardUID: "nonexistent-uid",
			Version:      3,
		}

		result, err := dashboardVersionService.RestoreVersion(context.Background(), cmd)
		require.Error(t, err)
		require.Nil(t, result)
		require.ErrorIs(t, err, dashboards.ErrDashboardNotFound)

		dashboardService.AssertExpectations(t)
	})

	t.Run("should return error when version not found", func(t *testing.T) {
		dashboardService := dashboards.NewFakeDashboardService(t)
		features := featuremgmt.WithFeatures(featuremgmt.FlagKubernetesDashboards, featuremgmt.FlagDashboardNewLayouts)
		dashboardVersionService := Service{
			dashSvc:  dashboardService,
			features: features,
			log:      log.New("dashboard-version"),
		}
		mockCli := new(client.MockK8sHandler)
		dashboardVersionService.k8sclient = mockCli

		// This test uses k8s features, so we don't need GetDashboard mock

		// Mock empty version list
		mockCli.On("Get", mock.Anything, "test-uid", int64(1), mock.Anything, mock.Anything).Return(&unstructured.Unstructured{
			Object: map[string]any{
				"apiVersion": "dashboard.grafana.app/v2alpha1",
				"metadata": map[string]any{
					"name":       "test-uid",
					"generation": int64(5),
				},
				"spec": map[string]any{
					"title": "Current Dashboard",
				},
			},
		}, nil)
		mockCli.On("List", mock.Anything, int64(1), mock.Anything).Return(&unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{},
		}, nil)

		cmd := &dashver.RestoreVersionCommand{
			Requester:    createMockRequester(1, 1),
			DashboardUID: "test-uid",
			Version:      999, // Non-existent version
		}

		result, err := dashboardVersionService.RestoreVersion(context.Background(), cmd)
		require.Error(t, err)
		require.Nil(t, result)
		require.ErrorIs(t, err, dashboards.ErrDashboardNotFound)

		dashboardService.AssertExpectations(t)
		mockCli.AssertExpectations(t)
	})

	t.Run("should skip restoration when dashboard data is identical", func(t *testing.T) {
		dashboardService := dashboards.NewFakeDashboardService(t)
		features := featuremgmt.WithFeatures(featuremgmt.FlagKubernetesDashboards, featuremgmt.FlagDashboardNewLayouts)
		dashboardVersionService := Service{
			dashSvc:  dashboardService,
			features: features,
			log:      log.New("dashboard-version"),
		}
		mockCli := new(client.MockK8sHandler)
		dashboardVersionService.k8sclient = mockCli

		// Mock identical dashboard data
		identicalData := map[string]any{"title": "Same Dashboard", "panels": []any{}}

		// Mock version with identical data
		versionObj := &unstructured.Unstructured{
			Object: map[string]any{
				"apiVersion": "dashboard.grafana.app/v2alpha1",
				"metadata": map[string]any{
					"name":       "test-uid",
					"generation": int64(3),
				},
				"spec": identicalData, // The spec should contain the dashboard data directly
			},
		}

		// Mock current dashboard with identical data
		currentObj := &unstructured.Unstructured{
			Object: map[string]any{
				"apiVersion": "dashboard.grafana.app/v2alpha1",
				"metadata": map[string]any{
					"name":       "test-uid",
					"generation": int64(5),
				},
				"spec": identicalData,
			},
		}
		mockCli.On("Get", mock.Anything, "test-uid", int64(1), mock.Anything, mock.Anything).Return(currentObj, nil)
		mockCli.On("List", mock.Anything, int64(1), mock.Anything).Return(&unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{*versionObj},
		}, nil)

		cmd := &dashver.RestoreVersionCommand{
			Requester:    createMockRequester(1, 1),
			DashboardUID: "test-uid",
			Version:      3,
		}

		result, err := dashboardVersionService.RestoreVersion(context.Background(), cmd)
		require.Error(t, err)
		require.Nil(t, result)
		// Should return appropriate error for identical data

		dashboardService.AssertExpectations(t)
		mockCli.AssertExpectations(t)
	})
}

func TestUnstructuredToDashboardVersionSpec(t *testing.T) {
	tests := []struct {
		name           string
		obj            *unstructured.Unstructured
		expectedResult DashboardVersionSpec
		expectError    bool
		errorMessage   string
		checkSpec      func(t *testing.T, spec any)
	}{
		{
			name: "should convert v2alpha1 dashboard correctly",
			obj: &unstructured.Unstructured{
				Object: map[string]any{
					"apiVersion": v2alpha1.GroupVersion.String(),
					"metadata": map[string]any{
						"name":       "test-dashboard",
						"generation": int64(5),
					},
					"spec": map[string]any{
						"title": "Test Dashboard",
						"panels": []any{
							map[string]any{"id": 1, "title": "Panel 1"},
						},
					},
				},
			},
			expectedResult: DashboardVersionSpec{
				UID:           "test-dashboard",
				Version:       5,
				ParentVersion: 4,
			},
			expectError: false,
		},
		{
			name: "should convert v2beta1 dashboard correctly",
			obj: &unstructured.Unstructured{
				Object: map[string]any{
					"apiVersion": v2beta1.GroupVersion.String(),
					"metadata": map[string]any{
						"name":       "test-dashboard-v2",
						"generation": int64(10),
					},
					"spec": map[string]any{
						"title": "Test Dashboard V2",
						"tags":  []string{"test", "dashboard"},
					},
				},
			},
			expectedResult: DashboardVersionSpec{
				UID:           "test-dashboard-v2",
				Version:       10,
				ParentVersion: 9,
			},
			expectError: false,
		},
		{
			name: "should convert legacy dashboard API version correctly",
			obj: &unstructured.Unstructured{
				Object: map[string]any{
					"apiVersion": "dashboard.grafana.app/v1",
					"metadata": map[string]any{
						"name":       "legacy-dashboard",
						"generation": int64(3),
					},
					"spec": map[string]any{
						"title": "Legacy Dashboard",
						"uid":   "legacy-uid",
					},
				},
			},
			expectedResult: DashboardVersionSpec{
				UID:           "legacy-dashboard",
				Version:       3,
				ParentVersion: 2,
			},
			expectError: false,
			checkSpec: func(t *testing.T, spec any) {
				specMap := spec.(map[string]any)
				require.Equal(t, "legacy-dashboard", specMap["uid"])
				require.Equal(t, int64(3), specMap["version"])
			},
		},
		{
			name: "should handle generation 0 correctly",
			obj: &unstructured.Unstructured{
				Object: map[string]any{
					"apiVersion": v2alpha1.GroupVersion.String(),
					"metadata": map[string]any{
						"name":       "zero-gen-dashboard",
						"generation": int64(0),
					},
					"spec": map[string]any{
						"title": "Zero Generation Dashboard",
					},
				},
			},
			expectedResult: DashboardVersionSpec{
				UID:           "zero-gen-dashboard",
				Version:       0,
				ParentVersion: 0,
			},
			expectError: false,
		},
		{
			name: "should handle generation 1 correctly",
			obj: &unstructured.Unstructured{
				Object: map[string]any{
					"apiVersion": "dashboard.grafana.app/v0",
					"metadata": map[string]any{
						"name":       "one-gen-dashboard",
						"generation": int64(1),
					},
					"spec": map[string]any{
						"title": "One Generation Dashboard",
					},
				},
			},
			expectedResult: DashboardVersionSpec{
				UID:           "one-gen-dashboard",
				Version:       1,
				ParentVersion: 0,
			},
			expectError: false,
			checkSpec: func(t *testing.T, spec any) {
				specMap := spec.(map[string]any)
				require.Equal(t, int64(1), specMap["version"])
			},
		},
		{
			name: "should return error when spec is missing for v2alpha1/v2beta1",
			obj: &unstructured.Unstructured{
				Object: map[string]any{
					"apiVersion": v2alpha1.GroupVersion.String(),
					"metadata": map[string]any{
						"name":       "no-spec-dashboard",
						"generation": int64(1),
					},
					// Missing spec
				},
			},
			expectError:  true,
			errorMessage: "error parsing dashboard from k8s response",
		},
		{
			name: "should return error when spec is missing for legacy API",
			obj: &unstructured.Unstructured{
				Object: map[string]any{
					"apiVersion": "dashboard.grafana.app/v1",
					"metadata": map[string]any{
						"name":       "no-spec-legacy-dashboard",
						"generation": int64(1),
					},
					// Missing spec
				},
			},
			expectError:  true,
			errorMessage: "error parsing dashboard from k8s response",
		},
		{
			name: "should return error when spec is not map for legacy API",
			obj: &unstructured.Unstructured{
				Object: map[string]any{
					"apiVersion": "dashboard.grafana.app/v1",
					"metadata": map[string]any{
						"name":       "invalid-spec-dashboard",
						"generation": int64(1),
					},
					"spec": "not a map", // Invalid spec type
				},
			},
			expectError:  true,
			errorMessage: "error parsing dashboard from k8s response",
		},
		{
			name: "should handle edge cases correctly",
			obj: &unstructured.Unstructured{
				Object: map[string]any{
					"apiVersion": v2beta1.GroupVersion.String(),
					"metadata": map[string]any{
						"name":       "high-gen-dashboard",
						"generation": int64(999999),
					},
					"spec": map[string]any{
						"title": "High Generation Dashboard",
					},
				},
			},
			expectedResult: DashboardVersionSpec{
				UID:           "high-gen-dashboard",
				Version:       999999,
				ParentVersion: 999998,
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var result DashboardVersionSpec
			err := UnstructuredToDashboardVersionSpec(tt.obj, &result)

			if tt.expectError {
				require.Error(t, err)
				require.Equal(t, tt.errorMessage, err.Error())
				return
			}

			require.NoError(t, err)

			// Check basic fields
			require.Equal(t, tt.expectedResult.UID, result.UID)
			require.Equal(t, tt.expectedResult.Version, result.Version)
			require.Equal(t, tt.expectedResult.ParentVersion, result.ParentVersion)

			// Check that spec is properly set
			require.NotNil(t, result.Spec)

			// Check that MetaAccessor is properly set
			require.NotNil(t, result.MetaAccessor)

			// Run custom spec checks if provided
			if tt.checkSpec != nil {
				tt.checkSpec(t, result.Spec)
			}
		})
	}
}

type FakeDashboardVersionStore struct {
	ExpectedDashboardVersion *dashver.DashboardVersion
	ExptectedDeletedVersions int64
	ExpectedVersions         []any
	ExpectedListVersions     []*dashver.DashboardVersion
	ExpectedError            error
}

func newDashboardVersionStoreFake() *FakeDashboardVersionStore {
	return &FakeDashboardVersionStore{}
}

func (f *FakeDashboardVersionStore) Get(_ context.Context, _ *dashver.GetDashboardVersionQuery) (*dashver.DashboardVersion, error) {
	return f.ExpectedDashboardVersion, f.ExpectedError
}

func (f *FakeDashboardVersionStore) GetBatch(_ context.Context, _ *dashver.DeleteExpiredVersionsCommand, _ int, _ int) ([]any, error) {
	return f.ExpectedVersions, f.ExpectedError
}

func (f *FakeDashboardVersionStore) DeleteBatch(_ context.Context, _ *dashver.DeleteExpiredVersionsCommand, _ []any) (int64, error) {
	return f.ExptectedDeletedVersions, f.ExpectedError
}

func (f *FakeDashboardVersionStore) List(_ context.Context, _ *dashver.ListDashboardVersionsQuery) ([]*dashver.DashboardVersion, error) {
	return f.ExpectedListVersions, f.ExpectedError
}

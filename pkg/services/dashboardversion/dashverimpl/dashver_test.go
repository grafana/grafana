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

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

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
		mockCli.On("List", mock.Anything, mock.Anything, mock.Anything).Return(firstPage, nil).Once()
		mockCli.On("List", mock.Anything, mock.Anything, mock.Anything).Return(secondPage, nil).Once()

		res, err := dashboardVersionService.List(context.Background(), &query)
		require.Nil(t, err)
		require.Equal(t, 3, len(res.Versions))
		require.Equal(t, "", res.ContinueToken)
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

func (f *FakeDashboardVersionStore) Get(ctx context.Context, query *dashver.GetDashboardVersionQuery) (*dashver.DashboardVersion, error) {
	return f.ExpectedDashboardVersion, f.ExpectedError
}

func (f *FakeDashboardVersionStore) GetBatch(ctx context.Context, cmd *dashver.DeleteExpiredVersionsCommand, perBatch int, versionsToKeep int) ([]any, error) {
	return f.ExpectedVersions, f.ExpectedError
}

func (f *FakeDashboardVersionStore) DeleteBatch(ctx context.Context, cmd *dashver.DeleteExpiredVersionsCommand, versionIdsToDelete []any) (int64, error) {
	return f.ExptectedDeletedVersions, f.ExpectedError
}

func (f *FakeDashboardVersionStore) List(ctx context.Context, query *dashver.ListDashboardVersionsQuery) ([]*dashver.DashboardVersion, error) {
	return f.ExpectedListVersions, f.ExpectedError
}

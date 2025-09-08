package service

import (
	"context"
	"fmt"
	"reflect"
	"slices"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apiserver/pkg/endpoints/request"

	dashboardv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestDashboardServiceValidation(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	fakePublicDashboardService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)
	defer fakeStore.AssertExpectations(t)

	service := &DashboardServiceImpl{
		cfg:                    setting.NewCfg(),
		log:                    log.New("test.logger"),
		dashboardStore:         &fakeStore,
		folderService:          foldertest.NewFakeService(),
		ac:                     actest.FakeAccessControl{ExpectedEvaluate: true},
		features:               featuremgmt.WithFeatures(),
		publicDashboardService: fakePublicDashboardService,
	}

	ctx, k8sCliMock := setupK8sDashboardTests(service)
	k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
	k8sCliMock.On("GetUsersFromMeta", mock.Anything, mock.Anything).Return(map[string]*user.User{}, nil)

	t.Run("Save dashboard validation", func(t *testing.T) {
		dto := &dashboards.SaveDashboardDTO{}

		t.Run("When saving a dashboard with empty title it should return error", func(t *testing.T) {
			titles := []string{"", " ", "   \t   "}

			for _, title := range titles {
				dto.Dashboard = dashboards.NewDashboard(title)
				_, err := service.SaveDashboard(ctx, dto, false)
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
			I wrote. Best of luck to the both of us!!`
			_, err := service.SaveDashboard(ctx, dto, false)
			require.Equal(t, err, dashboards.ErrDashboardMessageTooLong)

			// set to a shorter message for the rest of the tests
			dto.Message = `message`
		})

		t.Run("Should return validation error if folder is named General", func(t *testing.T) {
			dto.Dashboard = dashboards.NewDashboardFolder("General")
			_, err := service.SaveDashboard(ctx, dto, false)
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
					k8sCliMock.On("Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, nil).Once()
				}
				_, err := service.BuildSaveDashboardCommand(ctx, dto, false)
				require.Equal(t, err, tc.Error)
			}
		})

		t.Run("Should return validation error if a folder that is specified can't be found", func(t *testing.T) {
			dto.Dashboard = dashboards.NewDashboard("Dash")
			dto.Dashboard.FolderUID = "non-existing-folder"
			folderSvc := foldertest.FakeService{ExpectedError: dashboards.ErrFolderNotFound}
			service.folderService = &folderSvc
			_, err := service.SaveDashboard(ctx, dto, false)
			require.Equal(t, err, dashboards.ErrFolderNotFound)
		})
	})
}

func setupK8sDashboardTests(service *DashboardServiceImpl) (context.Context, *client.MockK8sHandler) {
	mockCli := new(client.MockK8sHandler)
	service.k8sclient = mockCli

	ctx := context.Background()
	userCtx := &user.SignedInUser{UserID: 1, OrgID: 1}
	ctx = identity.WithRequester(ctx, userCtx)

	return ctx, mockCli
}

func TestGetDashboard(t *testing.T) {
	service := &DashboardServiceImpl{
		cfg: setting.NewCfg(),
	}
	query := &dashboards.GetDashboardQuery{
		UID:   "test-uid",
		OrgID: 1,
	}

	t.Run("Should get dashboard", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		dashboardUnstructured := unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"name":       "uid",
				"generation": int64(1),
			},
			"spec": map[string]any{
				"test":  "test",
				"title": "testing slugify",
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
		k8sCliMock.On("GetUsersFromMeta", mock.Anything, mock.Anything).Return(map[string]*user.User{}, nil)

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
				"name":       "uid",
				"generation": int64(2),
			},
			"spec": map[string]any{
				"test":  "test",
				"title": "testing slugify",
			},
		}}

		dashboardExpected := dashboards.Dashboard{
			UID:     "uid", // uid is the name of the k8s object
			Title:   "testing slugify",
			Slug:    "testing-slugify", // slug is taken from title
			OrgID:   1,                 // orgID is populated from the query
			Version: 2,
			Data:    simplejson.NewFromAny(map[string]any{"test": "test", "title": "testing slugify", "uid": "uid", "version": int64(2)}),
		}
		k8sCliMock.On("Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&dashboardUnstructured, nil).Once()
		k8sCliMock.On("GetUsersFromMeta", mock.Anything, mock.Anything).Return(map[string]*user.User{}, nil)
		k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
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
	service := &DashboardServiceImpl{
		cfg: setting.NewCfg(),
	}
	ctx, k8sCliMock := setupK8sDashboardTests(service)

	dashboardUnstructured := unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{
			"name":       "uid",
			"generation": int64(1),
		},
		"spec": map[string]any{
			"test":  "test",
			"title": "testing slugify",
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

	k8sCliMock.On("GetUsersFromMeta", mock.Anything, mock.Anything).Return(map[string]*user.User{}, nil)
	k8sCliMock.On("List", mock.Anything, mock.Anything, mock.Anything).Return(&unstructured.UnstructuredList{Items: []unstructured.Unstructured{dashboardUnstructured}}, nil).Once()

	dashes, err := service.GetAllDashboardsByOrgId(ctx, 1)
	require.NoError(t, err)
	require.NotNil(t, dashes)
	k8sCliMock.AssertExpectations(t)
	// make sure the conversion is working
	require.True(t, reflect.DeepEqual(dashes, []*dashboards.Dashboard{&dashboardExpected}))
}

func TestGetAllDashboardsByOrgId(t *testing.T) {
	service := &DashboardServiceImpl{
		cfg: setting.NewCfg(),
	}
	ctx, k8sCliMock := setupK8sDashboardTests(service)

	dashboardUnstructured := unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{
			"name":       "uid",
			"generation": int64(1),
		},
		"spec": map[string]any{
			"test":  "test",
			"title": "testing slugify",
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

	k8sCliMock.On("GetUsersFromMeta", mock.Anything, mock.Anything).Return(map[string]*user.User{}, nil)
	k8sCliMock.On("List", mock.Anything, mock.Anything, mock.Anything).Return(&unstructured.UnstructuredList{Items: []unstructured.Unstructured{dashboardUnstructured}}, nil).Once()

	dashes, err := service.GetAllDashboardsByOrgId(ctx, 1)
	require.NoError(t, err)
	require.NotNil(t, dashes)
	k8sCliMock.AssertExpectations(t)
	// make sure the conversion is working
	require.True(t, reflect.DeepEqual(dashes, []*dashboards.Dashboard{&dashboardExpected}))
}

func TestGetProvisionedDashboardData(t *testing.T) {
	service := &DashboardServiceImpl{
		cfg: setting.NewCfg(),
		orgService: &orgtest.FakeOrgService{
			ExpectedOrgs: []*org.OrgDTO{{ID: 1}, {ID: 2}},
		},
	}

	ctx, k8sCliMock := setupK8sDashboardTests(service)
	provisioningTimestamp := int64(1234567)
	k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
	repo := "test"
	k8sCliMock.On("Search", mock.Anything, int64(1),
		mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
			// make sure the kind is added to the query
			return req.Options.Fields[0].Values[0] == string(utils.ManagerKindClassicFP) && // nolint:staticcheck
				req.Options.Fields[1].Values[0] == repo
		})).Return(&resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{},
			Rows:    []*resourcepb.ResourceTableRow{},
		},
		TotalHits: 0,
	}, nil).Once()
	k8sCliMock.On("Search", mock.Anything, int64(2), mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
		// make sure the kind is added to the query
		return req.Options.Fields[0].Values[0] == string(utils.ManagerKindClassicFP) && // nolint:staticcheck
			req.Options.Fields[1].Values[0] == repo
	})).Return(&resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{
					Name: "title",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: "folder",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_LEGACY_ID,
					Type: resourcepb.ResourceTableColumnDefinition_INT64,
				},
				{
					Name: resource.SEARCH_FIELD_MANAGER_KIND, // nolint:staticcheck
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_MANAGER_ID,
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_SOURCE_PATH,
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_SOURCE_CHECKSUM,
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_SOURCE_TIME,
					Type: resourcepb.ResourceTableColumnDefinition_INT64,
				},
			},
			Rows: []*resourcepb.ResourceTableRow{
				{
					Key: &resourcepb.ResourceKey{
						Name:     "uid",
						Resource: "dashboard",
					},
					Cells: [][]byte{
						[]byte("Dashboard 1"),
						[]byte("folder 1"),
						[]byte("1"),
						[]byte(string(utils.ManagerKindClassicFP)), // nolint:staticcheck
						[]byte(repo),
						[]byte("path/to/file"),
						[]byte("hash"),
						[]byte("1234567"),
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
		Updated:     provisioningTimestamp,
	})
	k8sCliMock.AssertExpectations(t)
}

func TestGetProvisionedDashboardDataByDashboardID(t *testing.T) {
	service := &DashboardServiceImpl{
		cfg: setting.NewCfg(),
		orgService: &orgtest.FakeOrgService{
			ExpectedOrgs: []*org.OrgDTO{{ID: 1}, {ID: 2}},
		},
	}

	ctx, k8sCliMock := setupK8sDashboardTests(service)
	provisioningTimestamp := int64(1234567)
	k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
	k8sCliMock.On("Search", mock.Anything, int64(1), mock.Anything).Return(&resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{},
			Rows:    []*resourcepb.ResourceTableRow{},
		},
		TotalHits: 0,
	}, nil)
	k8sCliMock.On("Search", mock.Anything, int64(2), mock.Anything).Return(&resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{
					Name: "title",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: "folder",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_LEGACY_ID,
					Type: resourcepb.ResourceTableColumnDefinition_INT64,
				},
				{
					Name: resource.SEARCH_FIELD_MANAGER_KIND, // nolint:staticcheck
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_MANAGER_ID,
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_SOURCE_PATH,
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_SOURCE_CHECKSUM,
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_SOURCE_TIME,
					Type: resourcepb.ResourceTableColumnDefinition_INT64,
				},
			},
			Rows: []*resourcepb.ResourceTableRow{
				{
					Key: &resourcepb.ResourceKey{
						Name:     "uid",
						Resource: "dashboard",
					},
					Cells: [][]byte{
						[]byte("Dashboard 1"),
						[]byte("folder 1"),
						[]byte("1"),
						[]byte(string(utils.ManagerKindClassicFP)), // nolint:staticcheck
						[]byte("test"),
						[]byte("path/to/file"),
						[]byte("hash"),
						[]byte("1234567"),
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
		Updated:     provisioningTimestamp,
	})
	k8sCliMock.AssertExpectations(t)
}

func TestGetProvisionedDashboardDataByDashboardUID(t *testing.T) {
	service := &DashboardServiceImpl{
		cfg: setting.NewCfg(),
		orgService: &orgtest.FakeOrgService{
			ExpectedOrgs: []*org.OrgDTO{{ID: 1}, {ID: 2}},
		},
	}
	ctx, k8sCliMock := setupK8sDashboardTests(service)
	provisioningTimestamp := int64(1234567)
	k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
	k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{
					Name: "title",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: "folder",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_LEGACY_ID,
					Type: resourcepb.ResourceTableColumnDefinition_INT64,
				},
				{
					Name: resource.SEARCH_FIELD_MANAGER_KIND, // nolint:staticcheck
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_MANAGER_ID,
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_SOURCE_PATH,
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_SOURCE_CHECKSUM,
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_SOURCE_TIME,
					Type: resourcepb.ResourceTableColumnDefinition_INT64,
				},
			},
			Rows: []*resourcepb.ResourceTableRow{
				{
					Key: &resourcepb.ResourceKey{
						Name:     "uid",
						Resource: "dashboard",
					},
					Cells: [][]byte{
						[]byte("Dashboard 1"),
						[]byte("folder 1"),
						[]byte("1"),
						[]byte(string(utils.ManagerKindClassicFP)), // nolint:staticcheck
						[]byte("test"),
						[]byte("path/to/file"),
						[]byte("hash"),
						[]byte("1234567"),
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
		Updated:     provisioningTimestamp,
	})
	k8sCliMock.AssertExpectations(t)
}

func TestDeleteOrphanedProvisionedDashboards(t *testing.T) {
	fakePublicDashboardService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)
	service := &DashboardServiceImpl{
		cfg: setting.NewCfg(),
		orgService: &orgtest.FakeOrgService{
			ExpectedOrgs: []*org.OrgDTO{{ID: 1}, {ID: 2}},
		},
		publicDashboardService: fakePublicDashboardService,
		log:                    log.NewNopLogger(),
	}

	t.Run("Should delete across all orgs, but only delete file based provisioned dashboards", func(t *testing.T) {
		_, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
		k8sCliMock.On("Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
		k8sCliMock.On("Search", mock.Anything, int64(1), mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
			// nolint:staticcheck
			return req.Options.Fields[0].Key == "manager.kind" && req.Options.Fields[0].Values[0] == string(utils.ManagerKindClassicFP) && req.Options.Fields[1].Key == "manager.id" && req.Options.Fields[1].Values[0] == "test" && req.Options.Fields[1].Operator == "notin"
		})).Return(&resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: resource.SEARCH_FIELD_MANAGER_KIND, // nolint:staticcheck
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: resource.SEARCH_FIELD_MANAGER_ID,
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: resource.SEARCH_FIELD_SOURCE_PATH,
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: resource.SEARCH_FIELD_SOURCE_CHECKSUM,
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: resource.SEARCH_FIELD_SOURCE_TIME,
						Type: resourcepb.ResourceTableColumnDefinition_INT64,
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
							Name:     "uid",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 1"),
							[]byte("folder 1"),
							[]byte(string(utils.ManagerKindClassicFP)), // nolint:staticcheck
							[]byte("orphaned"),
							[]byte("path/to/file"),
							[]byte("hash"),
							[]byte("1234567"),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil).Once()

		k8sCliMock.On("Search", mock.Anything, int64(2), mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
			// nolint:staticcheck
			return req.Options.Fields[0].Key == "manager.kind" && req.Options.Fields[0].Values[0] == string(utils.ManagerKindClassicFP) && req.Options.Fields[1].Key == "manager.id" && req.Options.Fields[1].Values[0] == "test" && req.Options.Fields[1].Operator == "notin"
		})).Return(&resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: resource.SEARCH_FIELD_MANAGER_KIND, // nolint:staticcheck
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: resource.SEARCH_FIELD_MANAGER_ID,
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: resource.SEARCH_FIELD_SOURCE_PATH,
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: resource.SEARCH_FIELD_SOURCE_CHECKSUM,
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: resource.SEARCH_FIELD_SOURCE_TIME,
						Type: resourcepb.ResourceTableColumnDefinition_INT64,
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
							Name:     "uid2",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 2"),
							[]byte("folder 2"),
							[]byte(string(utils.ManagerKindPlugin)),
							[]byte("app"),
							[]byte(""),
							[]byte(""),
							[]byte(""),
						},
					},
					{
						Key: &resourcepb.ResourceKey{
							Name:     "uid3",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 3"),
							[]byte("folder 3"),
							[]byte(string(utils.ManagerKindClassicFP)), // nolint:staticcheck
							[]byte("orphaned"),
							[]byte("path/to/file"),
							[]byte("hash"),
							[]byte("1234567"),
						},
					},
				},
			},
			TotalHits: 2,
		}, nil).Once()

		// mock call to waitForSearchQuery()
		k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{
			Results:   &resourcepb.ResourceTable{},
			TotalHits: 0,
		}, nil).Twice()

		err := service.DeleteOrphanedProvisionedDashboards(context.Background(), &dashboards.DeleteOrphanedProvisionedDashboardsCommand{
			ReaderNames: []string{"test"},
		})
		require.NoError(t, err)
		k8sCliMock.AssertExpectations(t)
	})

	t.Run("Should retry until deleted dashboard not found in search", func(t *testing.T) {
		repo := "test"
		singleOrgService := &DashboardServiceImpl{
			cfg: setting.NewCfg(),
			orgService: &orgtest.FakeOrgService{
				ExpectedOrgs: []*org.OrgDTO{{ID: 1}},
			},
			publicDashboardService: fakePublicDashboardService,
			log:                    log.NewNopLogger(),
		}
		ctx, k8sCliMock := setupK8sDashboardTests(singleOrgService)
		// Call to searchProvisionedDashboardsThroughK8s()
		k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
		k8sCliMock.On("Search", mock.Anything, int64(1), mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
			// make sure the kind is added to the query
			return req.Options.Fields[0].Values[0] == string(utils.ManagerKindClassicFP) && // nolint:staticcheck
				req.Options.Fields[1].Values[0] == repo
		})).Return(&resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: resource.SEARCH_FIELD_MANAGER_KIND, // nolint:staticcheck
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: resource.SEARCH_FIELD_MANAGER_ID,
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: resource.SEARCH_FIELD_SOURCE_PATH,
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: resource.SEARCH_FIELD_SOURCE_CHECKSUM,
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: resource.SEARCH_FIELD_SOURCE_TIME,
						Type: resourcepb.ResourceTableColumnDefinition_INT64,
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
							Name:     "uid",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Dashboard 1"),
							[]byte("folder 1"),
							[]byte(string(utils.ManagerKindClassicFP)), // nolint:staticcheck
							[]byte("orphaned"),
							[]byte("path/to/file"),
							[]byte("hash"),
							[]byte("1234567"),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil)

		// Mock deleteDashboard()
		k8sCliMock.On("Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()

		// Mock WaitForSearchQuery()
		// First call returns 1 hit
		k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{
			Results:   &resourcepb.ResourceTable{},
			TotalHits: 1,
		}, nil).Once()

		// Second call returns 0 hits
		k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{
			Results:   &resourcepb.ResourceTable{},
			TotalHits: 0,
		}, nil).Once()

		err := singleOrgService.DeleteOrphanedProvisionedDashboards(ctx, &dashboards.DeleteOrphanedProvisionedDashboardsCommand{
			ReaderNames: []string{"test"},
		})
		require.NoError(t, err)
		k8sCliMock.AssertExpectations(t)
	})

	t.Run("Will not wait for indexer when no dashboards were deleted", func(t *testing.T) {
		repo := "test"
		singleOrgService := &DashboardServiceImpl{
			cfg: setting.NewCfg(),
			orgService: &orgtest.FakeOrgService{
				ExpectedOrgs: []*org.OrgDTO{{ID: 1}},
			},
			publicDashboardService: fakePublicDashboardService,
			log:                    log.NewNopLogger(),
		}
		ctx, k8sCliMock := setupK8sDashboardTests(singleOrgService)

		// Call to searchProvisionedDashboardsThroughK8s()
		k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
		k8sCliMock.On("Search", mock.Anything, int64(1), mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
			// make sure the kind is added to the query
			return req.Options.Fields[0].Values[0] == string(utils.ManagerKindClassicFP) && // nolint:staticcheck
				req.Options.Fields[1].Values[0] == repo
		})).Return(&resourcepb.ResourceSearchResponse{
			Results:   &resourcepb.ResourceTable{},
			TotalHits: 0,
		}, nil)

		err := singleOrgService.DeleteOrphanedProvisionedDashboards(ctx, &dashboards.DeleteOrphanedProvisionedDashboardsCommand{
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

	ctx, k8sCliMock := setupK8sDashboardTests(service)
	dash := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{
			"name": "uid",
			"annotations": map[string]any{
				utils.AnnoKeyManagerKind:     utils.ManagerKindClassicFP, // nolint:staticcheck
				utils.AnnoKeyManagerIdentity: "test",
				utils.AnnoKeySourceChecksum:  "hash",
				utils.AnnoKeySourcePath:      "path/to/file",
				utils.AnnoKeySourceTimestamp: "2025-01-01T00:00:00Z",
			},
		},
		"spec": map[string]any{},
	}}
	fakeStore.On("UnprovisionDashboard", mock.Anything, int64(1)).Return(nil).Once()
	k8sCliMock.On("Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(dash, nil)
	dashWithoutAnnotations := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": dashboardv0.APIVERSION,
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
	k8sCliMock.On("Update", mock.Anything, dashWithoutAnnotations, mock.Anything, metav1.UpdateOptions{
		FieldValidation: metav1.FieldValidationIgnore,
	}).Return(dashWithoutAnnotations, nil)
	k8sCliMock.On("GetNamespace", mock.Anything).Return("default")
	k8sCliMock.On("GetUsersFromMeta", mock.Anything, mock.Anything).Return(map[string]*user.User{}, nil)
	k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{
					Name: "title",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: "folder",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
			},
			Rows: []*resourcepb.ResourceTableRow{
				{
					Key: &resourcepb.ResourceKey{
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
	fakeStore.AssertExpectations(t)
}

func TestGetDashboardsByPluginID(t *testing.T) {
	service := &DashboardServiceImpl{
		cfg: setting.NewCfg(),
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

	ctx, k8sCliMock := setupK8sDashboardTests(service)
	k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
	k8sCliMock.On("Get", mock.Anything, "uid", mock.Anything, mock.Anything, mock.Anything).Return(uidUnstructured, nil)
	k8sCliMock.On("GetUsersFromMeta", mock.Anything, mock.Anything).Return(map[string]*user.User{}, nil)
	k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
		return ( // gofmt comment helper
		req.Options.Fields[0].Key == "manager.kind" && req.Options.Fields[0].Values[0] == string(utils.ManagerKindPlugin) &&
			req.Options.Fields[1].Key == "manager.id" && req.Options.Fields[1].Values[0] == "testing")
	})).Return(&resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{
					Name: "title",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: "folder",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
			},
			Rows: []*resourcepb.ResourceTableRow{
				{
					Key: &resourcepb.ResourceKey{
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
}

func TestSetDefaultPermissionsWhenSavingFolderForProvisionedDashboards(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	defer fakeStore.AssertExpectations(t)

	folderPermService := acmock.NewMockedPermissionsService()
	folderPermService.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)

	cfg := setting.NewCfg()
	f := ini.Empty()
	f.Section("rbac").Key("resources_with_managed_permissions_on_creation").SetValue("folder")
	tempCfg, err := setting.NewCfgFromINIFile(f)
	require.NoError(t, err)
	cfg.RBAC = tempCfg.RBAC

	service := &DashboardServiceImpl{
		cfg:               cfg,
		dashboardStore:    &fakeStore,
		folderPermissions: folderPermService,
		folderService: &foldertest.FakeService{
			ExpectedFolder: &folder.Folder{
				ID:  0,
				UID: "general",
			},
		},
		ac:        actest.FakeAccessControl{ExpectedEvaluate: true},
		acService: &actest.FakeService{},
		log:       log.NewNopLogger(),
	}

	cmd := &folder.CreateFolderCommand{
		Title: "foo",
		OrgID: 1,
	}

	service.features = featuremgmt.WithFeatures()
	folder, err := service.SaveFolderForProvisionedDashboards(context.Background(), cmd)
	require.NoError(t, err)
	require.NotNil(t, folder)

	folderPermService.AssertNumberOfCalls(t, "SetPermissions", 0)
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
		ac:  actest.FakeAccessControl{ExpectedEvaluate: true},
		log: log.NewNopLogger(),
	}

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

	ctx, k8sCliMock := setupK8sDashboardTests(service)
	k8sCliMock.On("Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&dashboardUnstructured, nil)
	k8sCliMock.On("GetUsersFromMeta", mock.Anything, mock.Anything).Return(map[string]*user.User{}, nil)
	k8sCliMock.On("Update", mock.Anything, mock.Anything, mock.Anything, metav1.UpdateOptions{
		FieldValidation: metav1.FieldValidationIgnore,
	}).Return(&dashboardUnstructured, nil)
	k8sCliMock.On("GetNamespace", mock.Anything).Return("default")

	dashboard, err := service.SaveProvisionedDashboard(ctx, query, &dashboards.DashboardProvisioning{})
	require.NoError(t, err)
	require.NotNil(t, dashboard)
	k8sCliMock.AssertExpectations(t)
	// ensure the provisioning data is still saved to the db
	fakeStore.AssertExpectations(t)
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
		ac: actest.FakeAccessControl{ExpectedEvaluate: true},
	}

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
		k8sCliMock.On("GetUsersFromMeta", mock.Anything, mock.Anything).Return(map[string]*user.User{}, nil)
		k8sCliMock.On("GetNamespace", mock.Anything).Return("default")
		k8sCliMock.On("Update", mock.Anything, mock.Anything, mock.Anything, metav1.UpdateOptions{
			FieldValidation: metav1.FieldValidationIgnore,
		}).Return(&dashboardUnstructured, nil)

		dashboard, err := service.SaveDashboard(ctx, query, false)
		require.NoError(t, err)
		require.NotNil(t, dashboard)
	})

	t.Run("Should use Kubernetes update if feature flags are enabled and dashboard exists", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&dashboardUnstructured, nil)
		k8sCliMock.On("GetUsersFromMeta", mock.Anything, mock.Anything).Return(map[string]*user.User{}, nil)
		k8sCliMock.On("GetNamespace", mock.Anything).Return("default")
		k8sCliMock.On("Update", mock.Anything, mock.Anything, mock.Anything, metav1.UpdateOptions{
			FieldValidation: metav1.FieldValidationIgnore,
		}).Return(&dashboardUnstructured, nil)

		dashboard, err := service.SaveDashboard(ctx, query, false)
		require.NoError(t, err)
		require.NotNil(t, dashboard)
	})

	t.Run("Should return an error if uid is invalid", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("GetNamespace", mock.Anything).Return("default")
		k8sCliMock.On("Update", mock.Anything, mock.Anything, mock.Anything, metav1.UpdateOptions{
			FieldValidation: metav1.FieldValidationIgnore,
		}).Return(&dashboardUnstructured, nil)

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

	t.Run("Should use Kubernetes client if feature flags are enabled", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()

		err := service.DeleteDashboard(ctx, 1, "uid", 1)
		require.NoError(t, err)
		k8sCliMock.AssertExpectations(t)
	})

	t.Run("If UID is not passed in, it should retrieve that first", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
		k8sCliMock.On("Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()
		k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
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

	ctx, k8sCliMock := setupK8sDashboardTests(service)
	k8sCliMock.On("DeleteCollection", mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()

	err := service.DeleteAllDashboards(ctx, 1)
	require.NoError(t, err)
	k8sCliMock.AssertExpectations(t)
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
		features:       featuremgmt.WithFeatures(),
		dashboardStore: &fakeStore,
		folderService:  fakeFolders,
		metrics:        newDashboardsMetrics(prometheus.NewRegistry()),
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
			FolderID:    1,
			FolderURL:   "/dashboards/f/f1/testing-folder-1",
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
			FolderID:    1,
			FolderURL:   "/dashboards/f/f1/testing-folder-1",
		},
	}
	query := dashboards.FindPersistedDashboardsQuery{
		DashboardUIDs: []string{"uid1", "uid2"},
	}

	t.Run("Should search correctly", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		expectedFolders := model.HitList{
			{
				UID:   "f1",
				Title: "testing-folder-1",
				ID:    1,
			},
		}
		fakeFolders.ExpectedHitList = expectedFolders
		k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
		k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "tags",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
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
						Key: &resourcepb.ResourceKey{
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

	t.Run("Should handle Shared with me folder correctly", func(t *testing.T) {
		ctx, k8sCliMock := setupK8sDashboardTests(service)
		k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
		k8sCliMock.On("Search", mock.Anything, int64(1), mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
			if len(req.Options.Fields) == 0 {
				return false
			}
			// make sure the search request includes the shared folders
			for _, field := range req.Options.Fields {
				if field.Key == resource.SEARCH_FIELD_NAME {
					return slices.Equal(field.Values, []string{"shared-uid1", "shared-uid2"})
				}
			}
			return false
		})).Return(&resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "tags",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
							Name:     "shared-uid1",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Shared Dashboard 1"),
							[]byte("f1"),
							[]byte("[\"shared\"]"),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil).Once()
		k8sCliMock.On("Search", mock.Anything, int64(1), mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
			if len(req.Options.Fields) == 0 {
				return false
			}
			for _, field := range req.Options.Fields {
				if field.Key == resource.SEARCH_FIELD_NAME {
					return slices.Equal(field.Values, []string{"shared-uid1"})
				}
			}
			return false
		})).Return(&resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "title",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "folder",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
					{
						Name: "tags",
						Type: resourcepb.ResourceTableColumnDefinition_STRING,
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
							Name:     "shared-uid1",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("Shared Dashboard 1"),
							[]byte("f1"),
							[]byte("[\"shared\"]"),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil)
		fakeFolders.ExpectedFolders = []*folder.Folder{}
		query := dashboards.FindPersistedDashboardsQuery{
			FolderUIDs:   []string{folder.SharedWithMeFolderUID},
			SignedInUser: &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: {dashboards.ActionDashboardsRead: {dashboards.ScopeDashboardsPrefix + "shared-uid1", dashboards.ScopeDashboardsPrefix + "shared-uid2"}}}},
		}

		result, err := service.SearchDashboards(ctx, &query)
		require.NoError(t, err)
		require.Len(t, result, 1)
		require.Equal(t, "shared-uid1", result[0].UID)
		require.Equal(t, "Shared Dashboard 1", result[0].Title)
		k8sCliMock.AssertExpectations(t)
	})
}

func TestGetDashboards(t *testing.T) {
	service := &DashboardServiceImpl{
		cfg: setting.NewCfg(),
	}

	expectedResult := []*dashboards.Dashboard{
		{
			UID:     "uid1",
			Slug:    "dashboard-1",
			OrgID:   1,
			Title:   "Dashboard 1",
			Version: 1,
			Data:    simplejson.NewFromAny(map[string]any{"title": "Dashboard 1", "uid": "uid1", "version": int64(1)}),
		},
		{
			UID:     "uid2",
			Slug:    "dashboard-2",
			OrgID:   1,
			Title:   "Dashboard 2",
			Version: 1,
			Data:    simplejson.NewFromAny(map[string]any{"title": "Dashboard 2", "uid": "uid2", "version": int64(1)}),
		},
	}
	uid1Unstructured := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{
			"name":       "uid1",
			"generation": int64(1),
		},
		"spec": map[string]any{
			"title": "Dashboard 1",
		},
	}}
	uid2Unstructured := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{
			"name":       "uid2",
			"generation": int64(1),
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

	ctx, k8sCliMock := setupK8sDashboardTests(service)
	k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
	k8sCliMock.On("Get", mock.Anything, "uid1", mock.Anything, mock.Anything, mock.Anything).Return(uid1Unstructured, nil)
	k8sCliMock.On("Get", mock.Anything, "uid2", mock.Anything, mock.Anything, mock.Anything).Return(uid2Unstructured, nil)
	k8sCliMock.On("GetUsersFromMeta", mock.Anything, mock.Anything).Return(map[string]*user.User{}, nil)
	k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{
					Name: "title",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: "folder",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
			},
			Rows: []*resourcepb.ResourceTableRow{
				{
					Key: &resourcepb.ResourceKey{
						Name:     "uid1",
						Resource: "dashboard",
					},
					Cells: [][]byte{
						[]byte("Dashboard 1"),
						[]byte(""),
					},
				},
				{
					Key: &resourcepb.ResourceKey{
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
}

func TestGetDashboardUIDByID(t *testing.T) {
	service := &DashboardServiceImpl{
		cfg: setting.NewCfg(),
	}

	expectedResult := &dashboards.DashboardRef{
		UID:       "uid1",
		Slug:      "dashboard-1",
		FolderUID: "folder1",
	}
	query := &dashboards.GetDashboardRefByIDQuery{
		ID: 1,
	}
	ctx, k8sCliMock := setupK8sDashboardTests(service)
	k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
	k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{
					Name: "title",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: "folder",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
			},
			Rows: []*resourcepb.ResourceTableRow{
				{
					Key: &resourcepb.ResourceKey{
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
}

func TestUnstructuredToLegacyDashboard(t *testing.T) {
	k8sCliMock := new(client.MockK8sHandler)
	k8sCliMock.On("GetUsersFromMeta", mock.Anything, mock.Anything).Return(map[string]*user.User{"user:useruid": {ID: 10, UID: "useruid"}}, nil)
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
		assert.Equal(t, now.Format(time.RFC3339), result.Created.Format(time.RFC3339))
		assert.Equal(t, int64(10), result.CreatedBy)
		assert.Equal(t, now.Format(time.RFC3339), result.Updated.Format(time.RFC3339)) // updated should default to created
		assert.Equal(t, int64(10), result.UpdatedBy)
	})

	t.Run("returns error if spec is missing", func(t *testing.T) {
		item := &unstructured.Unstructured{
			Object: map[string]interface{}{},
		}
		_, err := dr.UnstructuredToLegacyDashboard(context.Background(), item, int64(123))
		assert.Error(t, err)
		assert.Equal(t, "error parsing dashboard from k8s response", err.Error())
	})
}

func TestGetDashboardTags(t *testing.T) {
	service := &DashboardServiceImpl{
		cfg: setting.NewCfg(),
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
	ctx, k8sCliMock := setupK8sDashboardTests(service)
	k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{
		Facet: map[string]*resourcepb.ResourceSearchResponse_Facet{
			"tags": {
				Terms: []*resourcepb.ResourceSearchResponse_TermFacet{
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
}

func TestQuotaCount(t *testing.T) {
	service := &DashboardServiceImpl{
		cfg: setting.NewCfg(),
	}

	orgs := []*org.OrgDTO{
		{
			ID: 1,
		},
		{
			ID: 2,
		},
	}

	countOrg1 := resourcepb.ResourceStatsResponse{
		Stats: []*resourcepb.ResourceStatsResponse_Stats{
			{
				Count: 1,
			},
		},
	}
	countOrg2 := resourcepb.ResourceStatsResponse{
		Stats: []*resourcepb.ResourceStatsResponse_Stats{
			{
				Count: 2,
			},
		},
	}

	query := &quota.ScopeParameters{
		OrgID: 1,
	}
	ctx, k8sCliMock := setupK8sDashboardTests(service)
	orgSvc := orgtest.FakeOrgService{ExpectedOrgs: orgs}
	service.orgService = &orgSvc
	k8sCliMock.On("GetStats", mock.Anything, int64(2)).Return(&countOrg2, nil).Once()
	k8sCliMock.On("GetStats", mock.Anything, int64(1)).Return(&countOrg1, nil).Once()

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
}

func TestCountDashboardsInOrg(t *testing.T) {
	service := &DashboardServiceImpl{
		cfg: setting.NewCfg(),
	}
	count := resourcepb.ResourceStatsResponse{
		Stats: []*resourcepb.ResourceStatsResponse_Stats{
			{
				Count: 3,
			},
		},
	}

	ctx, k8sCliMock := setupK8sDashboardTests(service)
	k8sCliMock.On("GetStats", mock.Anything, mock.Anything).Return(&count, nil).Once()
	result, err := service.CountDashboardsInOrg(ctx, 1)
	require.NoError(t, err)
	require.Equal(t, result, int64(3))
}

func TestCountInFolders(t *testing.T) {
	service := &DashboardServiceImpl{
		cfg: setting.NewCfg(),
	}
	ctx, k8sCliMock := setupK8sDashboardTests(service)
	dashs := &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{
					Name: "title",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: "folder",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
			},
			Rows: []*resourcepb.ResourceTableRow{
				{
					Key: &resourcepb.ResourceKey{
						Name:     "uid",
						Resource: "dashboard",
					},
					Cells: [][]byte{
						[]byte("Dashboard 1"),
						[]byte("folder 1"),
					},
				},
				{
					Key: &resourcepb.ResourceKey{
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

	k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
	k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(dashs, nil).Once()
	result, err := service.CountInFolders(ctx, 1, []string{"folder1"}, &user.SignedInUser{})
	require.NoError(t, err)
	require.Equal(t, result, int64(2))
}

func TestSearchDashboardsThroughK8sRaw(t *testing.T) {
	ctx := context.Background()
	k8sCliMock := new(client.MockK8sHandler)
	service := &DashboardServiceImpl{k8sclient: k8sCliMock}
	query := &dashboards.FindPersistedDashboardsQuery{
		OrgId: 1,
		Sort:  sort.SortAlphaAsc,
	}
	k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
	k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
		return len(req.SortBy) == 1 &&
			// should be converted to "title" due to ParseSortName
			req.SortBy[0].Field == "title" &&
			!req.SortBy[0].Desc
	})).Return(&resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{
					Name: "title",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: "folder",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
			},
			Rows: []*resourcepb.ResourceTableRow{
				{
					Key: &resourcepb.ResourceKey{
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
	provisioningTimestamp := int64(1234567)
	k8sCliMock.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
	k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{
					Name: "title",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: "folder",
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_MANAGER_KIND, // nolint:staticcheck
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_MANAGER_ID,
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_SOURCE_PATH,
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_SOURCE_CHECKSUM,
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_SOURCE_TIME,
					Type: resourcepb.ResourceTableColumnDefinition_INT64,
				},
			},
			Rows: []*resourcepb.ResourceTableRow{
				{
					Key: &resourcepb.ResourceKey{
						Name:     "uid",
						Resource: "dashboard",
					},
					Cells: [][]byte{
						[]byte("Dashboard 1"),
						[]byte("folder 1"),
						[]byte(string(utils.ManagerKindClassicFP)), // nolint:staticcheck
						[]byte("test"),
						[]byte("path/to/file"),
						[]byte("hash"),
						[]byte("1234567"),
					},
				},
			},
		},
		TotalHits: 1,
	}, nil)
	res, err := service.searchProvisionedDashboardsThroughK8s(ctx, query)
	require.NoError(t, err)
	assert.Equal(t, []*dashboardProvisioningWithUID{
		{
			DashboardUID: "uid",
			DashboardProvisioning: dashboards.DashboardProvisioning{
				Name:       "test",
				ExternalID: "path/to/file",
				CheckSum:   "hash",
				Updated:    provisioningTimestamp,
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

func TestSetDefaultPermissionsAfterCreate(t *testing.T) {
	t.Run("Should set correct default permissions", func(t *testing.T) {
		testCases := []struct {
			name                        string
			rootFolder                  bool
			featureKubernetesDashboards bool
			expectedPermission          []accesscontrol.SetResourcePermissionCommand
		}{
			{
				name:                        "without kubernetesDashboards feature in root folder",
				rootFolder:                  true,
				featureKubernetesDashboards: false,
				expectedPermission: []accesscontrol.SetResourcePermissionCommand{
					{UserID: 1, Permission: dashboardaccess.PERMISSION_ADMIN.String()},
					{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
					{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
				},
			},
			{
				name:                        "with kubernetesDashboards feature in root folder",
				rootFolder:                  true,
				featureKubernetesDashboards: true,
				expectedPermission: []accesscontrol.SetResourcePermissionCommand{
					{UserID: 1, Permission: dashboardaccess.PERMISSION_ADMIN.String()},
					{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_ADMIN.String()},
					{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
				},
			},
			{
				name:                        "without kubernetesDashboards feature in subfolder",
				rootFolder:                  false,
				featureKubernetesDashboards: false,
				expectedPermission: []accesscontrol.SetResourcePermissionCommand{
					{UserID: 1, Permission: dashboardaccess.PERMISSION_ADMIN.String()},
				},
			},
			{
				name:                        "with kubernetesDashboards feature in subfolder",
				rootFolder:                  false,
				featureKubernetesDashboards: true,
				expectedPermission:          nil,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				user := &user.SignedInUser{
					OrgID:   1,
					OrgRole: "Admin",
					UserID:  1,
				}
				ctx := request.WithNamespace(context.Background(), "default")
				ctx = identity.WithRequester(ctx, user)

				// Setup mocks and service
				dashboardStore := &dashboards.FakeDashboardStore{}
				features := featuremgmt.WithFeatures()
				if tc.featureKubernetesDashboards {
					features = featuremgmt.WithFeatures(featuremgmt.FlagKubernetesDashboards)
				}

				permService := acmock.NewMockedPermissionsService()
				permService.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)

				service := &DashboardServiceImpl{
					cfg:                       setting.NewCfg(),
					log:                       log.New("test-logger"),
					dashboardStore:            dashboardStore,
					features:                  features,
					dashboardPermissions:      permService,
					folderPermissions:         permService,
					dashboardPermissionsReady: make(chan struct{}),
					acService:                 &actest.FakeService{},
				}
				service.RegisterDashboardPermissions(permService)

				// Create test object
				key := &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "test", Namespace: "default"}
				obj := &dashboardv0.Dashboard{
					TypeMeta: metav1.TypeMeta{
						APIVersion: "dashboard.grafana.app/v0alpha1",
					},
				}
				meta, err := utils.MetaAccessor(obj)
				require.NoError(t, err)
				if !tc.rootFolder {
					meta.SetFolder("subfolder")
				}
				// Call the method
				err = service.SetDefaultPermissionsAfterCreate(ctx, key, user, meta)
				require.NoError(t, err)

				// Verify results
				if tc.expectedPermission == nil {
					permService.AssertNotCalled(t, "SetPermissions")
				} else {
					permService.AssertCalled(t, "SetPermissions", mock.Anything, mock.Anything, mock.Anything, tc.expectedPermission)
				}
			})
		}
	})
}

func TestCleanUpDashboard(t *testing.T) {
	tests := []struct {
		name          string
		deleteError   error
		cleanupError  error
		expectCleanup bool
		expectedError error
	}{
		{
			name:          "Should delete public dashboards and clean up after delete",
			expectCleanup: true,
		},
		{
			name:          "Should return error if DeleteByDashboardUIDs fails",
			deleteError:   fmt.Errorf("deletion error"),
			expectCleanup: false,
			expectedError: fmt.Errorf("deletion error"),
		},
		{
			name:          "Should return error if CleanupAfterDelete fails",
			cleanupError:  fmt.Errorf("cleanup error"),
			expectCleanup: true,
			expectedError: fmt.Errorf("cleanup error"),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			fakeStore := dashboards.FakeDashboardStore{}
			fakePublicDashboardService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)
			service := &DashboardServiceImpl{
				cfg:                    setting.NewCfg(),
				dashboardStore:         &fakeStore,
				publicDashboardService: fakePublicDashboardService,
			}

			ctx := context.Background()
			dashboardUID := "dash-uid"
			dashboardID := int64(1)
			orgID := int64(1)

			// Setup mocks
			fakePublicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, orgID, []string{dashboardUID}).Return(tc.deleteError).Maybe()

			if tc.expectCleanup {
				fakeStore.On("CleanupAfterDelete", mock.Anything, &dashboards.DeleteDashboardCommand{
					OrgID: orgID,
					UID:   dashboardUID,
					ID:    dashboardID,
				}).Return(tc.cleanupError).Maybe()
			}

			// Execute
			err := service.CleanUpDashboard(ctx, dashboardUID, dashboardID, orgID)

			// Assert
			if tc.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tc.expectedError.Error(), err.Error())
			} else {
				require.NoError(t, err)
			}

			fakePublicDashboardService.AssertExpectations(t)
			fakeStore.AssertExpectations(t)
		})
	}
}

func TestIntegrationK8sDashboardCleanupJob(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	tests := []struct {
		name            string
		readFromUnified bool
		batchSize       int
		setupFunc       func(*DashboardServiceImpl, context.Context, *client.MockK8sHandler)
		verifyFunc      func(*testing.T, *DashboardServiceImpl, context.Context, *client.MockK8sHandler, *kvstore.FakeKVStore)
	}{
		{
			name:            "Should not run cleanup when we're reading from legacy",
			readFromUnified: false,
			batchSize:       10,
		},
		{
			name:            "Should process dashboard cleanup for all orgs",
			readFromUnified: true,
			batchSize:       10,
			setupFunc: func(service *DashboardServiceImpl, ctx context.Context, k8sCliMock *client.MockK8sHandler) {
				// Test organizations
				fakeOrgService := service.orgService.(*orgtest.FakeOrgService)
				fakeOrgService.ExpectedOrgs = []*org.OrgDTO{
					{ID: 1, Name: "org1"},
					{ID: 2, Name: "org2"},
				}

				kv := service.kvstore.(*kvstore.FakeKVStore)
				fakeStore := service.dashboardStore.(*dashboards.FakeDashboardStore)
				fakePublicDashboardService := service.publicDashboardService.(*publicdashboards.FakePublicDashboardServiceWrapper)

				// Create dashboard unstructured items for response
				dashboard1 := createTestUnstructuredDashboard("dash1", "org1-dashboard", "101")
				dashboard2 := createTestUnstructuredDashboard("dash2", "org2-dashboard", "201")

				// Setup test data in KV store. Only populate org 1.
				_ = kv.Set(ctx, int64(1), k8sDashboardKvNamespace, k8sDashboardKvLastResourceVersionKey, "100")

				// Mock K8s responses for org 1
				k8sCliMock.On("List", mock.AnythingOfType("*context.valueCtx"), int64(1), mock.MatchedBy(func(opts metav1.ListOptions) bool {
					return opts.LabelSelector == utils.LabelKeyGetTrash+"=true" &&
						opts.Continue == ""
				})).Return(&unstructured.UnstructuredList{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"resourceVersion": "101",
						},
					},
					Items: []unstructured.Unstructured{dashboard1},
				}, nil).Once()

				// Mock K8s responses for org 2
				k8sCliMock.On("List", mock.AnythingOfType("*context.valueCtx"), int64(2), mock.MatchedBy(func(opts metav1.ListOptions) bool {
					return opts.LabelSelector == utils.LabelKeyGetTrash+"=true" &&
						opts.Continue == ""
				})).Return(&unstructured.UnstructuredList{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"resourceVersion": "201",
						},
					},
					Items: []unstructured.Unstructured{dashboard2},
				}, nil).Once()

				// should be called twice, one for each list call
				k8sCliMock.On("GetUsersFromMeta", mock.AnythingOfType("*context.valueCtx"), mock.Anything).Return(map[string]*user.User{}, nil).Times(2)

				// Mock cleanup
				fakePublicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, int64(1), []string{"dash1"}).Return(nil).Once()
				fakePublicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, int64(2), []string{"dash2"}).Return(nil).Once()
				fakeStore.On("CleanupAfterDelete", mock.Anything, mock.Anything).Return(nil).Times(2)
			},
			verifyFunc: func(t *testing.T, service *DashboardServiceImpl, ctx context.Context, k8sCliMock *client.MockK8sHandler, kv *kvstore.FakeKVStore) {
				k8sCliMock.AssertExpectations(t)

				// Verify KV store was updated with new resource versions
				val1, found1, _ := kv.Get(ctx, int64(1), k8sDashboardKvNamespace, k8sDashboardKvLastResourceVersionKey)
				require.True(t, found1)
				require.Equal(t, "101", val1)

				val2, found2, _ := kv.Get(ctx, int64(2), k8sDashboardKvNamespace, k8sDashboardKvLastResourceVersionKey)
				require.True(t, found2)
				require.Equal(t, "201", val2)
			},
		},
		{
			name:            "Should handle pagination and batching when processing large sets of dashboards",
			readFromUnified: true,
			batchSize:       3,
			setupFunc: func(service *DashboardServiceImpl, ctx context.Context, k8sCliMock *client.MockK8sHandler) {
				// Test organization
				fakeOrgService := service.orgService.(*orgtest.FakeOrgService)
				fakeOrgService.ExpectedOrgs = []*org.OrgDTO{
					{ID: 1, Name: "org1"},
				}

				kv := service.kvstore.(*kvstore.FakeKVStore)
				fakeStore := service.dashboardStore.(*dashboards.FakeDashboardStore)
				fakePublicDashboardService := service.publicDashboardService.(*publicdashboards.FakePublicDashboardServiceWrapper)

				// Setup initial resource version
				initialVersion := "100"
				_ = kv.Set(ctx, int64(1), k8sDashboardKvNamespace, k8sDashboardKvLastResourceVersionKey, initialVersion)

				// Create dashboard batches (5 dashboards total, to be processed in 2 batches)
				firstBatch := []unstructured.Unstructured{
					createTestUnstructuredDashboard("dash1", "dashboard1", "101"),
					createTestUnstructuredDashboard("dash2", "dashboard2", "102"),
					createTestUnstructuredDashboard("dash3", "dashboard3", "150"),
				}
				secondBatch := []unstructured.Unstructured{
					createTestUnstructuredDashboard("dash4", "dashboard4", "180"),
					createTestUnstructuredDashboard("dash5", "dashboard5", "200"),
				}

				// First batch response with continue token
				k8sCliMock.On("List", mock.AnythingOfType("*context.valueCtx"), int64(1), mock.MatchedBy(func(opts metav1.ListOptions) bool {
					return opts.LabelSelector == utils.LabelKeyGetTrash+"=true" &&
						opts.Continue == ""
				})).Return(&unstructured.UnstructuredList{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"resourceVersion": "200",
							"continue":        "next-token",
						},
					},
					Items: firstBatch,
				}, nil).Once()

				// Second batch response with updated resource version
				k8sCliMock.On("List", mock.AnythingOfType("*context.valueCtx"), int64(1), mock.MatchedBy(func(opts metav1.ListOptions) bool {
					return opts.LabelSelector == utils.LabelKeyGetTrash+"=true" &&
						opts.Continue == "next-token"
				})).Return(&unstructured.UnstructuredList{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"resourceVersion": "200",
						},
					},
					Items: secondBatch,
				}, nil).Once()

				// should be called twice, one for each list call
				k8sCliMock.On("GetUsersFromMeta", mock.AnythingOfType("*context.valueCtx"), mock.Anything).Return(map[string]*user.User{}, nil).Times(2)

				// Mock public dashboard deletion for each dashboard
				fakePublicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, int64(1), []string{"dash1"}).Return(nil).Once()
				fakePublicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, int64(1), []string{"dash2"}).Return(nil).Once()
				fakePublicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, int64(1), []string{"dash3"}).Return(nil).Once()
				fakePublicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, int64(1), []string{"dash4"}).Return(nil).Once()
				fakePublicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, int64(1), []string{"dash5"}).Return(nil).Once()

				// Mock cleanup after delete for each dashboard
				fakeStore.On("CleanupAfterDelete", mock.Anything, mock.Anything).Return(nil).Times(5)
			},
			verifyFunc: func(t *testing.T, service *DashboardServiceImpl, ctx context.Context, k8sCliMock *client.MockK8sHandler, kv *kvstore.FakeKVStore) {
				k8sCliMock.AssertExpectations(t)

				// Verify KV store was updated with latest resource version
				val, found, _ := kv.Get(ctx, int64(1), k8sDashboardKvNamespace, k8sDashboardKvLastResourceVersionKey)
				require.True(t, found)
				require.Equal(t, "200", val)
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Setup test database and utilities
			sqlStore, _ := sqlstore.InitTestDB(t)
			lockService := serverlock.ProvideService(sqlStore, tracing.InitializeTracerForTest())
			kv := kvstore.NewFakeKVStore()
			dual := dualwrite.NewMockService(t)
			dual.On("ReadFromUnified", mock.Anything, mock.Anything).Return(tc.readFromUnified, nil)

			fakeStore := dashboards.FakeDashboardStore{}
			fakePublicDashboardService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)
			fakeOrgService := orgtest.NewOrgServiceFake()
			features := featuremgmt.WithFeatures()

			service := &DashboardServiceImpl{
				cfg:                    setting.NewCfg(),
				log:                    log.New("test.logger"),
				dashboardStore:         &fakeStore,
				publicDashboardService: fakePublicDashboardService,
				orgService:             fakeOrgService,
				serverLockService:      lockService,
				kvstore:                kv,
				features:               features,
				dual:                   dual,
			}

			ctx, k8sCliMock := setupK8sDashboardTests(service)

			if tc.setupFunc != nil {
				tc.setupFunc(service, ctx, k8sCliMock)
			}

			// Execute
			err := service.cleanupK8sDashboardResources(ctx, int64(tc.batchSize), 20*time.Second)
			require.NoError(t, err)

			if tc.verifyFunc != nil {
				tc.verifyFunc(t, service, ctx, k8sCliMock, kv)
			}
		})
	}

	t.Run("Should start and stop background job correctly", func(t *testing.T) {
		// Setup test database and utilities
		sqlStore, _ := sqlstore.InitTestDB(t)
		lockService := serverlock.ProvideService(sqlStore, tracing.InitializeTracerForTest())

		cfg := setting.NewCfg()
		cfg.K8sDashboardCleanup = setting.K8sDashboardCleanupSettings{
			Interval:  30 * time.Second,
			Timeout:   25 * time.Second,
			BatchSize: 10,
		}

		service := &DashboardServiceImpl{
			cfg:               cfg,
			log:               log.New("test.logger"),
			features:          featuremgmt.WithFeatures(),
			serverLockService: lockService,
		}

		// Create a test context that can be canceled
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// Start job with the context
		done := service.startK8sDeletedDashboardsCleanupJob(ctx)

		// Cancel context to verify graceful shutdown
		cancel()

		// Wait for goroutine to exit instead of using sleep
		select {
		case <-done:
			// Job exited successfully
		case <-time.After(time.Second):
			t.Fatal("Cleanup job didn't exit within timeout")
		}
	})
}

// Helper functions for testing

func createTestUnstructuredDashboard(uid, title string, resourceVersion string) unstructured.Unstructured {
	return unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": dashboardv0.DashboardResourceInfo.GroupVersion().String(),
			"kind":       dashboardv0.DashboardResourceInfo.GroupVersionKind().Kind,
			"metadata": map[string]interface{}{
				"name":              uid,
				"deletionTimestamp": "2023-01-01T00:00:00Z",
				"resourceVersion":   resourceVersion,
			},
			"spec": map[string]interface{}{
				"title": title,
			},
		},
	}
}

func TestGetDashboardsByLibraryPanelUID(t *testing.T) {
	fakeStore := dashboards.FakeDashboardStore{}
	fakePublicDashboardService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)
	defer fakeStore.AssertExpectations(t)

	k8sCliMock := new(client.MockK8sHandler)

	folderSvc := foldertest.NewFakeService()
	service := &DashboardServiceImpl{
		cfg:                    setting.NewCfg(),
		log:                    log.New("test.logger"),
		dashboardStore:         &fakeStore,
		folderService:          folderSvc,
		ac:                     actest.FakeAccessControl{ExpectedEvaluate: true},
		features:               featuremgmt.WithFeatures(),
		publicDashboardService: fakePublicDashboardService,
		k8sclient:              k8sCliMock,
	}

	searchResponse := &resourcepb.ResourceSearchResponse{
		TotalHits: 3,
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{Name: resource.SEARCH_FIELD_TITLE, Type: resourcepb.ResourceTableColumnDefinition_STRING},
				{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceTableColumnDefinition_STRING},
				{Name: resource.SEARCH_FIELD_TAGS, Type: resourcepb.ResourceTableColumnDefinition_STRING},
				{Name: resource.SEARCH_FIELD_LEGACY_ID, Type: resourcepb.ResourceTableColumnDefinition_INT64},
			},
			Rows: []*resourcepb.ResourceTableRow{
				{
					Key: &resourcepb.ResourceKey{
						Name:     "dashboard1",
						Resource: "dashboard",
					},
					Cells: [][]byte{
						[]byte("Dashboard 1"),
						[]byte("folder1"),
						[]byte("[]"),
						[]byte("1"),
					},
				},
				{
					Key: &resourcepb.ResourceKey{
						Name:     "dashboard2",
						Resource: "dashboard",
					},
					Cells: [][]byte{
						[]byte("Dashboard 2"),
						[]byte("folder2"),
						[]byte("[]"),
						[]byte("2"),
					},
				},
				{
					Key: &resourcepb.ResourceKey{
						Name:     "dashboard3",
						Resource: "dashboard",
					},
					Cells: [][]byte{
						[]byte("Dashboard 3"),
						[]byte(""),
						[]byte("[]"),
						[]byte("3"),
					},
				},
			},
		},
	}

	k8sCliMock.On("Search", mock.Anything, mock.Anything, mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
		return len(req.Options.Fields) == 1 &&
			req.Options.Fields[0].Key == search.DASHBOARD_LIBRARY_PANEL_REFERENCE &&
			req.Options.Fields[0].Values[0] == "test-library-panel"
	})).Return(searchResponse, nil).Once()

	results, err := service.GetDashboardsByLibraryPanelUID(context.Background(), "test-library-panel", 1)

	require.NoError(t, err)
	require.Len(t, results, 3)

	resultMap := make(map[string]*dashboards.DashboardRef)
	for _, result := range results {
		resultMap[result.UID] = result
	}

	expectedDashboards := map[string]struct {
		folderUID string
		id        int64
	}{
		"dashboard1": {folderUID: "folder1", id: 1},
		"dashboard2": {folderUID: "folder2", id: 2},
		"dashboard3": {folderUID: "", id: 3},
	}
	for uid, expected := range expectedDashboards {
		result, exists := resultMap[uid]
		require.True(t, exists, "Expected dashboard %s not found", uid)
		require.Equal(t, expected.folderUID, result.FolderUID, "Folder UID mismatch for %s", uid)
		require.Equal(t, expected.id, result.ID, "ID mismatch for %s", uid) // nolint:staticcheck
	}

	k8sCliMock.AssertExpectations(t)
}

package folderimpl

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"k8s.io/apimachinery/pkg/selection"
	clientrest "k8s.io/client-go/rest"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	internalfolders "github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardsearch "github.com/grafana/grafana/pkg/services/dashboards/service/search"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	ngstore "github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var orgID = int64(1)
var noPermUsr = &user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{}}

type rcp struct {
	Host string
}

func (r rcp) GetRestConfig(ctx context.Context) (*clientrest.Config, error) {
	return &clientrest.Config{
		Host: r.Host,
	}, nil
}

func compareFoldersNormalizeTime(t *testing.T, expected, actual *folder.Folder) {
	require.Equal(t, expected.Title, actual.Title)
	require.Equal(t, expected.UID, actual.UID)
	require.Equal(t, expected.OrgID, actual.OrgID)
	require.Equal(t, expected.URL, actual.URL)
	require.Equal(t, expected.Fullpath, actual.Fullpath)
	require.Equal(t, expected.FullpathUIDs, actual.FullpathUIDs)
	require.Equal(t, expected.CreatedByUID, actual.CreatedByUID)
	require.Equal(t, expected.UpdatedByUID, actual.UpdatedByUID)
	require.Equal(t, expected.ParentUID, actual.ParentUID)
	require.Equal(t, expected.Description, actual.Description)
	require.Equal(t, expected.HasACL, actual.HasACL)
	require.Equal(t, expected.Version, actual.Version)
	require.Equal(t, expected.ManagedBy, actual.ManagedBy)
	require.Equal(t, expected.Created.Local(), actual.Created.Local())
	require.Equal(t, expected.Updated.Local(), actual.Updated.Local())
}

func TestIntegrationFolderServiceViaUnifiedStorage(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	m := map[string]folderv1.Folder{}

	unifiedStorageFolder := &folderv1.Folder{}
	unifiedStorageFolder.Kind = "folder"

	fooFolder := &folder.Folder{
		ID:        123,
		Title:     "Foo Folder",
		OrgID:     orgID,
		UID:       "foo",
		URL:       "/dashboards/f/foo/foo-folder",
		CreatedBy: 1,
		UpdatedBy: 1,
	}

	updateFolder := &folder.Folder{
		Title: "Folder",
		OrgID: orgID,
		UID:   "updatefolder",
	}

	mux := http.NewServeMux()

	mux.HandleFunc("DELETE /apis/folder.grafana.app/v1beta1/namespaces/default/folders/deletefolder", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
	})

	mux.HandleFunc("GET /apis/folder.grafana.app/v1beta1/namespaces/default/folders", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		l := &folderv1.FolderList{}
		l.Kind = "Folder"
		err := json.NewEncoder(w).Encode(l)
		require.NoError(t, err)
	})

	mux.HandleFunc("GET /apis/folder.grafana.app/v1beta1/namespaces/default/folders/foo", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		namespacer := func(_ int64) string { return "1" }
		result, err := internalfolders.LegacyFolderToUnstructured(fooFolder, namespacer)
		require.NoError(t, err)

		err = json.NewEncoder(w).Encode(result)
		require.NoError(t, err)
	})

	mux.HandleFunc("GET /apis/folder.grafana.app/v1beta1/namespaces/default/folders/updatefolder", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		namespacer := func(_ int64) string { return "1" }
		result, err := internalfolders.LegacyFolderToUnstructured(updateFolder, namespacer)
		require.NoError(t, err)

		err = json.NewEncoder(w).Encode(result)
		require.NoError(t, err)
	})

	mux.HandleFunc("PUT /apis/folder.grafana.app/v1beta1/namespaces/default/folders/updatefolder", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		buf, err := io.ReadAll(req.Body)
		require.NoError(t, err)

		var foldr folderv1.Folder
		err = json.Unmarshal(buf, &foldr)
		require.NoError(t, err)

		updateFolder.Title = foldr.Spec.Title

		namespacer := func(_ int64) string { return "1" }
		result, err := internalfolders.LegacyFolderToUnstructured(updateFolder, namespacer)
		require.NoError(t, err)

		err = json.NewEncoder(w).Encode(result)
		require.NoError(t, err)
	})

	mux.HandleFunc("GET /apis/folder.grafana.app/v1beta1/namespaces/default/folders/ady4yobv315a8e", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		err := json.NewEncoder(w).Encode(unifiedStorageFolder)
		require.NoError(t, err)
	})
	mux.HandleFunc("PUT /apis/folder.grafana.app/v1beta1/namespaces/default/folders/ady4yobv315a8e", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		err := json.NewEncoder(w).Encode(unifiedStorageFolder)
		require.NoError(t, err)
	})
	mux.HandleFunc("POST /apis/folder.grafana.app/v1beta1/namespaces/default/folders", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		buf, err := io.ReadAll(req.Body)
		require.NoError(t, err)

		var folder folderv1.Folder
		err = json.Unmarshal(buf, &folder)
		require.NoError(t, err)

		m[folder.Name] = folder

		fmt.Printf("buf: %+v\n", folder)
		folder.Kind = "Folder"
		err = json.NewEncoder(w).Encode(folder)
		require.NoError(t, err)
	})

	folderApiServerMock := httptest.NewServer(mux)
	defer folderApiServerMock.Close()

	db, cfg := sqlstore.InitTestDB(t)
	cfg.AppURL = folderApiServerMock.URL

	restCfgProvider := rcp{
		Host: folderApiServerMock.URL,
	}

	userService := &usertest.FakeUserService{
		ExpectedUser: &user.User{},
	}

	featuresArr := []any{
		featuremgmt.FlagKubernetesClientDashboardsFolders}
	features := featuremgmt.WithFeatures(featuresArr...)

	tracer := noop.NewTracerProvider().Tracer("TestIntegrationFolderServiceViaUnifiedStorage")
	dashboardStore := dashboards.NewFakeDashboardStore(t)
	k8sCli := client.NewK8sHandler(dualwrite.ProvideTestService(), request.GetNamespaceMapper(cfg), folderv1.FolderResourceInfo.GroupVersionResource(), restCfgProvider.GetRestConfig, dashboardStore, userService, nil, sort.ProvideService(), nil)
	unifiedStore := ProvideUnifiedStore(k8sCli, userService, tracer)

	ctx := context.Background()
	usr := &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{
		1: accesscontrol.GroupScopesByActionContext(
			ctx,
			[]accesscontrol.Permission{
				{Action: dashboards.ActionFoldersCreate, Scope: dashboards.ScopeFoldersAll},
				{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersAll},
				{Action: dashboards.ActionFoldersDelete, Scope: dashboards.ScopeFoldersAll},
				{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersAll},
				{Action: accesscontrol.ActionAlertingRuleDelete, Scope: dashboards.ScopeFoldersAll},
			}),
	}}

	alertingStore := ngstore.DBstore{
		SQLStore:      db,
		Cfg:           cfg.UnifiedAlerting,
		Logger:        log.New("test-alerting-store"),
		AccessControl: actest.FakeAccessControl{ExpectedEvaluate: true},
	}

	publicDashboardService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)

	fakeK8sClient := new(client.MockK8sHandler)
	folderService := &Service{
		log:                    slog.New(logtest.NewTestHandler(t)).With("logger", "test-folder-service"),
		unifiedStore:           unifiedStore,
		features:               features,
		bus:                    bus.ProvideBus(tracing.InitializeTracerForTest()),
		accessControl:          acimpl.ProvideAccessControl(features),
		registry:               make(map[string]folder.RegistryService),
		metrics:                newFoldersMetrics(nil),
		tracer:                 tracer,
		k8sclient:              k8sCli,
		dashboardK8sClient:     fakeK8sClient,
		publicDashboardService: publicDashboardService,
	}

	require.NoError(t, folderService.RegisterService(alertingStore))

	t.Run("Folder service tests", func(t *testing.T) {
		t.Run("Given user has no permissions", func(t *testing.T) {
			ctx = identity.WithRequester(context.Background(), noPermUsr)

			f := folder.NewFolder("Folder", "")
			f.UID = "foo"

			t.Run("When get folder by id should return access denied error", func(t *testing.T) {
				_, err := folderService.Get(ctx, &folder.GetFolderQuery{
					UID:          &f.UID,
					OrgID:        orgID,
					SignedInUser: noPermUsr,
				})
				require.Equal(t, dashboards.ErrFolderAccessDenied, err)
			})

			t.Run("When get folder by uid should return access denied error", func(t *testing.T) {
				_, err := folderService.Get(ctx, &folder.GetFolderQuery{
					UID:          &f.UID,
					OrgID:        orgID,
					SignedInUser: noPermUsr,
				})
				require.Equal(t, dashboards.ErrFolderAccessDenied, err)
			})

			t.Run("When creating folder should return access denied error", func(t *testing.T) {
				_, err := folderService.Create(ctx, &folder.CreateFolderCommand{
					OrgID:        orgID,
					Title:        f.Title,
					UID:          f.UID,
					SignedInUser: noPermUsr,
				})
				require.Error(t, err)
			})

			title := "Folder-TEST"
			t.Run("When updating folder should return access denied error", func(t *testing.T) {
				_, err := folderService.Update(ctx, &folder.UpdateFolderCommand{
					UID:          f.UID,
					OrgID:        orgID,
					NewTitle:     &title,
					SignedInUser: noPermUsr,
				})
				require.Error(t, err)
				require.Equal(t, dashboards.ErrFolderAccessDenied, err)
			})

			t.Run("When deleting folder by uid should return access denied error", func(t *testing.T) {
				err := folderService.Delete(ctx, &folder.DeleteFolderCommand{
					UID:              f.UID,
					OrgID:            orgID,
					ForceDeleteRules: false,
					SignedInUser:     noPermUsr,
				})
				require.Error(t, err)
				require.Equal(t, dashboards.ErrFolderAccessDenied, err)
			})
		})

		t.Run("Given user has permission to save", func(t *testing.T) {
			ctx = identity.WithRequester(context.Background(), usr)

			f := &folder.Folder{
				OrgID:     orgID,
				Title:     "Test-Folder",
				UID:       "testfolder",
				URL:       "/dashboards/f/testfolder/test-folder",
				CreatedBy: 1,
				UpdatedBy: 1,
			}

			t.Run("When creating folder should not return access denied error", func(t *testing.T) {
				actualFolder, err := folderService.Create(ctx, &folder.CreateFolderCommand{
					OrgID:        orgID,
					Title:        f.Title,
					UID:          f.UID,
					SignedInUser: usr,
				})
				require.NoError(t, err)
				compareFoldersNormalizeTime(t, f, actualFolder)
			})

			t.Run("When creating folder should return error if uid is general", func(t *testing.T) {
				_, err := folderService.Create(ctx, &folder.CreateFolderCommand{
					OrgID:        orgID,
					Title:        f.Title,
					UID:          "general",
					SignedInUser: usr,
				})
				require.ErrorIs(t, err, dashboards.ErrFolderInvalidUID)
			})

			t.Run("When updating folder should not return access denied error", func(t *testing.T) {
				title := "TEST-Folder"
				req := &folder.UpdateFolderCommand{
					UID:          updateFolder.UID,
					OrgID:        orgID,
					NewTitle:     &title,
					SignedInUser: usr,
				}
				reqResult, err := folderService.Update(ctx, req)
				require.NoError(t, err)
				require.Equal(t, title, reqResult.Title)
			})

			t.Run("When deleting folder by uid should not return access denied error - ForceDeleteRules true", func(t *testing.T) {
				err := folderService.Delete(ctx, &folder.DeleteFolderCommand{
					UID:              "deletefolder",
					OrgID:            orgID,
					ForceDeleteRules: true,
					SignedInUser:     usr,
				})
				require.NoError(t, err)
			})

			t.Run("When deleting folder by uid should not return access denied error - ForceDeleteRules false", func(t *testing.T) {
				fakeK8sClient.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{}}, nil).Once()
				publicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, mock.Anything, mock.Anything).Return(nil)

				err := folderService.Delete(ctx, &folder.DeleteFolderCommand{
					UID:              "deletefolder",
					OrgID:            orgID,
					ForceDeleteRules: false,
					SignedInUser:     usr,
				})
				require.NoError(t, err)
			})

			t.Run("When deleting folder by uid, expectedForceDeleteRules as false,should not return access denied error", func(t *testing.T) {
				fakeK8sClient.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{}}, nil).Once()

				expectedForceDeleteRules := false
				err := folderService.Delete(ctx, &folder.DeleteFolderCommand{
					UID:              "deletefolder",
					OrgID:            orgID,
					ForceDeleteRules: expectedForceDeleteRules,
					SignedInUser:     usr,
				})
				require.NoError(t, err)
			})

			t.Run("When deleting folder by uid, expectedForceDeleteRules as true, should not return access denied error", func(t *testing.T) {
				fakeK8sClient.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{}}, nil).Once()

				expectedForceDeleteRules := true
				err := folderService.Delete(ctx, &folder.DeleteFolderCommand{
					UID:              "deletefolder",
					OrgID:            orgID,
					ForceDeleteRules: expectedForceDeleteRules,
					SignedInUser:     usr,
				})
				require.NoError(t, err)
			})
		})

		t.Run("Given user has permission to view", func(t *testing.T) {
			t.Run("When get folder by uid should return folder", func(t *testing.T) {
				actual, err := folderService.Get(ctx, &folder.GetFolderQuery{
					UID:          &fooFolder.UID,
					OrgID:        fooFolder.OrgID,
					SignedInUser: usr,
				})
				require.NoError(t, err)
				compareFoldersNormalizeTime(t, fooFolder, actual)
			})

			t.Run("When get folder by uid and uid is general should return the root folder object", func(t *testing.T) {
				uid := accesscontrol.GeneralFolderUID
				query := &folder.GetFolderQuery{
					UID:          &uid,
					OrgID:        1,
					SignedInUser: usr,
				}
				actual, err := folderService.Get(ctx, query)
				require.Equal(t, folder.RootFolder, actual)
				require.NoError(t, err)
			})

			t.Run("When get folder by ID and uid is an empty string should return folder by id", func(t *testing.T) {
				dashboardStore.On("FindDashboards", mock.Anything, mock.Anything).Return([]dashboards.DashboardSearchProjection{
					{
						IsFolder: true,
						ID:       fooFolder.ID, // nolint:staticcheck
						UID:      fooFolder.UID,
					},
				}, nil).Once()
				id := int64(123)
				emptyString := ""
				query := &folder.GetFolderQuery{
					UID:          &emptyString,
					ID:           &id,
					OrgID:        1,
					SignedInUser: usr,
				}

				actual, err := folderService.Get(context.Background(), query)
				require.NoError(t, err)
				compareFoldersNormalizeTime(t, fooFolder, actual)
			})

			t.Run("When get folder by non existing ID should return not found error", func(t *testing.T) {
				dashboardStore.On("FindDashboards", mock.Anything, mock.Anything).Return([]dashboards.DashboardSearchProjection{}, nil).Once()
				id := int64(111111)
				query := &folder.GetFolderQuery{
					ID:           &id,
					OrgID:        1,
					SignedInUser: usr,
				}

				actual, err := folderService.Get(context.Background(), query)
				require.Nil(t, actual)
				require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
			})

			t.Run("When get folder by Title should return folder", func(t *testing.T) {
				dashboardStore.On("FindDashboards", mock.Anything, mock.Anything).Return([]dashboards.DashboardSearchProjection{
					{
						IsFolder: true,
						ID:       fooFolder.ID, // nolint:staticcheck
						UID:      fooFolder.UID,
					},
				}, nil).Once()
				title := "foo"
				query := &folder.GetFolderQuery{
					Title:        &title,
					OrgID:        1,
					SignedInUser: usr,
				}

				actual, err := folderService.Get(context.Background(), query)
				require.NoError(t, err)
				compareFoldersNormalizeTime(t, fooFolder, actual)
			})

			t.Run("When get folder by non existing Title should return not found error", func(t *testing.T) {
				dashboardStore.On("FindDashboards", mock.Anything, mock.Anything).Return([]dashboards.DashboardSearchProjection{}, nil).Once()
				title := "does not exists"
				query := &folder.GetFolderQuery{
					Title:        &title,
					OrgID:        1,
					SignedInUser: usr,
				}

				actual, err := folderService.Get(context.Background(), query)
				require.Nil(t, actual)
				require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
			})
		})

		t.Run("Returns root folder", func(t *testing.T) {
			t.Run("When the folder UID and title are blank, and id is 0, should return the root folder", func(t *testing.T) {
				emptyString := ""
				idZero := int64(0)
				actual, err := folderService.Get(ctx, &folder.GetFolderQuery{
					UID:          &emptyString,
					ID:           &idZero,
					Title:        &emptyString,
					OrgID:        1,
					SignedInUser: usr,
				})

				require.NoError(t, err)
				require.Equal(t, folder.GeneralFolder.UID, actual.UID)
				require.Equal(t, folder.GeneralFolder.Title, actual.Title)
			})
		})
	})
}

func TestSearchFoldersFromApiServer(t *testing.T) {
	fakeK8sClient := new(client.MockK8sHandler)
	folderStore := folder.NewFakeStore()
	folderStore.ExpectedFolder = &folder.Folder{
		UID:   "parent-uid",
		ID:    2,
		Title: "parent title",
	}
	tracer := noop.NewTracerProvider().Tracer("TestSearchFoldersFromApiServer")
	service := Service{
		k8sclient:     fakeK8sClient,
		features:      featuremgmt.WithFeatures(featuremgmt.FlagKubernetesClientDashboardsFolders),
		unifiedStore:  folderStore,
		tracer:        tracer,
		accessControl: actest.FakeAccessControl{ExpectedEvaluate: true},
	}
	user := &user.SignedInUser{OrgID: 1}
	ctx := identity.WithRequester(context.Background(), user)
	fakeK8sClient.On("GetNamespace", mock.Anything, mock.Anything).Return("default")

	t.Run("Should call search with uids, if provided", func(t *testing.T) {
		fakeK8sClient.On("Search", mock.Anything, int64(1), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "default",
					Group:     folderv1.FolderResourceInfo.GroupVersionResource().Group,
					Resource:  folderv1.FolderResourceInfo.GroupVersionResource().Resource,
				},
				Fields: []*resourcepb.Requirement{
					{
						Key:      resource.SEARCH_FIELD_NAME,
						Operator: string(selection.In),
						Values:   []string{"uid1", "uid2"}, // should only search by uid since it is provided
					},
				},
				Labels: []*resourcepb.Requirement{},
			},
			Limit: folderSearchLimit}).Return(&resourcepb.ResourceSearchResponse{
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
							Resource: "folder",
						},
						Cells: [][]byte{
							[]byte("folder0"),
							[]byte(""),
						},
					},
					{
						Key: &resourcepb.ResourceKey{
							Name:     "uid2",
							Resource: "folder",
						},
						Cells: [][]byte{
							[]byte("folder1"),
							[]byte(""),
						},
					},
				},
			},
			TotalHits: 2,
		}, nil).Once()
		query := folder.SearchFoldersQuery{
			UIDs:         []string{"uid1", "uid2"},
			IDs:          []int64{1, 2}, // will ignore these because uid is passed in
			SignedInUser: user,
		}
		result, err := service.searchFoldersFromApiServer(ctx, query)
		require.NoError(t, err)

		expectedResult := model.HitList{
			{
				UID: "uid1",
				// orgID should be taken from signed in user
				OrgID: 1,
				// the rest should be automatically set when parsing the hit results from search
				Type:  model.DashHitFolder,
				URI:   "db/folder0",
				Title: "folder0",
				URL:   "/dashboards/f/uid1/folder0",
			},
			{
				UID:   "uid2",
				OrgID: 1,
				Type:  model.DashHitFolder,
				URI:   "db/folder1",
				Title: "folder1",
				URL:   "/dashboards/f/uid2/folder1",
			},
		}
		require.Equal(t, expectedResult, result)
		fakeK8sClient.AssertExpectations(t)
	})

	t.Run("Should call search by ID if uids are not provided", func(t *testing.T) {
		query := folder.SearchFoldersQuery{
			IDs:          []int64{123},
			SignedInUser: user,
		}
		fakeK8sClient.On("Search", mock.Anything, int64(1), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "default",
					Group:     folderv1.FolderResourceInfo.GroupVersionResource().Group,
					Resource:  folderv1.FolderResourceInfo.GroupVersionResource().Resource,
				},
				Fields: []*resourcepb.Requirement{},
				Labels: []*resourcepb.Requirement{
					{
						Key:      utils.LabelKeyDeprecatedInternalID,
						Operator: string(selection.In),
						Values:   []string{"123"},
					},
				},
			},
			Limit: folderSearchLimit}).Return(&resourcepb.ResourceSearchResponse{
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
							Name:     "foo",
							Resource: "folder",
						},
						Cells: [][]byte{
							[]byte("folder1"),
							[]byte(""),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil).Once()

		result, err := service.searchFoldersFromApiServer(ctx, query)
		require.NoError(t, err)
		expectedResult := model.HitList{
			{
				UID:   "foo",
				OrgID: 1,
				Type:  model.DashHitFolder,
				URI:   "db/folder1",
				Title: "folder1",
				URL:   "/dashboards/f/foo/folder1",
			},
		}
		require.Equal(t, expectedResult, result)
		fakeK8sClient.AssertExpectations(t)
	})

	t.Run("Search by title, wildcard should be added to search request (won't match in search mock if not)", func(t *testing.T) {
		// the search here will return a parent, this will be the parent folder returned when we query for it to add to the hit info
		fakeFolderStore := folder.NewFakeStore()
		fakeFolderStore.ExpectedFolder = &folder.Folder{
			UID:   "parent-uid",
			ID:    2,
			Title: "parent title",
		}
		service.unifiedStore = fakeFolderStore
		fakeK8sClient.On("Search", mock.Anything, int64(1), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "default",
					Group:     folderv1.FolderResourceInfo.GroupVersionResource().Group,
					Resource:  folderv1.FolderResourceInfo.GroupVersionResource().Resource,
				},
				Fields: []*resourcepb.Requirement{},
				Labels: []*resourcepb.Requirement{},
			},
			Query:  "*test*",
			Fields: dashboardsearch.IncludeFields,
			Limit:  folderSearchLimit}).Return(&resourcepb.ResourceSearchResponse{
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
							Resource: "folder",
						},
						Cells: [][]byte{
							[]byte("testing-123"),
							[]byte("parent-uid"),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil).Once()

		query := folder.SearchFoldersQuery{
			Title:        "test",
			SignedInUser: user,
		}
		result, err := service.searchFoldersFromApiServer(ctx, query)
		require.NoError(t, err)

		expectedResult := model.HitList{
			{
				UID:       "uid",
				FolderUID: "parent-uid",
				OrgID:     1,
				Type:      model.DashHitFolder,
				URI:       "db/testing-123",
				Title:     "testing-123",
				URL:       "/dashboards/f/uid/testing-123",
			},
		}
		require.Equal(t, expectedResult, result)
		fakeK8sClient.AssertExpectations(t)
	})
}

func TestGetFoldersFromApiServer(t *testing.T) {
	fakeK8sClient := new(client.MockK8sHandler)
	folderStore := folder.NewFakeStore()
	folderStore.ExpectedFolder = &folder.Folder{
		UID:   "parent-uid",
		ID:    2,
		Title: "parent title",
	}
	tracer := noop.NewTracerProvider().Tracer("TestGetFoldersFromApiServer")
	service := Service{
		k8sclient:     fakeK8sClient,
		features:      featuremgmt.WithFeatures(featuremgmt.FlagKubernetesClientDashboardsFolders),
		unifiedStore:  folderStore,
		accessControl: actest.FakeAccessControl{ExpectedEvaluate: true},
		tracer:        tracer,
	}
	user := &user.SignedInUser{OrgID: 1}
	ctx := identity.WithRequester(context.Background(), user)
	fakeK8sClient.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
	folderkey := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     folderv1.FolderResourceInfo.GroupVersionResource().Group,
		Resource:  folderv1.FolderResourceInfo.GroupVersionResource().Resource,
	}

	t.Run("Get folder by title", func(t *testing.T) {
		// the search here will return a parent, this will be the parent folder returned when we query for it to add to the hit info
		fakeFolderStore := folder.NewFakeStore()
		fakeFolderStore.ExpectedFolder = &folder.Folder{
			UID:       "foouid",
			ParentUID: "parentuid",
			ID:        2,
			OrgID:     1,
			Title:     "foo title",
			URL:       "/dashboards/f/foouid/foo-title",
		}
		service.unifiedStore = fakeFolderStore
		fakeK8sClient.On("Search", mock.Anything, int64(1), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: folderkey,
				Fields: []*resourcepb.Requirement{
					{
						Key:      resource.SEARCH_FIELD_TITLE_PHRASE, // nolint:staticcheck
						Operator: string(selection.Equals),
						Values:   []string{"foo title"},
					},
				},
				Labels: []*resourcepb.Requirement{},
			},
			Limit: folderSearchLimit}).
			Return(&resourcepb.ResourceSearchResponse{
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
								Resource: "folder",
							},
							Cells: [][]byte{
								[]byte("foouid"),
								[]byte("parentuid"),
							},
						},
					},
				},
				TotalHits: 1,
			}, nil).Once()

		result, err := service.getFolderByTitleFromApiServer(ctx, 1, "foo title", nil)
		require.NoError(t, err)

		expectedResult := &folder.Folder{
			ID:        2,
			UID:       "foouid",
			ParentUID: "parentuid",
			Title:     "foo title",
			OrgID:     1,
			URL:       "/dashboards/f/foouid/foo-title",
		}
		compareFoldersNormalizeTime(t, expectedResult, result)
		fakeK8sClient.AssertExpectations(t)
	})
}

func TestIntegrationDeleteFoldersFromApiServer(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	fakeK8sClient := new(client.MockK8sHandler)
	fakeK8sClient.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
	dashboardK8sclient := new(client.MockK8sHandler)
	fakeFolderStore := folder.NewFakeStore()
	dashboardStore := dashboards.NewFakeDashboardStore(t)
	publicDashboardFakeService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)
	tracer := noop.NewTracerProvider().Tracer("TestDeleteFoldersFromApiServer")
	service := Service{
		k8sclient:              fakeK8sClient,
		dashboardK8sClient:     dashboardK8sclient,
		unifiedStore:           fakeFolderStore,
		dashboardStore:         dashboardStore,
		publicDashboardService: publicDashboardFakeService,
		accessControl:          actest.FakeAccessControl{ExpectedEvaluate: true},
		registry:               make(map[string]folder.RegistryService),
		features:               featuremgmt.WithFeatures(featuremgmt.FlagKubernetesClientDashboardsFolders),
		tracer:                 tracer,
	}
	user := &user.SignedInUser{OrgID: 1}
	ctx := identity.WithRequester(context.Background(), user)
	db, cfg := sqlstore.InitTestDB(t)

	alertingStore := ngstore.DBstore{
		SQLStore:      db,
		Cfg:           cfg.UnifiedAlerting,
		Logger:        log.New("test-alerting-store"),
		AccessControl: actest.FakeAccessControl{ExpectedEvaluate: true},
	}
	require.NoError(t, service.RegisterService(alertingStore))

	t.Run("Should delete folder", func(t *testing.T) {
		publicDashboardFakeService.On("DeleteByDashboardUIDs", mock.Anything, int64(1), []string{}).Return(nil).Once()
		dashboardK8sclient.On("Search", mock.Anything, int64(1), mock.Anything).Return(&resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{}}, nil).Once()
		err := service.deleteFromApiServer(ctx, &folder.DeleteFolderCommand{
			UID:          "uid1",
			OrgID:        1,
			SignedInUser: user,
		})
		require.NoError(t, err)
		dashboardK8sclient.AssertExpectations(t)
		publicDashboardFakeService.AssertExpectations(t)
	})

	t.Run("Should delete folders, dashboards, and public dashboards within the folder", func(t *testing.T) {
		fakeFolderStore.ExpectedFolders = []*folder.Folder{{UID: "uid2", ID: 2}}
		dashboardK8sclient.On("Delete", mock.Anything, "test", int64(1), mock.Anything).Return(nil).Once()
		dashboardK8sclient.On("Delete", mock.Anything, "test2", int64(1), mock.Anything).Return(nil).Once()
		dashboardK8sclient.On("Search", mock.Anything, int64(1), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Labels: []*resourcepb.Requirement{},
				Fields: []*resourcepb.Requirement{
					{
						Key:      resource.SEARCH_FIELD_FOLDER,
						Operator: string(selection.In),
						Values:   []string{"uid2", "uid"},
					},
				},
			},
			Limit: folderSearchLimit}).Return(&resourcepb.ResourceSearchResponse{
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
							Name:     "test",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("uid"),
							[]byte(""),
						},
					},
					{
						Key: &resourcepb.ResourceKey{
							Name:     "test2",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("uid2"),
							[]byte(""),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil).Once()
		publicDashboardFakeService.On("DeleteByDashboardUIDs", mock.Anything, int64(1), []string{"test", "test2"}).Return(nil).Once()
		err := service.deleteFromApiServer(ctx, &folder.DeleteFolderCommand{
			UID:          "uid",
			OrgID:        1,
			SignedInUser: user,
		})
		require.NoError(t, err)
		dashboardStore.AssertExpectations(t)
		publicDashboardFakeService.AssertExpectations(t)
	})
}

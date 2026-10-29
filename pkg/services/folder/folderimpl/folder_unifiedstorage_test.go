package folderimpl

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/protobuf/proto"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/selection"
	clientrest "k8s.io/client-go/rest"

	dashboardapp "github.com/grafana/grafana/apps/dashboard/pkg/apis"
	dashv0alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
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
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/librarypanels"
	ngrules "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type rcp struct {
	Host string
}

func (r rcp) GetRestConfig(ctx context.Context) (*clientrest.Config, error) {
	return &clientrest.Config{
		Host: r.Host,
	}, nil
}

type folderResult struct {
	uid       string
	parentUID string
}

func buildFolderSearchResponse(results ...folderResult) *resourcepb.ResourceSearchResponse {
	rows := make([]*resourcepb.ResourceSearchRow, len(results))
	for i, r := range results {
		rows[i] = &resourcepb.ResourceSearchRow{Key: &resourcepb.ResourceKey{Name: r.uid, Resource: "folders"}, Values: []*resourcepb.ResourceSearchValue{
			{FieldIndex: 0, StringValues: []string{r.parentUID}},
		}}
	}
	return &resourcepb.ResourceSearchResponse{
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Fields: []*resourcepb.ResourceSearchField{
			{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceSearchField_STRING},
		},
		Rows:      rows,
		TotalHits: int64(len(results)),
	}
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
	testutil.SkipIntegrationTestInShortMode(t)

	m := map[string]folderv1.Folder{}

	unifiedStorageFolder := &folderv1.Folder{}
	unifiedStorageFolder.Kind = "folder"

	fooFolder := &folder.Folder{
		ID:        123, //nolint:staticcheck // Exercise legacy field compatibility.
		Title:     "Foo Folder",
		OrgID:     orgID,
		UID:       "foo",
		URL:       "/dashboards/f/foo/foo-folder",
		CreatedBy: 1,
		UpdatedBy: 1,
	}

	notFooFolder := &folder.Folder{
		ID:        543, //nolint:staticcheck // Exercise legacy field compatibility.
		Title:     "Foo Folder",
		OrgID:     orgID,
		UID:       "not-foo",
		URL:       "/dashboards/f/not-foo/foo-folder",
		CreatedBy: 1,
		UpdatedBy: 1,
		ParentUID: "test",
	}

	updateFolder := &folder.Folder{
		Title: "Folder",
		OrgID: orgID,
		UID:   "updatefolder",
	}

	mux := http.NewServeMux()

	mux.HandleFunc("DELETE /apis/folder.grafana.app/v1/namespaces/default/folders/deletefolder", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
	})

	// GetDescendants validates the ancestor exists via Get before issuing the
	// per-level searches, so the delete tests need a GET handler for deletefolder.
	mux.HandleFunc("GET /apis/folder.grafana.app/v1/namespaces/default/folders/deletefolder", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		namespacer := func(_ int64) string { return "1" }
		result, err := internalfolders.LegacyFolderToUnstructured(&folder.Folder{
			OrgID: orgID,
			UID:   "deletefolder",
			Title: "deletefolder",
		}, namespacer)
		require.NoError(t, err)
		err = json.NewEncoder(w).Encode(result)
		require.NoError(t, err)
	})

	mux.HandleFunc("GET /apis/folder.grafana.app/v1/namespaces/default/folders", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		l := &folderv1.FolderList{}
		l.Kind = "Folder"
		err := json.NewEncoder(w).Encode(l)
		require.NoError(t, err)
	})

	mux.HandleFunc("GET /apis/folder.grafana.app/v1/namespaces/default/folders/foo", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		namespacer := func(_ int64) string { return "1" }
		result, err := internalfolders.LegacyFolderToUnstructured(fooFolder, namespacer)
		require.NoError(t, err)

		err = json.NewEncoder(w).Encode(result)
		require.NoError(t, err)
	})

	mux.HandleFunc("GET /apis/folder.grafana.app/v1/namespaces/default/folders/forbidden", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		_ = json.NewEncoder(w).Encode(`{
										"kind": "Status",
										"apiVersion": "v1",
										"metadata": {},
										"status": "Failure",
										"code": 403
										}`)
	})

	mux.HandleFunc("GET /apis/folder.grafana.app/v1/namespaces/default/folders/not-foo", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		namespacer := func(_ int64) string { return "1" }
		result, err := internalfolders.LegacyFolderToUnstructured(notFooFolder, namespacer)
		require.NoError(t, err)
		err = json.NewEncoder(w).Encode(result)
		require.NoError(t, err)
	})

	mux.HandleFunc("GET /apis/folder.grafana.app/v1/namespaces/default/folders/updatefolder", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		namespacer := func(_ int64) string { return "1" }
		result, err := internalfolders.LegacyFolderToUnstructured(updateFolder, namespacer)
		require.NoError(t, err)

		err = json.NewEncoder(w).Encode(result)
		require.NoError(t, err)
	})

	mux.HandleFunc("PUT /apis/folder.grafana.app/v1/namespaces/default/folders/updatefolder", func(w http.ResponseWriter, req *http.Request) {
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

	mux.HandleFunc("GET /apis/folder.grafana.app/v1/namespaces/default/folders/ady4yobv315a8e", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		err := json.NewEncoder(w).Encode(unifiedStorageFolder)
		require.NoError(t, err)
	})
	mux.HandleFunc("PUT /apis/folder.grafana.app/v1/namespaces/default/folders/ady4yobv315a8e", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		err := json.NewEncoder(w).Encode(unifiedStorageFolder)
		require.NoError(t, err)
	})
	mux.HandleFunc("POST /apis/folder.grafana.app/v1/namespaces/default/folders", func(w http.ResponseWriter, req *http.Request) {
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

	db, cfg := sqlstore.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	cfg.AppURL = folderApiServerMock.URL

	restCfgProvider := rcp{
		Host: folderApiServerMock.URL,
	}

	userService := &usertest.FakeUserService{
		ExpectedUser: &user.User{},
	}

	features := featuremgmt.WithFeatures()

	tracer := noop.NewTracerProvider().Tracer("TestIntegrationFolderServiceViaUnifiedStorage")
	searchMock := resource.NewMockResourceClient(t)
	k8sCli := client.NewK8sHandler(request.GetNamespaceMapper(cfg), folderv1.FolderResourceInfo.GroupVersionResource(), restCfgProvider.GetRestConfig, userService, searchMock)
	unifiedStore := ProvideUnifiedStore(k8sCli, userService, tracer, cfg)

	ctx := context.Background()
	usr := &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{
		1: accesscontrol.GroupScopesByActionContext(
			ctx,
			[]accesscontrol.Permission{
				{Action: folder.ActionFoldersCreate, Scope: folder.ScopeFoldersAll},
				{Action: folder.ActionFoldersWrite, Scope: folder.ScopeFoldersAll},
				{Action: folder.ActionFoldersDelete, Scope: folder.ScopeFoldersAll},
				{Action: folder.ActionFoldersRead, Scope: folder.ScopeFoldersAll},
				{Action: accesscontrol.ActionAlertingRuleDelete, Scope: folder.ScopeFoldersAll},
				{Action: accesscontrol.ActionLibraryPanelsDelete, Scope: folder.ScopeFoldersAll},
			}),
	}}

	alertingStore := ngrules.RuleStore{
		SQLStore:      db,
		Cfg:           cfg.UnifiedAlerting,
		Logger:        log.New("test-alerting-store"),
		AccessControl: actest.FakeAccessControl{ExpectedEvaluate: true},
	}

	mockDashboardService := dashboards.NewFakeDashboardService(t)
	mockFolderService := foldertest.NewFakeService()
	elementService := libraryelements.ProvideService(cfg, db, routing.NewRouteRegister(), mockFolderService, featuremgmt.WithFeatures(), actest.FakeAccessControl{ExpectedEvaluate: true}, mockDashboardService, nil, nil)
	lps := librarypanels.LibraryPanelService{
		Cfg:                   cfg,
		SQLStore:              db,
		LibraryElementService: elementService,
		FolderService:         mockFolderService,
	}

	publicDashboardService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)

	fakeK8sClient := new(client.MockK8sHandler)
	variableK8sClient := new(client.MockK8sHandler)
	variableK8sClient.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES}, nil)
	folderService := &Service{
		log:                    slog.New(logtest.NewTestHandler(t)).With("logger", "test-folder-service"),
		unifiedStore:           unifiedStore,
		features:               features,
		accessControl:          acimpl.ProvideAccessControl(features),
		registry:               make(map[string]folder.RegistryService),
		tracer:                 tracer,
		k8sclient:              k8sCli,
		dashboardK8sClient:     fakeK8sClient,
		variableK8sClient:      variableK8sClient,
		publicDashboardService: publicDashboardService,
	}

	require.NoError(t, folderService.RegisterService(alertingStore))
	require.NoError(t, folderService.RegisterService(lps))

	t.Run("Folder service tests", func(t *testing.T) {
		t.Run("Given user has no permissions", func(t *testing.T) {
			ctx = identity.WithRequester(context.Background(), noPermUsr)

			f := folder.NewFolder("Folder", "")
			f.UID = "forbidden"

			t.Run("When get folder by id should return access denied error", func(t *testing.T) {
				_, err := folderService.Get(ctx, &folder.GetFolderQuery{
					UID:          &f.UID,
					OrgID:        orgID,
					SignedInUser: noPermUsr,
				})
				require.Equal(t, folder.ErrAccessDenied, err)
			})

			t.Run("When get folder by uid should return access denied error", func(t *testing.T) {
				_, err := folderService.Get(ctx, &folder.GetFolderQuery{
					UID:          &f.UID,
					OrgID:        orgID,
					SignedInUser: noPermUsr,
				})
				require.Equal(t, folder.ErrAccessDenied, err)
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
				// GetDescendants issues a Search for the ancestor's children;
				// return an empty result so the subtree is just deletefolder.
				searchMock.On("Search", mock.Anything, mock.Anything).Return(buildFolderSearchResponse(), nil).Once()

				err := folderService.Delete(ctx, &folder.DeleteFolderCommand{
					UID:              "deletefolder",
					OrgID:            orgID,
					ForceDeleteRules: true,
					SignedInUser:     usr,
				})
				require.NoError(t, err)
			})

			t.Run("When deleting folder by uid should not return access denied error - ForceDeleteRules false", func(t *testing.T) {
				searchMock.On("Search", mock.Anything, mock.Anything).Return(buildFolderSearchResponse(), nil).Once()
				fakeK8sClient.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES}, nil).Once()
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
				searchMock.On("Search", mock.Anything, mock.Anything).Return(buildFolderSearchResponse(), nil).Once()
				fakeK8sClient.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES}, nil).Once()

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
				searchMock.On("Search", mock.Anything, mock.Anything).Return(buildFolderSearchResponse(), nil).Once()
				fakeK8sClient.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES}, nil).Once()

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
				searchMock.On("Search", mock.Anything, mock.Anything).Return(buildFolderSearchResponse(folderResult{uid: fooFolder.UID}), nil).Once()
				id := int64(123)
				emptyString := ""
				query := &folder.GetFolderQuery{
					UID:          &emptyString,
					ID:           &id, //nolint:staticcheck // Exercise legacy field compatibility.
					OrgID:        1,
					SignedInUser: usr,
				}

				actual, err := folderService.Get(context.Background(), query)
				require.NoError(t, err)
				compareFoldersNormalizeTime(t, fooFolder, actual)
			})

			t.Run("When get folder by non existing ID should return not found error", func(t *testing.T) {
				searchMock.On("Search", mock.Anything, mock.Anything).Return(buildFolderSearchResponse(), nil).Once()
				id := int64(111111)
				query := &folder.GetFolderQuery{
					ID:           &id, //nolint:staticcheck // Exercise legacy field compatibility.
					OrgID:        1,
					SignedInUser: usr,
				}

				actual, err := folderService.Get(context.Background(), query)
				require.Nil(t, actual)
				require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
			})

			t.Run("When get folder by Title and nil parentID should return top-level folder", func(t *testing.T) {
				searchMock.On("Search", mock.Anything, mock.Anything).Return(buildFolderSearchResponse(
					folderResult{uid: notFooFolder.UID, parentUID: notFooFolder.ParentUID},
					folderResult{uid: fooFolder.UID},
				), nil).Once()
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

			t.Run("When get folder by Title and non-nil parentID should return inner folder", func(t *testing.T) {
				searchMock.On("Search", mock.Anything, mock.Anything).Return(buildFolderSearchResponse(
					folderResult{uid: notFooFolder.UID, parentUID: notFooFolder.ParentUID},
				), nil).Once()
				title := "foo"
				parentUID := "test"
				query := &folder.GetFolderQuery{
					Title:        &title,
					OrgID:        1,
					SignedInUser: usr,
					ParentUID:    &parentUID,
				}

				actual, err := folderService.Get(context.Background(), query)
				require.NoError(t, err)
				compareFoldersNormalizeTime(t, notFooFolder, actual)
			})

			t.Run("When get folder by non existing Title should return not found error", func(t *testing.T) {
				searchMock.On("Search", mock.Anything, mock.Anything).Return(buildFolderSearchResponse(), nil).Once()
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
					ID:           &idZero, //nolint:staticcheck // Exercise legacy field compatibility.
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

func TestSearchFolders(t *testing.T) {
	fakeK8sClient := new(client.MockK8sHandler)
	folderStore := folder.NewFakeStore()
	folderStore.ExpectedFolder = &folder.Folder{
		UID:   "parent-uid",
		ID:    2, //nolint:staticcheck // Exercise legacy field compatibility.
		Title: "parent title",
	}
	tracer := noop.NewTracerProvider().Tracer("TestSearchFolders")
	service := Service{
		k8sclient:     fakeK8sClient,
		features:      featuremgmt.WithFeatures(),
		unifiedStore:  folderStore,
		tracer:        tracer,
		accessControl: actest.FakeAccessControl{ExpectedEvaluate: true},
	}
	user := &user.SignedInUser{OrgID: 1}
	ctx := identity.WithRequester(context.Background(), user)
	fakeK8sClient.On("GetNamespace", mock.Anything, mock.Anything).Return("default")

	t.Run("Should call search with uids, if provided", func(t *testing.T) {
		fakeK8sClient.On("Search", mock.Anything, int64(1), &resourcepb.ResourceSearchRequest{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
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
			Page:  1,
			Limit: folderSearchLimit}).Return(&resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Fields: []*resourcepb.ResourceSearchField{
				{Name: "title", Type: resourcepb.ResourceSearchField_STRING},
				{Name: "folder", Type: resourcepb.ResourceSearchField_STRING},
			},
			Rows: []*resourcepb.ResourceSearchRow{
				{
					Key: &resourcepb.ResourceKey{Name: "uid1", Resource: "folder"},
					Values: []*resourcepb.ResourceSearchValue{
						{FieldIndex: 0, StringValues: []string{"folder0"}},
						{FieldIndex: 1, StringValues: []string{""}},
					},
				},
				{
					Key: &resourcepb.ResourceKey{Name: "uid2", Resource: "folder"},
					Values: []*resourcepb.ResourceSearchValue{
						{FieldIndex: 0, StringValues: []string{"folder1"}},
						{FieldIndex: 1, StringValues: []string{""}},
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
		result, err := service.SearchFolders(ctx, query)
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
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
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
			Page:  1,
			Limit: folderSearchLimit}).Return(&resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Fields: []*resourcepb.ResourceSearchField{
				{Name: "title", Type: resourcepb.ResourceSearchField_STRING},
				{Name: "folder", Type: resourcepb.ResourceSearchField_STRING},
			},
			Rows: []*resourcepb.ResourceSearchRow{
				{
					Key: &resourcepb.ResourceKey{Name: "foo", Resource: "folder"},
					Values: []*resourcepb.ResourceSearchValue{
						{FieldIndex: 0, StringValues: []string{"folder1"}},
						{FieldIndex: 1, StringValues: []string{""}},
					},
				},
			},
			TotalHits: 1,
		}, nil).Once()

		result, err := service.SearchFolders(ctx, query)
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
			ID:    2, //nolint:staticcheck // Exercise legacy field compatibility.
			Title: "parent title",
		}
		service.unifiedStore = fakeFolderStore
		fakeK8sClient.On("Search", mock.Anything, int64(1), &resourcepb.ResourceSearchRequest{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "default",
					Group:     folderv1.FolderResourceInfo.GroupVersionResource().Group,
					Resource:  folderv1.FolderResourceInfo.GroupVersionResource().Resource,
				},
				Fields: []*resourcepb.Requirement{},
				Labels: []*resourcepb.Requirement{},
			},
			Query: "*test*",
			// Spelled out rather than referencing dashboardsearch.FieldValueIncludeFields, so a
			// change to the production list has to be acknowledged here. These are wire field
			// names: every one must have a typed field-value definition, or the search is
			// rejected with "unknown response field". Note the last entry is a per-label field,
			// typed via the "labels." prefix — unlike a bare "labels", which is not.
			Fields: []string{
				resource.SEARCH_FIELD_TITLE,
				resource.SEARCH_FIELD_TAGS,
				resource.SEARCH_FIELD_FOLDER,
				resource.SEARCH_FIELD_DESCRIPTION,
				resource.SEARCH_FIELD_CREATED,
				resource.SEARCH_FIELD_CREATED_BY,
				resource.SEARCH_FIELD_UPDATED,
				resource.SEARCH_FIELD_MANAGER_KIND,
				resource.SEARCH_FIELD_MANAGER_ID,
				resource.SEARCH_FIELD_SOURCE_PATH,
				resource.SEARCH_FIELD_SOURCE_CHECKSUM,
				resource.SEARCH_FIELD_SOURCE_TIME,
				resource.SEARCH_FIELD_OWNER_REFERENCES,
				resource.SEARCH_FIELD_LEGACY_ID,
				resource.SEARCH_FIELD_LABELS + "." + resource.SEARCH_FIELD_LEGACY_ID,
			},
			Page:  1,
			Limit: folderSearchLimit}).Return(&resourcepb.ResourceSearchResponse{
			Fields: []*resourcepb.ResourceSearchField{
				{Name: "title", Type: resourcepb.ResourceSearchField_STRING},
				{Name: "folder", Type: resourcepb.ResourceSearchField_STRING},
			},
			Rows: []*resourcepb.ResourceSearchRow{
				{
					Key: &resourcepb.ResourceKey{
						Name:     "uid",
						Resource: "folder",
					},
					Values: []*resourcepb.ResourceSearchValue{
						{FieldIndex: 0, StringValues: []string{"testing-123"}},
						{FieldIndex: 1, StringValues: []string{"parent-uid"}},
					},
				},
			},
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			TotalHits:    1,
		}, nil).Once()

		query := folder.SearchFoldersQuery{
			Title:        "test",
			SignedInUser: user,
		}
		result, err := service.SearchFolders(ctx, query)
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

	t.Run("Search by title rejects unsupported result formats", func(t *testing.T) {
		for _, format := range []resourcepb.ResourceSearchRequest_ResultFormat{
			resourcepb.ResourceSearchRequest_UNSPECIFIED,
			resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
			99,
		} {
			t.Run(format.String(), func(t *testing.T) {
				fakeK8sClient.On("Search", mock.Anything, int64(1), mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
					return req.ResultFormat == resourcepb.ResourceSearchRequest_FIELD_VALUES && req.Query == "*test*"
				})).Return(&resourcepb.ResourceSearchResponse{ResultFormat: format}, nil).Once()
				result, err := service.SearchFolders(ctx, folder.SearchFoldersQuery{Title: "test", SignedInUser: user})
				require.ErrorContains(t, err, "unsupported search result format")
				require.Empty(t, result)
				fakeK8sClient.AssertExpectations(t)
			})
		}
	})

	// A real index catches unknown response fields that the request mocks cannot validate.
	t.Run("Search by title returns usable field values from a populated index", func(t *testing.T) {
		var captured *resourcepb.ResourceSearchRequest
		fakeK8sClient.On("Search", mock.Anything, int64(1), mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
			captured = req
			return true
		})).Return(&resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		}, nil).Once()

		_, err := service.SearchFolders(ctx, folder.SearchFoldersQuery{
			Title:        "test",
			SignedInUser: user,
		})
		require.NoError(t, err)
		require.NotNil(t, captured, "SearchFolders did not issue a search request")
		require.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, captured.ResultFormat)
		require.NotEmpty(t, captured.Fields, "a title search must name its response fields")

		backend, err := search.NewBleveBackend(search.BleveOptions{Root: t.TempDir(), FileThreshold: 5}, nil)
		require.NoError(t, err)
		t.Cleanup(backend.Stop)

		// Folders index with the default searchable field set, as the server builds it, holding
		// one folder so the response carries values rather than only a schema.
		index, err := backend.BuildIndex(ctx, resource.NamespacedResource{
			Namespace: "default",
			Group:     folderv1.FolderResourceInfo.GroupVersionResource().Group,
			Resource:  folderv1.FolderResourceInfo.GroupVersionResource().Resource,
		}, 1, "test", func(idx resource.ResourceIndex) (int64, error) {
			return 1, idx.BulkIndex(&resource.BulkIndexRequest{
				ResourceVersion: 1,
				Items: []*resource.BulkIndexItem{{
					Action: resource.ActionIndex,
					Doc: (&resource.IndexableDocument{
						Key: &resourcepb.ResourceKey{
							Namespace: "default",
							Group:     folderv1.FolderResourceInfo.GroupVersionResource().Group,
							Resource:  folderv1.FolderResourceInfo.GroupVersionResource().Resource,
							Name:      "uid",
						},
						Name:        "uid",
						Title:       "testing-123",
						Description: "a folder",
						Folder:      "parent-uid",
						Labels:      map[string]string{utils.LabelKeyDeprecatedInternalID: "2"}, // nolint:staticcheck
						RV:          1,
					}).UpdateCopyFields(),
				}},
			})
		}, nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
		require.NoError(t, err)

		res, err := index.Search(ctx, nil, captured, nil, nil)
		require.NoError(t, err)
		require.Nil(t, res.Error, "the folder search index rejected the request SearchFolders built")
		require.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, res.ResultFormat)

		parsed, err := dashboardsearch.ParseResults(res, 0)
		require.NoError(t, err)
		require.Len(t, parsed.Hits, 1)
		hit := parsed.Hits[0]
		require.Equal(t, "uid", hit.Name)
		require.Equal(t, "testing-123", hit.Title)
		require.Equal(t, "parent-uid", hit.Folder)
		require.Equal(t, "a folder", hit.Description)
		require.Equal(t, int64(2), hit.Field.GetNestedInt64(resource.SEARCH_FIELD_LEGACY_ID))
	})
}

func TestFolderLookupSearchErrors(t *testing.T) {
	id, title := int64(1), "title"
	for name, lookup := range map[string]folder.GetFolderQuery{
		"by ID":    {ID: &id}, //nolint:staticcheck // Exercise legacy lookup compatibility.
		"by title": {Title: &title},
	} {
		for _, tc := range folderStorageFailures(t) {
			t.Run(name+"/"+tc.name, func(t *testing.T) {
				cli := new(client.MockK8sHandler)
				cli.On("GetNamespace", int64(1)).Return("default").Once()
				cli.On("Search", mock.Anything, int64(1), mock.Anything).Return(tc.searchResponse(), tc.err).Once()
				svc := &Service{k8sclient: cli, tracer: noop.NewTracerProvider().Tracer("test")}
				query := lookup
				query.OrgID = 1
				query.SignedInUser = &user.SignedInUser{OrgID: 1}

				got, err := svc.Get(t.Context(), &query)

				require.Nil(t, got)
				requireFolderStorageError(t, tc.want, err)
				cli.AssertExpectations(t)
			})
		}
	}
}

func TestGetFolderByTitle(t *testing.T) {
	fakeK8sClient := new(client.MockK8sHandler)
	folderStore := folder.NewFakeStore()
	folderStore.ExpectedFolder = &folder.Folder{
		UID:   "parent-uid",
		ID:    2, //nolint:staticcheck // Exercise legacy field compatibility.
		Title: "parent title",
	}
	tracer := noop.NewTracerProvider().Tracer("TestGetFolderByTitle")
	service := Service{
		k8sclient:     fakeK8sClient,
		features:      featuremgmt.WithFeatures(),
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

	t.Run("Get folder by title with nil parent ID", func(t *testing.T) {
		// the search here will return a parent, this will be the parent folder returned when we query for it to add to the hit info
		fakeFolderStore := folder.NewFakeStore()
		fakeFolderStore.ExpectedFolder = &folder.Folder{
			UID:       "foouid",
			ParentUID: "parentuid",
			ID:        2, //nolint:staticcheck // Exercise legacy field compatibility.
			OrgID:     1,
			Title:     "foo title",
			URL:       "/dashboards/f/foouid/foo-title",
		}
		service.unifiedStore = fakeFolderStore
		fakeK8sClient.On("Search", mock.Anything, int64(1), &resourcepb.ResourceSearchRequest{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Options: &resourcepb.ListOptions{
				Key: folderkey,
				Fields: []*resourcepb.Requirement{{
					Key:      resource.SEARCH_FIELD_TITLE_PHRASE, // nolint:staticcheck
					Operator: string(selection.Equals),
					Values:   []string{"foo title"},
				}},
				Labels: []*resourcepb.Requirement{},
			},
			Limit: folderSearchLimit}).
			Return(&resourcepb.ResourceSearchResponse{
				ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
				Fields: []*resourcepb.ResourceSearchField{
					{Name: "title", Type: resourcepb.ResourceSearchField_STRING},
					{Name: "folder", Type: resourcepb.ResourceSearchField_STRING},
				},
				Rows: []*resourcepb.ResourceSearchRow{
					{
						Key: &resourcepb.ResourceKey{Name: "uid", Resource: "folder"},
						Values: []*resourcepb.ResourceSearchValue{
							{FieldIndex: 0, StringValues: []string{"foouid"}},
							{FieldIndex: 1, StringValues: []string{"parentuid"}},
						},
					},
				},
				TotalHits: 1,
			}, nil).Once()

		_, err := service.getFolderByTitle(ctx, 1, "foo title", nil)
		// Since parentUID=nil and there's no top-level folder with the name, we return folder not found error.
		require.Error(t, err, dashboards.ErrFolderNotFound)
		fakeK8sClient.AssertExpectations(t)
	})

	t.Run("Get folder by title with parentID", func(t *testing.T) {
		// the search here will return a parent, this will be the parent folder returned when we query for it to add to the hit info
		fakeFolderStore := folder.NewFakeStore()
		fakeFolderStore.ExpectedFolder = &folder.Folder{
			UID:       "foouid",
			ParentUID: "parentuid",
			ID:        2, //nolint:staticcheck // Exercise legacy field compatibility.
			OrgID:     1,
			Title:     "foo title",
			URL:       "/dashboards/f/foouid/foo-title",
		}
		service.unifiedStore = fakeFolderStore
		fakeK8sClient.On("Search", mock.Anything, int64(1), &resourcepb.ResourceSearchRequest{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Options: &resourcepb.ListOptions{
				Key: folderkey,
				Fields: []*resourcepb.Requirement{{
					Key:      resource.SEARCH_FIELD_TITLE_PHRASE, // nolint:staticcheck
					Operator: string(selection.Equals),
					Values:   []string{"foo title"},
				}, {
					Key:      resource.SEARCH_FIELD_FOLDER,
					Operator: string(selection.In),
					Values:   []string{"parentuid"},
				}},
				Labels: []*resourcepb.Requirement{},
			},
			Limit: folderSearchLimit}).
			Return(&resourcepb.ResourceSearchResponse{
				ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
				Fields: []*resourcepb.ResourceSearchField{
					{Name: "title", Type: resourcepb.ResourceSearchField_STRING},
					{Name: "folder", Type: resourcepb.ResourceSearchField_STRING},
				},
				Rows: []*resourcepb.ResourceSearchRow{
					{
						Key: &resourcepb.ResourceKey{Name: "uid", Resource: "folder"},
						Values: []*resourcepb.ResourceSearchValue{
							{FieldIndex: 0, StringValues: []string{"foouid"}},
							{FieldIndex: 1, StringValues: []string{"parentuid"}},
						},
					},
				},
				TotalHits: 1,
			}, nil).Once()

		parentid := "parentuid"
		result, err := service.getFolderByTitle(ctx, 1, "foo title", &parentid)
		require.NoError(t, err)

		expectedResult := &folder.Folder{
			ID:        2, //nolint:staticcheck // Exercise legacy field compatibility.
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

type folderDeletionSearchClient struct {
	client.K8sHandler
	index         resource.ResourceIndex
	access        *folderSearchAccessClient
	resourceName  string
	requester     identity.Requester
	fields        []string
	deleted       []string
	calls         int
	responseBytes int
}

func (c *folderDeletionSearchClient) Search(ctx context.Context, _ int64, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	c.calls++
	c.requester, _ = identity.GetRequester(ctx)
	c.fields = slices.Clone(req.Fields)
	req.Options.Key = &resourcepb.ResourceKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: c.resourceName}
	res, err := c.index.Search(ctx, c.access, req, nil, nil)
	if err == nil && res != nil && c.responseBytes == 0 {
		c.responseBytes = proto.Size(res)
	}
	return res, err
}

func (c *folderDeletionSearchClient) Delete(_ context.Context, name string, _ int64, _ metav1.DeleteOptions) error {
	c.deleted = append(c.deleted, name)
	return nil
}

func newFolderDeletionSearchClient(t testing.TB, resourceName string, count int, cfg search.PostRankAuthzConfig) *folderDeletionSearchClient {
	t.Helper()
	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root:                 t.TempDir(),
		FileThreshold:        100,
		PostRankAuthzEnabled: true,
		PostRankAuthz:        cfg,
		SearchFields: resource.NewSearchFieldsRegistry(nil, nil, map[resource.LowerGroupResource]resource.SearchFieldsProvider{
			resource.NewLowerGroupResource("dashboard.grafana.app", resourceName): resource.NewManifestBackedProvider(dashboardapp.LocalManifest().ManifestData),
		}),
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	index, err := backend.BuildIndex(t.Context(), resource.NamespacedResource{
		Namespace: "default", Group: "dashboard.grafana.app", Resource: resourceName,
	}, int64(count), "test", func(idx resource.ResourceIndex) (int64, error) {
		items := make([]*resource.BulkIndexItem, count)
		for i := range items {
			name := fmt.Sprintf("resource-%05d", i)
			parent := "allowed"
			if i%2 == 1 {
				parent = "denied"
			}
			doc := &resource.IndexableDocument{
				Key:  &resourcepb.ResourceKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: resourceName, Name: name},
				Name: name, Title: name, Folder: parent, RV: 1,
				Description: "Shared observability configuration managed from a repository.",
				Created:     1700000000000,
				Updated:     1700000001000,
				CreatedBy:   "user:creator",
				UpdatedBy:   "user:editor",
				Labels: map[string]string{
					utils.LabelKeyDeprecatedInternalID: fmt.Sprint(i + 1), //nolint:staticcheck
					"team":                             "observability",
				},
				Manager: &utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "test-repository"},
				Source:  &utils.SourceProperties{Path: resourceName + "/" + name + ".json", Checksum: "test-checksum", TimestampMillis: 1700000001000},
			}
			if resourceName == "dashboards" {
				doc.Tags = []string{"metrics", fmt.Sprintf("service-%03d", i%100)}
			}
			items[i] = &resource.BulkIndexItem{Action: resource.ActionIndex, Doc: doc}
		}
		return int64(count), idx.BulkIndex(&resource.BulkIndexRequest{Items: items, ResourceVersion: 1})
	}, nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(t, err)
	return &folderDeletionSearchClient{
		index: index, resourceName: resourceName,
		access: &folderSearchAccessClient{AccessClient: claims.FixedAccessClient(true)},
	}
}

func searchFolderDeletionResources(ctx context.Context, cli *folderDeletionSearchClient, fields []string, limit int64, folders []string) (dashv0alpha1.SearchResults, error) {
	return dashboardsearch.SearchAll(ctx, 1, &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{Fields: []*resourcepb.Requirement{{
			Key: resource.SEARCH_FIELD_FOLDER, Operator: string(selection.In), Values: folders,
		}}},
		Fields: fields, Limit: limit, ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
	}, cli.Search)
}

func TestFolderDeletionSearchFields(t *testing.T) {
	for _, resourceName := range []string{"dashboards", "variables"} {
		for _, tc := range []struct {
			name           string
			count          int
			allowedFolders map[string]bool
			cfg            search.PostRankAuthzConfig
		}{
			{name: "empty"},
			{name: "all readable", count: 35},
			{name: "restricted", count: 35, allowedFolders: map[string]bool{"allowed": true}},
			{name: "denied", count: 35, allowedFolders: map[string]bool{}},
			{name: "candidate budget", count: 35, allowedFolders: map[string]bool{"allowed": true},
				cfg: search.PostRankAuthzConfig{MaxWindow: 7, MaxCandidates: 9}},
		} {
			t.Run(fmt.Sprintf("%s/%s", resourceName, tc.name), func(t *testing.T) {
				cli := newFolderDeletionSearchClient(t, resourceName, tc.count, tc.cfg)
				cli.access.allowedFolders = tc.allowedFolders
				ctx := claims.WithAuthInfo(t.Context(), &identity.StaticRequester{Type: claims.TypeUser, UserID: 1, Namespace: "default"})
				folders := []string{"allowed", "denied"}
				var want []string
				for i := range tc.count {
					if tc.allowedFolders == nil || tc.allowedFolders["allowed"] && i%2 == 0 {
						want = append(want, fmt.Sprintf("resource-%05d", i))
					}
				}
				for _, fields := range [][]string{nil, {resource.SEARCH_FIELD_NAME}} {
					results, err := searchFolderDeletionResources(ctx, cli, fields, 11, folders)
					require.NoError(t, err)
					var got []string
					for _, hit := range results.Hits {
						got = append(got, hit.Name)
					}
					require.Equal(t, want, got, "UID order and pagination must not depend on response fields")
				}
			})
		}
	}
}

func TestDeleteVariablesInFoldersServiceIdentity(t *testing.T) {
	cli := newFolderDeletionSearchClient(t, "variables", 6, search.PostRankAuthzConfig{})
	service := &Service{variableK8sClient: cli, tracer: noop.NewTracerProvider().Tracer("test")}
	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{OrgID: 1})
	require.NoError(t, service.deleteVariablesInFolders(ctx, 1, []string{"allowed"}))
	require.Equal(t, []string{"resource-00000", "resource-00002", "resource-00004"}, cli.deleted)
	_, serviceIdentity := identity.WithServiceIdentity(t.Context(), 1)
	require.Equal(t, serviceIdentity, cli.requester)
	require.Equal(t, []string{resource.SEARCH_FIELD_NAME}, cli.fields)
}

func TestDeleteVariablesInFoldersSearchErrors(t *testing.T) {
	for _, tc := range folderStorageFailures(t) {
		t.Run(tc.name, func(t *testing.T) {
			cli := new(client.MockK8sHandler)
			cli.On("Search", mock.Anything, int64(1), mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
				return slices.Equal(req.Fields, []string{resource.SEARCH_FIELD_NAME})
			})).Return(tc.searchResponse(), tc.err).Once()
			service := &Service{variableK8sClient: cli, tracer: noop.NewTracerProvider().Tracer("test")}
			err := service.deleteVariablesInFolders(t.Context(), 1, []string{"allowed"})
			require.ErrorContains(t, err, tc.want.Error())
			if tc.err != nil {
				require.ErrorIs(t, err, tc.err)
			}
			cli.AssertExpectations(t)
		})
	}
}

// This measures search and decoding only, without delete RPCs or real authorization-service latency.
func BenchmarkFolderDeletionSearchFields(b *testing.B) {
	for _, resourceName := range []string{"dashboards", "variables"} {
		for _, count := range []int{1000, 10000} {
			for _, restricted := range []bool{false, true} {
				for _, selected := range []bool{false, true} {
					b.Run(fmt.Sprintf("%s/docs=%d/restricted=%t/selected=%t", resourceName, count, restricted, selected), func(b *testing.B) {
						cli := newFolderDeletionSearchClient(b, resourceName, count, search.PostRankAuthzConfig{})
						ctx := identity.WithServiceIdentityContext(b.Context(), 1)
						want := count
						if restricted {
							ctx = claims.WithAuthInfo(b.Context(), &identity.StaticRequester{Type: claims.TypeUser, UserID: 1, Namespace: "default"})
							cli.access.allowedFolders = map[string]bool{"allowed": true}
							want = (count + 1) / 2
						}
						var fields []string
						if selected {
							fields = []string{resource.SEARCH_FIELD_NAME}
						}
						folders := []string{"allowed", "denied"}
						results, err := searchFolderDeletionResources(ctx, cli, fields, folderSearchLimit, folders)
						require.NoError(b, err)
						require.Len(b, results.Hits, want)
						cli.calls, cli.access.checked = 0, 0
						b.ReportAllocs()
						for b.Loop() {
							results, err := searchFolderDeletionResources(ctx, cli, fields, folderSearchLimit, folders)
							if err != nil {
								b.Fatal(err)
							}
							if len(results.Hits) != want {
								b.Fatalf("got %d UIDs, want %d", len(results.Hits), want)
							}
						}
						b.ReportMetric(float64(cli.calls)/float64(b.N), "searches/op")
						b.ReportMetric(float64(cli.access.checked)/float64(b.N), "authz-hits/op")
						b.ReportMetric(float64(cli.responseBytes), "response-bytes")
					})
				}
			}
		}
	}
}

func TestIntegrationDeleteFolders(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	fakeK8sClient := new(client.MockK8sHandler)
	fakeK8sClient.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
	dashboardK8sclient := new(client.MockK8sHandler)
	variableK8sClient := new(client.MockK8sHandler)
	fakeFolderStore := folder.NewFakeStore()
	publicDashboardFakeService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)
	tracer := noop.NewTracerProvider().Tracer("TestDeleteFolders")
	service := Service{
		k8sclient:              fakeK8sClient,
		dashboardK8sClient:     dashboardK8sclient,
		variableK8sClient:      variableK8sClient,
		unifiedStore:           fakeFolderStore,
		publicDashboardService: publicDashboardFakeService,
		accessControl:          actest.FakeAccessControl{ExpectedEvaluate: true},
		registry:               make(map[string]folder.RegistryService),
		features:               featuremgmt.WithFeatures(),
		tracer:                 tracer,
		log:                    slog.New(logtest.NewNopHandler(t)),
	}
	user := &user.SignedInUser{OrgID: 1}
	ctx := identity.WithRequester(context.Background(), user)
	db, cfg := sqlstore.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore

	alertingStore := ngrules.RuleStore{
		SQLStore:      db,
		Cfg:           cfg.UnifiedAlerting,
		Logger:        log.New("test-alerting-store"),
		AccessControl: actest.FakeAccessControl{ExpectedEvaluate: true},
	}
	require.NoError(t, service.RegisterService(alertingStore))

	mockDashboardService := dashboards.NewFakeDashboardService(t)
	mockFolderService := foldertest.NewFakeService()
	elementService := libraryelements.ProvideService(cfg, db, routing.NewRouteRegister(), mockFolderService, featuremgmt.WithFeatures(), actest.FakeAccessControl{ExpectedEvaluate: true}, mockDashboardService, nil, nil)
	lps := librarypanels.LibraryPanelService{
		Cfg:                   cfg,
		SQLStore:              db,
		LibraryElementService: elementService,
		FolderService:         mockFolderService,
	}
	require.NoError(t, service.RegisterService(lps))

	fieldValueRequest := mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
		return req.ResultFormat == resourcepb.ResourceSearchRequest_FIELD_VALUES &&
			slices.Equal(req.Fields, []string{resource.SEARCH_FIELD_NAME})
	})

	for _, tc := range folderStorageFailures(t) {
		t.Run("dashboard search error/"+tc.name, func(t *testing.T) {
			dashboardK8sclient.On("Search", mock.Anything, int64(1), fieldValueRequest).Return(tc.searchResponse(), tc.err).Once()
			err := service.Delete(ctx, &folder.DeleteFolderCommand{UID: "uid", OrgID: 1, SignedInUser: user})
			require.ErrorContains(t, err, tc.want.Error())
			if tc.err != nil {
				require.ErrorIs(t, err, tc.err)
			}
			dashboardK8sclient.AssertExpectations(t)
		})
	}

	t.Run("Should delete folder", func(t *testing.T) {
		publicDashboardFakeService.On("DeleteByDashboardUIDs", mock.Anything, int64(1), []string{}).Return(nil).Once()
		dashboardK8sclient.On("Search", mock.Anything, int64(1), fieldValueRequest).Return(&resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES}, nil).Once()
		variableK8sClient.On("Search", mock.Anything, int64(1), fieldValueRequest).Return(&resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES}, nil).Once()
		err := service.Delete(ctx, &folder.DeleteFolderCommand{
			UID:          "uid1",
			OrgID:        1,
			SignedInUser: user,
		})
		require.NoError(t, err)
		dashboardK8sclient.AssertExpectations(t)
		publicDashboardFakeService.AssertExpectations(t)
		variableK8sClient.AssertExpectations(t)
	})

	t.Run("Should delete folders, dashboards, and public dashboards within the folder", func(t *testing.T) {
		fakeFolderStore.ExpectedFolders = []*folder.Folder{{UID: "uid2", ID: 2}}
		dashboardK8sclient.On("Delete", mock.Anything, "test", int64(1), mock.Anything).Return(nil).Once()
		dashboardK8sclient.On("Delete", mock.Anything, "test2", int64(1), mock.Anything).Return(nil).Once()
		dashboardK8sclient.On("Search", mock.Anything, int64(1), &resourcepb.ResourceSearchRequest{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Fields:       []string{resource.SEARCH_FIELD_NAME},
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
			Page:  1,
			Limit: folderSearchLimit}).Return(&resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Fields: []*resourcepb.ResourceSearchField{
				{Name: "title", Type: resourcepb.ResourceSearchField_STRING},
				{Name: "folder", Type: resourcepb.ResourceSearchField_STRING},
			},
			Rows: []*resourcepb.ResourceSearchRow{
				{
					Key: &resourcepb.ResourceKey{Name: "test", Resource: "dashboard"},
					Values: []*resourcepb.ResourceSearchValue{
						{FieldIndex: 0, StringValues: []string{"uid"}},
						{FieldIndex: 1, StringValues: []string{""}},
					},
				},
				{
					Key: &resourcepb.ResourceKey{Name: "test2", Resource: "dashboard"},
					Values: []*resourcepb.ResourceSearchValue{
						{FieldIndex: 0, StringValues: []string{"uid2"}},
						{FieldIndex: 1, StringValues: []string{""}},
					},
				},
			},
			TotalHits: 1,
		}, nil).Once()
		publicDashboardFakeService.On("DeleteByDashboardUIDs", mock.Anything, int64(1), []string{"test", "test2"}).Return(nil).Once()
		variableK8sClient.On("Search", mock.Anything, int64(1), fieldValueRequest).Return(&resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES}, nil).Once()
		err := service.Delete(ctx, &folder.DeleteFolderCommand{
			UID:          "uid",
			OrgID:        1,
			SignedInUser: user,
		})
		require.NoError(t, err)
		publicDashboardFakeService.AssertExpectations(t)
		variableK8sClient.AssertExpectations(t)
	})

	t.Run("Should delete variables within the folder", func(t *testing.T) {
		fakeFolderStore.ExpectedFolders = nil
		variableK8sClient.On("Search", mock.Anything, int64(1), fieldValueRequest).Return(&resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Fields: []*resourcepb.ResourceSearchField{
				{Name: "title", Type: resourcepb.ResourceSearchField_STRING},
			},
			Rows: []*resourcepb.ResourceSearchRow{
				{
					Key: &resourcepb.ResourceKey{Name: "var1", Resource: "variables"},
					Values: []*resourcepb.ResourceSearchValue{
						{FieldIndex: 0, StringValues: []string{"my-var"}},
					},
				},
			},
			TotalHits: 1,
		}, nil).Once()
		variableK8sClient.On("Delete", mock.Anything, "var1", int64(1), mock.Anything).Return(nil).Once()

		err := service.Delete(ctx, &folder.DeleteFolderCommand{
			UID:              "uid-vars",
			OrgID:            1,
			ForceDeleteRules: true,
			SignedInUser:     user,
		})
		require.NoError(t, err)
		variableK8sClient.AssertExpectations(t)
	})
}

type dashboardDeleteClient struct {
	client.K8sHandler
	uids                       []string
	deleteFn                   func(context.Context, string) error
	mu                         sync.Mutex
	active, maximum, completed int
	calls                      []string
	badOptions                 bool
	requester                  identity.Requester
	badRequester               bool
}

func (c *dashboardDeleteClient) Search(context.Context, int64, *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	rows := make([]*resourcepb.ResourceSearchRow, len(c.uids))
	for i, uid := range c.uids {
		rows[i] = &resourcepb.ResourceSearchRow{Key: &resourcepb.ResourceKey{Name: uid}}
	}
	return &resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES, Rows: rows, TotalHits: int64(len(rows))}, nil
}
func (c *dashboardDeleteClient) Delete(ctx context.Context, uid string, orgID int64, opts metav1.DeleteOptions) error {
	requester, _ := identity.GetRequester(ctx)
	c.mu.Lock()
	c.calls = append(c.calls, uid)
	c.badOptions = c.badOptions || orgID != 1 || opts.GracePeriodSeconds != nil || opts.Preconditions != nil
	c.badRequester = c.badRequester || requester != c.requester
	c.active++
	c.maximum = max(c.maximum, c.active)
	c.mu.Unlock()
	defer func() { c.mu.Lock(); c.active--; c.completed++; c.mu.Unlock() }()
	if c.deleteFn != nil {
		return c.deleteFn(ctx, uid)
	}
	return nil
}

// dashboardDeletePublicService records how many dashboard deletes had finished when the public
// dashboard cleanup ran, which must be all of them.
type dashboardDeletePublicService struct {
	publicdashboards.ServiceWrapper
	client             *dashboardDeleteClient
	uids               []string
	completedAtCleanup int
}

func (p *dashboardDeletePublicService) DeleteByDashboardUIDs(_ context.Context, _ int64, uids []string) error {
	p.uids = uids
	p.client.mu.Lock()
	p.completedAtCleanup = p.client.completed
	p.client.mu.Unlock()
	return nil
}

type dashboardDeleteStore struct {
	folder.Store
	deleted bool
}

func (s *dashboardDeleteStore) GetDescendants(context.Context, int64, string) ([]*folder.Folder, error) {
	return nil, nil
}
func (s *dashboardDeleteStore) Delete(context.Context, []string, int64) error {
	s.deleted = true
	return nil
}

type emptyFolderRegistry struct{ folder.RegistryService }

func (*emptyFolderRegistry) CountInFolders(context.Context, int64, []string, identity.Requester) (int64, error) {
	return 0, nil
}
func (*emptyFolderRegistry) DeleteInFolders(context.Context, int64, []string, identity.Requester) error {
	return nil
}

// withParallelDashboardDelete serves the parallel delete flag for the duration of the test. Call it outside a
// synctest bubble: the OpenFeature provider is process-global.
func withParallelDashboardDelete(t *testing.T, concurrency int) {
	featuremgmt.WithFlagValues(t, map[string]any{featuremgmt.FlagFoldersParallelDashboardDeleteConcurrency: concurrency})
}

func newDashboardDeleteService(t *testing.T, count int) (*Service, *dashboardDeleteClient, *folder.DeleteFolderCommand, context.Context) {
	requester := &user.SignedInUser{UserID: 42, OrgID: 1}
	cli := &dashboardDeleteClient{requester: requester}
	for i := range count {
		cli.uids = append(cli.uids, fmt.Sprintf("dashboard-%d", i))
	}
	svc := &Service{
		cfg: setting.NewCfg(), dashboardK8sClient: cli, variableK8sClient: &dashboardDeleteClient{}, unifiedStore: &dashboardDeleteStore{},
		publicDashboardService: &dashboardDeletePublicService{client: cli},
		tracer:                 noop.NewTracerProvider().Tracer("test"), log: slog.New(logtest.NewNopHandler(t)),
		registry: map[string]folder.RegistryService{entity.StandardKindAlertRule: &emptyFolderRegistry{}, entity.StandardKindLibraryPanel: &emptyFolderRegistry{}},
	}
	return svc, cli, &folder.DeleteFolderCommand{UID: "folder", OrgID: 1, SignedInUser: requester}, identity.WithRequester(context.Background(), requester)
}

// deleteGate holds every delete until open is called, so a test can see how many run at once.
type deleteGate struct {
	entered chan struct{}
	release chan struct{}
	once    sync.Once
}

func newDeleteGate(t *testing.T) *deleteGate {
	g := &deleteGate{entered: make(chan struct{}, 100), release: make(chan struct{})}
	t.Cleanup(g.open)
	return g
}

func (g *deleteGate) hold(context.Context, string) error {
	g.entered <- struct{}{}
	<-g.release
	return nil
}

func (g *deleteGate) open() { g.once.Do(func() { close(g.release) }) }

func (g *deleteGate) waitForDeletes(t *testing.T, n int) {
	t.Helper()
	synctest.Wait()
	require.Len(t, g.entered, n, "unexpected number of in-flight deletes")
}

func runInBackground(f func() error) <-chan error {
	done := make(chan error, 1)
	go func() { done <- f() }()
	return done
}

func waitForResult(t *testing.T, done <-chan error) error {
	t.Helper()
	synctest.Wait()
	select {
	case err := <-done:
		return err
	default:
		t.Fatal("delete did not finish")
		return nil
	}
}

func TestDeleteFolderDashboardConcurrency(t *testing.T) {
	for _, tc := range []struct {
		name                 string
		workers, count, want int
	}{
		{"one worker deletes in order", 1, 12, 1},
		{"bounded by the worker count", 4, 12, 4},
		{"more workers than dashboards", 8, 2, 2},
		{"non-positive worker count deletes in order", 0, 12, 1},
		{"empty folder", 4, 0, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			withParallelDashboardDelete(t, tc.workers)
			synctest.Test(t, func(t *testing.T) {
				svc, cli, cmd, ctx := newDashboardDeleteService(t, tc.count)
				gate := newDeleteGate(t)
				cli.deleteFn = gate.hold
				done := runInBackground(func() error { return svc.Delete(ctx, cmd) })

				gate.waitForDeletes(t, tc.want)
				gate.open()
				require.NoError(t, waitForResult(t, done))

				require.Equal(t, tc.want, cli.maximum)
				if tc.workers > 1 {
					require.ElementsMatch(t, cli.uids, cli.calls)
				} else {
					require.Equal(t, cli.uids, cli.calls)
				}
				require.False(t, cli.badOptions)
				require.False(t, cli.badRequester)
				public := svc.publicDashboardService.(*dashboardDeletePublicService)
				require.Equal(t, tc.count, public.completedAtCleanup)
				require.ElementsMatch(t, cli.uids, public.uids)
				require.True(t, svc.unifiedStore.(*dashboardDeleteStore).deleted)
			})
		})
	}
}

func TestDeleteFolderDashboardRequestCancellation(t *testing.T) {
	withParallelDashboardDelete(t, 4)
	synctest.Test(t, func(t *testing.T) {
		svc, cli, cmd, ctx := newDashboardDeleteService(t, 20)
		ctx, cancel := context.WithCancel(ctx)
		gate := newDeleteGate(t)
		cli.deleteFn = func(ctx context.Context, uid string) error {
			_ = gate.hold(ctx, uid)
			<-ctx.Done()
			return ctx.Err()
		}
		done := runInBackground(func() error { return svc.Delete(ctx, cmd) })

		gate.waitForDeletes(t, 4)
		cancel()
		synctest.Wait()
		select {
		case <-done:
			t.Fatal("returned before in-flight deletes finished")
		default:
		}
		gate.open()

		require.ErrorIs(t, waitForResult(t, done), context.Canceled)
		require.Len(t, cli.calls, 4)
		require.Nil(t, svc.publicDashboardService.(*dashboardDeletePublicService).uids)
		require.False(t, svc.unifiedStore.(*dashboardDeleteStore).deleted)
	})
}

func TestDeleteFolderDashboardFailureLetsInFlightDeletesFinish(t *testing.T) {
	withParallelDashboardDelete(t, 4)
	synctest.Test(t, func(t *testing.T) {
		svc, cli, cmd, ctx := newDashboardDeleteService(t, 20)
		gate := newDeleteGate(t)
		releaseFailure := make(chan struct{})
		canceled := make(chan string, 20)
		failure := errors.New("dashboard delete failed")
		cli.deleteFn = func(ctx context.Context, uid string) error {
			gate.entered <- struct{}{}
			if uid == "dashboard-0" {
				<-releaseFailure
				return failure
			}
			select {
			case <-ctx.Done():
				canceled <- uid
				return ctx.Err()
			case <-gate.release:
				return nil
			}
		}
		done := runInBackground(func() error { return svc.Delete(ctx, cmd) })

		gate.waitForDeletes(t, 4)
		close(releaseFailure)
		synctest.Wait()
		select {
		case uid := <-canceled:
			t.Fatalf("a failed sibling canceled the in-flight delete of %s", uid)
		case <-done:
			t.Fatal("returned before in-flight deletes finished")
		default:
		}
		gate.open()

		require.ErrorIs(t, waitForResult(t, done), failure)
		require.Len(t, cli.calls, 4, "no new deletes may start after the first failure")
		require.Nil(t, svc.publicDashboardService.(*dashboardDeletePublicService).uids)
		require.False(t, svc.unifiedStore.(*dashboardDeleteStore).deleted)
	})
}

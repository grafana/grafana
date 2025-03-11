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
	"k8s.io/apimachinery/pkg/selection"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
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
	"github.com/grafana/grafana/pkg/services/guardian"
	ngstore "github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type rcp struct {
	Host string
}

func (r rcp) GetRestConfig(ctx context.Context) (*clientrest.Config, error) {
	return &clientrest.Config{
		Host: r.Host,
	}, nil
}

func TestIntegrationFolderServiceViaUnifiedStorage(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	m := map[string]v0alpha1.Folder{}

	unifiedStorageFolder := &v0alpha1.Folder{}
	unifiedStorageFolder.Kind = "folder"

	fooFolder := &folder.Folder{
		ID:           123,
		Title:        "Foo Folder",
		OrgID:        orgID,
		UID:          "foo",
		URL:          "/dashboards/f/foo/foo-folder",
		CreatedByUID: "user:1",
		UpdatedByUID: "user:1",
	}

	updateFolder := &folder.Folder{
		Title: "Folder",
		OrgID: orgID,
		UID:   "updatefolder",
	}

	mux := http.NewServeMux()

	mux.HandleFunc("DELETE /apis/folder.grafana.app/v0alpha1/namespaces/default/folders/deletefolder", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
	})

	mux.HandleFunc("GET /apis/folder.grafana.app/v0alpha1/namespaces/default/folders", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		l := &v0alpha1.FolderList{}
		l.Kind = "Folder"
		err := json.NewEncoder(w).Encode(l)
		require.NoError(t, err)
	})

	mux.HandleFunc("GET /apis/folder.grafana.app/v0alpha1/namespaces/default/folders/foo", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		namespacer := func(_ int64) string { return "1" }
		result, err := internalfolders.LegacyFolderToUnstructured(fooFolder, namespacer)
		require.NoError(t, err)

		err = json.NewEncoder(w).Encode(result)
		require.NoError(t, err)
	})

	mux.HandleFunc("GET /apis/folder.grafana.app/v0alpha1/namespaces/default/folders/updatefolder", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		namespacer := func(_ int64) string { return "1" }
		result, err := internalfolders.LegacyFolderToUnstructured(updateFolder, namespacer)
		require.NoError(t, err)

		err = json.NewEncoder(w).Encode(result)
		require.NoError(t, err)
	})

	mux.HandleFunc("PUT /apis/folder.grafana.app/v0alpha1/namespaces/default/folders/updatefolder", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		buf, err := io.ReadAll(req.Body)
		require.NoError(t, err)

		var foldr v0alpha1.Folder
		err = json.Unmarshal(buf, &foldr)
		require.NoError(t, err)

		updateFolder.Title = foldr.Spec.Title

		namespacer := func(_ int64) string { return "1" }
		result, err := internalfolders.LegacyFolderToUnstructured(updateFolder, namespacer)
		require.NoError(t, err)

		err = json.NewEncoder(w).Encode(result)
		require.NoError(t, err)
	})

	mux.HandleFunc("GET /apis/folder.grafana.app/v0alpha1/namespaces/default/folders/ady4yobv315a8e", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		err := json.NewEncoder(w).Encode(unifiedStorageFolder)
		require.NoError(t, err)
	})
	mux.HandleFunc("PUT /apis/folder.grafana.app/v0alpha1/namespaces/default/folders/ady4yobv315a8e", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		err := json.NewEncoder(w).Encode(unifiedStorageFolder)
		require.NoError(t, err)
	})
	mux.HandleFunc("POST /apis/folder.grafana.app/v0alpha1/namespaces/default/folders", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		buf, err := io.ReadAll(req.Body)
		require.NoError(t, err)

		var folder v0alpha1.Folder
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

	origNewGuardian := guardian.New
	t.Cleanup(func() {
		guardian.New = origNewGuardian
	})

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

	dashboardStore := dashboards.NewFakeDashboardStore(t)
	k8sCli := client.NewK8sHandler(dualwrite.ProvideTestService(), request.GetNamespaceMapper(cfg), v0alpha1.FolderResourceInfo.GroupVersionResource(), restCfgProvider.GetRestConfig, dashboardStore, userService, nil, sort.ProvideService())
	unifiedStore := ProvideUnifiedStore(k8sCli, userService)

	ctx := context.Background()
	usr := &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{
		1: accesscontrol.GroupScopesByActionContext(
			ctx,
			[]accesscontrol.Permission{
				{Action: dashboards.ActionFoldersCreate, Scope: dashboards.ScopeFoldersAll},
				{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersAll},
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
		tracer:                 tracing.InitializeTracerForTest(),
		k8sclient:              k8sCli,
		dashboardK8sClient:     fakeK8sClient,
		publicDashboardService: publicDashboardService,
	}

	require.NoError(t, folderService.RegisterService(alertingStore))

	t.Run("Folder service tests", func(t *testing.T) {
		t.Run("Given user has no permissions", func(t *testing.T) {
			origNewGuardian := guardian.New
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{})

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

			t.Cleanup(func() {
				guardian.New = origNewGuardian
			})
		})

		t.Run("Given user has permission to save", func(t *testing.T) {
			origNewGuardian := guardian.New
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanSaveValue: true, CanViewValue: true})

			ctx = identity.WithRequester(context.Background(), usr)

			f := &folder.Folder{
				OrgID:        orgID,
				Title:        "Test-Folder",
				UID:          "testfolder",
				URL:          "/dashboards/f/testfolder/test-folder",
				CreatedByUID: "user:1",
				UpdatedByUID: "user:1",
			}

			t.Run("When creating folder should not return access denied error", func(t *testing.T) {
				actualFolder, err := folderService.Create(ctx, &folder.CreateFolderCommand{
					OrgID:        orgID,
					Title:        f.Title,
					UID:          f.UID,
					SignedInUser: usr,
				})
				require.NoError(t, err)
				require.Equal(t, f, actualFolder)
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
				fakeK8sClient.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resource.ResourceSearchResponse{Results: &resource.ResourceTable{}}, nil).Once()
				publicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, mock.Anything, mock.Anything).Return(nil)

				err := folderService.Delete(ctx, &folder.DeleteFolderCommand{
					UID:              "deletefolder",
					OrgID:            orgID,
					ForceDeleteRules: false,
					SignedInUser:     usr,
				})
				require.NoError(t, err)
			})

			t.Run("When deleting folder by uid, expectedForceDeleteRules as false, and dashboard Restore turned on should not return access denied error", func(t *testing.T) {
				folderService.features = featuremgmt.WithFeatures(append(featuresArr, featuremgmt.FlagDashboardRestore)...)
				fakeK8sClient.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resource.ResourceSearchResponse{Results: &resource.ResourceTable{}}, nil).Once()

				expectedForceDeleteRules := false
				err := folderService.Delete(ctx, &folder.DeleteFolderCommand{
					UID:              "deletefolder",
					OrgID:            orgID,
					ForceDeleteRules: expectedForceDeleteRules,
					SignedInUser:     usr,
				})
				require.NoError(t, err)
			})

			t.Run("When deleting folder by uid, expectedForceDeleteRules as true, and dashboard Restore turned on should not return access denied error", func(t *testing.T) {
				folderService.features = featuremgmt.WithFeatures(append(featuresArr, featuremgmt.FlagDashboardRestore)...)
				fakeK8sClient.On("Search", mock.Anything, mock.Anything, mock.Anything).Return(&resource.ResourceSearchResponse{Results: &resource.ResourceTable{}}, nil).Once()

				expectedForceDeleteRules := true
				err := folderService.Delete(ctx, &folder.DeleteFolderCommand{
					UID:              "deletefolder",
					OrgID:            orgID,
					ForceDeleteRules: expectedForceDeleteRules,
					SignedInUser:     usr,
				})
				require.NoError(t, err)
			})

			t.Cleanup(func() {
				guardian.New = origNewGuardian
			})
		})

		t.Run("Given user has permission to view", func(t *testing.T) {
			origNewGuardian := guardian.New
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanViewValue: true})

			t.Run("When get folder by uid should return folder", func(t *testing.T) {
				actual, err := folderService.Get(ctx, &folder.GetFolderQuery{
					UID:          &fooFolder.UID,
					OrgID:        fooFolder.OrgID,
					SignedInUser: usr,
				})
				require.Equal(t, fooFolder, actual)
				require.NoError(t, err)
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
				require.Equal(t, fooFolder, actual)
				require.NoError(t, err)
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
				require.Equal(t, fooFolder, actual)
				require.NoError(t, err)
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

			t.Cleanup(func() {
				guardian.New = origNewGuardian
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
	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
		CanSaveValue: true,
		CanViewValue: true,
	})
	folderStore := folder.NewFakeStore()
	folderStore.ExpectedFolder = &folder.Folder{
		UID:   "parent-uid",
		ID:    2,
		Title: "parent title",
	}
	service := Service{
		k8sclient:    fakeK8sClient,
		features:     featuremgmt.WithFeatures(featuremgmt.FlagKubernetesClientDashboardsFolders),
		unifiedStore: folderStore,
	}
	user := &user.SignedInUser{OrgID: 1}
	ctx := identity.WithRequester(context.Background(), user)
	fakeK8sClient.On("GetNamespace", mock.Anything, mock.Anything).Return("default")

	t.Run("Should call search with uids, if provided", func(t *testing.T) {
		fakeK8sClient.On("Search", mock.Anything, int64(1), &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Namespace: "default",
					Group:     v0alpha1.FolderResourceInfo.GroupVersionResource().Group,
					Resource:  v0alpha1.FolderResourceInfo.GroupVersionResource().Resource,
				},
				Fields: []*resource.Requirement{
					{
						Key:      resource.SEARCH_FIELD_NAME,
						Operator: string(selection.In),
						Values:   []string{"uid1", "uid2"}, // should only search by uid since it is provided
					},
				},
				Labels: []*resource.Requirement{},
			},
			Limit: folderSearchLimit}).Return(&resource.ResourceSearchResponse{
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
							Resource: "folder",
						},
						Cells: [][]byte{
							[]byte("folder0"),
							[]byte(""),
						},
					},
					{
						Key: &resource.ResourceKey{
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
				// no parent folder is returned, so the general folder should be set
				FolderID:    0,
				FolderTitle: "General",
				// orgID should be taken from signed in user
				OrgID: 1,
				// the rest should be automatically set when parsing the hit results from search
				Type:  model.DashHitFolder,
				URI:   "db/folder0",
				Title: "folder0",
				URL:   "/dashboards/f/uid1/folder0",
			},
			{
				UID:         "uid2",
				FolderID:    0,
				FolderTitle: "General",
				OrgID:       1,
				Type:        model.DashHitFolder,
				URI:         "db/folder1",
				Title:       "folder1",
				URL:         "/dashboards/f/uid2/folder1",
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
		fakeK8sClient.On("Search", mock.Anything, int64(1), &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Namespace: "default",
					Group:     v0alpha1.FolderResourceInfo.GroupVersionResource().Group,
					Resource:  v0alpha1.FolderResourceInfo.GroupVersionResource().Resource,
				},
				Fields: []*resource.Requirement{},
				Labels: []*resource.Requirement{
					{
						Key:      utils.LabelKeyDeprecatedInternalID,
						Operator: string(selection.In),
						Values:   []string{"123"},
					},
				},
			},
			Limit: folderSearchLimit}).Return(&resource.ResourceSearchResponse{
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
				UID:         "foo",
				FolderID:    0,
				FolderTitle: "General",
				OrgID:       1,
				Type:        model.DashHitFolder,
				URI:         "db/folder1",
				Title:       "folder1",
				URL:         "/dashboards/f/foo/folder1",
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
		fakeK8sClient.On("Search", mock.Anything, int64(1), &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Namespace: "default",
					Group:     v0alpha1.FolderResourceInfo.GroupVersionResource().Group,
					Resource:  v0alpha1.FolderResourceInfo.GroupVersionResource().Resource,
				},
				Fields: []*resource.Requirement{},
				Labels: []*resource.Requirement{},
			},
			Query:  "*test*",
			Fields: dashboardsearch.IncludeFields,
			Limit:  folderSearchLimit}).Return(&resource.ResourceSearchResponse{
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
				UID:         "uid",
				FolderID:    2,
				FolderTitle: "parent title",
				FolderUID:   "parent-uid",
				OrgID:       1,
				Type:        model.DashHitFolder,
				URI:         "db/testing-123",
				Title:       "testing-123",
				URL:         "/dashboards/f/uid/testing-123",
			},
		}
		require.Equal(t, expectedResult, result)
		fakeK8sClient.AssertExpectations(t)
	})
}

func TestGetFoldersFromApiServer(t *testing.T) {
	fakeK8sClient := new(client.MockK8sHandler)
	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
		CanSaveValue: true,
		CanViewValue: true,
	})
	folderStore := folder.NewFakeStore()
	folderStore.ExpectedFolder = &folder.Folder{
		UID:   "parent-uid",
		ID:    2,
		Title: "parent title",
	}
	service := Service{
		k8sclient:    fakeK8sClient,
		features:     featuremgmt.WithFeatures(featuremgmt.FlagKubernetesClientDashboardsFolders),
		unifiedStore: folderStore,
	}
	user := &user.SignedInUser{OrgID: 1}
	ctx := identity.WithRequester(context.Background(), user)
	fakeK8sClient.On("GetNamespace", mock.Anything, mock.Anything).Return("default")

	t.Run("Get folder by title)", func(t *testing.T) {
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
		fakeK8sClient.On("Search", mock.Anything, int64(1), &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Namespace: "default",
					Group:     v0alpha1.FolderResourceInfo.GroupVersionResource().Group,
					Resource:  v0alpha1.FolderResourceInfo.GroupVersionResource().Resource,
				},
				Fields: []*resource.Requirement{},
				Labels: []*resource.Requirement{},
			},
			Query: "foo title",
			Limit: folderSearchLimit}).Return(&resource.ResourceSearchResponse{
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
			ID:           2,
			UID:          "foouid",
			ParentUID:    "parentuid",
			Title:        "foo title",
			OrgID:        1,
			URL:          "/dashboards/f/foouid/foo-title",
			Fullpath:     "foo title",
			FullpathUIDs: "foouid",
			CreatedByUID: ":0",
			UpdatedByUID: ":0",
		}
		require.Equal(t, expectedResult, result)
		fakeK8sClient.AssertExpectations(t)
	})
}

func TestDeleteFoldersFromApiServer(t *testing.T) {
	fakeK8sClient := new(client.MockK8sHandler)
	fakeK8sClient.On("GetNamespace", mock.Anything, mock.Anything).Return("default")
	dashboardK8sclient := new(client.MockK8sHandler)
	fakeFolderStore := folder.NewFakeStore()
	dashboardStore := dashboards.NewFakeDashboardStore(t)
	publicDashboardFakeService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)
	service := Service{
		k8sclient:              fakeK8sClient,
		dashboardK8sClient:     dashboardK8sclient,
		unifiedStore:           fakeFolderStore,
		dashboardStore:         dashboardStore,
		publicDashboardService: publicDashboardFakeService,
		registry:               make(map[string]folder.RegistryService),
		features:               featuremgmt.WithFeatures(featuremgmt.FlagKubernetesClientDashboardsFolders),
	}
	user := &user.SignedInUser{OrgID: 1}
	ctx := identity.WithRequester(context.Background(), user)
	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
		CanSaveValue: true,
		CanViewValue: true,
	})
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
		dashboardK8sclient.On("Search", mock.Anything, int64(1), mock.Anything).Return(&resource.ResourceSearchResponse{Results: &resource.ResourceTable{}}, nil).Once()
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
		dashboardK8sclient.On("Search", mock.Anything, int64(1), &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Labels: []*resource.Requirement{},
				Fields: []*resource.Requirement{
					{
						Key:      resource.SEARCH_FIELD_FOLDER,
						Operator: string(selection.In),
						Values:   []string{"uid2", "uid"},
					},
				},
			},
			Limit: folderSearchLimit}).Return(&resource.ResourceSearchResponse{
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
							Name:     "test",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("uid"),
							[]byte(""),
						},
					},
					{
						Key: &resource.ResourceKey{
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

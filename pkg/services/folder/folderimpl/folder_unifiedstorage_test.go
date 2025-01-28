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
	"google.golang.org/grpc"
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
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	ngstore "github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type rcp struct {
	Host string
}

func (r rcp) GetRestConfig(ctx context.Context) *clientrest.Config {
	return &clientrest.Config{
		Host: r.Host,
	}
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

	f := func(ctx context.Context) resource.ResourceClient {
		return resourceClientMock{}
	}

	k8sHandler := &foldk8sHandler{
		gvr:                    v0alpha1.FolderResourceInfo.GroupVersionResource(),
		namespacer:             request.GetNamespaceMapper(cfg),
		cfg:                    cfg,
		restConfigProvider:     restCfgProvider.GetRestConfig,
		recourceClientProvider: f,
	}

	unifiedStore := ProvideUnifiedStore(k8sHandler)

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

	featuresArr := []any{
		featuremgmt.FlagKubernetesFoldersServiceV2}
	features := featuremgmt.WithFeatures(featuresArr...)
	dashboardStore := dashboards.NewFakeDashboardStore(t)
	publicDashboardService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)

	folderService := &Service{
		log:                    slog.New(logtest.NewTestHandler(t)).With("logger", "test-folder-service"),
		unifiedStore:           unifiedStore,
		features:               features,
		bus:                    bus.ProvideBus(tracing.InitializeTracerForTest()),
		accessControl:          acimpl.ProvideAccessControl(features),
		registry:               make(map[string]folder.RegistryService),
		metrics:                newFoldersMetrics(nil),
		tracer:                 tracing.InitializeTracerForTest(),
		k8sclient:              k8sHandler,
		dashboardStore:         dashboardStore,
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
				dashboardStore.On("FindDashboards", mock.Anything, mock.Anything).Return([]dashboards.DashboardSearchProjection{}, nil)
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

			t.Run("When get folder by ID should return folder", func(t *testing.T) {
				id := int64(123)
				query := &folder.GetFolderQuery{
					ID:           &id,
					OrgID:        1,
					SignedInUser: usr,
				}

				actual, err := folderService.Get(context.Background(), query)
				require.Equal(t, fooFolder, actual)
				require.NoError(t, err)
			})

			t.Run("When get folder by non existing ID should return not found error", func(t *testing.T) {
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
			t.Run("When the folder UID is blank should return the root folder", func(t *testing.T) {
				emptyString := ""
				actual, err := folderService.Get(ctx, &folder.GetFolderQuery{
					UID:          &emptyString,
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

type resourceClientMock struct{}

func (r resourceClientMock) Read(ctx context.Context, in *resource.ReadRequest, opts ...grpc.CallOption) (*resource.ReadResponse, error) {
	return nil, nil
}
func (r resourceClientMock) Create(ctx context.Context, in *resource.CreateRequest, opts ...grpc.CallOption) (*resource.CreateResponse, error) {
	return nil, nil
}
func (r resourceClientMock) Update(ctx context.Context, in *resource.UpdateRequest, opts ...grpc.CallOption) (*resource.UpdateResponse, error) {
	return nil, nil
}
func (r resourceClientMock) Delete(ctx context.Context, in *resource.DeleteRequest, opts ...grpc.CallOption) (*resource.DeleteResponse, error) {
	return nil, nil
}
func (r resourceClientMock) Restore(ctx context.Context, in *resource.RestoreRequest, opts ...grpc.CallOption) (*resource.RestoreResponse, error) {
	return nil, nil
}
func (r resourceClientMock) List(ctx context.Context, in *resource.ListRequest, opts ...grpc.CallOption) (*resource.ListResponse, error) {
	return nil, nil
}
func (r resourceClientMock) Watch(ctx context.Context, in *resource.WatchRequest, opts ...grpc.CallOption) (resource.ResourceStore_WatchClient, error) {
	return nil, nil
}
func (r resourceClientMock) Search(ctx context.Context, in *resource.ResourceSearchRequest, opts ...grpc.CallOption) (*resource.ResourceSearchResponse, error) {
	if len(in.Options.Labels) > 0 &&
		in.Options.Labels[0].Key == utils.LabelKeyDeprecatedInternalID &&
		in.Options.Labels[0].Operator == "in" &&
		len(in.Options.Labels[0].Values) > 0 &&
		in.Options.Labels[0].Values[0] == "123" {
		return &resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{
						Name: "_id",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
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
							Resource: "folders",
						},
						Cells: [][]byte{
							[]byte("123"),
							[]byte("folder1"),
							[]byte(""),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil
	}

	if len(in.Options.Fields) > 0 &&
		in.Options.Fields[0].Key == resource.SEARCH_FIELD_TITLE &&
		in.Options.Fields[0].Operator == "in" &&
		len(in.Options.Fields[0].Values) > 0 &&
		in.Options.Fields[0].Values[0] == "foo" {
		return &resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{
						Name: "_id",
						Type: resource.ResourceTableColumnDefinition_STRING,
					},
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
							Resource: "folders",
						},
						Cells: [][]byte{
							[]byte("123"),
							[]byte("folder1"),
							[]byte(""),
						},
					},
				},
			},
			TotalHits: 1,
		}, nil
	}

	// not found
	return &resource.ResourceSearchResponse{
		Results: &resource.ResourceTable{},
	}, nil
}
func (r resourceClientMock) GetStats(ctx context.Context, in *resource.ResourceStatsRequest, opts ...grpc.CallOption) (*resource.ResourceStatsResponse, error) {
	return nil, nil
}
func (r resourceClientMock) CountRepositoryObjects(ctx context.Context, in *resource.CountRepositoryObjectsRequest, opts ...grpc.CallOption) (*resource.CountRepositoryObjectsResponse, error) {
	return nil, nil
}
func (r resourceClientMock) ListRepositoryObjects(ctx context.Context, in *resource.ListRepositoryObjectsRequest, opts ...grpc.CallOption) (*resource.ListRepositoryObjectsResponse, error) {
	return nil, nil
}
func (r resourceClientMock) PutBlob(ctx context.Context, in *resource.PutBlobRequest, opts ...grpc.CallOption) (*resource.PutBlobResponse, error) {
	return nil, nil
}
func (r resourceClientMock) GetBlob(ctx context.Context, in *resource.GetBlobRequest, opts ...grpc.CallOption) (*resource.GetBlobResponse, error) {
	return nil, nil
}
func (r resourceClientMock) IsHealthy(ctx context.Context, in *resource.HealthCheckRequest, opts ...grpc.CallOption) (*resource.HealthCheckResponse, error) {
	return nil, nil
}

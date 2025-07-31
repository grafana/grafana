package folderimpl

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math/rand"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/librarypanels"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	ngstore "github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/util"
)

var (
	orgID     = int64(1)
	usr       = &user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{orgID: {dashboards.ActionFoldersCreate: {dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.GeneralFolderUID)}}}}
	noPermUsr = &user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{}}
)

func TestIntegrationProvideFolderService(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Run("should register scope resolvers", func(t *testing.T) {
		ac := acmock.New()
		db, cfg := db.InitTestDBWithCfg(t)
		store := ProvideStore(db)
		tracer := noop.NewTracerProvider().Tracer("TestIntegrationProvideFolderService")
		ProvideService(
			store, ac, bus.ProvideBus(tracing.InitializeTracerForTest()),
			nil, nil, nil, db, featuremgmt.WithFeatures(), supportbundlestest.NewFakeBundleService(), nil, cfg, nil, tracer, nil, dualwrite.ProvideTestService(), sort.ProvideService(),
			apiserver.WithoutRestConfig)

		require.Len(t, ac.Calls.RegisterAttributeScopeResolver, 2)
	})
}

func TestIntegrationFolderService(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Run("Folder service tests", func(t *testing.T) {
		dashStore := &dashboards.FakeDashboardStore{}
		db, settingsProvider := sqlstore.InitTestDB(t)
		cfg := settingsProvider.Get()
		nestedFolderStore := ProvideStore(db)

		folderStore := foldertest.NewFakeFolderStore(t)
		publicDashboardService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)
		features := featuremgmt.WithFeatures()
		tracer := noop.NewTracerProvider().Tracer("TestIntegrationFolderService")

		alertingStore := ngstore.DBstore{
			SQLStore:      db,
			Cfg:           cfg.UnifiedAlerting,
			Logger:        log.New("test-alerting-store"),
			AccessControl: actest.FakeAccessControl{ExpectedEvaluate: true},
		}

		service := &Service{
			log:                    slog.New(logtest.NewTestHandler(t)).With("logger", "test-folder-service"),
			dashboardStore:         dashStore,
			dashboardFolderStore:   folderStore,
			store:                  nestedFolderStore,
			publicDashboardService: publicDashboardService,
			features:               features,
			bus:                    bus.ProvideBus(tracing.InitializeTracerForTest()),
			db:                     db,
			accessControl:          actest.FakeAccessControl{ExpectedEvaluate: true},
			metrics:                newFoldersMetrics(nil),
			registry:               make(map[string]folder.RegistryService),
			tracer:                 tracer,
		}

		require.NoError(t, service.RegisterService(alertingStore))

		t.Run("Given user has no permissions", func(t *testing.T) {
			folderUID := util.GenerateShortUID()
			service.accessControl = actest.FakeAccessControl{ExpectedEvaluate: false}

			f := folder.NewFolder("Folder", "")
			f.UID = folderUID

			folderStore.On("Get", mock.Anything, mock.MatchedBy(func(query folder.GetFolderQuery) bool {
				return query.OrgID == orgID && *query.UID == folderUID
			})).Return(f, nil)

			t.Run("When get folder by id should return access denied error", func(t *testing.T) {
				_, err := service.Get(context.Background(), &folder.GetFolderQuery{
					UID:          &folderUID,
					OrgID:        orgID,
					SignedInUser: noPermUsr,
				})
				require.Equal(t, err, dashboards.ErrFolderAccessDenied)
			})

			t.Run("When get folder by uid should return access denied error", func(t *testing.T) {
				_, err := service.Get(context.Background(), &folder.GetFolderQuery{
					UID:          &folderUID,
					OrgID:        orgID,
					SignedInUser: noPermUsr,
				})
				require.Equal(t, err, dashboards.ErrFolderAccessDenied)
			})

			t.Run("When creating folder should return access denied error", func(t *testing.T) {
				dashStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.AnythingOfType("*dashboards.Dashboard"), mock.AnythingOfType("bool")).Return(true, nil).Times(2)
				_, err := service.Create(context.Background(), &folder.CreateFolderCommand{
					OrgID:        orgID,
					Title:        f.Title,
					UID:          folderUID,
					SignedInUser: noPermUsr,
				})
				require.Error(t, err)
			})

			title := "Folder-TEST"
			t.Run("When updating folder should return access denied error", func(t *testing.T) {
				folderResult := dashboards.NewDashboard("dashboard-test")
				folderResult.IsFolder = true
				dashStore.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(folderResult, nil)
				_, err := service.Update(context.Background(), &folder.UpdateFolderCommand{
					UID:          folderUID,
					OrgID:        orgID,
					NewTitle:     &title,
					SignedInUser: noPermUsr,
				})
				require.Equal(t, err, dashboards.ErrFolderAccessDenied)
			})

			t.Run("When deleting folder by uid should return access denied error", func(t *testing.T) {
				newFolder := folder.NewFolder("Folder", "")
				newFolder.UID = folderUID

				folderStore.On("Get", mock.Anything, mock.MatchedBy(func(query folder.GetFolderQuery) bool {
					return query.OrgID == orgID && *query.UID == f.UID
				})).Return(newFolder, nil)

				err := service.Delete(context.Background(), &folder.DeleteFolderCommand{
					UID:              folderUID,
					OrgID:            orgID,
					ForceDeleteRules: false,
					SignedInUser:     noPermUsr,
				})
				require.Error(t, err)
				require.Equal(t, err, dashboards.ErrFolderAccessDenied)
			})

			t.Cleanup(func() {
				service.accessControl = actest.FakeAccessControl{ExpectedEvaluate: true}
			})
		})

		t.Run("Given user has permission to save", func(t *testing.T) {
			t.Run("When creating folder should not return access denied error", func(t *testing.T) {
				dash := dashboards.NewDashboardFolder("Test-Folder")
				dash.ID = rand.Int63()
				dash.UID = util.GenerateShortUID()
				f := dashboards.FromDashboard(dash)

				dashStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.AnythingOfType("*dashboards.Dashboard"), mock.AnythingOfType("bool")).Return(true, nil)
				dashStore.On("SaveDashboard", mock.Anything, mock.AnythingOfType("dashboards.SaveDashboardCommand")).Return(dash, nil).Once()

				actualFolder, err := service.Create(context.Background(), &folder.CreateFolderCommand{
					OrgID:        orgID,
					Title:        dash.Title,
					UID:          dash.UID,
					SignedInUser: usr,
				})
				require.NoError(t, err)
				require.Equal(t, f, actualFolder)
			})

			t.Run("When creating folder should return error if uid is general", func(t *testing.T) {
				dash := dashboards.NewDashboardFolder("Test-Folder")
				dash.ID = rand.Int63()

				_, err := service.Create(context.Background(), &folder.CreateFolderCommand{
					OrgID:        orgID,
					Title:        dash.Title,
					UID:          "general",
					SignedInUser: usr,
				})
				require.ErrorIs(t, err, dashboards.ErrFolderInvalidUID)
			})

			t.Run("When updating folder should not return access denied error", func(t *testing.T) {
				dashboardFolder := dashboards.NewDashboardFolder("Folder")
				dashboardFolder.ID = rand.Int63()
				dashboardFolder.UID = util.GenerateShortUID()
				dashboardFolder.OrgID = orgID

				f, err := service.store.Create(context.Background(), folder.CreateFolderCommand{
					OrgID:        orgID,
					Title:        dashboardFolder.Title,
					UID:          dashboardFolder.UID,
					SignedInUser: usr,
				})
				require.NoError(t, err)
				assert.Equal(t, "Folder", f.Title)

				dashStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.AnythingOfType("*dashboards.Dashboard"), mock.AnythingOfType("bool")).Return(true, nil)
				title := "TEST-Folder"
				updatedDashboardFolder := *dashboardFolder
				updatedDashboardFolder.Title = title
				dashStore.On("SaveDashboard", mock.Anything, mock.AnythingOfType("dashboards.SaveDashboardCommand")).Return(&updatedDashboardFolder, nil)
				dashStore.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(&updatedDashboardFolder, nil)

				folderStore.On("GetFolderByID", mock.Anything, orgID, dashboardFolder.ID).Return(&folder.Folder{
					OrgID: orgID,
					ID:    dashboardFolder.ID,
					UID:   dashboardFolder.UID,
					Title: title,
				}, nil)

				req := &folder.UpdateFolderCommand{
					UID:          dashboardFolder.UID,
					OrgID:        orgID,
					NewTitle:     &title,
					SignedInUser: usr,
				}

				reqResult, err := service.Update(context.Background(), req)
				require.NoError(t, err)
				assert.Equal(t, title, reqResult.Title)
			})

			t.Run("When deleting folder by uid should not return access denied error", func(t *testing.T) {
				f := folder.NewFolder(util.GenerateShortUID(), "")
				f.UID = util.GenerateShortUID()
				folderStore.On("Get", mock.Anything, mock.MatchedBy(func(query folder.GetFolderQuery) bool {
					return query.OrgID == orgID && *query.UID == f.UID
				})).Return(f, nil)
				publicDashboardService.On("DeleteByDashboardUIDs", mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()

				var actualCmd *dashboards.DeleteDashboardCommand
				dashStore.On("DeleteDashboard", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
					actualCmd = args.Get(1).(*dashboards.DeleteDashboardCommand)
				}).Return(nil).Once()
				dashStore.On("FindDashboards", mock.Anything, mock.Anything).Return([]dashboards.DashboardSearchProjection{}, nil).Once()

				expectedForceDeleteRules := rand.Int63()%2 == 0
				err := service.Delete(context.Background(), &folder.DeleteFolderCommand{
					UID:              f.UID,
					OrgID:            orgID,
					ForceDeleteRules: expectedForceDeleteRules,
					SignedInUser:     usr,
				})
				require.NoError(t, err)
				require.NotNil(t, actualCmd)
				require.Equal(t, orgID, actualCmd.OrgID)
				require.Equal(t, expectedForceDeleteRules, actualCmd.ForceDeleteFolderRules)
			})
		})

		t.Run("Given user has permission to view", func(t *testing.T) {
			t.Run("When get folder by uid should return folder", func(t *testing.T) {
				expected := folder.NewFolder(util.GenerateShortUID(), "")
				expected.UID = util.GenerateShortUID()

				folderStore.On("GetFolderByUID", mock.Anything, orgID, expected.UID).Return(expected, nil)

				actual, err := service.getFolderByUID(context.Background(), orgID, expected.UID)
				require.Equal(t, expected, actual)
				require.NoError(t, err)
			})

			t.Run("When get folder by uid and uid is general should return the root folder object", func(t *testing.T) {
				uid := accesscontrol.GeneralFolderUID
				query := &folder.GetFolderQuery{
					UID:          &uid,
					SignedInUser: usr,
				}
				actual, err := service.Get(context.Background(), query)
				require.Equal(t, folder.RootFolder, actual)
				require.NoError(t, err)
			})
		})

		t.Run("Should map errors correct", func(t *testing.T) {
			testCases := []struct {
				ActualError   error
				ExpectedError error
			}{
				{ActualError: dashboards.ErrDashboardTitleEmpty, ExpectedError: dashboards.ErrFolderTitleEmpty},
				{ActualError: dashboards.ErrDashboardUpdateAccessDenied, ExpectedError: dashboards.ErrFolderAccessDenied},
				{ActualError: dashboards.ErrDashboardWithSameUIDExists, ExpectedError: dashboards.ErrFolderWithSameUIDExists},
				{ActualError: dashboards.ErrDashboardVersionMismatch, ExpectedError: dashboards.ErrFolderVersionMismatch},
				{ActualError: dashboards.ErrDashboardNotFound, ExpectedError: dashboards.ErrFolderNotFound},
				{ActualError: dashboards.ErrDashboardInvalidUid, ExpectedError: dashboards.ErrDashboardInvalidUid},
			}

			for _, tc := range testCases {
				actualError := toFolderError(tc.ActualError)
				assert.EqualErrorf(t, actualError, tc.ExpectedError.Error(),
					"For error '%s' expected error '%s', actual '%s'", tc.ActualError, tc.ExpectedError, actualError)
			}
		})

		t.Run("Returns root folder", func(t *testing.T) {
			t.Run("When the folder UID is blank should return the root folder", func(t *testing.T) {
				emptyString := ""
				actual, err := service.Get(context.Background(), &folder.GetFolderQuery{
					UID:          &emptyString,
					OrgID:        1,
					SignedInUser: usr,
				})

				assert.NoError(t, err)
				assert.Equal(t, folder.GeneralFolder.UID, actual.UID)
				assert.Equal(t, folder.GeneralFolder.Title, actual.Title)
			})
		})
	})
}

func TestIntegrationNestedFolderServiceBasicOperations(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	db, settingsProvider := sqlstore.InitTestDB(t)
	cfg := settingsProvider.Get()
	cfg.UnifiedAlerting.BaseInterval = time.Second
	quotaService := quotatest.New(false, nil)
	folderStore := ProvideDashboardFolderStore(db)

	featuresFlagOn := featuremgmt.WithFeatures("nestedFolders")
	dashStore, err := database.ProvideDashboardStore(db, settingsProvider, featuresFlagOn, tagimpl.ProvideService(db))
	require.NoError(t, err)
	nestedFolderStore := ProvideStore(db)
	publicDashboardFakeService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)
	tracer := noop.NewTracerProvider().Tracer("TestIntegrationNestedFolderService")

	b := bus.ProvideBus(tracing.InitializeTracerForTest())
	ac := actest.FakeAccessControl{ExpectedEvaluate: true}

	serviceWithFlagOn := &Service{
		log:                    slog.New(logtest.NewTestHandler(t)).With("logger", "test-folder-service"),
		dashboardStore:         dashStore,
		dashboardFolderStore:   folderStore,
		store:                  nestedFolderStore,
		features:               featuresFlagOn,
		bus:                    b,
		db:                     db,
		accessControl:          ac,
		registry:               make(map[string]folder.RegistryService),
		metrics:                newFoldersMetrics(nil),
		tracer:                 tracer,
		publicDashboardService: publicDashboardFakeService,
	}

	signedInUser := user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{
		orgID: {
			dashboards.ActionFoldersCreate:         {},
			dashboards.ActionFoldersWrite:          {dashboards.ScopeFoldersAll},
			accesscontrol.ActionAlertingRuleDelete: {dashboards.ScopeFoldersAll},
		},
	}}
	createCmd := folder.CreateFolderCommand{
		OrgID:        orgID,
		ParentUID:    "",
		SignedInUser: &signedInUser,
	}

	libraryElementCmd := model.CreateLibraryElementCommand{
		Model: []byte(`
		{
		  "datasource": "${DS_GDEV-TESTDATA}",
		  "id": 1,
		  "title": "Text - Library Panel",
		  "type": "text",
		  "description": "A description"
		}
	`),
		Kind: int64(model.PanelElement),
	}
	routeRegister := routing.NewRouteRegister()

	folderPermissions := acmock.NewMockedPermissionsService()
	dashboardPermissions := acmock.NewMockedPermissionsService()

	t.Run("Should get descendant counts", func(t *testing.T) {
		depth := 5
		t.Run("With nested folder feature flag on", func(t *testing.T) {
			publicDashboardFakeService.On("DeleteByDashboardUIDs", mock.Anything, mock.Anything, mock.Anything).Return(nil)

			dashSrv, err := dashboardservice.ProvideDashboardServiceImpl(settingsProvider, dashStore, folderStore, featuresFlagOn, folderPermissions, ac, actest.FakeService{}, serviceWithFlagOn, nil,
				client.MockTestRestConfig{}, nil, quotaService, nil, publicDashboardFakeService, nil, dualwrite.ProvideTestService(), sort.ProvideService(),
				serverlock.ProvideService(db, tracing.InitializeTracerForTest()),
				kvstore.NewFakeKVStore(),
			)
			require.NoError(t, err)
			dashSrv.RegisterDashboardPermissions(dashboardPermissions)

			alertStore, err := ngstore.ProvideDBStore(settingsProvider, featuresFlagOn, db, serviceWithFlagOn, dashSrv, ac, b)
			require.NoError(t, err)

			elementService := libraryelements.ProvideService(settingsProvider, db, routeRegister, serviceWithFlagOn, featuresFlagOn, ac, dashSrv, nil, nil)
			lps, err := librarypanels.ProvideService(settingsProvider, db, routeRegister, elementService, serviceWithFlagOn)
			require.NoError(t, err)

			ancestors := CreateSubtreeInStore(t, nestedFolderStore, serviceWithFlagOn, depth, "getDescendantCountsOn", createCmd, true)

			parent, err := serviceWithFlagOn.dashboardFolderStore.GetFolderByUID(context.Background(), orgID, ancestors[0].UID)
			require.NoError(t, err)
			subfolder, err := serviceWithFlagOn.dashboardFolderStore.GetFolderByUID(context.Background(), orgID, ancestors[1].UID)
			require.NoError(t, err)
			// nolint:staticcheck
			_ = insertTestDashboard(t, serviceWithFlagOn.dashboardStore, "dashboard in parent", orgID, parent.ID, parent.UID, "prod")
			// nolint:staticcheck
			_ = insertTestDashboard(t, serviceWithFlagOn.dashboardStore, "dashboard in subfolder", orgID, subfolder.ID, subfolder.UID, "prod")
			_ = createRule(t, alertStore, parent.UID, "parent alert")
			_ = createRule(t, alertStore, subfolder.UID, "sub alert")

			// nolint:staticcheck
			libraryElementCmd.FolderID = parent.ID
			libraryElementCmd.FolderUID = &parent.UID
			_, err = lps.LibraryElementService.CreateElement(context.Background(), &signedInUser, libraryElementCmd)
			require.NoError(t, err)
			// nolint:staticcheck
			libraryElementCmd.FolderID = subfolder.ID
			libraryElementCmd.FolderUID = &subfolder.UID
			_, err = lps.LibraryElementService.CreateElement(context.Background(), &signedInUser, libraryElementCmd)
			require.NoError(t, err)

			countCmd := folder.GetDescendantCountsQuery{
				UID:          &ancestors[0].UID,
				OrgID:        orgID,
				SignedInUser: &signedInUser,
			}
			m, err := serviceWithFlagOn.GetDescendantCounts(context.Background(), &countCmd)
			require.NoError(t, err)
			require.Equal(t, int64(depth-1), m[entity.StandardKindFolder])
			require.Equal(t, int64(2), m[entity.StandardKindDashboard])
			require.Equal(t, int64(2), m[entity.StandardKindAlertRule])
			require.Equal(t, int64(2), m[entity.StandardKindLibraryPanel])

			t.Cleanup(func() {
				for _, ancestor := range ancestors {
					err := serviceWithFlagOn.store.Delete(context.Background(), []string{ancestor.UID}, orgID)
					assert.NoError(t, err)
				}
			})
		})
		t.Run("With nested folder feature flag off", func(t *testing.T) {
			featuresFlagOff := featuremgmt.WithFeatures()
			dashStore, err := database.ProvideDashboardStore(db, settingsProvider, featuresFlagOff, tagimpl.ProvideService(db))
			require.NoError(t, err)
			nestedFolderStore := ProvideStore(db)

			serviceWithFlagOff := &Service{
				log:                    slog.New(logtest.NewTestHandler(t)).With("logger", "test-folder-service"),
				dashboardStore:         dashStore,
				dashboardFolderStore:   folderStore,
				store:                  nestedFolderStore,
				features:               featuresFlagOff,
				bus:                    b,
				db:                     db,
				registry:               make(map[string]folder.RegistryService),
				metrics:                newFoldersMetrics(nil),
				tracer:                 tracer,
				publicDashboardService: publicDashboardFakeService,
			}

			publicDashboardFakeService.On("DeleteByDashboardUIDs", mock.Anything, mock.Anything, mock.Anything).Return(nil)

			dashSrv, err := dashboardservice.ProvideDashboardServiceImpl(settingsProvider, dashStore, folderStore, featuresFlagOff,
				folderPermissions, ac, actest.FakeService{}, serviceWithFlagOff, nil, client.MockTestRestConfig{}, nil, quotaService, nil, publicDashboardFakeService, nil, dualwrite.ProvideTestService(), sort.ProvideService(),
				serverlock.ProvideService(db, tracing.InitializeTracerForTest()),
				kvstore.NewFakeKVStore(),
			)
			require.NoError(t, err)
			dashSrv.RegisterDashboardPermissions(dashboardPermissions)
			alertStore, err := ngstore.ProvideDBStore(settingsProvider, featuresFlagOff, db, serviceWithFlagOff, dashSrv, ac, b)
			require.NoError(t, err)

			elementService := libraryelements.ProvideService(settingsProvider, db, routeRegister, serviceWithFlagOff, featuresFlagOff, ac, dashSrv, nil, nil)
			lps, err := librarypanels.ProvideService(settingsProvider, db, routeRegister, elementService, serviceWithFlagOff)
			require.NoError(t, err)

			ancestors := CreateSubtreeInStore(t, nestedFolderStore, serviceWithFlagOn, depth, "getDescendantCountsOff", createCmd, true)

			parent, err := serviceWithFlagOn.dashboardFolderStore.GetFolderByUID(context.Background(), orgID, ancestors[0].UID)
			require.NoError(t, err)
			subfolder, err := serviceWithFlagOn.dashboardFolderStore.GetFolderByUID(context.Background(), orgID, ancestors[1].UID)
			require.NoError(t, err)
			// nolint:staticcheck
			_ = insertTestDashboard(t, serviceWithFlagOn.dashboardStore, "dashboard in parent", orgID, parent.ID, parent.UID, "prod")
			// nolint:staticcheck
			_ = insertTestDashboard(t, serviceWithFlagOn.dashboardStore, "dashboard in subfolder", orgID, subfolder.ID, subfolder.UID, "prod")
			_ = createRule(t, alertStore, parent.UID, "parent alert")
			_ = createRule(t, alertStore, subfolder.UID, "sub alert")

			// nolint:staticcheck
			libraryElementCmd.FolderID = parent.ID
			libraryElementCmd.FolderUID = &parent.UID
			_, err = lps.LibraryElementService.CreateElement(context.Background(), &signedInUser, libraryElementCmd)
			require.NoError(t, err)
			// nolint:staticcheck
			libraryElementCmd.FolderID = subfolder.ID
			libraryElementCmd.FolderUID = &subfolder.UID
			_, err = lps.LibraryElementService.CreateElement(context.Background(), &signedInUser, libraryElementCmd)
			require.NoError(t, err)

			countCmd := folder.GetDescendantCountsQuery{
				UID:          &ancestors[0].UID,
				OrgID:        orgID,
				SignedInUser: &signedInUser,
			}
			m, err := serviceWithFlagOff.GetDescendantCounts(context.Background(), &countCmd)
			require.NoError(t, err)
			require.Equal(t, int64(0), m[entity.StandardKindFolder])
			require.Equal(t, int64(1), m[entity.StandardKindDashboard])
			require.Equal(t, int64(1), m[entity.StandardKindAlertRule])
			require.Equal(t, int64(1), m[entity.StandardKindLibraryPanel])

			t.Cleanup(func() {
				for _, ancestor := range ancestors {
					err := serviceWithFlagOn.store.Delete(context.Background(), []string{ancestor.UID}, orgID)
					assert.NoError(t, err)
				}
			})
		})
	})

	t.Run("Should delete folders", func(t *testing.T) {
		featuresFlagOff := featuremgmt.WithFeatures()
		serviceWithFlagOff := &Service{
			log:                    slog.New(logtest.NewTestHandler(t)).With("logger", "test-folder-service"),
			dashboardFolderStore:   folderStore,
			features:               featuresFlagOff,
			bus:                    b,
			db:                     db,
			registry:               make(map[string]folder.RegistryService),
			metrics:                newFoldersMetrics(nil),
			tracer:                 tracer,
			publicDashboardService: publicDashboardFakeService,
			accessControl:          actest.FakeAccessControl{ExpectedEvaluate: true},
		}

		testCases := []struct {
			service           *Service
			featuresFlag      featuremgmt.FeatureToggles
			prefix            string
			depth             int
			forceDelete       bool
			deletionErr       error
			dashboardErr      error
			folderErr         error
			libPanelParentErr error
			libPanelSubErr    error
			desc              string
		}{
			{
				service:           serviceWithFlagOn,
				featuresFlag:      featuresFlagOn,
				prefix:            "flagon-force",
				depth:             3,
				forceDelete:       true,
				dashboardErr:      dashboards.ErrFolderNotFound,
				folderErr:         folder.ErrFolderNotFound,
				libPanelParentErr: model.ErrLibraryElementNotFound,
				libPanelSubErr:    model.ErrLibraryElementNotFound,
				desc:              "With nested folder feature flag on and force deletion of rules",
			},
			{
				service:      serviceWithFlagOn,
				featuresFlag: featuresFlagOn,
				prefix:       "flagon-noforce",
				depth:        3,
				forceDelete:  false,
				deletionErr:  folder.ErrFolderNotEmpty,
				desc:         "With nested folder feature flag on and no force deletion of rules",
			},
			{
				service:           serviceWithFlagOff,
				featuresFlag:      featuresFlagOff,
				prefix:            "flagoff-force",
				depth:             1,
				forceDelete:       true,
				dashboardErr:      dashboards.ErrFolderNotFound,
				folderErr:         folder.ErrFolderNotFound,
				libPanelParentErr: model.ErrLibraryElementNotFound,
				desc:              "With nested folder feature flag off and force deletion of rules",
			},
			{
				service:      serviceWithFlagOff,
				featuresFlag: featuresFlagOff,
				prefix:       "flagoff-noforce",
				depth:        1,
				forceDelete:  false,
				deletionErr:  folder.ErrFolderNotEmpty,
				desc:         "With nested folder feature flag off and no force deletion of rules",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				dashStore, err := database.ProvideDashboardStore(db, settingsProvider, tc.featuresFlag, tagimpl.ProvideService(db))
				require.NoError(t, err)
				nestedFolderStore := ProvideStore(db)
				tc.service.dashboardStore = dashStore
				tc.service.store = nestedFolderStore
				publicDashboardFakeService.On("DeleteByDashboardUIDs", mock.Anything, mock.Anything, mock.Anything).Return(nil)

				dashSrv, err := dashboardservice.ProvideDashboardServiceImpl(settingsProvider, dashStore, folderStore, tc.featuresFlag, folderPermissions, ac, actest.FakeService{}, tc.service,
					nil, client.MockTestRestConfig{}, nil, quotaService, nil, publicDashboardFakeService, nil,
					dualwrite.ProvideTestService(), sort.ProvideService(),
					serverlock.ProvideService(db, tracing.InitializeTracerForTest()),
					kvstore.NewFakeKVStore(),
				)
				require.NoError(t, err)
				dashSrv.RegisterDashboardPermissions(dashboardPermissions)

				elementService := libraryelements.ProvideService(settingsProvider, db, routeRegister, tc.service, tc.featuresFlag, ac, dashSrv, nil, nil)
				lps, err := librarypanels.ProvideService(settingsProvider, db, routeRegister, elementService, tc.service)
				require.NoError(t, err)

				alertStore, err := ngstore.ProvideDBStore(settingsProvider, tc.featuresFlag, db, tc.service, dashSrv, ac, b)
				require.NoError(t, err)

				ancestors := CreateSubtreeInStore(t, nestedFolderStore, serviceWithFlagOn, tc.depth, tc.prefix, createCmd, true)

				parent, err := serviceWithFlagOn.dashboardFolderStore.GetFolderByUID(context.Background(), orgID, ancestors[0].UID)
				require.NoError(t, err)
				_ = createRule(t, alertStore, parent.UID, "parent alert")

				var (
					subfolder *folder.Folder
					subPanel  model.LibraryElementDTO
				)
				if tc.depth > 1 {
					subfolder, err = serviceWithFlagOn.dashboardFolderStore.GetFolderByUID(context.Background(), orgID, ancestors[1].UID)
					require.NoError(t, err)
					_ = createRule(t, alertStore, subfolder.UID, "sub alert")
					// nolint:staticcheck
					libraryElementCmd.FolderID = subfolder.ID
					libraryElementCmd.FolderUID = &subfolder.UID
					subPanel, err = lps.LibraryElementService.CreateElement(context.Background(), &signedInUser, libraryElementCmd)
					require.NoError(t, err)
				}
				// nolint:staticcheck
				libraryElementCmd.FolderID = parent.ID
				libraryElementCmd.FolderUID = &parent.UID
				parentPanel, err := lps.LibraryElementService.CreateElement(context.Background(), &signedInUser, libraryElementCmd)
				require.NoError(t, err)

				deleteCmd := folder.DeleteFolderCommand{
					UID:              ancestors[0].UID,
					OrgID:            orgID,
					SignedInUser:     &signedInUser,
					ForceDeleteRules: tc.forceDelete,
				}

				err = tc.service.Delete(context.Background(), &deleteCmd)
				require.ErrorIs(t, err, tc.deletionErr)

				for i, ancestor := range ancestors {
					// dashboard table
					_, err := tc.service.dashboardFolderStore.GetFolderByUID(context.Background(), orgID, ancestor.UID)
					require.ErrorIs(t, err, tc.dashboardErr)
					// folder table
					_, err = tc.service.store.Get(context.Background(), folder.GetFolderQuery{UID: &ancestors[i].UID, OrgID: orgID})
					require.ErrorIs(t, err, tc.folderErr)
				}

				_, err = lps.LibraryElementService.GetElement(context.Background(), &signedInUser, model.GetLibraryElementCommand{
					FolderName: parent.Title,
					FolderID:   parent.ID, // nolint:staticcheck
					UID:        parentPanel.UID,
				})
				require.ErrorIs(t, err, tc.libPanelParentErr)
				if tc.depth > 1 {
					_, err = lps.LibraryElementService.GetElement(context.Background(), &signedInUser, model.GetLibraryElementCommand{
						FolderName: subfolder.Title,
						FolderID:   subfolder.ID, // nolint:staticcheck
						UID:        subPanel.UID,
					})
					require.ErrorIs(t, err, tc.libPanelSubErr)
				}
			})
		}
	})
}

func TestIntegrationNestedFolderServiceFeatureToggle(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	nestedFolderStore := folder.NewFakeStore()

	dashStore := dashboards.FakeDashboardStore{}
	dashStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.AnythingOfType("*dashboards.Dashboard"), mock.AnythingOfType("bool")).Return(true, nil)
	dashStore.On("SaveDashboard", mock.Anything, mock.AnythingOfType("dashboards.SaveDashboardCommand")).Return(&dashboards.Dashboard{}, nil)

	dashboardFolderStore := foldertest.NewFakeFolderStore(t)
	tracer := noop.NewTracerProvider().Tracer("TestNestedFolderServiceFeatureToggle")

	db, _ := sqlstore.InitTestDB(t)
	folderService := &Service{
		store:                nestedFolderStore,
		log:                  slog.New(logtest.NewTestHandler(t)).With("logger", "test-folder-service"),
		db:                   db,
		dashboardStore:       &dashStore,
		dashboardFolderStore: dashboardFolderStore,
		features:             featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders),
		accessControl:        actest.FakeAccessControl{ExpectedEvaluate: true},
		metrics:              newFoldersMetrics(nil),
		tracer:               tracer,
	}
	t.Run("create folder", func(t *testing.T) {
		nestedFolderStore.ExpectedFolder = &folder.Folder{ParentUID: util.GenerateShortUID()}
		res, err := folderService.Create(context.Background(), &folder.CreateFolderCommand{SignedInUser: usr, Title: "my folder"})
		require.NoError(t, err)
		require.NotNil(t, res.UID)
		require.NotEmpty(t, res.ParentUID)
	})
}

func TestIntegrationFolderServiceDualWrite(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	db, settingsProvider := sqlstore.InitTestDB(t)
	features := featuremgmt.WithFeatures()
	nestedFolderStore := ProvideStore(db)

	dashStore, err := database.ProvideDashboardStore(db, settingsProvider, features, tagimpl.ProvideService(db))
	require.NoError(t, err)

	dashboardFolderStore := ProvideDashboardFolderStore(db)
	tracer := noop.NewTracerProvider().Tracer("TestFolderServiceDualWrite")

	folderService := &Service{
		store:                nestedFolderStore,
		log:                  slog.New(logtest.NewTestHandler(t)).With("logger", "test-folder-service"),
		db:                   db,
		dashboardStore:       dashStore,
		dashboardFolderStore: dashboardFolderStore,
		features:             featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders),
		accessControl:        actest.FakeAccessControl{ExpectedEvaluate: true},
		metrics:              newFoldersMetrics(nil),
		tracer:               tracer,
		bus:                  bus.ProvideBus(tracing.InitializeTracerForTest()),
	}

	t.Run("When creating a folder it should trim leading and trailing spaces in both dashboard and folder tables", func(t *testing.T) {
		f, err := folderService.Create(context.Background(), &folder.CreateFolderCommand{SignedInUser: usr, OrgID: orgID, Title: "  my folder  "})
		require.NoError(t, err)

		assert.Equal(t, "my folder", f.Title)

		dashFolder, err := dashboardFolderStore.GetFolderByUID(context.Background(), orgID, f.UID)
		require.NoError(t, err)

		nestedFolder, err := nestedFolderStore.Get(context.Background(), folder.GetFolderQuery{UID: &f.UID, OrgID: orgID})
		require.NoError(t, err)

		assert.Equal(t, dashFolder.Title, nestedFolder.Title)
	})

	t.Run("When updating a folder it should trim leading and trailing spaces in both dashboard and folder tables", func(t *testing.T) {
		f, err := folderService.Create(context.Background(), &folder.CreateFolderCommand{SignedInUser: usr, OrgID: orgID, Title: "my folder 2"})
		require.NoError(t, err)

		f, err = folderService.Update(context.Background(), &folder.UpdateFolderCommand{SignedInUser: usr, OrgID: orgID, UID: f.UID, NewTitle: util.Pointer("  my updated folder 2 "), Version: f.Version})
		require.NoError(t, err)

		assert.Equal(t, "my updated folder 2", f.Title)

		dashFolder, err := dashboardFolderStore.GetFolderByUID(context.Background(), orgID, f.UID)
		require.NoError(t, err)

		nestedFolder, err := nestedFolderStore.Get(context.Background(), folder.GetFolderQuery{UID: &f.UID, OrgID: orgID})
		require.NoError(t, err)

		assert.Equal(t, dashFolder.Title, nestedFolder.Title)
	})
}

func TestIntegrationNestedFolderService(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	t.Run("with feature flag unset", func(t *testing.T) {
		t.Run("Should create a folder in both dashboard and folders tables", func(t *testing.T) {
			// dash is needed here because folderSvc.Create expects SaveDashboard to return it
			dash := dashboards.NewDashboardFolder("myFolder")
			dash.ID = rand.Int63()
			dash.UID = "some_uid"

			// dashboard store & service commands that should be called.
			dashStore := &dashboards.FakeDashboardStore{}
			dashStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.AnythingOfType("*dashboards.Dashboard"), mock.AnythingOfType("bool")).Return(true, nil)
			dashStore.On("SaveDashboard", mock.Anything, mock.AnythingOfType("dashboards.SaveDashboardCommand")).Return(dash, nil)

			dashboardFolderStore := foldertest.NewFakeFolderStore(t)

			nestedFolderStore := folder.NewFakeStore()
			features := featuremgmt.WithFeatures()

			db, _ := sqlstore.InitTestDB(t)
			folderSvc := setup(t, dashStore, dashboardFolderStore, nestedFolderStore, features, actest.FakeAccessControl{ExpectedEvaluate: true}, db)

			tempUser := &user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{}}
			tempUser.Permissions[orgID] = map[string][]string{dashboards.ActionFoldersCreate: {dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.GeneralFolderUID)}}

			_, err := folderSvc.Create(context.Background(), &folder.CreateFolderCommand{
				OrgID:        orgID,
				Title:        dash.Title,
				UID:          dash.UID,
				SignedInUser: tempUser,
			})
			require.NoError(t, err)
			require.True(t, nestedFolderStore.CreateCalled)
		})
	})

	t.Run("with nested folder feature flag on", func(t *testing.T) {
		t.Run("Should be able to create a nested folder under the root with the right permissions", func(t *testing.T) {
			dash := dashboards.NewDashboardFolder("myFolder")
			dash.ID = rand.Int63()
			dash.UID = "some_uid"

			// dashboard store commands that should be called.
			dashStore := &dashboards.FakeDashboardStore{}
			dashStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.AnythingOfType("*dashboards.Dashboard"), mock.AnythingOfType("bool")).Return(true, nil)
			dashStore.On("SaveDashboard", mock.Anything, mock.AnythingOfType("dashboards.SaveDashboardCommand")).Return(dash, nil)

			dashboardFolderStore := foldertest.NewFakeFolderStore(t)
			nestedFolderStore := folder.NewFakeStore()
			features := featuremgmt.WithFeatures("nestedFolders")

			tempUser := &user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{}}
			tempUser.Permissions[orgID] = map[string][]string{dashboards.ActionFoldersCreate: {dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.GeneralFolderUID)}}

			db, _ := sqlstore.InitTestDB(t)
			folderSvc := setup(t, dashStore, dashboardFolderStore, nestedFolderStore, features, acimpl.ProvideAccessControl(features), db)
			_, err := folderSvc.Create(context.Background(), &folder.CreateFolderCommand{
				OrgID:        orgID,
				Title:        dash.Title,
				UID:          dash.UID,
				SignedInUser: tempUser,
			})
			require.NoError(t, err)
			// CreateFolder should also call the folder store's create method.
			require.True(t, nestedFolderStore.CreateCalled)
		})

		t.Run("Should not be able to create a folder under the root with subfolder creation permissions", func(t *testing.T) {
			// dashboard store commands that should be called.
			dashStore := &dashboards.FakeDashboardStore{}

			dashboardFolderStore := foldertest.NewFakeFolderStore(t)
			nestedFolderStore := folder.NewFakeStore()
			features := featuremgmt.WithFeatures("nestedFolders")

			tempUser := &user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{}}
			tempUser.Permissions[orgID] = map[string][]string{dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("subfolder_uid")}}

			db, _ := sqlstore.InitTestDB(t)
			folderSvc := setup(t, dashStore, dashboardFolderStore, nestedFolderStore, features, acimpl.ProvideAccessControl(features), db)
			_, err := folderSvc.Create(context.Background(), &folder.CreateFolderCommand{
				OrgID:        orgID,
				Title:        "some_folder",
				UID:          "some_uid",
				SignedInUser: tempUser,
			})
			require.ErrorIs(t, err, dashboards.ErrFolderCreationAccessDenied)
		})

		t.Run("Should not be able to create new folder under another folder without the right permissions", func(t *testing.T) {
			dash := dashboards.NewDashboardFolder("Test-Folder")
			dash.ID = rand.Int63()
			dash.UID = "some_uid"

			tempUser := &user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{}}
			tempUser.Permissions[orgID] = map[string][]string{dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("wrong_uid")}}

			// dashboard store commands that should be called.
			dashStore := &dashboards.FakeDashboardStore{}
			dashStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.AnythingOfType("*dashboards.Dashboard"), mock.AnythingOfType("bool")).Return(true, nil)
			dashStore.On("SaveDashboard", mock.Anything, mock.AnythingOfType("dashboards.SaveDashboardCommand")).Return(&dashboards.Dashboard{}, nil)

			features := featuremgmt.WithFeatures("nestedFolders")
			folderSvc := setup(t, dashStore, nil, nil, features, acimpl.ProvideAccessControl(features), dbtest.NewFakeDB())
			_, err := folderSvc.Create(context.Background(), &folder.CreateFolderCommand{
				OrgID:        orgID,
				Title:        dash.Title,
				UID:          dash.UID,
				SignedInUser: tempUser,
				ParentUID:    "some_parent",
			})
			require.ErrorIs(t, err, dashboards.ErrFolderCreationAccessDenied)
		})

		t.Run("Should be able to create new folder under another folder with the right permissions", func(t *testing.T) {
			dash := dashboards.NewDashboardFolder("Test-Folder")
			dash.ID = rand.Int63()
			dash.UID = "some_uid"

			// dashboard store commands that should be called.
			dashStore := &dashboards.FakeDashboardStore{}
			dashStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.AnythingOfType("*dashboards.Dashboard"), mock.AnythingOfType("bool")).Return(true, nil)
			dashStore.On("SaveDashboard", mock.Anything, mock.AnythingOfType("dashboards.SaveDashboardCommand")).Return(dash, nil)

			dashboardFolderStore := foldertest.NewFakeFolderStore(t)
			dashboardFolderStore.On("GetFolderByUID", mock.Anything, mock.AnythingOfType("int64"), mock.AnythingOfType("string")).Return(&folder.Folder{}, nil)

			nestedFolderUser := &user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{}}
			nestedFolderUser.Permissions[orgID] = map[string][]string{dashboards.ActionFoldersCreate: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("some_parent")}}

			nestedFolderStore := folder.NewFakeStore()
			db, _ := sqlstore.InitTestDB(t)
			features := featuremgmt.WithFeatures("nestedFolders")
			folderSvc := setup(t, dashStore, dashboardFolderStore, nestedFolderStore, features, acimpl.ProvideAccessControl(features), db)
			_, err := folderSvc.Create(context.Background(), &folder.CreateFolderCommand{
				OrgID:        orgID,
				Title:        dash.Title,
				UID:          dash.UID,
				SignedInUser: nestedFolderUser,
				ParentUID:    "some_parent",
			})
			require.NoError(t, err)
			require.True(t, nestedFolderStore.CreateCalled)
		})

		t.Run("create without UID, no error", func(t *testing.T) {
			// dashboard store commands that should be called.
			dashStore := &dashboards.FakeDashboardStore{}
			dashStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.AnythingOfType("*dashboards.Dashboard"), mock.AnythingOfType("bool")).Return(true, nil)
			dashStore.On("SaveDashboard", mock.Anything, mock.AnythingOfType("dashboards.SaveDashboardCommand")).Return(&dashboards.Dashboard{UID: "newUID"}, nil)

			dashboardFolderStore := foldertest.NewFakeFolderStore(t)
			nestedFolderStore := folder.NewFakeStore()

			db, _ := sqlstore.InitTestDB(t)
			folderSvc := setup(t, dashStore, dashboardFolderStore, nestedFolderStore, featuremgmt.WithFeatures("nestedFolders"), actest.FakeAccessControl{
				ExpectedEvaluate: true,
			}, db)
			f, err := folderSvc.Create(context.Background(), &folder.CreateFolderCommand{
				OrgID:        orgID,
				Title:        "myFolder",
				SignedInUser: usr,
			})
			require.NoError(t, err)
			// CreateFolder should also call the folder store's create method.
			require.True(t, nestedFolderStore.CreateCalled)
			require.Equal(t, "newUID", f.UID)
		})

		t.Run("create failed because of circular reference", func(t *testing.T) {
			dashboardFolder := dashboards.NewDashboardFolder("myFolder")
			dashboardFolder.ID = rand.Int63()
			dashboardFolder.UID = "myFolder"
			f := dashboards.FromDashboard(dashboardFolder)

			// dashboard store commands that should be called.
			dashStore := &dashboards.FakeDashboardStore{}
			dashStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.AnythingOfType("*dashboards.Dashboard"), mock.AnythingOfType("bool")).Return(true, nil)
			dashStore.On("SaveDashboard", mock.Anything, mock.AnythingOfType("dashboards.SaveDashboardCommand")).Return(dashboardFolder, nil)

			dashboardFolderStore := foldertest.NewFakeFolderStore(t)
			dashboardFolderStore.On("GetFolderByUID", mock.Anything, orgID, dashboardFolder.UID).Return(f, nil)

			nestedFolderStore := folder.NewFakeStore()
			nestedFolderStore.ExpectedParentFolders = []*folder.Folder{
				{UID: "newFolder", ParentUID: "newFolder"},
				{UID: "newFolder2", ParentUID: "newFolder2"},
				{UID: "newFolder3", ParentUID: "newFolder3"},
				{UID: "myFolder", ParentUID: "newFolder"},
			}

			cmd := folder.CreateFolderCommand{
				ParentUID:    dashboardFolder.UID,
				OrgID:        orgID,
				Title:        "myFolder1",
				UID:          "myFolder1",
				SignedInUser: usr,
			}

			db, _ := sqlstore.InitTestDB(t)
			folderSvc := setup(t, dashStore, dashboardFolderStore, nestedFolderStore, featuremgmt.WithFeatures("nestedFolders"), actest.FakeAccessControl{
				ExpectedEvaluate: true,
			}, db)
			_, err := folderSvc.Create(context.Background(), &cmd)
			require.Error(t, err, folder.ErrCircularReference)
			// CreateFolder should not call the folder store's create method.
			require.False(t, nestedFolderStore.CreateCalled)
		})

		t.Run("create returns error from nested folder service", func(t *testing.T) {
			// dashboard store commands that should be called.
			dashStore := &dashboards.FakeDashboardStore{}
			dashStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.AnythingOfType("*dashboards.Dashboard"), mock.AnythingOfType("bool")).Return(true, nil)
			dashStore.On("SaveDashboard", mock.Anything, mock.AnythingOfType("dashboards.SaveDashboardCommand")).Return(&dashboards.Dashboard{}, nil)

			dashboardFolderStore := foldertest.NewFakeFolderStore(t)

			// return an error from the folder store
			nestedFolderStore := folder.NewFakeStore()
			nestedFolderStore.ExpectedError = errors.New("FAILED")

			// the service return success as long as the legacy create succeeds
			db, _ := sqlstore.InitTestDB(t)
			folderSvc := setup(t, dashStore, dashboardFolderStore, nestedFolderStore, featuremgmt.WithFeatures("nestedFolders"), actest.FakeAccessControl{
				ExpectedEvaluate: true,
			}, db)
			_, err := folderSvc.Create(context.Background(), &folder.CreateFolderCommand{
				OrgID:        orgID,
				Title:        "myFolder",
				UID:          "myFolder",
				SignedInUser: usr,
			})
			require.Error(t, err, "FAILED")

			// CreateFolder should also call the folder store's create method.
			require.True(t, nestedFolderStore.CreateCalled)
		})

		t.Run("move without the right permissions should fail", func(t *testing.T) {
			dashStore := &dashboards.FakeDashboardStore{}
			dashboardFolderStore := foldertest.NewFakeFolderStore(t)
			// dashboardFolderStore.On("GetFolderByUID", mock.Anything, mock.AnythingOfType("int64"), mock.AnythingOfType("string")).Return(&folder.Folder{}, nil)

			nestedFolderStore := folder.NewFakeStore()
			nestedFolderStore.ExpectedFolder = &folder.Folder{UID: "myFolder", ParentUID: "newFolder"}

			nestedFolderUser := &user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{}}
			nestedFolderUser.Permissions[orgID] = map[string][]string{dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("wrong_uid")}}

			features := featuremgmt.WithFeatures("nestedFolders")
			folderSvc := setup(t, dashStore, dashboardFolderStore, nestedFolderStore, features, acimpl.ProvideAccessControl(features), dbtest.NewFakeDB())
			_, err := folderSvc.Move(context.Background(), &folder.MoveFolderCommand{UID: "myFolder", NewParentUID: "newFolder", OrgID: orgID, SignedInUser: nestedFolderUser})
			require.ErrorIs(t, err, dashboards.ErrMoveAccessDenied)
		})

		t.Run("move with the right permissions succeeds", func(t *testing.T) {
			dashStore := &dashboards.FakeDashboardStore{}
			dashboardFolderStore := foldertest.NewFakeFolderStore(t)

			nestedFolderStore := folder.NewFakeStore()
			nestedFolderStore.ExpectedFolder = &folder.Folder{UID: "myFolder", ParentUID: "newFolder"}
			nestedFolderStore.ExpectedParentFolders = []*folder.Folder{
				{UID: "newFolder", ParentUID: "newFolder"},
				{UID: "newFolder2", ParentUID: "newFolder2"},
				{UID: "newFolder3", ParentUID: "newFolder3"},
			}

			nestedFolderUser := &user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{}}
			nestedFolderUser.Permissions[orgID] = map[string][]string{
				dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("myFolder"), dashboards.ScopeFoldersProvider.GetResourceScopeUID("newFolder")},
			}

			features := featuremgmt.WithFeatures("nestedFolders")
			folderSvc := setup(t, dashStore, dashboardFolderStore, nestedFolderStore, features, acimpl.ProvideAccessControl(features), dbtest.NewFakeDB())
			_, err := folderSvc.Move(context.Background(), &folder.MoveFolderCommand{UID: "myFolder", NewParentUID: "newFolder", OrgID: orgID, SignedInUser: nestedFolderUser})
			require.NoError(t, err)

			// Parent write access check will eventually be replaced with scoped folder creation check
			nestedFolderUser.Permissions[orgID] = map[string][]string{
				dashboards.ActionFoldersCreate: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("myFolder"), dashboards.ScopeFoldersProvider.GetResourceScopeUID("newFolder2")},
			}
			_, err = folderSvc.Move(context.Background(), &folder.MoveFolderCommand{UID: "myFolder", NewParentUID: "newFolder2", OrgID: orgID, SignedInUser: nestedFolderUser})
			require.NoError(t, err)
		})

		t.Run("cannot move the k6 folder even when has permissions to move folders", func(t *testing.T) {
			nestedFolderUser := &user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{}}
			nestedFolderUser.Permissions[orgID] = map[string][]string{dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersProvider.GetResourceAllScope()}}

			features := featuremgmt.WithFeatures("nestedFolders")
			folderSvc := setup(t, &dashboards.FakeDashboardStore{}, foldertest.NewFakeFolderStore(t), folder.NewFakeStore(), features, acimpl.ProvideAccessControl(features), dbtest.NewFakeDB())
			_, err := folderSvc.Move(context.Background(), &folder.MoveFolderCommand{UID: accesscontrol.K6FolderUID, NewParentUID: "newFolder", OrgID: orgID, SignedInUser: nestedFolderUser})
			require.Error(t, err, folder.ErrBadRequest)
		})

		t.Run("cannot move a k6 subfolder even when has permissions to move folders", func(t *testing.T) {
			nestedFolderUser := &user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{}}
			nestedFolderUser.Permissions[orgID] = map[string][]string{dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersProvider.GetResourceAllScope()}}

			childUID := "k6-app-child"
			nestedFolderStore := folder.NewFakeStore()
			nestedFolderStore.ExpectedFolder = &folder.Folder{
				OrgID:     orgID,
				UID:       childUID,
				ParentUID: accesscontrol.K6FolderUID,
			}

			features := featuremgmt.WithFeatures("nestedFolders")
			folderSvc := setup(t, &dashboards.FakeDashboardStore{}, foldertest.NewFakeFolderStore(t), nestedFolderStore, features, acimpl.ProvideAccessControl(features), dbtest.NewFakeDB())
			_, err := folderSvc.Move(context.Background(), &folder.MoveFolderCommand{UID: childUID, NewParentUID: "newFolder", OrgID: orgID, SignedInUser: nestedFolderUser})
			require.Error(t, err, folder.ErrBadRequest)
		})

		t.Run("move to the root folder without folder creation permissions fails", func(t *testing.T) {
			dashStore := &dashboards.FakeDashboardStore{}
			dashboardFolderStore := foldertest.NewFakeFolderStore(t)

			nestedFolderStore := folder.NewFakeStore()
			nestedFolderStore.ExpectedFolder = &folder.Folder{UID: "myFolder", ParentUID: "newFolder"}

			nestedFolderUser := &user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{}}
			nestedFolderUser.Permissions[orgID] = map[string][]string{dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("")}}

			features := featuremgmt.WithFeatures("nestedFolders")
			folderSvc := setup(t, dashStore, dashboardFolderStore, nestedFolderStore, features, acimpl.ProvideAccessControl(features), dbtest.NewFakeDB())
			_, err := folderSvc.Move(context.Background(), &folder.MoveFolderCommand{UID: "myFolder", NewParentUID: "", OrgID: orgID, SignedInUser: nestedFolderUser})
			require.Error(t, err, dashboards.ErrFolderAccessDenied)
		})

		t.Run("move to the root folder with root folder creation permissions succeeds", func(t *testing.T) {
			dashStore := &dashboards.FakeDashboardStore{}
			dashboardFolderStore := foldertest.NewFakeFolderStore(t)

			nestedFolderStore := folder.NewFakeStore()
			nestedFolderStore.ExpectedFolder = &folder.Folder{UID: "myFolder", ParentUID: "newFolder"}
			nestedFolderStore.ExpectedParentFolders = []*folder.Folder{
				{UID: "newFolder", ParentUID: "newFolder"},
				{UID: "newFolder2", ParentUID: "newFolder2"},
				{UID: "newFolder3", ParentUID: "newFolder3"},
			}

			nestedFolderUser := &user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{}}
			nestedFolderUser.Permissions[orgID] = map[string][]string{
				dashboards.ActionFoldersCreate: {
					dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.GeneralFolderUID),
					dashboards.ScopeFoldersProvider.GetResourceScopeUID("myFolder"),
				},
			}

			features := featuremgmt.WithFeatures("nestedFolders")
			folderSvc := setup(t, dashStore, dashboardFolderStore, nestedFolderStore, features, acimpl.ProvideAccessControl(features), dbtest.NewFakeDB())
			_, err := folderSvc.Move(context.Background(), &folder.MoveFolderCommand{UID: "myFolder", NewParentUID: "", OrgID: orgID, SignedInUser: nestedFolderUser})
			require.NoError(t, err)
			// the folder is set inside InTransaction() but the fake one is called
			// require.NotNil(t, f)
		})

		t.Run("move to the root folder with only subfolder creation permissions fails", func(t *testing.T) {
			dashStore := &dashboards.FakeDashboardStore{}
			dashboardFolderStore := foldertest.NewFakeFolderStore(t)

			nestedFolderStore := folder.NewFakeStore()

			nestedFolderUser := &user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{}}
			nestedFolderUser.Permissions[orgID] = map[string][]string{dashboards.ActionFoldersCreate: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("some_subfolder")}}

			features := featuremgmt.WithFeatures("nestedFolders")
			folderSvc := setup(t, dashStore, dashboardFolderStore, nestedFolderStore, features, acimpl.ProvideAccessControl(features), dbtest.NewFakeDB())
			_, err := folderSvc.Move(context.Background(), &folder.MoveFolderCommand{UID: "myFolder", NewParentUID: "", OrgID: orgID, SignedInUser: nestedFolderUser})
			require.Error(t, err)
		})

		t.Run("move when parentUID in the current subtree returns error from nested folder service", func(t *testing.T) {
			dashStore := &dashboards.FakeDashboardStore{}
			dashboardFolderStore := foldertest.NewFakeFolderStore(t)

			nestedFolderStore := folder.NewFakeStore()
			nestedFolderStore.ExpectedFolder = &folder.Folder{UID: "myFolder", ParentUID: "newFolder"}
			nestedFolderStore.ExpectedError = folder.ErrCircularReference

			folderSvc := setup(t, dashStore, dashboardFolderStore, nestedFolderStore, featuremgmt.WithFeatures("nestedFolders"), actest.FakeAccessControl{
				ExpectedEvaluate: true,
			}, dbtest.NewFakeDB())
			f, err := folderSvc.Move(context.Background(), &folder.MoveFolderCommand{UID: "myFolder", NewParentUID: "newFolder", OrgID: orgID, SignedInUser: usr})
			require.Error(t, err, folder.ErrCircularReference)
			require.Nil(t, f)
		})

		t.Run("move when new parentUID depth + subTree height bypassed maximum depth returns error", func(t *testing.T) {
			dashStore := &dashboards.FakeDashboardStore{}
			dashboardFolderStore := foldertest.NewFakeFolderStore(t)

			nestedFolderStore := folder.NewFakeStore()
			nestedFolderStore.ExpectedFolder = &folder.Folder{UID: "myFolder", ParentUID: "newFolder"}
			nestedFolderStore.ExpectedParentFolders = []*folder.Folder{
				{UID: "newFolder", ParentUID: "newFolder"},
				{UID: "newFolder2", ParentUID: "newFolder2"},
			}
			nestedFolderStore.ExpectedFolderHeight = 5

			folderSvc := setup(t, dashStore, dashboardFolderStore, nestedFolderStore, featuremgmt.WithFeatures("nestedFolders"), actest.FakeAccessControl{
				ExpectedEvaluate: true,
			}, dbtest.NewFakeDB())
			f, err := folderSvc.Move(context.Background(), &folder.MoveFolderCommand{UID: "myFolder", NewParentUID: "newFolder2", OrgID: orgID, SignedInUser: usr})
			require.Error(t, err, folder.ErrMaximumDepthReached)
			require.Nil(t, f)
		})

		t.Run("move when parentUID in the current subtree returns error from nested folder service", func(t *testing.T) {
			dashStore := &dashboards.FakeDashboardStore{}
			dashboardFolderStore := foldertest.NewFakeFolderStore(t)

			nestedFolderStore := folder.NewFakeStore()
			nestedFolderStore.ExpectedFolder = &folder.Folder{UID: "myFolder", ParentUID: "newFolder"}
			nestedFolderStore.ExpectedParentFolders = []*folder.Folder{{UID: "myFolder", ParentUID: "12345"}, {UID: "12345", ParentUID: ""}}

			folderSvc := setup(t, dashStore, dashboardFolderStore, nestedFolderStore, featuremgmt.WithFeatures("nestedFolders"), actest.FakeAccessControl{
				ExpectedEvaluate: true,
			}, dbtest.NewFakeDB())
			f, err := folderSvc.Move(context.Background(), &folder.MoveFolderCommand{UID: "myFolder", NewParentUID: "newFolder2", OrgID: orgID, SignedInUser: usr})
			require.Error(t, err, folder.ErrCircularReference)
			require.Nil(t, f)
		})

		t.Run("create returns error if maximum depth reached", func(t *testing.T) {
			// dashboard store commands that should be called.
			dashStore := &dashboards.FakeDashboardStore{}
			dashStore.On("ValidateDashboardBeforeSave", mock.Anything, mock.AnythingOfType("*dashboards.Dashboard"), mock.AnythingOfType("bool")).Return(true, nil).Times(2)
			dashStore.On("SaveDashboard", mock.Anything, mock.AnythingOfType("dashboards.SaveDashboardCommand")).Return(&dashboards.Dashboard{}, nil)

			dashboardFolderStore := foldertest.NewFakeFolderStore(t)
			dashboardFolderStore.On("GetFolderByUID", mock.Anything, mock.AnythingOfType("int64"), mock.AnythingOfType("string")).Return(&folder.Folder{}, nil)

			parents := make([]*folder.Folder, 0, folder.MaxNestedFolderDepth)
			for i := 0; i < folder.MaxNestedFolderDepth; i++ {
				parents = append(parents, &folder.Folder{UID: fmt.Sprintf("folder%d", i)})
			}

			nestedFolderStore := folder.NewFakeStore()
			// nestedFolderStore.ExpectedFolder = &folder.Folder{UID: "myFolder", ParentUID: "newFolder"}
			nestedFolderStore.ExpectedParentFolders = parents

			db, _ := sqlstore.InitTestDB(t)
			folderSvc := setup(t, dashStore, dashboardFolderStore, nestedFolderStore, featuremgmt.WithFeatures("nestedFolders"), actest.FakeAccessControl{
				ExpectedEvaluate: true,
			}, db)
			_, err := folderSvc.Create(context.Background(), &folder.CreateFolderCommand{
				Title:        "folder",
				OrgID:        orgID,
				ParentUID:    parents[len(parents)-1].UID,
				UID:          util.GenerateShortUID(),
				SignedInUser: usr,
			})
			assert.ErrorIs(t, err, folder.ErrMaximumDepthReached)
		})

		t.Run("get default folder, no error", func(t *testing.T) {
			// dashboard store commands that should be called.
			dashStore := &dashboards.FakeDashboardStore{}
			nestedFolderStore := folder.NewFakeStore()
			dashboardFolderStore := foldertest.NewFakeFolderStore(t)

			folderSvc := setup(t, dashStore, dashboardFolderStore, nestedFolderStore, featuremgmt.WithFeatures("nestedFolders"), actest.FakeAccessControl{
				ExpectedEvaluate: true,
			}, dbtest.NewFakeDB())
			_, err := folderSvc.Get(context.Background(), &folder.GetFolderQuery{
				OrgID:        orgID,
				ID:           &folder.GeneralFolder.ID, // nolint:staticcheck
				SignedInUser: usr,
			})
			require.NoError(t, err)
		})
	})
}

func TestIntegrationNestedFolderSharedWithMe(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	db, cfg := sqlstore.InitTestDB(t)
	quotaService := quotatest.New(false, nil)
	folderStore := ProvideDashboardFolderStore(db)

	featuresFlagOn := featuremgmt.WithFeatures("nestedFolders")
	dashStore, err := database.ProvideDashboardStore(db, cfg, featuresFlagOn, tagimpl.ProvideService(db))
	require.NoError(t, err)
	nestedFolderStore := ProvideStore(db)
	tracer := noop.NewTracerProvider().Tracer("TestIntegrationNestedFolderSharedWithMe")

	b := bus.ProvideBus(tracing.InitializeTracerForTest())
	ac := acimpl.ProvideAccessControl(featuresFlagOn)

	serviceWithFlagOn := &Service{
		log:                  slog.New(logtest.NewTestHandler(t)).With("logger", "test-folder-service"),
		dashboardStore:       dashStore,
		dashboardFolderStore: folderStore,
		store:                nestedFolderStore,
		features:             featuresFlagOn,
		bus:                  b,
		db:                   db,
		accessControl:        ac,
		registry:             make(map[string]folder.RegistryService),
		metrics:              newFoldersMetrics(nil),
		tracer:               tracer,
	}

	dashboardPermissions := acmock.NewMockedPermissionsService()
	dashboardService, err := dashboardservice.ProvideDashboardServiceImpl(
		cfg, dashStore, folderStore,
		featuresFlagOn,
		acmock.NewMockedPermissionsService(),
		actest.FakeAccessControl{},
		actest.FakeService{},
		serviceWithFlagOn,
		nil,
		client.MockTestRestConfig{},
		nil,
		quotaService,
		nil,
		nil,
		nil,
		dualwrite.ProvideTestService(),
		sort.ProvideService(),
		serverlock.ProvideService(db, tracing.InitializeTracerForTest()),
		kvstore.NewFakeKVStore(),
	)
	require.NoError(t, err)
	dashboardService.RegisterDashboardPermissions(dashboardPermissions)
	signedInUser := user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{
		orgID: {
			dashboards.ActionFoldersRead: {},
		},
	}}

	signedInAdminUser := user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{
		orgID: {
			dashboards.ActionFoldersCreate: {},
			dashboards.ActionFoldersWrite:  {dashboards.ScopeFoldersAll},
			dashboards.ActionFoldersRead:   {dashboards.ScopeFoldersAll},
		},
	}}

	createCmd := folder.CreateFolderCommand{
		OrgID:        orgID,
		ParentUID:    "",
		SignedInUser: &signedInAdminUser,
	}

	t.Run("Should get folders shared with given user", func(t *testing.T) {
		depth := 3

		ancestorFoldersWithPermissions := CreateSubtreeInStore(t, nestedFolderStore, serviceWithFlagOn, depth, "withPermissions", createCmd, true)
		ancestorFoldersWithoutPermissions := CreateSubtreeInStore(t, nestedFolderStore, serviceWithFlagOn, depth, "withoutPermissions", createCmd, true)

		parent, err := serviceWithFlagOn.dashboardFolderStore.GetFolderByUID(context.Background(), orgID, ancestorFoldersWithoutPermissions[0].UID)
		require.NoError(t, err)
		subfolder, err := serviceWithFlagOn.dashboardFolderStore.GetFolderByUID(context.Background(), orgID, ancestorFoldersWithoutPermissions[1].UID)
		require.NoError(t, err)
		// nolint:staticcheck
		dash1 := insertTestDashboard(t, serviceWithFlagOn.dashboardStore, "dashboard in parent", orgID, parent.ID, parent.UID, "prod")
		// nolint:staticcheck
		dash2 := insertTestDashboard(t, serviceWithFlagOn.dashboardStore, "dashboard in subfolder", orgID, subfolder.ID, subfolder.UID, "prod")

		signedInUser.Permissions[orgID][dashboards.ActionFoldersRead] = []string{
			dashboards.ScopeFoldersProvider.GetResourceScopeUID(ancestorFoldersWithPermissions[0].UID),
			// Add permission to the subfolder of folder with permission (to check deduplication)
			dashboards.ScopeFoldersProvider.GetResourceScopeUID(ancestorFoldersWithPermissions[1].UID),
			// Add permission to the subfolder of folder without permission
			dashboards.ScopeFoldersProvider.GetResourceScopeUID(ancestorFoldersWithoutPermissions[1].UID),
		}
		signedInUser.Permissions[orgID][dashboards.ActionDashboardsRead] = []string{
			dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dash1.UID),
			dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dash2.UID),
		}

		getSharedCmd := folder.GetChildrenQuery{
			UID:          folder.SharedWithMeFolderUID,
			OrgID:        orgID,
			SignedInUser: &signedInUser,
		}

		sharedFolders, err := serviceWithFlagOn.GetChildren(context.Background(), &getSharedCmd)
		sharedFoldersUIDs := make([]string, 0)
		for _, f := range sharedFolders {
			sharedFoldersUIDs = append(sharedFoldersUIDs, f.UID)
		}

		require.NoError(t, err)
		require.Len(t, sharedFolders, 1)
		require.Contains(t, sharedFoldersUIDs, ancestorFoldersWithoutPermissions[1].UID)
		require.NotContains(t, sharedFoldersUIDs, ancestorFoldersWithPermissions[1].UID)

		t.Cleanup(func() {
			toDelete := make([]string, 0, len(ancestorFoldersWithPermissions)+len(ancestorFoldersWithoutPermissions))
			for _, ancestor := range append(ancestorFoldersWithPermissions, ancestorFoldersWithoutPermissions...) {
				toDelete = append(toDelete, ancestor.UID)
			}
			err := serviceWithFlagOn.store.Delete(context.Background(), toDelete, orgID)
			assert.NoError(t, err)
		})
	})

	t.Run("Should not list k6 folders or subfolders", func(t *testing.T) {
		_, err = nestedFolderStore.Create(context.Background(), folder.CreateFolderCommand{
			UID:          accesscontrol.K6FolderUID,
			OrgID:        orgID,
			SignedInUser: &signedInAdminUser,
		})
		require.NoError(t, err)

		k6ChildFolder, err := nestedFolderStore.Create(context.Background(), folder.CreateFolderCommand{
			UID:          "k6-app-child",
			ParentUID:    accesscontrol.K6FolderUID,
			OrgID:        orgID,
			SignedInUser: &signedInAdminUser,
		})
		require.NoError(t, err)

		unrelatedFolder, err := nestedFolderStore.Create(context.Background(), folder.CreateFolderCommand{
			UID:          "another-folder",
			OrgID:        orgID,
			SignedInUser: &signedInAdminUser,
		})
		require.NoError(t, err)

		folders, err := serviceWithFlagOn.GetFolders(context.Background(), folder.GetFoldersQuery{
			OrgID:        orgID,
			SignedInUser: &signedInAdminUser,
		})
		require.NoError(t, err)
		assert.Equal(t, 1, len(folders), "should not return k6 folders or subfolders")
		assert.Equal(t, unrelatedFolder.UID, folders[0].UID)

		// Service accounts should be able to list k6 folders
		svcAccountUser := user.SignedInUser{UserID: 2, IsServiceAccount: true, OrgID: orgID, Permissions: map[int64]map[string][]string{
			orgID: {
				dashboards.ActionFoldersRead: {dashboards.ScopeFoldersAll},
			},
		}}
		folders, err = serviceWithFlagOn.GetFolders(context.Background(), folder.GetFoldersQuery{
			OrgID:        orgID,
			SignedInUser: &svcAccountUser,
		})
		require.NoError(t, err)
		assert.Equal(t, 3, len(folders), "service accounts should be able to list k6 folders")

		t.Cleanup(func() {
			toDelete := []string{k6ChildFolder.UID, accesscontrol.K6FolderUID, unrelatedFolder.UID}
			err := serviceWithFlagOn.store.Delete(context.Background(), toDelete, orgID)
			assert.NoError(t, err)
		})
	})

	t.Run("Should get org folders visible", func(t *testing.T) {
		depth := 3

		// create folder sctructure like this:
		// tree1-folder-0
		// └──tree1-folder-1
		// 	└──tree1-folder-2
		// tree2-folder-0
		//  └──tree2-folder-1
		// 	 └──tree2-folder-2
		tree1 := CreateSubtreeInStore(t, nestedFolderStore, serviceWithFlagOn, depth, "tree1-", createCmd, true)
		tree2 := CreateSubtreeInStore(t, nestedFolderStore, serviceWithFlagOn, depth, "tree2-", createCmd, true)

		signedInUser.Permissions[orgID][dashboards.ActionFoldersRead] = []string{
			// Add permission to tree1-folder-0
			dashboards.ScopeFoldersProvider.GetResourceScopeUID(tree1[0].UID),
			// Add permission to the subfolder of folder with permission (tree1-folder-1) to check deduplication
			dashboards.ScopeFoldersProvider.GetResourceScopeUID(tree1[1].UID),
			// Add permission to the subfolder of folder without permission (tree2-folder-1)
			dashboards.ScopeFoldersProvider.GetResourceScopeUID(tree2[1].UID),
		}

		t.Cleanup(func() {
			toDelete := make([]string, 0, len(tree1)+len(tree2))
			for _, f := range append(tree1, tree2...) {
				toDelete = append(toDelete, f.UID)
			}
			err := serviceWithFlagOn.store.Delete(context.Background(), toDelete, orgID)
			assert.NoError(t, err)
		})

		testCases := []struct {
			name     string
			cmd      folder.GetFoldersQuery
			expected []*folder.Folder
		}{
			{
				name: "Should get all org folders visible to the user",
				cmd: folder.GetFoldersQuery{
					OrgID:        orgID,
					SignedInUser: &signedInUser,
				},
				expected: []*folder.Folder{
					{
						UID: tree1[0].UID,
					},
					{
						UID: tree1[1].UID,
					},
					{
						UID: tree1[2].UID,
					},
					{
						UID: tree2[1].UID,
					},
					{
						UID: tree2[2].UID,
					},
				},
			},
			{
				name: "Should get all org folders visible to the user with fullpath",
				cmd: folder.GetFoldersQuery{
					OrgID:        orgID,
					WithFullpath: true,
					SignedInUser: &signedInUser,
				},
				expected: []*folder.Folder{
					{
						UID:      tree1[0].UID,
						Fullpath: "tree1-folder-0",
					},
					{
						UID:      tree1[1].UID,
						Fullpath: "tree1-folder-0/tree1-folder-1",
					},
					{
						UID:      tree1[2].UID,
						Fullpath: "tree1-folder-0/tree1-folder-1/tree1-folder-2",
					},
					{
						UID:      tree2[1].UID,
						Fullpath: "tree2-folder-0/tree2-folder-1",
					},
					{
						UID:      tree2[2].UID,
						Fullpath: "tree2-folder-0/tree2-folder-1/tree2-folder-2",
					},
				},
			},
			{
				name: "Should get all org folders visible to the user with fullpath UIDs",
				cmd: folder.GetFoldersQuery{
					OrgID:            orgID,
					WithFullpathUIDs: true,
					SignedInUser:     &signedInUser,
				},
				expected: []*folder.Folder{
					{
						UID:          tree1[0].UID,
						FullpathUIDs: strings.Join([]string{tree1[0].UID}, "/"),
					},
					{
						UID:          tree1[1].UID,
						FullpathUIDs: strings.Join([]string{tree1[0].UID, tree1[1].UID}, "/"),
					},
					{
						UID:          tree1[2].UID,
						FullpathUIDs: strings.Join([]string{tree1[0].UID, tree1[1].UID, tree1[2].UID}, "/"),
					},
					{
						UID:          tree2[1].UID,
						FullpathUIDs: strings.Join([]string{tree2[0].UID, tree2[1].UID}, "/"),
					},
					{
						UID:          tree2[2].UID,
						FullpathUIDs: strings.Join([]string{tree2[0].UID, tree2[1].UID, tree2[2].UID}, "/"),
					},
				},
			},
			{
				name: "Should get specific org folders visible to the user",
				cmd: folder.GetFoldersQuery{
					OrgID:        orgID,
					UIDs:         []string{tree1[0].UID, tree2[0].UID, tree2[1].UID},
					SignedInUser: &signedInUser,
				},
				expected: []*folder.Folder{
					{
						UID: tree1[0].UID,
					},
					{
						UID: tree2[1].UID,
					},
				},
			},
			{
				name: "Should get all org folders visible to the user with admin permissions",
				cmd: folder.GetFoldersQuery{
					OrgID:        orgID,
					SignedInUser: &signedInAdminUser,
				},
				expected: []*folder.Folder{
					{
						UID:          tree1[0].UID,
						Fullpath:     "tree1-folder-0",
						FullpathUIDs: strings.Join([]string{tree1[0].UID}, "/"),
					},
					{
						UID:          tree1[1].UID,
						Fullpath:     "tree1-folder-0/tree1-folder-1",
						FullpathUIDs: strings.Join([]string{tree1[0].UID, tree1[1].UID}, "/"),
					},
					{
						UID:      tree1[2].UID,
						Fullpath: "tree1-folder-0/tree1-folder-1/tree1-folder-2",
					},
					{
						UID:          tree2[0].UID,
						Fullpath:     "tree2-folder-0",
						FullpathUIDs: strings.Join([]string{tree2[0].UID}, "/"),
					},
					{
						UID:          tree2[1].UID,
						Fullpath:     "tree2-folder-0/tree2-folder-1",
						FullpathUIDs: strings.Join([]string{tree2[0].UID, tree2[1].UID}, "/"),
					},
					{
						UID:          tree2[2].UID,
						Fullpath:     "tree2-folder-0/tree2-folder-1/tree2-folder-2",
						FullpathUIDs: strings.Join([]string{tree2[0].UID, tree2[1].UID, tree2[2].UID}, "/"),
					},
				},
			},
			{
				name: "Should not get any folders if user has no permissions",
				cmd: folder.GetFoldersQuery{
					OrgID: orgID,
					SignedInUser: &user.SignedInUser{UserID: 999, OrgID: orgID, Permissions: map[int64]map[string][]string{
						orgID: {},
					}},
				},
				expected: nil,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				actualFolders, err := serviceWithFlagOn.GetFolders(context.Background(), tc.cmd)
				require.NoError(t, err)

				require.NoError(t, err)
				require.Len(t, actualFolders, len(tc.expected))

				for _, expected := range tc.expected {
					var actualFolder *folder.Folder
					for _, f := range actualFolders {
						if f.UID == expected.UID {
							actualFolder = f
							break
						}
					}
					if actualFolder == nil {
						t.Fatalf("expected folder with UID %s not found", expected.UID)
					}
					if tc.cmd.WithFullpath {
						require.Equal(t, expected.Fullpath, actualFolder.Fullpath)
					} else {
						require.Empty(t, actualFolder.Fullpath)
					}

					if tc.cmd.WithFullpathUIDs {
						require.Equal(t, expected.FullpathUIDs, actualFolder.FullpathUIDs)
					} else {
						require.Empty(t, actualFolder.FullpathUIDs)
					}
				}
			})
		}
	})
}

func TestIntegrationFolderServiceGetFolder(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	db, _ := sqlstore.InitTestDB(t)

	signedInAdminUser := user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{
		orgID: {
			dashboards.ActionFoldersCreate: {},
			dashboards.ActionFoldersWrite:  {dashboards.ScopeFoldersAll},
			dashboards.ActionFoldersRead:   {dashboards.ScopeFoldersAll},
		},
	}}

	getSvc := func(features featuremgmt.FeatureToggles) Service {
		folderStore := ProvideDashboardFolderStore(db)

		cfg := setting.NewCfg()

		featuresFlagOff := featuremgmt.WithFeatures()
		dashStore, err := database.ProvideDashboardStore(db, setting.ProvideService(cfg), featuresFlagOff, tagimpl.ProvideService(db))
		require.NoError(t, err)
		nestedFolderStore := ProvideStore(db)
		tracer := noop.NewTracerProvider().Tracer("TestFolderServiceGetFolder")

		b := bus.ProvideBus(tracing.InitializeTracerForTest())
		ac := acimpl.ProvideAccessControl(featuresFlagOff)

		return Service{
			log:                  slog.New(logtest.NewTestHandler(t)).With("logger", "test-folder-service"),
			dashboardStore:       dashStore,
			dashboardFolderStore: folderStore,
			store:                nestedFolderStore,
			features:             features,
			bus:                  b,
			db:                   db,
			accessControl:        ac,
			registry:             make(map[string]folder.RegistryService),
			metrics:              newFoldersMetrics(nil),
			tracer:               tracer,
		}
	}

	folderSvcOn := getSvc(featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders))
	folderSvcOff := getSvc(featuremgmt.WithFeatures())

	createCmd := folder.CreateFolderCommand{
		OrgID:        orgID,
		ParentUID:    "",
		SignedInUser: &signedInAdminUser,
	}

	depth := 3
	folders := CreateSubtreeInStore(t, folderSvcOn.store, &folderSvcOn, depth, "get/folder-", createCmd, false)
	f := folders[1]

	testCases := []struct {
		name                 string
		svc                  *Service
		WithFullpath         bool
		WithFullpathUIDs     bool
		expectedFullpath     string
		expectedFullpathUIDs string
	}{
		{
			name:             "when flag is off",
			svc:              &folderSvcOff,
			expectedFullpath: f.Title,
		},
		{
			name:             "when flag is on and WithFullpath is false",
			svc:              &folderSvcOn,
			WithFullpath:     false,
			expectedFullpath: "",
		},
		{
			name:             "when flag is on and WithFullpath is true",
			svc:              &folderSvcOn,
			WithFullpath:     true,
			expectedFullpath: "get\\/folder-folder-0/get\\/folder-folder-1",
		},
		{
			name:                 "when flag is on and WithFullpathUIDs is false",
			svc:                  &folderSvcOn,
			WithFullpathUIDs:     false,
			expectedFullpathUIDs: "",
		},
		{
			name:                 "when flag is on and WithFullpathUIDs is true",
			svc:                  &folderSvcOn,
			WithFullpathUIDs:     true,
			expectedFullpathUIDs: "uidfor-0/uidfor-1",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			q := folder.GetFolderQuery{
				OrgID:        orgID,
				UID:          &f.UID,
				WithFullpath: tc.WithFullpath,
				SignedInUser: &signedInAdminUser,
			}
			fldr, err := tc.svc.Get(context.Background(), &q)
			require.NoError(t, err)
			require.Equal(t, f.UID, fldr.UID)
			require.Equal(t, f.CreatedBy, fldr.CreatedBy)
			require.Equal(t, f.UpdatedBy, fldr.CreatedBy)

			require.Equal(t, tc.expectedFullpath, fldr.Fullpath)
		})
	}
}

func TestIntegrationFolderServiceGetFolders(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	db, cfg := sqlstore.InitTestDB(t)
	folderStore := ProvideDashboardFolderStore(db)

	featuresFlagOff := featuremgmt.WithFeatures()
	dashStore, err := database.ProvideDashboardStore(db, cfg, featuresFlagOff, tagimpl.ProvideService(db))
	require.NoError(t, err)
	nestedFolderStore := ProvideStore(db)
	tracer := noop.NewTracerProvider().Tracer("TestFolderServiceGetFolders")

	b := bus.ProvideBus(tracing.InitializeTracerForTest())
	ac := acimpl.ProvideAccessControl(featuresFlagOff)

	serviceWithFlagOff := &Service{
		log:                  slog.New(logtest.NewTestHandler(t)).With("logger", "test-folder-service"),
		dashboardStore:       dashStore,
		dashboardFolderStore: folderStore,
		store:                nestedFolderStore,
		features:             featuresFlagOff,
		bus:                  b,
		db:                   db,
		accessControl:        ac,
		registry:             make(map[string]folder.RegistryService),
		metrics:              newFoldersMetrics(nil),
		tracer:               tracer,
	}

	signedInAdminUser := user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{
		orgID: {
			dashboards.ActionFoldersCreate: {},
			dashboards.ActionFoldersWrite:  {dashboards.ScopeFoldersAll},
			dashboards.ActionFoldersRead:   {dashboards.ScopeFoldersAll},
		},
	}}

	createCmd := folder.CreateFolderCommand{
		OrgID:        orgID,
		ParentUID:    "",
		SignedInUser: &signedInAdminUser,
	}

	prefix := "getfolders/ff/off"
	folders := CreateSubtreeInStore(t, nestedFolderStore, serviceWithFlagOff, 5, prefix, createCmd, true)
	f := folders[rand.Intn(len(folders))]

	t.Run("when flag is off", func(t *testing.T) {
		t.Run("full path should be a title", func(t *testing.T) {
			q := folder.GetFoldersQuery{
				OrgID:            orgID,
				WithFullpath:     true,
				WithFullpathUIDs: true,
				SignedInUser:     &signedInAdminUser,
				UIDs:             []string{f.UID},
			}
			fldrs, err := serviceWithFlagOff.GetFolders(context.Background(), q)
			require.NoError(t, err)
			require.Len(t, fldrs, 1)
			require.Equal(t, f.UID, fldrs[0].UID)
			require.Equal(t, f.Title, fldrs[0].Title)
			require.Equal(t, f.Title, fldrs[0].Fullpath)

			t.Run("path should not be escaped", func(t *testing.T) {
				require.Contains(t, fldrs[0].Fullpath, prefix)
				require.Contains(t, fldrs[0].Title, prefix)
			})
		})
	})
}

// TODO replace it with an API test under /pkg/tests/api/folders
// whenever the golang client with get updated to allow filtering child folders by permission
func TestIntegrationGetChildrenFilterByPermission(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	db, cfg := sqlstore.InitTestDB(t)

	signedInAdminUser := user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{
		orgID: {
			dashboards.ActionFoldersCreate: {dashboards.ScopeFoldersAll},
			dashboards.ActionFoldersWrite:  {dashboards.ScopeFoldersAll},
			dashboards.ActionFoldersRead:   {dashboards.ScopeFoldersAll},
		},
	}}

	folderStore := ProvideDashboardFolderStore(db)

	featuresFlagOff := featuremgmt.WithFeatures()
	dashStore, err := database.ProvideDashboardStore(db, cfg, featuresFlagOff, tagimpl.ProvideService(db))
	require.NoError(t, err)
	nestedFolderStore := ProvideStore(db)
	tracer := noop.NewTracerProvider().Tracer("TestGetChildrenFilterByPermission")

	b := bus.ProvideBus(tracing.InitializeTracerForTest())
	ac := acimpl.ProvideAccessControl(featuresFlagOff)

	features := featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders)

	folderSvcOn := &Service{
		log:                  slog.New(logtest.NewTestHandler(t)).With("logger", "test-folder-service"),
		dashboardStore:       dashStore,
		dashboardFolderStore: folderStore,
		store:                nestedFolderStore,
		features:             features,
		bus:                  b,
		db:                   db,
		accessControl:        ac,
		registry:             make(map[string]folder.RegistryService),
		metrics:              newFoldersMetrics(nil),
		tracer:               tracer,
	}

	viewer := user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{
		orgID: {
			dashboards.ActionFoldersRead:  {},
			dashboards.ActionFoldersWrite: {},
		},
	}}

	// no view permission
	// 	|_ subfolder under no view permission with view permission
	// 	|_ subfolder under no view permission with view permissionn and with edit permission
	// with edit permission
	//	|_ subfolder under with edit permission
	// no edit permission
	// 	|_ subfolder under no edit permission
	// 	|_ subfolder under no edit permission with edit permission
	noViewPermission, err := folderSvcOn.Create(context.Background(), &folder.CreateFolderCommand{
		OrgID:        orgID,
		ParentUID:    "",
		Title:        "no view permission",
		SignedInUser: &signedInAdminUser,
	})
	require.NoError(t, err)

	f, err := folderSvcOn.Create(context.Background(), &folder.CreateFolderCommand{
		OrgID:        orgID,
		ParentUID:    noViewPermission.UID,
		Title:        "subfolder under no view permission with view permission",
		SignedInUser: &signedInAdminUser,
	})
	viewer.Permissions[orgID][dashboards.ActionFoldersRead] = append(viewer.Permissions[orgID][dashboards.ActionFoldersRead], dashboards.ScopeFoldersProvider.GetResourceScopeUID(f.UID))

	require.NoError(t, err)
	f, err = folderSvcOn.Create(context.Background(), &folder.CreateFolderCommand{
		OrgID:        orgID,
		ParentUID:    noViewPermission.UID,
		Title:        "subfolder under no view permission with view permission and with edit permission",
		SignedInUser: &signedInAdminUser,
	})
	require.NoError(t, err)
	viewer.Permissions[orgID][dashboards.ActionFoldersRead] = append(viewer.Permissions[orgID][dashboards.ActionFoldersRead], dashboards.ScopeFoldersProvider.GetResourceScopeUID(f.UID))
	viewer.Permissions[orgID][dashboards.ActionFoldersWrite] = append(viewer.Permissions[orgID][dashboards.ActionFoldersWrite], dashboards.ScopeFoldersProvider.GetResourceScopeUID(f.UID))

	withEditPermission, err := folderSvcOn.Create(context.Background(), &folder.CreateFolderCommand{
		OrgID:        orgID,
		ParentUID:    "",
		Title:        "with edit permission",
		SignedInUser: &signedInAdminUser,
	})
	require.NoError(t, err)
	viewer.Permissions[orgID][dashboards.ActionFoldersRead] = append(viewer.Permissions[orgID][dashboards.ActionFoldersRead], dashboards.ScopeFoldersProvider.GetResourceScopeUID(withEditPermission.UID))
	viewer.Permissions[orgID][dashboards.ActionFoldersWrite] = append(viewer.Permissions[orgID][dashboards.ActionFoldersWrite], dashboards.ScopeFoldersProvider.GetResourceScopeUID(withEditPermission.UID))

	_, err = folderSvcOn.Create(context.Background(), &folder.CreateFolderCommand{
		OrgID:        orgID,
		ParentUID:    withEditPermission.UID,
		Title:        "subfolder under with edit permission",
		SignedInUser: &signedInAdminUser,
	})
	require.NoError(t, err)

	noEditPermission, err := folderSvcOn.Create(context.Background(), &folder.CreateFolderCommand{
		OrgID:        orgID,
		ParentUID:    "",
		Title:        "no edit permission",
		SignedInUser: &signedInAdminUser,
	})
	require.NoError(t, err)
	viewer.Permissions[orgID][dashboards.ActionFoldersRead] = append(viewer.Permissions[orgID][dashboards.ActionFoldersRead], dashboards.ScopeFoldersProvider.GetResourceScopeUID(noEditPermission.UID))

	_, err = folderSvcOn.Create(context.Background(), &folder.CreateFolderCommand{
		OrgID:        orgID,
		ParentUID:    noEditPermission.UID,
		Title:        "subfolder under no edit permission",
		SignedInUser: &signedInAdminUser,
	})
	require.NoError(t, err)

	f, err = folderSvcOn.Create(context.Background(), &folder.CreateFolderCommand{
		OrgID:        orgID,
		ParentUID:    noEditPermission.UID,
		Title:        "subfolder under no edit permission with edit permission",
		SignedInUser: &signedInAdminUser,
	})
	require.NoError(t, err)
	viewer.Permissions[orgID][dashboards.ActionFoldersWrite] = append(viewer.Permissions[orgID][dashboards.ActionFoldersWrite], dashboards.ScopeFoldersProvider.GetResourceScopeUID(f.UID))

	testCases := []struct {
		name            string
		q               folder.GetChildrenQuery
		expectedErr     error
		expectedFolders []string
	}{
		{
			name: "should return root folders with view permission",
			q: folder.GetChildrenQuery{
				OrgID:        orgID,
				SignedInUser: &viewer,
			},
			expectedFolders: []string{
				"Shared with me",
				"no edit permission",
				"with edit permission",
			},
		},
		{
			name: "should return subfolders with view permission",
			q: folder.GetChildrenQuery{
				OrgID:        orgID,
				SignedInUser: &viewer,
				UID:          noEditPermission.UID,
			},
			expectedFolders: []string{
				"subfolder under no edit permission",
				"subfolder under no edit permission with edit permission",
			},
		},
		{
			name: "should return shared with me folders with view permission",
			q: folder.GetChildrenQuery{
				OrgID:        orgID,
				SignedInUser: &viewer,
				UID:          folder.SharedWithMeFolderUID,
			},
			expectedFolders: []string{
				"subfolder under no view permission with view permission",
				"subfolder under no view permission with view permission and with edit permission",
			},
		},
		{
			name: "should return root folders with edit permission",
			q: folder.GetChildrenQuery{
				OrgID:        orgID,
				SignedInUser: &viewer,
				Permission:   dashboardaccess.PERMISSION_EDIT,
			},
			expectedFolders: []string{
				"Shared with me",
				"with edit permission",
			},
		},
		{
			name: "should fail returning subfolders with edit permission when parent folder has no edit permission",
			q: folder.GetChildrenQuery{
				OrgID:        orgID,
				SignedInUser: &viewer,
				Permission:   dashboardaccess.PERMISSION_EDIT,
				UID:          noEditPermission.UID,
			},
			expectedErr: dashboards.ErrFolderAccessDenied,
		},
		{
			name: "should return shared with me folders with edit permission",
			q: folder.GetChildrenQuery{
				OrgID:        orgID,
				SignedInUser: &viewer,
				Permission:   dashboardaccess.PERMISSION_EDIT,
				UID:          folder.SharedWithMeFolderUID,
			},
			expectedFolders: []string{
				"subfolder under no edit permission with edit permission",
				"subfolder under no view permission with view permission and with edit permission",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			folders, err := folderSvcOn.GetChildren(context.Background(), &tc.q)
			if tc.expectedErr != nil {
				require.Error(t, err)
				require.Equal(t, tc.expectedErr, err)
			} else {
				require.NoError(t, err)
				actual := make([]string, 0, len(folders))
				for _, f := range folders {
					actual = append(actual, f.Title)
				}
				if cmp.Diff(tc.expectedFolders, actual) != "" {
					t.Fatalf("unexpected folders: %s", cmp.Diff(tc.expectedFolders, actual))
				}
			}
		})
	}
}

func TestIntegration_canMove(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	dashStore := &dashboards.FakeDashboardStore{}
	dashboardFolderStore := foldertest.NewFakeFolderStore(t)

	db, cfg := sqlstore.InitTestDB(t)
	folderStore := ProvideStore(db)
	orgID := CreateOrg(t, db, cfg)

	adminUsr := &user.SignedInUser{OrgID: orgID, OrgRole: org.RoleAdmin}

	// Set up source folder and a source folder parent
	sourceParent, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
		UID:          "source-parent",
		OrgID:        orgID,
		Title:        "Source parent",
		SignedInUser: adminUsr,
	})
	require.NoError(t, err)
	sourceFolder, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
		UID:          "source",
		OrgID:        orgID,
		Title:        "Source",
		ParentUID:    sourceParent.UID,
		SignedInUser: adminUsr,
	})
	require.NoError(t, err)

	// Set up destination folder and destination folder parent
	destParent, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
		UID:          "destination-parent",
		OrgID:        orgID,
		Title:        "Destination parent",
		SignedInUser: adminUsr,
	})
	require.NoError(t, err)
	destFolder, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
		UID:          "destination",
		OrgID:        orgID,
		Title:        "Destination",
		ParentUID:    destParent.UID,
		SignedInUser: adminUsr,
	})
	require.NoError(t, err)

	features := featuremgmt.WithFeatures("nestedFolders")
	folderSvc := setup(t, dashStore, dashboardFolderStore, folderStore, features, acimpl.ProvideAccessControl(features), dbtest.NewFakeDB())

	testCases := []struct {
		description       string
		destinationFolder string
		permissions       map[string][]string
		expectedErr       error
	}{
		{
			description:       "can move a folder if has edit access to both folders",
			destinationFolder: destFolder.UID,
			permissions: map[string][]string{
				dashboards.ActionFoldersWrite: {
					dashboards.ScopeFoldersProvider.GetResourceScopeUID(sourceFolder.UID),
					dashboards.ScopeFoldersProvider.GetResourceScopeUID(destFolder.UID),
				},
			},
		},
		{
			description:       "can't move a folder if missing write access to the destination folder",
			destinationFolder: destFolder.UID,
			permissions: map[string][]string{
				dashboards.ActionFoldersWrite: {
					dashboards.ScopeFoldersProvider.GetResourceScopeUID(sourceFolder.UID),
				},
				dashboards.ActionFoldersRead: {
					dashboards.ScopeFoldersProvider.GetResourceScopeUID(destFolder.UID),
				},
			},
			expectedErr: dashboards.ErrMoveAccessDenied,
		},
		{
			description:       "can't move a folder to the root if missing folder create permissions",
			destinationFolder: "",
			permissions: map[string][]string{
				dashboards.ActionFoldersWrite: {
					dashboards.ScopeFoldersProvider.GetResourceScopeUID(sourceFolder.UID),
				},
			},
			expectedErr: dashboards.ErrMoveAccessDenied,
		},
		{
			description:       "can move a folder to the root with folder create permissions",
			destinationFolder: "",
			permissions: map[string][]string{
				dashboards.ActionFoldersCreate: {
					dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.GeneralFolderUID),
					dashboards.ScopeFoldersProvider.GetResourceScopeUID(sourceFolder.UID),
				},
			},
		},
		{
			description:       "can't move a folder to another folder where user has higher plugin permissions",
			destinationFolder: destFolder.UID,
			permissions: map[string][]string{
				dashboards.ActionFoldersWrite: {
					dashboards.ScopeFoldersProvider.GetResourceScopeUID(sourceFolder.UID),
					dashboards.ScopeFoldersProvider.GetResourceScopeUID(destFolder.UID),
				},
				"some_plugin:action": {
					dashboards.ScopeFoldersProvider.GetResourceScopeUID(destFolder.UID),
				},
			},
			expectedErr: dashboards.ErrFolderAccessEscalation,
		},
		{
			description:       "can move a folder to another folder where user has lower permissions",
			destinationFolder: destFolder.UID,
			permissions: map[string][]string{
				dashboards.ActionFoldersWrite: {
					dashboards.ScopeFoldersProvider.GetResourceScopeUID(sourceFolder.UID),
					dashboards.ScopeFoldersProvider.GetResourceScopeUID(destFolder.UID),
				},
				"some_plugin:action": {
					dashboards.ScopeFoldersProvider.GetResourceScopeUID(sourceFolder.UID),
				},
			},
		},
		{
			description:       "can't move a folder to another folder where user has higher plugin permissions through inheritance",
			destinationFolder: destFolder.UID,
			permissions: map[string][]string{
				dashboards.ActionFoldersWrite: {
					dashboards.ScopeFoldersProvider.GetResourceScopeUID(sourceFolder.UID),
					dashboards.ScopeFoldersProvider.GetResourceScopeUID(destFolder.UID),
				},
				"some_plugin:action": {
					dashboards.ScopeFoldersProvider.GetResourceScopeUID(destParent.UID),
				},
			},
			expectedErr: dashboards.ErrFolderAccessEscalation,
		},
	}

	for _, tc := range testCases {
		usr := &user.SignedInUser{UserID: 1, OrgID: orgID, Permissions: map[int64]map[string][]string{}}
		usr.Permissions[orgID] = tc.permissions

		t.Run(tc.description, func(t *testing.T) {
			_, err := folderSvc.Move(context.Background(), &folder.MoveFolderCommand{UID: sourceFolder.UID, NewParentUID: tc.destinationFolder, OrgID: orgID, SignedInUser: usr})
			if tc.expectedErr == nil {
				require.NoError(t, err)
			} else {
				require.ErrorIs(t, err, tc.expectedErr)
			}
		})
	}
}

func TestSupportBundle(t *testing.T) {
	f := func(uid, parent string) *folder.Folder { return &folder.Folder{UID: uid, ParentUID: parent} }
	for _, tc := range []struct {
		Folders          []*folder.Folder
		ExpectedTotal    int
		ExpectedDepths   map[int]int
		ExpectedChildren map[int]int
	}{
		// Empty folder list
		{
			Folders:          []*folder.Folder{},
			ExpectedTotal:    0,
			ExpectedDepths:   map[int]int{},
			ExpectedChildren: map[int]int{},
		},
		// Single folder
		{
			Folders:          []*folder.Folder{f("a", "")},
			ExpectedTotal:    1,
			ExpectedDepths:   map[int]int{1: 1},
			ExpectedChildren: map[int]int{0: 1},
		},
		// Flat folders
		{
			Folders:          []*folder.Folder{f("a", ""), f("b", ""), f("c", "")},
			ExpectedTotal:    3,
			ExpectedDepths:   map[int]int{1: 3},
			ExpectedChildren: map[int]int{0: 3},
		},
		// Nested folders
		{
			Folders:          []*folder.Folder{f("a", ""), f("ab", "a"), f("ac", "a"), f("x", ""), f("xy", "x"), f("xyz", "xy")},
			ExpectedTotal:    6,
			ExpectedDepths:   map[int]int{1: 2, 2: 3, 3: 1},
			ExpectedChildren: map[int]int{0: 3, 1: 2, 2: 1},
		},
	} {
		svc := &Service{}
		supportItem, err := svc.supportItemFromFolders(tc.Folders)
		if err != nil {
			t.Fatal(err)
		}

		stats := struct {
			Total    int         `json:"total"`
			Depths   map[int]int `json:"depths"`
			Children map[int]int `json:"children"`
		}{}
		if err := json.Unmarshal(supportItem.FileBytes, &stats); err != nil {
			t.Fatal(err)
		}

		if stats.Total != tc.ExpectedTotal {
			t.Error("Total mismatch", stats, tc)
		}
		if fmt.Sprint(stats.Depths) != fmt.Sprint(tc.ExpectedDepths) {
			t.Error("Depths mismatch", stats, tc.ExpectedDepths)
		}
		if fmt.Sprint(stats.Children) != fmt.Sprint(tc.ExpectedChildren) {
			t.Error("Depths mismatch", stats, tc.ExpectedChildren)
		}
	}
}

func CreateSubtreeInStore(t *testing.T, store folder.Store, service *Service, depth int, prefix string, cmd folder.CreateFolderCommand, randomUID bool) []*folder.Folder {
	t.Helper()

	folders := make([]*folder.Folder, 0, depth)
	for i := 0; i < depth; i++ {
		title := fmt.Sprintf("%sfolder-%d", prefix, i)
		cmd.Title = title
		cmd.UID = util.GenerateShortUID()
		if !randomUID {
			cmd.UID = fmt.Sprintf("uidfor-%d", i)
		}
		cmd.OrgID = orgID
		cmd.SignedInUser = &user.SignedInUser{OrgID: orgID, Permissions: map[int64]map[string][]string{orgID: {dashboards.ActionFoldersCreate: {dashboards.ScopeFoldersAll}}}}

		f, err := service.Create(context.Background(), &cmd)
		require.NoError(t, err)
		require.Equal(t, title, f.Title)
		require.NotEmpty(t, f.UID)

		folders = append(folders, f)

		cmd.ParentUID = f.UID
	}

	return folders
}

func setup(t *testing.T, dashStore dashboards.Store, dashboardFolderStore folder.FolderStore, nestedFolderStore folder.Store, features featuremgmt.FeatureToggles, ac accesscontrol.AccessControl, db db.DB) folder.Service {
	t.Helper()

	// nothing enabled yet
	return &Service{
		log:                  slog.New(logtest.NewTestHandler(t)).With("logger", "test-folder-service"),
		dashboardStore:       dashStore,
		dashboardFolderStore: dashboardFolderStore,
		store:                nestedFolderStore,
		features:             features,
		accessControl:        ac,
		db:                   db,
		metrics:              newFoldersMetrics(nil),
		tracer:               noop.NewTracerProvider().Tracer("setup"),
	}
}

func createRule(t *testing.T, store *ngstore.DBstore, folderUID, title string) *models.AlertRule {
	t.Helper()
	gen := models.RuleGen
	rule := gen.With(
		gen.WithOrgID(orgID),
		gen.WithTitle(title),
		gen.WithNamespaceUID(folderUID),
		gen.WithIntervalSeconds(10),
	).Generate()
	ids, err := store.InsertAlertRules(context.Background(), nil, []models.AlertRule{rule})
	require.NoError(t, err)

	result, err := store.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{OrgID: orgID, UID: ids[0].UID})
	require.NoError(t, err)
	return result
}

func TestSplitFullpath(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: []string{},
		},
		{
			name:     "root folder",
			input:    "/",
			expected: []string{},
		},
		{
			name:     "single folder",
			input:    "folder",
			expected: []string{"folder"},
		},
		{
			name:     "single folder with leading slash",
			input:    "/folder",
			expected: []string{"folder"},
		},
		{
			name:     "nested folder",
			input:    "folder/subfolder/subsubfolder",
			expected: []string{"folder", "subfolder", "subsubfolder"},
		},
		{
			name:     "escaped slashes",
			input:    "folder\\/with\\/slashes",
			expected: []string{"folder/with/slashes"},
		},
		{
			name:     "nested folder with escaped slashes",
			input:    "folder\\/with\\/slashes/subfolder\\/with\\/slashes",
			expected: []string{"folder/with/slashes", "subfolder/with/slashes"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := SplitFullpath(tt.input)
			assert.Equal(t, tt.expected, actual)
		})
	}
}

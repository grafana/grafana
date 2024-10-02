package libraryelements

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/kinds/librarypanel"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/web"
)

const userInDbName = "user_in_db"
const userInDbAvatar = "/avatar/402d08de060496d6b6874495fe20f5ad"

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestDeleteLibraryPanelsInFolder(t *testing.T) {
	scenarioWithPanel(t, "When an admin tries to delete a folder that contains connected library elements, it should fail",
		func(t *testing.T, sc scenarioContext) {
			dashJSON := map[string]any{
				"panels": []any{
					map[string]any{
						"id": int64(1),
						"gridPos": map[string]any{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]any{
						"id": int64(2),
						"gridPos": map[string]any{
							"h": 6,
							"w": 6,
							"x": 6,
							"y": 0,
						},
						"libraryPanel": map[string]any{
							"uid":  sc.initialResult.Result.UID,
							"name": sc.initialResult.Result.Name,
						},
					},
				},
			}
			dash := dashboards.Dashboard{
				Title: "Testing DeleteLibraryElementsInFolder",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			// nolint:staticcheck
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.ID, sc.folder.UID)
			err := sc.service.ConnectElementsToDashboard(sc.reqContext.Req.Context(), sc.reqContext.SignedInUser, []string{sc.initialResult.Result.UID}, dashInDB.ID)
			require.NoError(t, err)

			err = sc.service.DeleteLibraryElementsInFolder(sc.reqContext.Req.Context(), sc.reqContext.SignedInUser, sc.folder.UID)
			require.EqualError(t, err, model.ErrFolderHasConnectedLibraryElements.Error())
		})

	scenarioWithPanel(t, "When an admin tries to delete a folder uid that doesn't exist, it should fail",
		func(t *testing.T, sc scenarioContext) {
			err := sc.service.DeleteLibraryElementsInFolder(sc.reqContext.Req.Context(), sc.reqContext.SignedInUser, sc.folder.UID+"xxxx")
			require.EqualError(t, err, dashboards.ErrFolderNotFound.Error())
		})

	scenarioWithPanel(t, "When an admin tries to delete a folder that contains disconnected elements, it should delete all disconnected elements too",
		func(t *testing.T, sc scenarioContext) {
			// nolint:staticcheck
			command := getCreateVariableCommand(sc.folder.ID, sc.folder.UID, "query0")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
			var result libraryElementsSearch
			err := json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			require.NotNil(t, result.Result)
			require.Equal(t, 2, len(result.Result.Elements))

			err = sc.service.DeleteLibraryElementsInFolder(sc.reqContext.Req.Context(), sc.reqContext.SignedInUser, sc.folder.UID)
			require.NoError(t, err)
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			require.NotNil(t, result.Result)
			require.Equal(t, 0, len(result.Result.Elements))
		})
}

func TestGetLibraryPanelConnections(t *testing.T) {
	scenarioWithPanel(t, "When an admin tries to get connections of library panel, it should succeed and return correct result",
		func(t *testing.T, sc scenarioContext) {
			dashJSON := map[string]any{
				"panels": []any{
					map[string]any{
						"id": int64(1),
						"gridPos": map[string]any{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]any{
						"id": int64(2),
						"gridPos": map[string]any{
							"h": 6,
							"w": 6,
							"x": 6,
							"y": 0,
						},
						"libraryPanel": map[string]any{
							"uid":  sc.initialResult.Result.UID,
							"name": sc.initialResult.Result.Name,
						},
					},
				},
			}
			dash := dashboards.Dashboard{
				Title: "Testing GetLibraryPanelConnections",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			// nolint:staticcheck
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.ID, sc.folder.UID)
			err := sc.service.ConnectElementsToDashboard(sc.reqContext.Req.Context(), sc.reqContext.SignedInUser, []string{sc.initialResult.Result.UID}, dashInDB.ID)
			require.NoError(t, err)

			var expected = func(res model.LibraryElementConnectionsResponse) model.LibraryElementConnectionsResponse {
				return model.LibraryElementConnectionsResponse{
					Result: []model.LibraryElementConnectionDTO{
						{
							ID:            sc.initialResult.Result.ID,
							Kind:          sc.initialResult.Result.Kind,
							ElementID:     1,
							ConnectionID:  dashInDB.ID,
							ConnectionUID: dashInDB.UID,
							Created:       res.Result[0].Created,
							CreatedBy: librarypanel.LibraryElementDTOMetaUser{
								Id:        1,
								Name:      userInDbName,
								AvatarUrl: userInDbAvatar,
							},
						},
					},
				}
			}

			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.getConnectionsHandler(sc.reqContext)
			var result = validateAndUnMarshalConnectionResponse(t, resp)

			if diff := cmp.Diff(expected(result), result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})
}

type libraryElement struct {
	ID    int64 `json:"id"`
	OrgID int64 `json:"orgId"`
	// Deprecated: use FolderUID instead
	FolderID    int64                       `json:"folderId"`
	FolderUID   string                      `json:"folderUid"`
	UID         string                      `json:"uid"`
	Name        string                      `json:"name"`
	Kind        int64                       `json:"kind"`
	Type        string                      `json:"type"`
	Description string                      `json:"description"`
	Model       map[string]any              `json:"model"`
	Version     int64                       `json:"version"`
	Meta        model.LibraryElementDTOMeta `json:"meta"`
}

type libraryElementResult struct {
	Result libraryElement `json:"result"`
}

type libraryElementArrayResult struct {
	Result []libraryElement `json:"result"`
}

type libraryElementsSearch struct {
	Result libraryElementsSearchResult `json:"result"`
}

type libraryElementsSearchResult struct {
	TotalCount int64            `json:"totalCount"`
	Elements   []libraryElement `json:"elements"`
	Page       int              `json:"page"`
	PerPage    int              `json:"perPage"`
}

func getCreatePanelCommand(folderID int64, folderUID string, name string) model.CreateLibraryElementCommand {
	command := getCreateCommandWithModel(folderID, folderUID, name, model.PanelElement, []byte(`
			{
			  "datasource": "${DS_GDEV-TESTDATA}",
			  "id": 1,
			  "title": "Text - Library Panel",
			  "type": "text",
			  "description": "A description"
			}
		`))

	return command
}

func getCreateVariableCommand(folderID int64, folderUID, name string) model.CreateLibraryElementCommand {
	command := getCreateCommandWithModel(folderID, folderUID, name, model.VariableElement, []byte(`
			{
			  "datasource": "${DS_GDEV-TESTDATA}",
			  "name": "query0",
			  "type": "query",
			  "description": "A description"
			}
		`))

	return command
}

func getCreateCommandWithModel(folderID int64, folderUID, name string, kind model.LibraryElementKind, byteModel []byte) model.CreateLibraryElementCommand {
	command := model.CreateLibraryElementCommand{
		FolderUID: &folderUID,
		Name:      name,
		Model:     byteModel,
		Kind:      int64(kind),
	}

	return command
}

type scenarioContext struct {
	ctx           *web.Context
	service       *LibraryElementService
	reqContext    *contextmodel.ReqContext
	user          user.SignedInUser
	folder        *folder.Folder
	initialResult libraryElementResult
	sqlStore      db.DB
	log           log.Logger
}

func createDashboard(t *testing.T, sqlStore db.DB, user user.SignedInUser, dash *dashboards.Dashboard, folderID int64, folderUID string) *dashboards.Dashboard {
	// nolint:staticcheck
	dash.FolderID = folderID
	dash.FolderUID = folderUID
	dashItem := &dashboards.SaveDashboardDTO{
		Dashboard: dash,
		Message:   "",
		OrgID:     user.OrgID,
		User:      &user,
		Overwrite: false,
	}

	features := featuremgmt.WithFeatures()
	cfg := setting.NewCfg()
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, features, tagimpl.ProvideService(sqlStore), quotaService)
	require.NoError(t, err)
	ac := actest.FakeAccessControl{ExpectedEvaluate: true}
	folderPermissions := acmock.NewMockedPermissionsService()
	dashboardPermissions := acmock.NewMockedPermissionsService()
	dashboardPermissions.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
	service, err := dashboardservice.ProvideDashboardServiceImpl(
		cfg, dashboardStore, folderStore,
		features, folderPermissions, dashboardPermissions, ac,
		foldertest.NewFakeService(),
		folder.NewFakeStore(),
		nil,
	)
	require.NoError(t, err)
	dashboard, err := service.SaveDashboard(context.Background(), dashItem, true)
	require.NoError(t, err)

	return dashboard
}

func createFolder(t *testing.T, sc scenarioContext, title string) *folder.Folder {
	t.Helper()

	features := featuremgmt.WithFeatures()
	cfg := setting.NewCfg()
	ac := actest.FakeAccessControl{ExpectedEvaluate: true}
	folderPermissions := acmock.NewMockedPermissionsService()
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := database.ProvideDashboardStore(sc.sqlStore, cfg, features, tagimpl.ProvideService(sc.sqlStore), quotaService)
	require.NoError(t, err)

	folderStore := folderimpl.ProvideDashboardFolderStore(sc.sqlStore)
	store := folderimpl.ProvideStore(sc.sqlStore)
	s := folderimpl.ProvideService(store, ac, bus.ProvideBus(tracing.InitializeTracerForTest()), dashboardStore, folderStore, sc.sqlStore,
		features, cfg, folderPermissions, supportbundlestest.NewFakeBundleService(), nil, tracing.InitializeTracerForTest())
	t.Logf("Creating folder with title and UID %q", title)
	ctx := identity.WithRequester(context.Background(), &sc.user)
	folder, err := s.Create(ctx, &folder.CreateFolderCommand{
		OrgID: sc.user.OrgID, Title: title, UID: title, SignedInUser: &sc.user,
	})
	require.NoError(t, err)

	// Set user permissions on the newly created folder so that they can interact with library elements stored in it
	sc.reqContext.SignedInUser.Permissions[sc.user.OrgID][dashboards.ActionFoldersWrite] = append(sc.reqContext.SignedInUser.Permissions[sc.user.OrgID][dashboards.ActionFoldersWrite], dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.UID))
	sc.reqContext.SignedInUser.Permissions[sc.user.OrgID][dashboards.ActionFoldersRead] = append(sc.reqContext.SignedInUser.Permissions[sc.user.OrgID][dashboards.ActionFoldersRead], dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.UID))
	sc.reqContext.SignedInUser.Permissions[sc.user.OrgID][dashboards.ActionDashboardsCreate] = append(sc.reqContext.SignedInUser.Permissions[sc.user.OrgID][dashboards.ActionDashboardsCreate], dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.UID))

	return folder
}

func validateAndUnMarshalResponse(t *testing.T, resp response.Response) libraryElementResult {
	t.Helper()

	require.Equal(t, 200, resp.Status())

	var result = libraryElementResult{}
	err := json.Unmarshal(resp.Body(), &result)
	require.NoError(t, err)

	return result
}

func validateAndUnMarshalConnectionResponse(t *testing.T, resp response.Response) model.LibraryElementConnectionsResponse {
	t.Helper()
	require.Equal(t, 200, resp.Status())
	var result = model.LibraryElementConnectionsResponse{}
	err := json.Unmarshal(resp.Body(), &result)
	require.NoError(t, err)
	return result
}

func validateAndUnMarshalArrayResponse(t *testing.T, resp response.Response) libraryElementArrayResult {
	t.Helper()

	require.Equal(t, 200, resp.Status())
	var result = libraryElementArrayResult{}
	err := json.Unmarshal(resp.Body(), &result)
	require.NoError(t, err)

	return result
}

func scenarioWithPanel(t *testing.T, desc string, fn func(t *testing.T, sc scenarioContext)) {
	t.Helper()

	features := featuremgmt.WithFeatures()
	sqlStore, cfg := db.InitTestDBWithCfg(t)
	ac := actest.FakeAccessControl{}
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, features, tagimpl.ProvideService(sqlStore), quotaService)
	require.NoError(t, err)
	folderPermissions := acmock.NewMockedPermissionsService()
	dashboardPermissions := acmock.NewMockedPermissionsService()
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
	dashboardService, svcErr := dashboardservice.ProvideDashboardServiceImpl(
		cfg, dashboardStore, folderStore,
		features, folderPermissions, dashboardPermissions, ac,
		foldertest.NewFakeService(), folder.NewFakeStore(),
		nil,
	)
	require.NoError(t, svcErr)
	guardian.InitAccessControlGuardian(cfg, ac, dashboardService)

	testScenario(t, desc, func(t *testing.T, sc scenarioContext) {
		// nolint:staticcheck
		command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Text - Library Panel")
		sc.reqContext.Req.Body = mockRequestBody(command)
		resp := sc.service.createHandler(sc.reqContext)
		sc.initialResult = validateAndUnMarshalResponse(t, resp)
		sc.log = log.New("libraryelements-test")

		fn(t, sc)
	})
}

// testScenario is a wrapper around t.Run performing common setup for library panel tests.
// It takes your real test function as a callback.
func testScenario(t *testing.T, desc string, fn func(t *testing.T, sc scenarioContext)) {
	t.Helper()

	t.Run(desc, func(t *testing.T) {
		orgID := int64(1)
		role := org.RoleAdmin
		usr := user.SignedInUser{
			UserID:     1,
			Name:       "Signed In User",
			Login:      "signed_in_user",
			Email:      "signed.in.user@test.com",
			OrgID:      orgID,
			OrgRole:    role,
			LastSeenAt: time.Now(),
			// Allow user to create folders
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionFoldersCreate: {dashboards.ScopeFoldersAll}},
			},
		}
		req := &http.Request{
			Header: http.Header{
				"Content-Type": []string{"application/json"},
			},
		}
		ctx := identity.WithRequester(context.Background(), &usr)
		req = req.WithContext(ctx)
		webCtx := web.Context{Req: req}

		features := featuremgmt.WithFeatures()
		tracer := tracing.InitializeTracerForTest()
		sqlStore, cfg := db.InitTestDBWithCfg(t)
		quotaService := quotatest.New(false, nil)
		dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, features, tagimpl.ProvideService(sqlStore), quotaService)
		require.NoError(t, err)
		ac := acimpl.ProvideAccessControl(features, zanzana.NewNoopClient())
		folderPermissions := acmock.NewMockedPermissionsService()
		folderPermissions.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)
		dashboardPermissions := acmock.NewMockedPermissionsService()
		folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
		dashService, dashSvcErr := dashboardservice.ProvideDashboardServiceImpl(
			cfg, dashboardStore, folderStore,
			features, folderPermissions, dashboardPermissions, ac,
			foldertest.NewFakeService(), folder.NewFakeStore(),
			nil,
		)
		require.NoError(t, dashSvcErr)
		guardian.InitAccessControlGuardian(cfg, ac, dashService)
		fStore := folderimpl.ProvideStore(sqlStore)
		folderSrv := folderimpl.ProvideService(fStore, ac, bus.ProvideBus(tracer), dashboardStore, folderStore, sqlStore,
			features, cfg, folderPermissions, supportbundlestest.NewFakeBundleService(), nil, tracing.InitializeTracerForTest())
		service := LibraryElementService{
			Cfg:           cfg,
			features:      featuremgmt.WithFeatures(),
			SQLStore:      sqlStore,
			folderService: folderSrv,
		}

		// deliberate difference between signed in user and user in db to make it crystal clear
		// what to expect in the tests
		// In the real world these are identical
		cmd := user.CreateUserCommand{
			Email: "user.in.db@test.com",
			Name:  "User In DB",
			Login: userInDbName,
		}
		orgSvc, err := orgimpl.ProvideService(sqlStore, cfg, quotaService)
		require.NoError(t, err)
		usrSvc, err := userimpl.ProvideService(
			sqlStore, orgSvc, cfg, nil, nil, tracer,
			quotaService, supportbundlestest.NewFakeBundleService(),
		)
		require.NoError(t, err)
		_, err = usrSvc.Create(context.Background(), &cmd)
		require.NoError(t, err)

		sc := scenarioContext{
			user:     usr,
			ctx:      &webCtx,
			service:  &service,
			sqlStore: sqlStore,
			reqContext: &contextmodel.ReqContext{
				Context:      &webCtx,
				SignedInUser: &usr,
			},
		}

		sc.folder = createFolder(t, sc, "ScenarioFolder")

		fn(t, sc)
	})
}

func getCompareOptions() []cmp.Option {
	return []cmp.Option{
		cmp.Transformer("Time", func(in time.Time) int64 {
			return in.UTC().Unix()
		}),
	}
}

func mockRequestBody(v any) io.ReadCloser {
	b, _ := json.Marshal(v)
	return io.NopCloser(bytes.NewReader(b))
}

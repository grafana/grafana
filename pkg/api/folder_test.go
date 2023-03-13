package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestFoldersAPIEndpoint(t *testing.T) {
	folderService := &foldertest.FakeService{}

	t.Run("Given a correct request for creating a folder", func(t *testing.T) {
		cmd := folder.CreateFolderCommand{
			UID:   "uid",
			Title: "Folder",
		}

		folderService.ExpectedFolder = &folder.Folder{ID: 1, UID: "uid", Title: "Folder"}

		createFolderScenario(t, "When calling POST on", "/api/folders", "/api/folders", folderService, cmd,
			func(sc *scenarioContext) {
				callCreateFolder(sc)

				folder := dtos.Folder{}
				err := json.NewDecoder(sc.resp.Body).Decode(&folder)
				require.NoError(t, err)
				assert.Equal(t, int64(1), folder.Id)
				assert.Equal(t, "uid", folder.Uid)
				assert.Equal(t, "Folder", folder.Title)
			})
	})

	t.Run("Given incorrect requests for creating a folder", func(t *testing.T) {
		t.Cleanup(func() {
			folderService.ExpectedError = nil
		})
		testCases := []struct {
			Error              error
			ExpectedStatusCode int
		}{
			{Error: dashboards.ErrFolderWithSameUIDExists, ExpectedStatusCode: 409},
			{Error: dashboards.ErrFolderTitleEmpty, ExpectedStatusCode: 400},
			{Error: dashboards.ErrFolderSameNameExists, ExpectedStatusCode: 409},
			{Error: dashboards.ErrDashboardInvalidUid, ExpectedStatusCode: 400},
			{Error: dashboards.ErrDashboardUidTooLong, ExpectedStatusCode: 400},
			{Error: dashboards.ErrFolderAccessDenied, ExpectedStatusCode: 403},
			{Error: dashboards.ErrFolderNotFound, ExpectedStatusCode: 404},
			{Error: dashboards.ErrFolderVersionMismatch, ExpectedStatusCode: 412},
		}

		cmd := folder.CreateFolderCommand{
			UID:   "uid",
			Title: "Folder",
		}

		for _, tc := range testCases {
			folderService.ExpectedError = tc.Error

			createFolderScenario(t, fmt.Sprintf("Expect '%s' error when calling POST on", tc.Error.Error()),
				"/api/folders", "/api/folders", folderService, cmd, func(sc *scenarioContext) {
					callCreateFolder(sc)
					assert.Equalf(t, tc.ExpectedStatusCode, sc.resp.Code, "Wrong status code for error %s", tc.Error)
				})
		}
	})

	t.Run("Given a correct request for updating a folder", func(t *testing.T) {
		title := "Folder upd"
		cmd := folder.UpdateFolderCommand{
			NewTitle: &title,
		}

		folderService.ExpectedFolder = &folder.Folder{ID: 1, UID: "uid", Title: "Folder upd"}

		updateFolderScenario(t, "When calling PUT on", "/api/folders/uid", "/api/folders/:uid", folderService, cmd,
			func(sc *scenarioContext) {
				callUpdateFolder(sc)

				folder := dtos.Folder{}
				err := json.NewDecoder(sc.resp.Body).Decode(&folder)
				require.NoError(t, err)
				assert.Equal(t, int64(1), folder.Id)
				assert.Equal(t, "uid", folder.Uid)
				assert.Equal(t, "Folder upd", folder.Title)
			})
	})

	t.Run("Given incorrect requests for updating a folder", func(t *testing.T) {
		testCases := []struct {
			Error              error
			ExpectedStatusCode int
		}{
			{Error: dashboards.ErrFolderWithSameUIDExists, ExpectedStatusCode: 409},
			{Error: dashboards.ErrFolderTitleEmpty, ExpectedStatusCode: 400},
			{Error: dashboards.ErrFolderSameNameExists, ExpectedStatusCode: 409},
			{Error: dashboards.ErrDashboardInvalidUid, ExpectedStatusCode: 400},
			{Error: dashboards.ErrDashboardUidTooLong, ExpectedStatusCode: 400},
			{Error: dashboards.ErrFolderAccessDenied, ExpectedStatusCode: 403},
			{Error: dashboards.ErrFolderNotFound, ExpectedStatusCode: 404},
			{Error: dashboards.ErrFolderVersionMismatch, ExpectedStatusCode: 412},
		}

		title := "Folder upd"
		cmd := folder.UpdateFolderCommand{
			NewTitle: &title,
		}

		for _, tc := range testCases {
			folderService.ExpectedError = tc.Error
			updateFolderScenario(t, fmt.Sprintf("Expect '%s' error when calling PUT on", tc.Error.Error()),
				"/api/folders/uid", "/api/folders/:uid", folderService, cmd, func(sc *scenarioContext) {
					callUpdateFolder(sc)
					assert.Equalf(t, tc.ExpectedStatusCode, sc.resp.Code, "Wrong status code for %s", tc.Error)
				})
		}
	})
}

func TestHTTPServer_FolderMetadata(t *testing.T) {
	setUpRBACGuardian(t)
	folderService := &foldertest.FakeService{}
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.folderService = folderService
		hs.AccessControl = acmock.New()
		hs.QuotaService = quotatest.New(false, nil)
		hs.SearchService = &mockSearchService{
			ExpectedResult: model.HitList{},
		}
	})

	t.Run("Should attach access control metadata to multiple folders", func(t *testing.T) {
		folderService.ExpectedFolders = []*folder.Folder{{UID: "1"}, {UID: "2"}, {UID: "3"}}

		req := server.NewGetRequest("/api/folders?accesscontrol=true")
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{
			1: accesscontrol.GroupScopesByAction([]accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersAll},
				{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID("2")},
			}),
		}})

		res, err := server.Send(req)
		require.NoError(t, err)
		defer func() { require.NoError(t, res.Body.Close()) }()
		assert.Equal(t, http.StatusOK, res.StatusCode)

		body := []dtos.FolderSearchHit{}
		require.NoError(t, json.NewDecoder(res.Body).Decode(&body))

		for _, f := range body {
			assert.True(t, f.AccessControl[dashboards.ActionFoldersRead])
			if f.Uid == "2" {
				assert.True(t, f.AccessControl[dashboards.ActionFoldersWrite])
			} else {
				assert.False(t, f.AccessControl[dashboards.ActionFoldersWrite])
			}
		}
	})

	t.Run("Should attach access control metadata to folder response", func(t *testing.T) {
		folderService.ExpectedFolder = &folder.Folder{UID: "folderUid"}

		req := server.NewGetRequest("/api/folders/folderUid?accesscontrol=true")
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{
			1: accesscontrol.GroupScopesByAction([]accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersAll},
				{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID("folderUid")},
			}),
		}})

		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		defer func() { require.NoError(t, res.Body.Close()) }()

		body := dtos.Folder{}
		require.NoError(t, json.NewDecoder(res.Body).Decode(&body))

		assert.True(t, body.AccessControl[dashboards.ActionFoldersRead])
		assert.True(t, body.AccessControl[dashboards.ActionFoldersWrite])
	})

	t.Run("Should attach access control metadata to folder response", func(t *testing.T) {
		folderService.ExpectedFolder = &folder.Folder{UID: "folderUid"}

		req := server.NewGetRequest("/api/folders/folderUid")
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{
			1: accesscontrol.GroupScopesByAction([]accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersAll},
				{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID("folderUid")},
			}),
		}})

		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		defer func() { require.NoError(t, res.Body.Close()) }()

		body := dtos.Folder{}
		require.NoError(t, json.NewDecoder(res.Body).Decode(&body))

		assert.False(t, body.AccessControl[dashboards.ActionFoldersRead])
		assert.False(t, body.AccessControl[dashboards.ActionFoldersWrite])
	})
}

func callCreateFolder(sc *scenarioContext) {
	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func createFolderScenario(t *testing.T, desc string, url string, routePattern string, folderService folder.Service,
	cmd folder.CreateFolderCommand, fn scenarioFunc) {
	setUpRBACGuardian(t)
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		aclMockResp := []*dashboards.DashboardACLInfoDTO{}
		teamSvc := &teamtest.FakeService{}
		dashSvc := &dashboards.FakeDashboardService{}
		qResult1 := aclMockResp
		dashSvc.On("GetDashboardACLInfoList", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardACLInfoListQuery")).Return(qResult1, nil)
		qResult := &dashboards.Dashboard{}
		dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(qResult, nil)
		store := dbtest.NewFakeDB()
		guardian.InitLegacyGuardian(store, dashSvc, teamSvc)
		folderPermissions := acmock.NewMockedPermissionsService()
		folderPermissions.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)
		hs := HTTPServer{
			AccessControl:            acmock.New(),
			folderService:            folderService,
			Cfg:                      setting.NewCfg(),
			Features:                 featuremgmt.WithFeatures(),
			accesscontrolService:     actest.FakeService{},
			folderPermissionsService: folderPermissions,
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.SignedInUser = &user.SignedInUser{OrgID: testOrgID, UserID: testUserID}

			return hs.CreateFolder(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func callUpdateFolder(sc *scenarioContext) {
	sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
}

func updateFolderScenario(t *testing.T, desc string, url string, routePattern string, folderService folder.Service,
	cmd folder.UpdateFolderCommand, fn scenarioFunc) {
	setUpRBACGuardian(t)
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := HTTPServer{
			Cfg:           setting.NewCfg(),
			AccessControl: acmock.New(),
			folderService: folderService,
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.SignedInUser = &user.SignedInUser{OrgID: testOrgID, UserID: testUserID}

			return hs.UpdateFolder(c)
		})

		sc.m.Put(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

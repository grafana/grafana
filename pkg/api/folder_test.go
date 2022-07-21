package api

import (
	"context"
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
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestFoldersAPIEndpoint(t *testing.T) {
	folderService := &dashboards.FakeFolderService{}
	defer folderService.AssertExpectations(t)

	t.Run("Given a correct request for creating a folder", func(t *testing.T) {
		cmd := models.CreateFolderCommand{
			Uid:   "uid",
			Title: "Folder",
		}

		folderResult := &models.Folder{Id: 1, Uid: "uid", Title: "Folder"}
		folderService.On("CreateFolder", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(folderResult, nil).Once()

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
			{Error: dashboards.ErrFolderFailedGenerateUniqueUid, ExpectedStatusCode: 500},
		}

		cmd := models.CreateFolderCommand{
			Uid:   "uid",
			Title: "Folder",
		}

		for _, tc := range testCases {
			folderService.On("CreateFolder", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, tc.Error).Once()

			createFolderScenario(t, fmt.Sprintf("Expect '%s' error when calling POST on", tc.Error.Error()),
				"/api/folders", "/api/folders", folderService, cmd, func(sc *scenarioContext) {
					callCreateFolder(sc)
					assert.Equalf(t, tc.ExpectedStatusCode, sc.resp.Code, "Wrong status code for error %s", tc.Error)
				})
		}
	})

	t.Run("Given a correct request for updating a folder", func(t *testing.T) {
		cmd := models.UpdateFolderCommand{
			Title: "Folder upd",
		}

		folderService.On("UpdateFolder", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			cmd := args.Get(4).(*models.UpdateFolderCommand)
			cmd.Result = &models.Folder{Id: 1, Uid: "uid", Title: "Folder upd"}
		}).Return(nil).Once()

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
			{Error: dashboards.ErrFolderFailedGenerateUniqueUid, ExpectedStatusCode: 500},
		}

		cmd := models.UpdateFolderCommand{
			Title: "Folder upd",
		}

		for _, tc := range testCases {
			folderService.On("UpdateFolder", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(tc.Error).Once()
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
	folderService := dashboards.NewFakeFolderService(t)
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.folderService = folderService
		hs.AccessControl = acmock.New()
		hs.QuotaService = quotatest.NewQuotaServiceFake()
	})

	t.Run("Should attach access control metadata to multiple folders", func(t *testing.T) {
		folderService.On("GetFolders", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]*models.Folder{
			{Uid: "1"},
			{Uid: "2"},
			{Uid: "3"},
		}, nil)

		req := server.NewGetRequest("/api/folders?accesscontrol=true")
		webtest.RequestWithSignedInUser(req, &models.SignedInUser{UserId: 1, OrgId: 1, Permissions: map[int64]map[string][]string{
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
		folderService.On("GetFolderByUID", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&models.Folder{Uid: "folderUid"}, nil)

		req := server.NewGetRequest("/api/folders/folderUid?accesscontrol=true")
		webtest.RequestWithSignedInUser(req, &models.SignedInUser{UserId: 1, OrgId: 1, Permissions: map[int64]map[string][]string{
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
		folderService.On("GetFolderByUID", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&models.Folder{Uid: "folderUid"}, nil)

		req := server.NewGetRequest("/api/folders/folderUid")
		webtest.RequestWithSignedInUser(req, &models.SignedInUser{UserId: 1, OrgId: 1, Permissions: map[int64]map[string][]string{
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

func createFolderScenario(t *testing.T, desc string, url string, routePattern string, folderService dashboards.FolderService,
	cmd models.CreateFolderCommand, fn scenarioFunc) {
	setUpRBACGuardian(t)
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		aclMockResp := []*models.DashboardACLInfoDTO{}
		dashSvc := &dashboards.FakeDashboardService{}
		dashSvc.On("GetDashboardACLInfoList", mock.Anything, mock.AnythingOfType("*models.GetDashboardACLInfoListQuery")).Run(func(args mock.Arguments) {
			q := args.Get(1).(*models.GetDashboardACLInfoListQuery)
			q.Result = aclMockResp
		}).Return(nil)
		store := mockstore.NewSQLStoreMock()
		guardian.InitLegacyGuardian(store, dashSvc)
		hs := HTTPServer{
			AccessControl: acmock.New(),
			folderService: folderService,
			Cfg:           setting.NewCfg(),
			Features:      featuremgmt.WithFeatures(),
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.SignedInUser = &models.SignedInUser{OrgId: testOrgID, UserId: testUserID}

			return hs.CreateFolder(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func callUpdateFolder(sc *scenarioContext) {
	sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
}

func updateFolderScenario(t *testing.T, desc string, url string, routePattern string, folderService dashboards.FolderService,
	cmd models.UpdateFolderCommand, fn scenarioFunc) {
	setUpRBACGuardian(t)
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := HTTPServer{
			Cfg:           setting.NewCfg(),
			AccessControl: acmock.New(),
			folderService: folderService,
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.SignedInUser = &models.SignedInUser{OrgId: testOrgID, UserId: testUserID}

			return hs.UpdateFolder(c)
		})

		sc.m.Put(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

type fakeFolderService struct {
	dashboards.FolderService

	GetFoldersResult     []*models.Folder
	GetFoldersError      error
	GetFolderByUIDResult *models.Folder
	GetFolderByUIDError  error
	GetFolderByIDResult  *models.Folder
	GetFolderByIDError   error
	CreateFolderResult   *models.Folder
	CreateFolderError    error
	UpdateFolderResult   *models.Folder
	UpdateFolderError    error
	DeleteFolderResult   *models.Folder
	DeleteFolderError    error
	DeletedFolderUids    []string
}

func (s *fakeFolderService) GetFolders(ctx context.Context, user *models.SignedInUser, orgID int64, limit int64, page int64) ([]*models.Folder, error) {
	return s.GetFoldersResult, s.GetFoldersError
}

func (s *fakeFolderService) GetFolderByID(ctx context.Context, user *models.SignedInUser, id int64, orgID int64) (*models.Folder, error) {
	return s.GetFolderByIDResult, s.GetFolderByIDError
}

func (s *fakeFolderService) GetFolderByUID(ctx context.Context, user *models.SignedInUser, orgID int64, uid string) (*models.Folder, error) {
	return s.GetFolderByUIDResult, s.GetFolderByUIDError
}

func (s *fakeFolderService) CreateFolder(ctx context.Context, user *models.SignedInUser, orgID int64, title, uid string) (*models.Folder, error) {
	return s.CreateFolderResult, s.CreateFolderError
}

func (s *fakeFolderService) UpdateFolder(ctx context.Context, user *models.SignedInUser, orgID int64, existingUid string, cmd *models.UpdateFolderCommand) error {
	cmd.Result = s.UpdateFolderResult
	return s.UpdateFolderError
}

func (s *fakeFolderService) DeleteFolder(ctx context.Context, user *models.SignedInUser, orgID int64, uid string, forceDeleteRules bool) (*models.Folder, error) {
	s.DeletedFolderUids = append(s.DeletedFolderUids, uid)
	return s.DeleteFolderResult, s.DeleteFolderError
}

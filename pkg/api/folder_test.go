package api

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
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
			{Error: models.ErrFolderWithSameUIDExists, ExpectedStatusCode: 409},
			{Error: models.ErrFolderTitleEmpty, ExpectedStatusCode: 400},
			{Error: models.ErrFolderSameNameExists, ExpectedStatusCode: 409},
			{Error: models.ErrDashboardInvalidUid, ExpectedStatusCode: 400},
			{Error: models.ErrDashboardUidTooLong, ExpectedStatusCode: 400},
			{Error: models.ErrFolderAccessDenied, ExpectedStatusCode: 403},
			{Error: models.ErrFolderNotFound, ExpectedStatusCode: 404},
			{Error: models.ErrFolderVersionMismatch, ExpectedStatusCode: 412},
			{Error: models.ErrFolderFailedGenerateUniqueUid, ExpectedStatusCode: 500},
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
			{Error: models.ErrFolderWithSameUIDExists, ExpectedStatusCode: 409},
			{Error: models.ErrFolderTitleEmpty, ExpectedStatusCode: 400},
			{Error: models.ErrFolderSameNameExists, ExpectedStatusCode: 409},
			{Error: models.ErrDashboardInvalidUid, ExpectedStatusCode: 400},
			{Error: models.ErrDashboardUidTooLong, ExpectedStatusCode: 400},
			{Error: models.ErrFolderAccessDenied, ExpectedStatusCode: 403},
			{Error: models.ErrFolderNotFound, ExpectedStatusCode: 404},
			{Error: models.ErrFolderVersionMismatch, ExpectedStatusCode: 412},
			{Error: models.ErrFolderFailedGenerateUniqueUid, ExpectedStatusCode: 500},
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

func callCreateFolder(sc *scenarioContext) {
	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func createFolderScenario(t *testing.T, desc string, url string, routePattern string, folderService dashboards.FolderService,
	cmd models.CreateFolderCommand, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := HTTPServer{
			Cfg:           setting.NewCfg(),
			folderService: folderService,
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
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := HTTPServer{
			Cfg:           setting.NewCfg(),
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

package api

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestFoldersAPIEndpoint(t *testing.T) {
	folderService := &dashboards.MockFolderService{}
	defer folderService.AssertExpectations(t)

	t.Run("Given a correct request for creating a folder", func(t *testing.T) {
		cmd := dashboards.CreateFolderCommand{
			Uid:   "uid",
			Title: "Folder",
		}

		folderResult := &dashboards.Folder{Id: 1, Uid: "uid", Title: "Folder"}
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

		cmd := dashboards.CreateFolderCommand{
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
		cmd := dashboards.UpdateFolderCommand{
			Title: "Folder upd",
		}

		folderService.On("UpdateFolder", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			cmd := args.Get(4).(*dashboards.UpdateFolderCommand)
			cmd.Result = &dashboards.Folder{Id: 1, Uid: "uid", Title: "Folder upd"}
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

		cmd := dashboards.UpdateFolderCommand{
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
	cmd dashboards.CreateFolderCommand, fn scenarioFunc) {
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
	cmd dashboards.UpdateFolderCommand, fn scenarioFunc) {
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

type MockFolderService struct {
	dashboards.FolderService

	GetFoldersResult     []*dashboards.Folder
	GetFoldersError      error
	GetFolderByUIDResult *dashboards.Folder
	GetFolderByUIDError  error
	GetFolderByIDResult  *dashboards.Folder
	GetFolderByIDError   error
	CreateFolderResult   *dashboards.Folder
	CreateFolderError    error
	UpdateFolderResult   *dashboards.Folder
	UpdateFolderError    error
	DeleteFolderResult   *dashboards.Folder
	DeleteFolderError    error
	DeletedFolderUids    []string
}

func (s *MockFolderService) GetFolders(ctx context.Context, user *models.SignedInUser, orgID int64, limit int64, page int64) ([]*dashboards.Folder, error) {
	return s.GetFoldersResult, s.GetFoldersError
}

func (s *MockFolderService) GetFolderByID(ctx context.Context, user *models.SignedInUser, id int64, orgID int64) (*dashboards.Folder, error) {
	return s.GetFolderByIDResult, s.GetFolderByIDError
}

func (s *MockFolderService) GetFolderByUID(ctx context.Context, user *models.SignedInUser, orgID int64, uid string) (*dashboards.Folder, error) {
	return s.GetFolderByUIDResult, s.GetFolderByUIDError
}

func (s *MockFolderService) CreateFolder(ctx context.Context, user *models.SignedInUser, orgID int64, title, uid string) (*dashboards.Folder, error) {
	return s.CreateFolderResult, s.CreateFolderError
}

func (s *MockFolderService) UpdateFolder(ctx context.Context, user *models.SignedInUser, orgID int64, existingUid string, cmd *dashboards.UpdateFolderCommand) error {
	cmd.Result = s.UpdateFolderResult
	return s.UpdateFolderError
}

func (s *MockFolderService) DeleteFolder(ctx context.Context, user *models.SignedInUser, orgID int64, uid string, forceDeleteRules bool) (*dashboards.Folder, error) {
	s.DeletedFolderUids = append(s.DeletedFolderUids, uid)
	return s.DeleteFolderResult, s.DeleteFolderError
}

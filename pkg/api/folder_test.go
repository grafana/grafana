package api

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/setting"

	. "github.com/smartystreets/goconvey/convey"
)

func TestFoldersApiEndpoint(t *testing.T) {
	Convey("Create/update folder response tests", t, func() {
		Convey("Given a correct request for creating a folder", func() {
			cmd := models.CreateFolderCommand{
				Uid:   "uid",
				Title: "Folder",
			}

			mock := &fakeFolderService{
				CreateFolderResult: &models.Folder{Id: 1, Uid: "uid", Title: "Folder"},
			}

			createFolderScenario("When calling POST on", "/api/folders", "/api/folders", mock, cmd, func(sc *scenarioContext) {
				callCreateFolder(sc)

				Convey("It should return correct response data", func() {
					folder := dtos.Folder{}
					err := json.NewDecoder(sc.resp.Body).Decode(&folder)
					So(err, ShouldBeNil)
					So(folder.Id, ShouldEqual, 1)
					So(folder.Uid, ShouldEqual, "uid")
					So(folder.Title, ShouldEqual, "Folder")
				})
			})
		})

		Convey("Given incorrect requests for creating a folder", func() {
			testCases := []struct {
				Error              error
				ExpectedStatusCode int
			}{
				{Error: models.ErrFolderWithSameUIDExists, ExpectedStatusCode: 400},
				{Error: models.ErrFolderTitleEmpty, ExpectedStatusCode: 400},
				{Error: models.ErrFolderSameNameExists, ExpectedStatusCode: 400},
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
				mock := &fakeFolderService{
					CreateFolderError: tc.Error,
				}

				createFolderScenario(fmt.Sprintf("Expect '%s' error when calling POST on", tc.Error.Error()), "/api/folders", "/api/folders", mock, cmd, func(sc *scenarioContext) {
					callCreateFolder(sc)
					if sc.resp.Code != tc.ExpectedStatusCode {
						t.Errorf("For error '%s' expected status code %d, actual %d", tc.Error, tc.ExpectedStatusCode, sc.resp.Code)
					}
				})
			}
		})

		Convey("Given a correct request for updating a folder", func() {
			cmd := models.UpdateFolderCommand{
				Title: "Folder upd",
			}

			mock := &fakeFolderService{
				UpdateFolderResult: &models.Folder{Id: 1, Uid: "uid", Title: "Folder upd"},
			}

			updateFolderScenario("When calling PUT on", "/api/folders/uid", "/api/folders/:uid", mock, cmd, func(sc *scenarioContext) {
				callUpdateFolder(sc)

				Convey("It should return correct response data", func() {
					folder := dtos.Folder{}
					err := json.NewDecoder(sc.resp.Body).Decode(&folder)
					So(err, ShouldBeNil)
					So(folder.Id, ShouldEqual, 1)
					So(folder.Uid, ShouldEqual, "uid")
					So(folder.Title, ShouldEqual, "Folder upd")
				})
			})
		})

		Convey("Given incorrect requests for updating a folder", func() {
			testCases := []struct {
				Error              error
				ExpectedStatusCode int
			}{
				{Error: models.ErrFolderWithSameUIDExists, ExpectedStatusCode: 400},
				{Error: models.ErrFolderTitleEmpty, ExpectedStatusCode: 400},
				{Error: models.ErrFolderSameNameExists, ExpectedStatusCode: 400},
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
				mock := &fakeFolderService{
					UpdateFolderError: tc.Error,
				}

				updateFolderScenario(fmt.Sprintf("Expect '%s' error when calling PUT on", tc.Error.Error()), "/api/folders/uid", "/api/folders/:uid", mock, cmd, func(sc *scenarioContext) {
					callUpdateFolder(sc)
					if sc.resp.Code != tc.ExpectedStatusCode {
						t.Errorf("For error '%s' expected status code %d, actual %d", tc.Error, tc.ExpectedStatusCode, sc.resp.Code)
					}
				})
			}
		})
	})
}

func callCreateFolder(sc *scenarioContext) {
	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func createFolderScenario(desc string, url string, routePattern string, mock *fakeFolderService, cmd models.CreateFolderCommand, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		hs := HTTPServer{
			Bus: bus.GetBus(),
			Cfg: setting.NewCfg(),
		}

		sc := setupScenarioContext(url)
		sc.defaultHandler = Wrap(func(c *models.ReqContext) Response {
			sc.context = c
			sc.context.SignedInUser = &models.SignedInUser{OrgId: TestOrgID, UserId: TestUserID}

			return hs.CreateFolder(c, cmd)
		})

		origNewFolderService := dashboards.NewFolderService
		mockFolderService(mock)

		sc.m.Post(routePattern, sc.defaultHandler)

		defer func() {
			dashboards.NewFolderService = origNewFolderService
		}()

		fn(sc)
	})
}

func callUpdateFolder(sc *scenarioContext) {
	sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
}

func updateFolderScenario(desc string, url string, routePattern string, mock *fakeFolderService, cmd models.UpdateFolderCommand, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(url)
		sc.defaultHandler = Wrap(func(c *models.ReqContext) Response {
			sc.context = c
			sc.context.SignedInUser = &models.SignedInUser{OrgId: TestOrgID, UserId: TestUserID}

			return UpdateFolder(c, cmd)
		})

		origNewFolderService := dashboards.NewFolderService
		mockFolderService(mock)

		sc.m.Put(routePattern, sc.defaultHandler)

		defer func() {
			dashboards.NewFolderService = origNewFolderService
		}()

		fn(sc)
	})
}

type fakeFolderService struct {
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

func (s *fakeFolderService) GetFolders(limit int64) ([]*models.Folder, error) {
	return s.GetFoldersResult, s.GetFoldersError
}

func (s *fakeFolderService) GetFolderByID(id int64) (*models.Folder, error) {
	return s.GetFolderByIDResult, s.GetFolderByIDError
}

func (s *fakeFolderService) GetFolderByUID(uid string) (*models.Folder, error) {
	return s.GetFolderByUIDResult, s.GetFolderByUIDError
}

func (s *fakeFolderService) CreateFolder(cmd *models.CreateFolderCommand) error {
	cmd.Result = s.CreateFolderResult
	return s.CreateFolderError
}

func (s *fakeFolderService) UpdateFolder(existingUID string, cmd *models.UpdateFolderCommand) error {
	cmd.Result = s.UpdateFolderResult
	return s.UpdateFolderError
}

func (s *fakeFolderService) DeleteFolder(uid string) (*models.Folder, error) {
	s.DeletedFolderUids = append(s.DeletedFolderUids, uid)
	return s.DeleteFolderResult, s.DeleteFolderError
}

func mockFolderService(mock *fakeFolderService) {
	dashboards.NewFolderService = func(orgId int64, user *models.SignedInUser) dashboards.FolderService {
		return mock
	}
}

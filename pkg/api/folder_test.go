package api

import (
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/go-macaron/session"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	macaron "gopkg.in/macaron.v1"

	. "github.com/smartystreets/goconvey/convey"
)

func TestFoldersApiEndpoint(t *testing.T) {
	Convey("Given a dashboard", t, func() {
		fakeDash := m.NewDashboard("Child dash")
		fakeDash.Id = 1
		fakeDash.FolderId = 1
		fakeDash.HasAcl = false

		bus.AddHandler("test", func(query *m.GetDashboardQuery) error {
			query.Result = fakeDash
			return nil
		})

		updateFolderCmd := m.UpdateFolderCommand{}

		Convey("When user is an Org Editor", func() {
			role := m.ROLE_EDITOR

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/folders/1", "/api/folders/:id", role, func(sc *scenarioContext) {
				callGetFolder(sc)
				So(sc.resp.Code, ShouldEqual, 404)
			})

			updateFolderScenario("When calling PUT on", "/api/folders/1", "/api/folders/:id", role, updateFolderCmd, func(sc *scenarioContext) {
				callUpdateFolder(sc)
				So(sc.resp.Code, ShouldEqual, 404)
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/folders/1", "/api/folders/:id", role, func(sc *scenarioContext) {
				callDeleteFolder(sc)
				So(sc.resp.Code, ShouldEqual, 404)
			})
		})
	})

	Convey("Given a folder which does not have an acl", t, func() {
		fakeFolder := m.NewDashboardFolder("Folder")
		fakeFolder.Id = 1
		fakeFolder.HasAcl = false

		bus.AddHandler("test", func(query *m.GetDashboardQuery) error {
			query.Result = fakeFolder
			return nil
		})

		viewerRole := m.ROLE_VIEWER
		editorRole := m.ROLE_EDITOR

		aclMockResp := []*m.DashboardAclInfoDTO{
			{Role: &viewerRole, Permission: m.PERMISSION_VIEW},
			{Role: &editorRole, Permission: m.PERMISSION_EDIT},
		}

		bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
			query.Result = aclMockResp
			return nil
		})

		bus.AddHandler("test", func(query *m.GetTeamsByUserQuery) error {
			query.Result = []*m.Team{}
			return nil
		})

		cmd := m.CreateFolderCommand{
			Title: fakeFolder.Title,
		}

		Convey("When user is an Org Viewer", func() {
			role := m.ROLE_VIEWER

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/folders/1", "/api/folders/:id", role, func(sc *scenarioContext) {
				folder := getFolderShouldReturn200(sc)

				Convey("Should not be able to edit or save folder", func() {
					So(folder.CanEdit, ShouldBeFalse)
					So(folder.CanSave, ShouldBeFalse)
					So(folder.CanAdmin, ShouldBeFalse)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/folders/1", "/api/folders/:id", role, func(sc *scenarioContext) {
				callDeleteFolder(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			createFolderScenario("When calling POST on", "/api/folders", "/api/folders", role, cmd, func(sc *scenarioContext) {
				callCreateFolder(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})
		})

		Convey("When user is an Org Editor", func() {
			role := m.ROLE_EDITOR

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/folders/1", "/api/folders/:id", role, func(sc *scenarioContext) {
				folder := getFolderShouldReturn200(sc)

				Convey("Should be able to edit or save folder", func() {
					So(folder.CanEdit, ShouldBeTrue)
					So(folder.CanSave, ShouldBeTrue)
					So(folder.CanAdmin, ShouldBeFalse)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/folders/1", "/api/folders/:id", role, func(sc *scenarioContext) {
				callDeleteFolder(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})

			createFolderScenario("When calling POST on", "/api/folders", "/api/folders", role, cmd, func(sc *scenarioContext) {
				callCreateFolder(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})
		})
	})

	Convey("Given a folder which have an acl", t, func() {
		fakeFolder := m.NewDashboardFolder("Folder")
		fakeFolder.Id = 1
		fakeFolder.HasAcl = true

		bus.AddHandler("test", func(query *m.GetDashboardQuery) error {
			query.Result = fakeFolder
			return nil
		})

		aclMockResp := []*m.DashboardAclInfoDTO{
			{
				DashboardId: 1,
				Permission:  m.PERMISSION_EDIT,
				UserId:      200,
			},
		}

		bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
			query.Result = aclMockResp
			return nil
		})

		bus.AddHandler("test", func(query *m.GetTeamsByUserQuery) error {
			query.Result = []*m.Team{}
			return nil
		})

		cmd := m.CreateFolderCommand{
			Title: fakeFolder.Title,
		}

		Convey("When user is an Org Viewer and has no permissions for this folder", func() {
			role := m.ROLE_VIEWER

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/folders/1", "/api/folders/:id", role, func(sc *scenarioContext) {
				sc.handlerFunc = GetFolderById
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				Convey("Should be denied access", func() {
					So(sc.resp.Code, ShouldEqual, 403)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/folders/1", "/api/folders/:id", role, func(sc *scenarioContext) {
				callDeleteFolder(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			createFolderScenario("When calling POST on", "/api/folders", "/api/folders", role, cmd, func(sc *scenarioContext) {
				callCreateFolder(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})
		})

		Convey("When user is an Org Editor and has no permissions for this folder", func() {
			role := m.ROLE_EDITOR

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/folders/1", "/api/folders/:id", role, func(sc *scenarioContext) {
				sc.handlerFunc = GetFolderById
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				Convey("Should be denied access", func() {
					So(sc.resp.Code, ShouldEqual, 403)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/folders/1", "/api/folders/:id", role, func(sc *scenarioContext) {
				callDeleteFolder(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			createFolderScenario("When calling POST on", "/api/folders", "/api/folders", role, cmd, func(sc *scenarioContext) {
				callCreateFolder(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})
		})
	})
}

func getFolderShouldReturn200(sc *scenarioContext) dtos.Folder {
	callGetFolder(sc)

	So(sc.resp.Code, ShouldEqual, 200)

	folder := dtos.Folder{}
	err := json.NewDecoder(sc.resp.Body).Decode(&folder)
	So(err, ShouldBeNil)

	return folder
}

func callGetFolder(sc *scenarioContext) {
	sc.handlerFunc = GetFolderById
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func callDeleteFolder(sc *scenarioContext) {
	bus.AddHandler("test", func(cmd *m.DeleteDashboardCommand) error {
		return nil
	})

	sc.handlerFunc = DeleteFolder
	sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
}

func callCreateFolder(sc *scenarioContext) {
	bus.AddHandler("test", func(cmd *m.SaveDashboardCommand) error {
		cmd.Result = &m.Dashboard{Id: 1, Slug: "folder", Version: 2}
		return nil
	})

	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func callUpdateFolder(sc *scenarioContext) {
	bus.AddHandler("test", func(cmd *m.SaveDashboardCommand) error {
		cmd.Result = &m.Dashboard{Id: 1, Slug: "folder", Version: 2}
		return nil
	})

	sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
}

func createFolderScenario(desc string, url string, routePattern string, role m.RoleType, cmd m.CreateFolderCommand, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		sc := &scenarioContext{
			url: url,
		}
		viewsPath, _ := filepath.Abs("../../public/views")

		sc.m = macaron.New()
		sc.m.Use(macaron.Renderer(macaron.RenderOptions{
			Directory: viewsPath,
			Delims:    macaron.Delims{Left: "[[", Right: "]]"},
		}))

		sc.m.Use(middleware.GetContextHandler())
		sc.m.Use(middleware.Sessioner(&session.Options{}))

		sc.defaultHandler = wrap(func(c *middleware.Context) Response {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = role

			return CreateFolder(c, cmd)
		})

		fakeRepo = &fakeDashboardRepo{}
		dashboards.SetRepository(fakeRepo)

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func updateFolderScenario(desc string, url string, routePattern string, role m.RoleType, cmd m.UpdateFolderCommand, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		sc := &scenarioContext{
			url: url,
		}
		viewsPath, _ := filepath.Abs("../../public/views")

		sc.m = macaron.New()
		sc.m.Use(macaron.Renderer(macaron.RenderOptions{
			Directory: viewsPath,
			Delims:    macaron.Delims{Left: "[[", Right: "]]"},
		}))

		sc.m.Use(middleware.GetContextHandler())
		sc.m.Use(middleware.Sessioner(&session.Options{}))

		sc.defaultHandler = wrap(func(c *middleware.Context) Response {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = role

			return UpdateFolder(c, cmd)
		})

		fakeRepo = &fakeDashboardRepo{}
		dashboards.SetRepository(fakeRepo)

		sc.m.Put(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

package api

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/stretchr/testify/assert"
)

func TestAnnotationsAPIEndpoint(t *testing.T) {
	t.Run("Given an annotation without a dashboard ID", func(t *testing.T) {
		cmd := dtos.PostAnnotationsCmd{
			Time: 1000,
			Text: "annotation text",
			Tags: []string{"tag1", "tag2"},
		}

		updateCmd := dtos.UpdateAnnotationsCmd{
			Time: 1000,
			Text: "annotation text",
			Tags: []string{"tag1", "tag2"},
		}

		patchCmd := dtos.PatchAnnotationsCmd{
			Time: 1000,
			Text: "annotation text",
			Tags: []string{"tag1", "tag2"},
		}

		t.Run("When user is an Org Viewer", func(t *testing.T) {
			role := models.ROLE_VIEWER
			t.Run("Should not be allowed to save an annotation", func(t *testing.T) {
				postAnnotationScenario(t, "When calling POST on", "/api/annotations", "/api/annotations", role,
					cmd, func(sc *scenarioContext) {
						sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
						assert.Equal(t, 403, sc.resp.Code)
					})

				putAnnotationScenario(t, "When calling PUT on", "/api/annotations/1", "/api/annotations/:annotationId",
					role, updateCmd, func(sc *scenarioContext) {
						sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
						assert.Equal(t, 403, sc.resp.Code)
					})

				patchAnnotationScenario(t, "When calling PATCH on", "/api/annotations/1",
					"/api/annotations/:annotationId", role, patchCmd, func(sc *scenarioContext) {
						sc.fakeReqWithParams("PATCH", sc.url, map[string]string{}).exec()
						assert.Equal(t, 403, sc.resp.Code)
					})

				loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/annotations/1",
					"/api/annotations/:annotationId", role, func(sc *scenarioContext) {
						fakeAnnoRepo = &fakeAnnotationsRepo{}
						annotations.SetRepository(fakeAnnoRepo)
						sc.handlerFunc = DeleteAnnotationByID
						sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
						assert.Equal(t, 403, sc.resp.Code)
					})
			})
		})

		t.Run("When user is an Org Editor", func(t *testing.T) {
			role := models.ROLE_EDITOR
			t.Run("Should be able to save an annotation", func(t *testing.T) {
				postAnnotationScenario(t, "When calling POST on", "/api/annotations", "/api/annotations", role,
					cmd, func(sc *scenarioContext) {
						sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
						assert.Equal(t, 200, sc.resp.Code)
					})

				putAnnotationScenario(t, "When calling PUT on", "/api/annotations/1", "/api/annotations/:annotationId", role, updateCmd, func(sc *scenarioContext) {
					sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				patchAnnotationScenario(t, "When calling PATCH on", "/api/annotations/1", "/api/annotations/:annotationId", role, patchCmd, func(sc *scenarioContext) {
					sc.fakeReqWithParams("PATCH", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/annotations/1",
					"/api/annotations/:annotationId", role, func(sc *scenarioContext) {
						fakeAnnoRepo = &fakeAnnotationsRepo{}
						annotations.SetRepository(fakeAnnoRepo)
						sc.handlerFunc = DeleteAnnotationByID
						sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
						assert.Equal(t, 200, sc.resp.Code)
					})
			})
		})
	})

	t.Run("Given an annotation with a dashboard ID and the dashboard does not have an ACL", func(t *testing.T) {
		cmd := dtos.PostAnnotationsCmd{
			Time:        1000,
			Text:        "annotation text",
			Tags:        []string{"tag1", "tag2"},
			DashboardId: 1,
			PanelId:     1,
		}

		updateCmd := dtos.UpdateAnnotationsCmd{
			Time: 1000,
			Text: "annotation text",
			Tags: []string{"tag1", "tag2"},
			Id:   1,
		}

		patchCmd := dtos.PatchAnnotationsCmd{
			Time: 8000,
			Text: "annotation text 50",
			Tags: []string{"foo", "bar"},
			Id:   1,
		}

		deleteCmd := dtos.DeleteAnnotationsCmd{
			DashboardId: 1,
			PanelId:     1,
		}

		viewerRole := models.ROLE_VIEWER
		editorRole := models.ROLE_EDITOR

		aclMockResp := []*models.DashboardAclInfoDTO{
			{Role: &viewerRole, Permission: models.PERMISSION_VIEW},
			{Role: &editorRole, Permission: models.PERMISSION_EDIT},
		}

		setUp := func() {
			bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
				query.Result = aclMockResp
				return nil
			})

			bus.AddHandler("test", func(query *models.GetTeamsByUserQuery) error {
				query.Result = []*models.TeamDTO{}
				return nil
			})
		}

		t.Run("When user is an Org Viewer", func(t *testing.T) {
			role := models.ROLE_VIEWER
			t.Run("Should not be allowed to save an annotation", func(t *testing.T) {
				postAnnotationScenario(t, "When calling POST on", "/api/annotations", "/api/annotations", role, cmd, func(sc *scenarioContext) {
					setUp()
					sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
					assert.Equal(t, 403, sc.resp.Code)
				})

				putAnnotationScenario(t, "When calling PUT on", "/api/annotations/1", "/api/annotations/:annotationId", role, updateCmd, func(sc *scenarioContext) {
					setUp()
					sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
					assert.Equal(t, 403, sc.resp.Code)
				})

				patchAnnotationScenario(t, "When calling PATCH on", "/api/annotations/1", "/api/annotations/:annotationId", role, patchCmd, func(sc *scenarioContext) {
					setUp()
					sc.fakeReqWithParams("PATCH", sc.url, map[string]string{}).exec()
					assert.Equal(t, 403, sc.resp.Code)
				})

				loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/annotations/1",
					"/api/annotations/:annotationId", role, func(sc *scenarioContext) {
						setUp()
						fakeAnnoRepo = &fakeAnnotationsRepo{}
						annotations.SetRepository(fakeAnnoRepo)
						sc.handlerFunc = DeleteAnnotationByID
						sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
						assert.Equal(t, 403, sc.resp.Code)
					})
			})
		})

		t.Run("When user is an Org Editor", func(t *testing.T) {
			role := models.ROLE_EDITOR
			t.Run("Should be able to save an annotation", func(t *testing.T) {
				postAnnotationScenario(t, "When calling POST on", "/api/annotations", "/api/annotations", role, cmd, func(sc *scenarioContext) {
					setUp()
					sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				putAnnotationScenario(t, "When calling PUT on", "/api/annotations/1", "/api/annotations/:annotationId", role, updateCmd, func(sc *scenarioContext) {
					setUp()
					sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				patchAnnotationScenario(t, "When calling PATCH on", "/api/annotations/1", "/api/annotations/:annotationId", role, patchCmd, func(sc *scenarioContext) {
					setUp()
					sc.fakeReqWithParams("PATCH", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/annotations/1",
					"/api/annotations/:annotationId", role, func(sc *scenarioContext) {
						setUp()
						fakeAnnoRepo = &fakeAnnotationsRepo{}
						annotations.SetRepository(fakeAnnoRepo)
						sc.handlerFunc = DeleteAnnotationByID
						sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
						assert.Equal(t, 200, sc.resp.Code)
					})
			})
		})

		t.Run("When user is an Admin", func(t *testing.T) {
			role := models.ROLE_ADMIN
			t.Run("Should be able to do anything", func(t *testing.T) {
				postAnnotationScenario(t, "When calling POST on", "/api/annotations", "/api/annotations", role, cmd, func(sc *scenarioContext) {
					setUp()
					sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				putAnnotationScenario(t, "When calling PUT on", "/api/annotations/1", "/api/annotations/:annotationId", role, updateCmd, func(sc *scenarioContext) {
					setUp()
					sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				patchAnnotationScenario(t, "When calling PATCH on", "/api/annotations/1", "/api/annotations/:annotationId", role, patchCmd, func(sc *scenarioContext) {
					setUp()
					sc.fakeReqWithParams("PATCH", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				deleteAnnotationsScenario(t, "When calling POST on", "/api/annotations/mass-delete",
					"/api/annotations/mass-delete", role, deleteCmd, func(sc *scenarioContext) {
						setUp()
						sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
						assert.Equal(t, 200, sc.resp.Code)
					})
			})
		})
	})
}

type fakeAnnotationsRepo struct {
}

func (repo *fakeAnnotationsRepo) Delete(params *annotations.DeleteParams) error {
	return nil
}
func (repo *fakeAnnotationsRepo) Save(item *annotations.Item) error {
	item.Id = 1
	return nil
}
func (repo *fakeAnnotationsRepo) Update(item *annotations.Item) error {
	return nil
}
func (repo *fakeAnnotationsRepo) Find(query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	annotations := []*annotations.ItemDTO{{Id: 1}}
	return annotations, nil
}
func (repo *fakeAnnotationsRepo) FindTags(query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	result := annotations.FindTagsResult{
		Tags: []*annotations.TagsDTO{},
	}
	return result, nil
}

var fakeAnnoRepo *fakeAnnotationsRepo

func postAnnotationScenario(t *testing.T, desc string, url string, routePattern string, role models.RoleType,
	cmd dtos.PostAnnotationsCmd, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		t.Cleanup(bus.ClearBusHandlers)

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			sc.context = c
			sc.context.UserId = testUserID
			sc.context.OrgId = testOrgID
			sc.context.OrgRole = role

			return PostAnnotation(c, cmd)
		})

		fakeAnnoRepo = &fakeAnnotationsRepo{}
		annotations.SetRepository(fakeAnnoRepo)

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func putAnnotationScenario(t *testing.T, desc string, url string, routePattern string, role models.RoleType,
	cmd dtos.UpdateAnnotationsCmd, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		t.Cleanup(bus.ClearBusHandlers)

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			sc.context = c
			sc.context.UserId = testUserID
			sc.context.OrgId = testOrgID
			sc.context.OrgRole = role

			return UpdateAnnotation(c, cmd)
		})

		fakeAnnoRepo = &fakeAnnotationsRepo{}
		annotations.SetRepository(fakeAnnoRepo)

		sc.m.Put(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func patchAnnotationScenario(t *testing.T, desc string, url string, routePattern string, role models.RoleType, cmd dtos.PatchAnnotationsCmd, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			sc.context = c
			sc.context.UserId = testUserID
			sc.context.OrgId = testOrgID
			sc.context.OrgRole = role

			return PatchAnnotation(c, cmd)
		})

		fakeAnnoRepo = &fakeAnnotationsRepo{}
		annotations.SetRepository(fakeAnnoRepo)

		sc.m.Patch(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func deleteAnnotationsScenario(t *testing.T, desc string, url string, routePattern string, role models.RoleType,
	cmd dtos.DeleteAnnotationsCmd, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			sc.context = c
			sc.context.UserId = testUserID
			sc.context.OrgId = testOrgID
			sc.context.OrgRole = role

			return DeleteAnnotations(c, cmd)
		})

		fakeAnnoRepo = &fakeAnnotationsRepo{}
		annotations.SetRepository(fakeAnnoRepo)

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

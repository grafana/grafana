package api

import (
	"context"
	"fmt"
	"io"
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
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
)

func TestAnnotationsAPIEndpoint(t *testing.T) {
	hs := setupSimpleHTTPServer(nil)
	store := sqlstore.InitTestDB(t)
	store.Cfg = hs.Cfg
	hs.SQLStore = store

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
					cmd, store, nil, func(sc *scenarioContext) {
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

				mock := mockstore.NewSQLStoreMock()
				loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/annotations/1",
					"/api/annotations/:annotationId", role, func(sc *scenarioContext) {
						fakeAnnoRepo = NewFakeAnnotationsRepo()
						annotations.SetRepository(fakeAnnoRepo)
						sc.handlerFunc = hs.DeleteAnnotationByID
						sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
						assert.Equal(t, 403, sc.resp.Code)
					}, mock)
			})
		})

		t.Run("When user is an Org Editor", func(t *testing.T) {
			role := models.ROLE_EDITOR
			t.Run("Should be able to save an annotation", func(t *testing.T) {
				postAnnotationScenario(t, "When calling POST on", "/api/annotations", "/api/annotations", role,
					cmd, store, nil, func(sc *scenarioContext) {
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
				mock := mockstore.NewSQLStoreMock()
				loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/annotations/1",
					"/api/annotations/:annotationId", role, func(sc *scenarioContext) {
						fakeAnnoRepo = NewFakeAnnotationsRepo()
						annotations.SetRepository(fakeAnnoRepo)
						sc.handlerFunc = hs.DeleteAnnotationByID
						sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
						assert.Equal(t, 200, sc.resp.Code)
					}, mock)
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

		dashboardUIDCmd := dtos.PostAnnotationsCmd{
			Time:         1000,
			Text:         "annotation text",
			Tags:         []string{"tag1", "tag2"},
			DashboardUID: "home",
			PanelId:      1,
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

		deleteCmd := dtos.MassDeleteAnnotationsCmd{
			DashboardId: 1,
			PanelId:     1,
		}

		deleteWithDashboardUIDCmd := dtos.MassDeleteAnnotationsCmd{
			DashboardUID: "home",
			PanelId:      1,
		}

		t.Run("When user is an Org Viewer", func(t *testing.T) {
			role := models.ROLE_VIEWER
			t.Run("Should not be allowed to save an annotation", func(t *testing.T) {
				postAnnotationScenario(t, "When calling POST on", "/api/annotations", "/api/annotations", role, cmd, store, nil, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
					assert.Equal(t, 403, sc.resp.Code)
				})

				putAnnotationScenario(t, "When calling PUT on", "/api/annotations/1", "/api/annotations/:annotationId", role, updateCmd, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
					assert.Equal(t, 403, sc.resp.Code)
				})

				patchAnnotationScenario(t, "When calling PATCH on", "/api/annotations/1", "/api/annotations/:annotationId", role, patchCmd, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("PATCH", sc.url, map[string]string{}).exec()
					assert.Equal(t, 403, sc.resp.Code)
				})
				mock := mockstore.NewSQLStoreMock()
				loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/annotations/1",
					"/api/annotations/:annotationId", role, func(sc *scenarioContext) {
						setUpACL()
						fakeAnnoRepo = NewFakeAnnotationsRepo()
						annotations.SetRepository(fakeAnnoRepo)
						sc.handlerFunc = hs.DeleteAnnotationByID
						sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
						assert.Equal(t, 403, sc.resp.Code)
					}, mock)
			})
		})

		t.Run("When user is an Org Editor", func(t *testing.T) {
			role := models.ROLE_EDITOR
			t.Run("Should be able to save an annotation", func(t *testing.T) {
				postAnnotationScenario(t, "When calling POST on", "/api/annotations", "/api/annotations", role, cmd, store, nil, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				putAnnotationScenario(t, "When calling PUT on", "/api/annotations/1", "/api/annotations/:annotationId", role, updateCmd, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				patchAnnotationScenario(t, "When calling PATCH on", "/api/annotations/1", "/api/annotations/:annotationId", role, patchCmd, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("PATCH", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})
				mock := mockstore.NewSQLStoreMock()
				loggedInUserScenarioWithRole(t, "When calling DELETE on", "DELETE", "/api/annotations/1",
					"/api/annotations/:annotationId", role, func(sc *scenarioContext) {
						setUpACL()
						fakeAnnoRepo = NewFakeAnnotationsRepo()
						annotations.SetRepository(fakeAnnoRepo)
						sc.handlerFunc = hs.DeleteAnnotationByID
						sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
						assert.Equal(t, 200, sc.resp.Code)
					}, mock)
			})
		})

		t.Run("When user is an Admin", func(t *testing.T) {
			role := models.ROLE_ADMIN

			mockStore := mockstore.NewSQLStoreMock()

			t.Run("Should be able to do anything", func(t *testing.T) {
				postAnnotationScenario(t, "When calling POST on", "/api/annotations", "/api/annotations", role, cmd, store, nil, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				dashSvc := dashboards.NewFakeDashboardService(t)
				dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Run(func(args mock.Arguments) {
					q := args.Get(1).(*models.GetDashboardQuery)
					q.Result = &models.Dashboard{
						Id:  q.Id,
						Uid: q.Uid,
					}
				}).Return(nil)
				postAnnotationScenario(t, "When calling POST on", "/api/annotations", "/api/annotations", role, dashboardUIDCmd, mockStore, dashSvc, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
					dashSvc.AssertCalled(t, "GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery"))
				})

				putAnnotationScenario(t, "When calling PUT on", "/api/annotations/1", "/api/annotations/:annotationId", role, updateCmd, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				patchAnnotationScenario(t, "When calling PATCH on", "/api/annotations/1", "/api/annotations/:annotationId", role, patchCmd, func(sc *scenarioContext) {
					setUpACL()
					sc.fakeReqWithParams("PATCH", sc.url, map[string]string{}).exec()
					assert.Equal(t, 200, sc.resp.Code)
				})

				deleteAnnotationsScenario(t, "When calling POST on", "/api/annotations/mass-delete",
					"/api/annotations/mass-delete", role, deleteCmd, store, nil, func(sc *scenarioContext) {
						setUpACL()
						sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
						assert.Equal(t, 200, sc.resp.Code)
					})

				dashSvc = dashboards.NewFakeDashboardService(t)
				dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Run(func(args mock.Arguments) {
					q := args.Get(1).(*models.GetDashboardQuery)
					q.Result = &models.Dashboard{
						Id:  1,
						Uid: deleteWithDashboardUIDCmd.DashboardUID,
					}
				}).Return(nil)
				deleteAnnotationsScenario(t, "When calling POST with dashboardUID on", "/api/annotations/mass-delete",
					"/api/annotations/mass-delete", role, deleteWithDashboardUIDCmd, mockStore, dashSvc, func(sc *scenarioContext) {
						setUpACL()
						sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
						assert.Equal(t, 200, sc.resp.Code)
						dashSvc.AssertCalled(t, "GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery"))
					})
			})
		})
	})
}

type fakeAnnotationsRepo struct {
	annotations map[int64]annotations.Item
}

func NewFakeAnnotationsRepo() *fakeAnnotationsRepo {
	return &fakeAnnotationsRepo{
		annotations: map[int64]annotations.Item{},
	}
}

func (repo *fakeAnnotationsRepo) Delete(_ context.Context, params *annotations.DeleteParams) error {
	if params.Id != 0 {
		delete(repo.annotations, params.Id)
	} else {
		for _, v := range repo.annotations {
			if params.DashboardId == v.DashboardId && params.PanelId == v.PanelId {
				delete(repo.annotations, v.Id)
			}
		}
	}

	return nil
}
func (repo *fakeAnnotationsRepo) Save(item *annotations.Item) error {
	if item.Id == 0 {
		item.Id = int64(len(repo.annotations) + 1)
	}
	repo.annotations[item.Id] = *item
	return nil
}
func (repo *fakeAnnotationsRepo) Update(_ context.Context, item *annotations.Item) error {
	return nil
}
func (repo *fakeAnnotationsRepo) Find(_ context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	if annotation, has := repo.annotations[query.AnnotationId]; has {
		return []*annotations.ItemDTO{{Id: annotation.Id, DashboardId: annotation.DashboardId}}, nil
	}
	annotations := []*annotations.ItemDTO{{Id: 1, DashboardId: 0}}
	return annotations, nil
}
func (repo *fakeAnnotationsRepo) FindTags(_ context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	result := annotations.FindTagsResult{
		Tags: []*annotations.TagsDTO{},
	}
	return result, nil
}

func (repo *fakeAnnotationsRepo) LoadItems() {

}

var fakeAnnoRepo *fakeAnnotationsRepo

func postAnnotationScenario(t *testing.T, desc string, url string, routePattern string, role models.RoleType,
	cmd dtos.PostAnnotationsCmd, store sqlstore.Store, dashSvc dashboards.DashboardService, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := setupSimpleHTTPServer(nil)
		hs.SQLStore = store
		hs.DashboardService = dashSvc

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.UserId = testUserID
			sc.context.OrgId = testOrgID
			sc.context.OrgRole = role

			return hs.PostAnnotation(c)
		})

		fakeAnnoRepo = NewFakeAnnotationsRepo()
		annotations.SetRepository(fakeAnnoRepo)

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func putAnnotationScenario(t *testing.T, desc string, url string, routePattern string, role models.RoleType,
	cmd dtos.UpdateAnnotationsCmd, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := setupSimpleHTTPServer(nil)
		store := sqlstore.InitTestDB(t)
		store.Cfg = hs.Cfg
		hs.SQLStore = store

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.UserId = testUserID
			sc.context.OrgId = testOrgID
			sc.context.OrgRole = role

			return hs.UpdateAnnotation(c)
		})

		fakeAnnoRepo = NewFakeAnnotationsRepo()
		annotations.SetRepository(fakeAnnoRepo)

		sc.m.Put(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func patchAnnotationScenario(t *testing.T, desc string, url string, routePattern string, role models.RoleType, cmd dtos.PatchAnnotationsCmd, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := setupSimpleHTTPServer(nil)
		store := sqlstore.InitTestDB(t)
		store.Cfg = hs.Cfg
		hs.SQLStore = store

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.UserId = testUserID
			sc.context.OrgId = testOrgID
			sc.context.OrgRole = role

			return hs.PatchAnnotation(c)
		})

		fakeAnnoRepo = NewFakeAnnotationsRepo()
		annotations.SetRepository(fakeAnnoRepo)

		sc.m.Patch(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func deleteAnnotationsScenario(t *testing.T, desc string, url string, routePattern string, role models.RoleType,
	cmd dtos.MassDeleteAnnotationsCmd, store sqlstore.Store, dashSvc dashboards.DashboardService, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := setupSimpleHTTPServer(nil)
		hs.SQLStore = store
		hs.DashboardService = dashSvc

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.UserId = testUserID
			sc.context.OrgId = testOrgID
			sc.context.OrgRole = role

			return hs.MassDeleteAnnotations(c)
		})

		fakeAnnoRepo = NewFakeAnnotationsRepo()
		annotations.SetRepository(fakeAnnoRepo)

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func TestAPI_Annotations_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true, true)
	setInitCtxSignedInEditor(sc.initCtx)
	_, err := sc.db.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)

	dashboardAnnotation := &annotations.Item{Id: 1, DashboardId: 1}
	organizationAnnotation := &annotations.Item{Id: 2, DashboardId: 0}

	fakeAnnoRepo = NewFakeAnnotationsRepo()
	_ = fakeAnnoRepo.Save(dashboardAnnotation)
	_ = fakeAnnoRepo.Save(organizationAnnotation)

	annotations.SetRepository(fakeAnnoRepo)

	postOrganizationCmd := dtos.PostAnnotationsCmd{
		Time:    1000,
		Text:    "annotation text",
		Tags:    []string{"tag1", "tag2"},
		PanelId: 1,
	}

	postDashboardCmd := dtos.PostAnnotationsCmd{
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
	}

	patchCmd := dtos.PatchAnnotationsCmd{
		Time: 1000,
		Text: "annotation text",
		Tags: []string{"tag1", "tag2"},
	}

	postGraphiteCmd := dtos.PostGraphiteAnnotationsCmd{
		When: 1000,
		What: "annotation text",
		Data: "Deploy",
		Tags: []string{"tag1", "tag2"},
	}

	type args struct {
		permissions []accesscontrol.Permission
		url         string
		body        io.Reader
		method      string
	}

	tests := []struct {
		name string
		args args
		want int
	}{
		{
			name: "AccessControl getting annotations with correct permissions is allowed",
			args: args{
				permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsRead, Scope: accesscontrol.ScopeAnnotationsAll}},
				url:         "/api/annotations",
				method:      http.MethodGet,
			},
			want: http.StatusOK,
		},
		{
			name: "AccessControl getting annotations without permissions is forbidden",
			args: args{
				permissions: []accesscontrol.Permission{},
				url:         "/api/annotations",
				method:      http.MethodGet,
			},
			want: http.StatusForbidden,
		},
		{
			name: "AccessControl getting annotation by ID with correct permissions is allowed",
			args: args{
				permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsRead, Scope: accesscontrol.ScopeAnnotationsAll}},
				url:         "/api/annotations/1",
				method:      http.MethodGet,
			},
			want: http.StatusOK,
		},
		{
			name: "AccessControl getting annotation by ID without permissions is forbidden",
			args: args{
				permissions: []accesscontrol.Permission{},
				url:         "/api/annotations",
				method:      http.MethodGet,
			},
			want: http.StatusForbidden,
		},
		{
			name: "AccessControl getting tags for annotations with correct permissions is allowed",
			args: args{
				permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsRead}},
				url:         "/api/annotations/tags",
				method:      http.MethodGet,
			},
			want: http.StatusOK,
		},
		{
			name: "AccessControl getting tags for annotations without correct permissions is forbidden",
			args: args{
				permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite}},
				url:         "/api/annotations/tags",
				method:      http.MethodGet,
			},
			want: http.StatusForbidden,
		},
		{
			name: "AccessControl update dashboard annotation with permissions is allowed",
			args: args{
				permissions: []accesscontrol.Permission{{
					Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeDashboard,
				}},
				url:    "/api/annotations/1",
				method: http.MethodPut,
				body:   mockRequestBody(updateCmd),
			},
			want: http.StatusOK,
		},
		{
			name: "AccessControl update dashboard annotation without permissions is forbidden",
			args: args{
				permissions: []accesscontrol.Permission{},
				url:         "/api/annotations/1",
				method:      http.MethodPut,
				body:        mockRequestBody(updateCmd),
			},
			want: http.StatusForbidden,
		},
		{
			name: "AccessControl update organization annotation with permissions is allowed",
			args: args{
				permissions: []accesscontrol.Permission{{
					Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsAll,
				}},
				url:    "/api/annotations/2",
				method: http.MethodPut,
				body:   mockRequestBody(updateCmd),
			},
			want: http.StatusOK,
		},
		{
			name: "AccessControl update organization annotation without permissions is forbidden",
			args: args{
				permissions: []accesscontrol.Permission{{
					Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeDashboard,
				}},
				url:    "/api/annotations/2",
				method: http.MethodPut,
				body:   mockRequestBody(updateCmd),
			},
			want: http.StatusForbidden,
		},
		{
			name: "AccessControl patch dashboard annotation with permissions is allowed",
			args: args{
				permissions: []accesscontrol.Permission{{
					Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeDashboard,
				}},
				url:    "/api/annotations/1",
				method: http.MethodPatch,
				body:   mockRequestBody(patchCmd),
			},
			want: http.StatusOK,
		},
		{
			name: "AccessControl patch dashboard annotation without permissions is forbidden",
			args: args{
				permissions: []accesscontrol.Permission{},
				url:         "/api/annotations/1",
				method:      http.MethodPatch,
				body:        mockRequestBody(patchCmd),
			},
			want: http.StatusForbidden,
		},
		{
			name: "AccessControl patch organization annotation with permissions is allowed",
			args: args{
				permissions: []accesscontrol.Permission{{
					Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsAll,
				}},
				url:    "/api/annotations/2",
				method: http.MethodPatch,
				body:   mockRequestBody(patchCmd),
			},
			want: http.StatusOK,
		},
		{
			name: "AccessControl patch organization annotation without permissions is forbidden",
			args: args{
				permissions: []accesscontrol.Permission{{
					Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeDashboard,
				}},
				url:    "/api/annotations/2",
				method: http.MethodPatch,
				body:   mockRequestBody(patchCmd),
			},
			want: http.StatusForbidden,
		},
		{
			name: "AccessControl create dashboard annotation with permissions is allowed",
			args: args{
				permissions: []accesscontrol.Permission{{
					Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeDashboard,
				}},
				url:    "/api/annotations",
				method: http.MethodPost,
				body:   mockRequestBody(postDashboardCmd),
			},
			want: http.StatusOK,
		},
		{
			name: "AccessControl create dashboard annotation without permissions is forbidden",
			args: args{
				permissions: []accesscontrol.Permission{},
				url:         "/api/annotations",
				method:      http.MethodPost,
				body:        mockRequestBody(postDashboardCmd),
			},
			want: http.StatusForbidden,
		},
		{
			name: "AccessControl create dashboard annotation with incorrect permissions is forbidden",
			args: args{
				permissions: []accesscontrol.Permission{{
					Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeOrganization,
				}},
				url:    "/api/annotations",
				method: http.MethodPost,
				body:   mockRequestBody(postDashboardCmd),
			},
			want: http.StatusForbidden,
		},
		{
			name: "AccessControl create organization annotation with permissions is allowed",
			args: args{
				permissions: []accesscontrol.Permission{{
					Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsAll,
				}},
				url:    "/api/annotations",
				method: http.MethodPost,
				body:   mockRequestBody(postOrganizationCmd),
			},
			want: http.StatusOK,
		},
		{
			name: "AccessControl create organization annotation without permissions is forbidden",
			args: args{
				permissions: []accesscontrol.Permission{{
					Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeDashboard,
				}},
				url:    "/api/annotations",
				method: http.MethodPost,
				body:   mockRequestBody(postOrganizationCmd),
			},
			want: http.StatusForbidden,
		},
		{
			name: "AccessControl delete dashboard annotation with permissions is allowed",
			args: args{
				permissions: []accesscontrol.Permission{{
					Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeDashboard,
				}},
				url:    "/api/annotations/1",
				method: http.MethodDelete,
			},
			want: http.StatusOK,
		},
		{
			name: "AccessControl delete dashboard annotation without permissions is forbidden",
			args: args{
				permissions: []accesscontrol.Permission{},
				url:         "/api/annotations/1",
				method:      http.MethodDelete,
			},
			want: http.StatusForbidden,
		},
		{
			name: "AccessControl delete organization annotation with permissions is allowed",
			args: args{
				permissions: []accesscontrol.Permission{{
					Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsAll,
				}},
				url:    "/api/annotations/2",
				method: http.MethodDelete,
			},
			want: http.StatusOK,
		},
		{
			name: "AccessControl delete organization annotation without permissions is forbidden",
			args: args{
				permissions: []accesscontrol.Permission{{
					Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeDashboard,
				}},
				url:    "/api/annotations/2",
				method: http.MethodDelete,
			},
			want: http.StatusForbidden,
		},
		{
			name: "AccessControl create graphite annotation with permissions is allowed",
			args: args{
				permissions: []accesscontrol.Permission{{
					Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsAll,
				}},
				url:    "/api/annotations/graphite",
				method: http.MethodPost,
				body:   mockRequestBody(postGraphiteCmd),
			},
			want: http.StatusOK,
		},
		{
			name: "AccessControl create organization annotation without permissions is forbidden",
			args: args{
				permissions: []accesscontrol.Permission{{
					Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeDashboard,
				}},
				url:    "/api/annotations/graphite",
				method: http.MethodPost,
				body:   mockRequestBody(postGraphiteCmd),
			},
			want: http.StatusForbidden,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setUpRBACGuardian(t)
			sc.acmock.
				RegisterScopeAttributeResolver(AnnotationTypeScopeResolver())
			setAccessControlPermissions(sc.acmock, tt.args.permissions, sc.initCtx.OrgId)

			r := callAPI(sc.server, tt.args.method, tt.args.url, tt.args.body, t)
			assert.Equalf(t, tt.want, r.Code, "Annotations API(%v)", tt.args.url)
		})
	}
}

func TestService_AnnotationTypeScopeResolver(t *testing.T) {
	type testCaseResolver struct {
		desc    string
		given   string
		want    string
		wantErr error
	}

	testCases := []testCaseResolver{
		{
			desc:    "correctly resolves dashboard annotations",
			given:   "annotations:id:1",
			want:    accesscontrol.ScopeAnnotationsTypeDashboard,
			wantErr: nil,
		},
		{
			desc:    "correctly resolves organization annotations",
			given:   "annotations:id:2",
			want:    accesscontrol.ScopeAnnotationsTypeOrganization,
			wantErr: nil,
		},
		{
			desc:    "invalid annotation ID",
			given:   "annotations:id:123abc",
			want:    "",
			wantErr: accesscontrol.ErrInvalidScope,
		},
		{
			desc:    "malformed scope",
			given:   "annotations:1",
			want:    "",
			wantErr: accesscontrol.ErrInvalidScope,
		},
	}

	dashboardAnnotation := annotations.Item{Id: 1, DashboardId: 1}
	organizationAnnotation := annotations.Item{Id: 2}

	fakeAnnoRepo = NewFakeAnnotationsRepo()
	_ = fakeAnnoRepo.Save(&dashboardAnnotation)
	_ = fakeAnnoRepo.Save(&organizationAnnotation)

	annotations.SetRepository(fakeAnnoRepo)

	prefix, resolver := AnnotationTypeScopeResolver()
	require.Equal(t, "annotations:id:", prefix)

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			resolved, err := resolver.Resolve(context.Background(), 1, tc.given)
			if tc.wantErr != nil {
				require.Error(t, err)
				require.Equal(t, tc.wantErr, err)
			} else {
				require.NoError(t, err)
				require.Len(t, resolved, 1)
				require.Equal(t, tc.want, resolved[0])
			}
		})
	}
}

func TestAPI_MassDeleteAnnotations_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true, true)
	setInitCtxSignedInEditor(sc.initCtx)
	_, err := sc.db.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)

	type args struct {
		permissions []accesscontrol.Permission
		url         string
		body        io.Reader
		method      string
	}

	tests := []struct {
		name string
		args args
		want int
	}{
		{
			name: "Mass delete dashboard annotations without dashboardId is not allowed",
			args: args{
				permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
				url:         "/api/annotations/mass-delete",
				method:      http.MethodPost,
				body: mockRequestBody(dtos.MassDeleteAnnotationsCmd{
					DashboardId: 0,
					PanelId:     1,
				}),
			},
			want: http.StatusBadRequest,
		},
		{
			name: "Mass delete dashboard annotations without panelId is not allowed",
			args: args{
				permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
				url:         "/api/annotations/mass-delete",
				method:      http.MethodPost,
				body: mockRequestBody(dtos.MassDeleteAnnotationsCmd{
					DashboardId: 10,
					PanelId:     0,
				}),
			},
			want: http.StatusBadRequest,
		},
		{
			name: "AccessControl mass delete dashboard annotations with correct dashboardId and panelId as input is allowed",
			args: args{
				permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
				url:         "/api/annotations/mass-delete",
				method:      http.MethodPost,
				body: mockRequestBody(dtos.MassDeleteAnnotationsCmd{
					DashboardId: 1,
					PanelId:     1,
				}),
			},
			want: http.StatusOK,
		},
		{
			name: "Mass delete organization annotations without input to delete all organization annotations is allowed",
			args: args{
				permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
				url:         "/api/annotations/mass-delete",
				method:      http.MethodPost,
				body: mockRequestBody(dtos.MassDeleteAnnotationsCmd{
					DashboardId: 0,
					PanelId:     0,
				}),
			},
			want: http.StatusOK,
		},
		{
			name: "Mass delete organization annotations without permissions is forbidden",
			args: args{
				permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
				url:         "/api/annotations/mass-delete",
				method:      http.MethodPost,
				body: mockRequestBody(dtos.MassDeleteAnnotationsCmd{
					DashboardId: 0,
					PanelId:     0,
				}),
			},
			want: http.StatusForbidden,
		},
		{
			name: "AccessControl mass delete dashboard annotations with correct annotationId as input is allowed",
			args: args{
				permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
				url:         "/api/annotations/mass-delete",
				method:      http.MethodPost,
				body: mockRequestBody(dtos.MassDeleteAnnotationsCmd{
					AnnotationId: 1,
				}),
			},
			want: http.StatusOK,
		},
		{
			name: "AccessControl mass delete annotation without access to dashboard annotations is forbidden",
			args: args{
				permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
				url:         "/api/annotations/mass-delete",
				method:      http.MethodPost,
				body: mockRequestBody(dtos.MassDeleteAnnotationsCmd{
					AnnotationId: 1,
				}),
			},
			want: http.StatusForbidden,
		},
		{
			name: "AccessControl mass delete annotation without access to organization annotations is forbidden",
			args: args{
				permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
				url:         "/api/annotations/mass-delete",
				method:      http.MethodPost,
				body: mockRequestBody(dtos.MassDeleteAnnotationsCmd{
					AnnotationId: 2,
				}),
			},
			want: http.StatusForbidden,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setUpRBACGuardian(t)
			setAccessControlPermissions(sc.acmock, tt.args.permissions, sc.initCtx.OrgId)
			dashboardAnnotation := &annotations.Item{Id: 1, DashboardId: 1}
			organizationAnnotation := &annotations.Item{Id: 2, DashboardId: 0}

			fakeAnnoRepo = NewFakeAnnotationsRepo()
			_ = fakeAnnoRepo.Save(dashboardAnnotation)
			_ = fakeAnnoRepo.Save(organizationAnnotation)

			annotations.SetRepository(fakeAnnoRepo)

			r := callAPI(sc.server, tt.args.method, tt.args.url, tt.args.body, t)
			assert.Equalf(t, tt.want, r.Code, "Annotations API(%v)", tt.args.url)
		})
	}
}

func setUpACL() {
	viewerRole := models.ROLE_VIEWER
	editorRole := models.ROLE_EDITOR
	store := mockstore.NewSQLStoreMock()
	store.ExpectedTeamsByUser = []*models.TeamDTO{}
	dashSvc := &dashboards.FakeDashboardService{}
	dashSvc.On("GetDashboardACLInfoList", mock.Anything, mock.AnythingOfType("*models.GetDashboardACLInfoListQuery")).Run(func(args mock.Arguments) {
		q := args.Get(1).(*models.GetDashboardACLInfoListQuery)
		q.Result = []*models.DashboardACLInfoDTO{
			{Role: &viewerRole, Permission: models.PERMISSION_VIEW},
			{Role: &editorRole, Permission: models.PERMISSION_EDIT},
		}
	}).Return(nil)

	guardian.InitLegacyGuardian(store, dashSvc)
}

func setUpRBACGuardian(t *testing.T) {
	origNewGuardian := guardian.New
	t.Cleanup(func() {
		guardian.New = origNewGuardian
	})

	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanEditValue: true})
}

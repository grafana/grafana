package libraryelements

import (
	"encoding/json"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/kinds/librarypanel"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/web"
)

func TestIntegration_GetLibraryElement(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	scenarioWithPanel(t, "When an admin tries to get a library panel that does not exist, it should fail",
		func(t *testing.T, sc scenarioContext) {
			// by uid
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": "unknown"})
			resp := sc.service.getHandler(sc.reqContext)
			require.Equal(t, 404, resp.Status())

			// by name
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":name": "unknown"})
			resp = sc.service.getByNameHandler(sc.reqContext)
			require.Equal(t, 404, resp.Status())
		})

	scenarioWithPanel(t, "When an admin tries to get a library panel that exists, it should succeed and return correct result",
		func(t *testing.T, sc scenarioContext) {
			var expected = func(res libraryElementResult) libraryElementResult {
				return libraryElementResult{
					Result: libraryElement{
						ID:          1,
						OrgID:       1,
						FolderID:    1, // nolint:staticcheck
						FolderUID:   sc.folder.UID,
						UID:         res.Result.UID,
						Name:        "Text - Library Panel",
						Kind:        int64(model.PanelElement),
						Type:        "text",
						Description: "A description",
						Model: map[string]any{
							"datasource":  "${DS_GDEV-TESTDATA}",
							"description": "A description",
							"id":          float64(1),
							"title":       "Text - Library Panel",
							"type":        "text",
						},
						Version: 1,
						Meta: model.LibraryElementDTOMeta{
							FolderName:          sc.folder.Title,
							FolderUID:           sc.folder.UID,
							ConnectedDashboards: 0,
							Created:             res.Result.Meta.Created,
							Updated:             res.Result.Meta.Updated,
							CreatedBy: librarypanel.LibraryElementDTOMetaUser{
								Id:        1,
								Name:      userInDbName,
								AvatarUrl: userInDbAvatar,
							},
							UpdatedBy: librarypanel.LibraryElementDTOMetaUser{
								Id:        1,
								Name:      userInDbName,
								AvatarUrl: userInDbAvatar,
							},
						},
					},
				}
			}

			sc.reqContext.Permissions[sc.reqContext.OrgID][dashboards.ActionFoldersRead] = []string{dashboards.ScopeFoldersAll}

			// by uid
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.getHandler(sc.reqContext)
			var result = validateAndUnMarshalResponse(t, resp)

			if diff := cmp.Diff(expected(result), result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}

			// by name
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":name": sc.initialResult.Result.Name})
			resp = sc.service.getByNameHandler(sc.reqContext)
			arrayResult := validateAndUnMarshalArrayResponse(t, resp)

			if diff := cmp.Diff(libraryElementArrayResult{Result: []libraryElement{expected(result).Result}}, arrayResult, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to get a library panel that exists, but the original folder does not, it should succeed and return correct result",
		func(t *testing.T, sc scenarioContext) {
			b, err := json.Marshal(map[string]string{"test": "test"})
			require.NoError(t, err)
			newFolder := createFolder(t, sc, "NewFolder", sc.folderSvc)
			sc.reqContext.Permissions[sc.reqContext.OrgID][dashboards.ActionFoldersRead] = []string{dashboards.ScopeFoldersAll}
			sc.reqContext.Permissions[sc.reqContext.OrgID][dashboards.ActionFoldersDelete] = []string{dashboards.ScopeFoldersAll}
			result, err := sc.service.createLibraryElement(sc.reqContext.Req.Context(), sc.reqContext.SignedInUser, model.CreateLibraryElementCommand{
				FolderID:  newFolder.ID, // nolint:staticcheck
				FolderUID: &newFolder.UID,
				Name:      "Testing Library Panel With Deleted Folder",
				Kind:      1,
				Model:     b,
				UID:       "panel-with-deleted-folder",
			})
			require.NoError(t, err)
			err = sc.service.folderService.Delete(sc.reqContext.Req.Context(), &folder.DeleteFolderCommand{
				UID:          newFolder.UID,
				OrgID:        sc.reqContext.OrgID,
				SignedInUser: sc.reqContext.SignedInUser,
			})
			require.NoError(t, err)
			sc.folderSvc.ExpectedFolder = nil
			sc.folderSvc.ExpectedError = folder.ErrFolderNotFound
			err = sc.sqlStore.WithDbSession(sc.reqContext.Req.Context(), func(session *db.Session) error {
				elem, err := sc.service.GetLibraryElement(sc.reqContext.Req.Context(), sc.reqContext.SignedInUser, session, result.UID)
				require.NoError(t, err)
				require.Equal(t, elem.FolderName, "General")
				return nil
			})
			require.NoError(t, err)
		})

	scenarioWithPanel(t, "When an admin tries to get a connected library panel, it should succeed and return correct connected dashboards",
		func(t *testing.T, sc scenarioContext) {
			err := sc.service.ConnectElementsToDashboard(sc.reqContext.Req.Context(), sc.reqContext.SignedInUser, []string{sc.initialResult.Result.UID}, 1)
			require.NoError(t, err)

			expected := func(res libraryElementResult) libraryElementResult {
				return libraryElementResult{
					Result: libraryElement{
						ID:          1,
						OrgID:       1,
						FolderID:    1, // nolint:staticcheck
						FolderUID:   sc.folder.UID,
						UID:         res.Result.UID,
						Name:        "Text - Library Panel",
						Kind:        int64(model.PanelElement),
						Type:        "text",
						Description: "A description",
						Model: map[string]any{
							"datasource":  "${DS_GDEV-TESTDATA}",
							"description": "A description",
							"id":          float64(1),
							"title":       "Text - Library Panel",
							"type":        "text",
						},
						Version: 1,
						Meta: model.LibraryElementDTOMeta{
							FolderName:          sc.folder.Title,
							FolderUID:           sc.folder.UID,
							ConnectedDashboards: 1,
							Created:             res.Result.Meta.Created,
							Updated:             res.Result.Meta.Updated,
							CreatedBy: librarypanel.LibraryElementDTOMetaUser{
								Id:        1,
								Name:      userInDbName,
								AvatarUrl: userInDbAvatar,
							},
							UpdatedBy: librarypanel.LibraryElementDTOMetaUser{
								Id:        1,
								Name:      userInDbName,
								AvatarUrl: userInDbAvatar,
							},
						},
					},
				}
			}

			sc.reqContext.Permissions[sc.reqContext.OrgID][dashboards.ActionFoldersRead] = []string{dashboards.ScopeFoldersAll}

			// by uid
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.getHandler(sc.reqContext)
			result := validateAndUnMarshalResponse(t, resp)

			if diff := cmp.Diff(expected(result), result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}

			// by name
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":name": sc.initialResult.Result.Name})
			resp = sc.service.getByNameHandler(sc.reqContext)
			arrayResult := validateAndUnMarshalArrayResponse(t, resp)
			if diff := cmp.Diff(libraryElementArrayResult{Result: []libraryElement{expected(result).Result}}, arrayResult, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to get a library panel that exists in an other org, it should fail",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.OrgID = 2
			sc.reqContext.OrgRole = org.RoleAdmin

			// by uid
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.getHandler(sc.reqContext)
			require.Equal(t, 404, resp.Status())

			// by name
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":name": sc.initialResult.Result.Name})
			resp = sc.service.getByNameHandler(sc.reqContext)
			require.Equal(t, 404, resp.Status())
		})
}

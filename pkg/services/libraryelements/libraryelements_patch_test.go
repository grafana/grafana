package libraryelements

import (
	"testing"

	"github.com/grafana/grafana/pkg/kinds/librarypanel"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/util"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/web"
)

func TestIntegration_PatchLibraryElement(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	scenarioWithPanel(t, "When an admin tries to patch a library panel that does not exist, it should fail",
		func(t *testing.T, sc scenarioContext) {
			cmd := model.PatchLibraryElementCommand{Kind: int64(model.PanelElement), Version: 1}
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": "unknown"})
			sc.reqContext.Req.Body = mockRequestBody(cmd)
			resp := sc.service.patchHandler(sc.reqContext)
			require.Equal(t, 404, resp.Status())
		})

	scenarioWithPanel(t, "When an admin tries to patch a library panel that exists, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			newFolder := createFolder(t, sc, "NewFolder", sc.folderSvc)
			cmd := model.PatchLibraryElementCommand{
				FolderID:  newFolder.ID, // nolint:staticcheck
				FolderUID: &newFolder.UID,
				Name:      "Panel - New name",
				Model: []byte(`
								{
								  "datasource": "${DS_GDEV-TESTDATA}",
                                  "description": "An updated description",
								  "id": 1,
								  "title": "Model - New name",
								  "type": "graph"
								}
							`),
				Kind:    int64(model.PanelElement),
				Version: 1,
			}
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			sc.reqContext.Req.Body = mockRequestBody(cmd)
			resp := sc.service.patchHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
			var result = validateAndUnMarshalResponse(t, resp)
			var expected = libraryElementResult{
				Result: libraryElement{
					ID:          1,
					OrgID:       1,
					FolderID:    newFolder.ID, // nolint:staticcheck
					FolderUID:   newFolder.UID,
					UID:         sc.initialResult.Result.UID,
					Name:        "Panel - New name",
					Kind:        int64(model.PanelElement),
					Type:        "graph",
					Description: "An updated description",
					Model: map[string]any{
						"datasource":  "${DS_GDEV-TESTDATA}",
						"description": "An updated description",
						"id":          float64(1),
						"title":       "Model - New name",
						"type":        "graph",
					},
					Version: 2,
					Meta: model.LibraryElementDTOMeta{
						FolderName:          "NewFolder",
						FolderUID:           "uid_for_NewFolder",
						ConnectedDashboards: 0,
						Created:             sc.initialResult.Result.Meta.Created,
						Updated:             result.Result.Meta.Updated,
						CreatedBy: librarypanel.LibraryElementDTOMetaUser{
							Id:        1,
							Name:      userInDbName,
							AvatarUrl: userInDbAvatar,
						},
						UpdatedBy: librarypanel.LibraryElementDTOMetaUser{
							Id:        1,
							Name:      "signed_in_user",
							AvatarUrl: "/avatar/37524e1eb8b3e32850b57db0a19af93b",
						},
					},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to patch a library panel with folder only, it should change folder successfully and return correct result",
		func(t *testing.T, sc scenarioContext) {
			newFolder := createFolder(t, sc, "NewFolder", sc.folderSvc)
			cmd := model.PatchLibraryElementCommand{
				FolderID:  newFolder.ID, // nolint:staticcheck
				FolderUID: &newFolder.UID,
				Kind:      int64(model.PanelElement),
				Version:   1,
			}
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			sc.reqContext.Req.Body = mockRequestBody(cmd)
			resp := sc.service.patchHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
			var result = validateAndUnMarshalResponse(t, resp)
			// nolint:staticcheck
			sc.initialResult.Result.FolderID = newFolder.ID
			sc.initialResult.Result.FolderUID = newFolder.UID
			sc.initialResult.Result.Meta.CreatedBy.Name = userInDbName
			sc.initialResult.Result.Meta.CreatedBy.AvatarUrl = userInDbAvatar
			sc.initialResult.Result.Meta.Updated = result.Result.Meta.Updated
			sc.initialResult.Result.Version = 2
			sc.initialResult.Result.Meta.FolderName = "NewFolder"
			sc.initialResult.Result.Meta.FolderUID = "uid_for_NewFolder"
			if diff := cmp.Diff(sc.initialResult.Result, result.Result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to patch a library panel with name only, it should change name successfully and return correct result",
		func(t *testing.T, sc scenarioContext) {
			cmd := model.PatchLibraryElementCommand{
				FolderID: -1, // nolint:staticcheck
				Name:     "New Name",
				Kind:     int64(model.PanelElement),
				Version:  1,
			}
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			sc.ctx.Req.Body = mockRequestBody(cmd)
			resp := sc.service.patchHandler(sc.reqContext)
			var result = validateAndUnMarshalResponse(t, resp)
			sc.initialResult.Result.Name = "New Name"
			sc.initialResult.Result.Meta.CreatedBy.Name = userInDbName
			sc.initialResult.Result.Meta.CreatedBy.AvatarUrl = userInDbAvatar
			sc.initialResult.Result.Meta.Updated = result.Result.Meta.Updated
			sc.initialResult.Result.Model["title"] = "Text - Library Panel"
			sc.initialResult.Result.Version = 2
			if diff := cmp.Diff(sc.initialResult.Result, result.Result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to patch a library panel with a nonexistent UID, it should change UID successfully and return correct result",
		func(t *testing.T, sc scenarioContext) {
			cmd := model.PatchLibraryElementCommand{
				FolderID: -1, // nolint:staticcheck
				UID:      util.GenerateShortUID(),
				Kind:     int64(model.PanelElement),
				Version:  1,
			}
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			sc.ctx.Req.Body = mockRequestBody(cmd)
			resp := sc.service.patchHandler(sc.reqContext)
			var result = validateAndUnMarshalResponse(t, resp)
			sc.initialResult.Result.UID = cmd.UID
			sc.initialResult.Result.Meta.CreatedBy.Name = userInDbName
			sc.initialResult.Result.Meta.CreatedBy.AvatarUrl = userInDbAvatar
			sc.initialResult.Result.Meta.Updated = result.Result.Meta.Updated
			sc.initialResult.Result.Model["title"] = "Text - Library Panel"
			sc.initialResult.Result.Version = 2
			if diff := cmp.Diff(sc.initialResult.Result, result.Result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to patch a library panel with an invalid UID, it should fail",
		func(t *testing.T, sc scenarioContext) {
			cmd := model.PatchLibraryElementCommand{
				FolderID: -1, // nolint:staticcheck
				UID:      "Testing an invalid UID",
				Kind:     int64(model.PanelElement),
				Version:  1,
			}
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			sc.ctx.Req.Body = mockRequestBody(cmd)
			resp := sc.service.patchHandler(sc.reqContext)
			require.Equal(t, 400, resp.Status())
		})

	scenarioWithPanel(t, "When an admin tries to patch a library panel with an UID that is too long, it should fail",
		func(t *testing.T, sc scenarioContext) {
			cmd := model.PatchLibraryElementCommand{
				FolderID:  -1, // nolint:staticcheck
				FolderUID: &sc.folder.UID,
				UID:       "j6T00KRZzj6T00KRZzj6T00KRZzj6T00KRZzj6T00K",
				Kind:      int64(model.PanelElement),
				Version:   1,
			}
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			sc.ctx.Req.Body = mockRequestBody(cmd)
			resp := sc.service.patchHandler(sc.reqContext)
			require.Equal(t, 400, resp.Status())
		})

	scenarioWithPanel(t, "When an admin tries to patch a library panel with an existing UID, it should fail",
		func(t *testing.T, sc scenarioContext) {
			// nolint:staticcheck
			command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Existing UID")
			command.UID = util.GenerateShortUID()
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
			cmd := model.PatchLibraryElementCommand{
				FolderID:  -1, // nolint:staticcheck
				FolderUID: &sc.folder.UID,
				UID:       command.UID,
				Kind:      int64(model.PanelElement),
				Version:   1,
			}
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			sc.ctx.Req.Body = mockRequestBody(cmd)
			resp = sc.service.patchHandler(sc.reqContext)
			require.Equal(t, 400, resp.Status())
		})

	scenarioWithPanel(t, "When an admin tries to patch a library panel with model only, it should change model successfully, sync type and description fields and return correct result",
		func(t *testing.T, sc scenarioContext) {
			cmd := model.PatchLibraryElementCommand{
				FolderID: -1, // nolint:staticcheck
				Model:    []byte(`{ "title": "New Model Title", "name": "New Model Name", "type":"graph", "description": "New description" }`),
				Kind:     int64(model.PanelElement),
				Version:  1,
			}
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			sc.ctx.Req.Body = mockRequestBody(cmd)
			resp := sc.service.patchHandler(sc.reqContext)
			var result = validateAndUnMarshalResponse(t, resp)
			sc.initialResult.Result.Type = "graph"
			sc.initialResult.Result.Description = "New description"
			sc.initialResult.Result.Model = map[string]any{
				"title":       "New Model Title",
				"name":        "New Model Name",
				"type":        "graph",
				"description": "New description",
			}
			sc.initialResult.Result.Meta.CreatedBy.Name = userInDbName
			sc.initialResult.Result.Meta.CreatedBy.AvatarUrl = userInDbAvatar
			sc.initialResult.Result.Meta.Updated = result.Result.Meta.Updated
			sc.initialResult.Result.Version = 2
			if diff := cmp.Diff(sc.initialResult.Result, result.Result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to patch a library panel with model.description only, it should change model successfully, sync type and description fields and return correct result",
		func(t *testing.T, sc scenarioContext) {
			cmd := model.PatchLibraryElementCommand{
				FolderID: -1, // nolint:staticcheck
				Model:    []byte(`{ "description": "New description" }`),
				Kind:     int64(model.PanelElement),
				Version:  1,
			}
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			sc.ctx.Req.Body = mockRequestBody(cmd)
			resp := sc.service.patchHandler(sc.reqContext)
			var result = validateAndUnMarshalResponse(t, resp)
			sc.initialResult.Result.Type = "text"
			sc.initialResult.Result.Description = "New description"
			sc.initialResult.Result.Model = map[string]any{
				"type":        "text",
				"description": "New description",
			}
			sc.initialResult.Result.Meta.CreatedBy.Name = userInDbName
			sc.initialResult.Result.Meta.CreatedBy.AvatarUrl = userInDbAvatar
			sc.initialResult.Result.Meta.Updated = result.Result.Meta.Updated
			sc.initialResult.Result.Version = 2
			if diff := cmp.Diff(sc.initialResult.Result, result.Result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to patch a library panel with model.type only, it should change model successfully, sync type and description fields and return correct result",
		func(t *testing.T, sc scenarioContext) {
			cmd := model.PatchLibraryElementCommand{
				FolderID: -1, // nolint:staticcheck
				Model:    []byte(`{ "type": "graph" }`),
				Kind:     int64(model.PanelElement),
				Version:  1,
			}
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			sc.ctx.Req.Body = mockRequestBody(cmd)
			resp := sc.service.patchHandler(sc.reqContext)
			var result = validateAndUnMarshalResponse(t, resp)
			sc.initialResult.Result.Type = "graph"
			sc.initialResult.Result.Description = "A description"
			sc.initialResult.Result.Model = map[string]any{
				"type":        "graph",
				"description": "A description",
			}
			sc.initialResult.Result.Meta.CreatedBy.Name = userInDbName
			sc.initialResult.Result.Meta.CreatedBy.AvatarUrl = userInDbAvatar
			sc.initialResult.Result.Meta.Updated = result.Result.Meta.Updated
			sc.initialResult.Result.Version = 2
			if diff := cmp.Diff(sc.initialResult.Result, result.Result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When another admin tries to patch a library panel, it should change UpdatedBy successfully and return correct result",
		func(t *testing.T, sc scenarioContext) {
			// nolint:staticcheck
			cmd := model.PatchLibraryElementCommand{FolderID: -1, Version: 1, Kind: int64(model.PanelElement)}
			sc.reqContext.UserID = 2
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			sc.ctx.Req.Body = mockRequestBody(cmd)
			resp := sc.service.patchHandler(sc.reqContext)
			var result = validateAndUnMarshalResponse(t, resp)
			sc.initialResult.Result.Meta.UpdatedBy.Id = int64(2)
			sc.initialResult.Result.Meta.CreatedBy.Name = userInDbName
			sc.initialResult.Result.Meta.CreatedBy.AvatarUrl = userInDbAvatar
			sc.initialResult.Result.Meta.Updated = result.Result.Meta.Updated
			sc.initialResult.Result.Version = 2
			if diff := cmp.Diff(sc.initialResult.Result, result.Result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to patch a library panel with a name that already exists, it should fail",
		func(t *testing.T, sc scenarioContext) {
			// nolint:staticcheck
			command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Another Panel")
			sc.ctx.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			var result = validateAndUnMarshalResponse(t, resp)
			cmd := model.PatchLibraryElementCommand{
				Name:      "Text - Library Panel",
				Version:   1,
				Kind:      int64(model.PanelElement),
				FolderUID: &sc.folder.UID,
			}
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result.Result.UID})
			sc.ctx.Req.Body = mockRequestBody(cmd)
			resp = sc.service.patchHandler(sc.reqContext)
			require.Equal(t, 400, resp.Status())
		})

	scenarioWithPanel(t, "When an admin tries to patch a library panel with a folder where a library panel with the same name already exists, it should fail",
		func(t *testing.T, sc scenarioContext) {
			newFolder := createFolder(t, sc, "NewFolder", sc.folderSvc)
			// nolint:staticcheck
			command := getCreatePanelCommand(newFolder.ID, newFolder.UID, "Text - Library Panel")
			sc.ctx.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			var result = validateAndUnMarshalResponse(t, resp)
			cmd := model.PatchLibraryElementCommand{
				FolderID:  1, // nolint:staticcheck
				FolderUID: &sc.folder.UID,
				Version:   1,
				Kind:      int64(model.PanelElement),
			}
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result.Result.UID})
			sc.ctx.Req.Body = mockRequestBody(cmd)
			resp = sc.service.patchHandler(sc.reqContext)
			require.Equal(t, 400, resp.Status())
		})

	scenarioWithPanel(t, "When an admin tries to patch a library panel in another org, it should fail",
		func(t *testing.T, sc scenarioContext) {
			cmd := model.PatchLibraryElementCommand{
				FolderID:  sc.folder.ID, // nolint:staticcheck
				FolderUID: &sc.folder.UID,
				Version:   1,
				Kind:      int64(model.PanelElement),
			}
			sc.reqContext.OrgID = 2
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			sc.ctx.Req.Body = mockRequestBody(cmd)
			resp := sc.service.patchHandler(sc.reqContext)
			require.Equal(t, 400, resp.Status())
		})

	scenarioWithPanel(t, "When an admin tries to patch a library panel with an old version number, it should fail",
		func(t *testing.T, sc scenarioContext) {
			cmd := model.PatchLibraryElementCommand{
				FolderID:  sc.folder.ID, // nolint:staticcheck
				FolderUID: &sc.folder.UID,
				Version:   1,
				Kind:      int64(model.PanelElement),
			}
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			sc.ctx.Req.Body = mockRequestBody(cmd)
			resp := sc.service.patchHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
			sc.ctx.Req.Body = mockRequestBody(cmd)
			resp = sc.service.patchHandler(sc.reqContext)
			require.Equal(t, 412, resp.Status())
		})
}

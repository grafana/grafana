package librarypanels

import (
	"fmt"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
)

func TestPatchLibraryPanel(t *testing.T) {
	scenarioWithLibraryPanel(t, "When an admin tries to patch a library panel that does not exist, it should fail",
		func(t *testing.T, sc scenarioContext) {
			cmd := patchLibraryPanelCommand{}
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": "unknown"})
			resp := sc.service.patchHandler(sc.reqContext, cmd)
			require.Equal(t, 404, resp.Status())
		})

	scenarioWithLibraryPanel(t, "When an admin tries to patch a library panel that exists, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID, ":dashboardId": "1"})
			resp := sc.service.connectHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID, ":dashboardId": "2"})
			resp = sc.service.connectHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			newFolder := createFolderWithACL(t, "NewFolder", sc.user, []folderACLItem{})
			cmd := patchLibraryPanelCommand{
				FolderID: newFolder.Id,
				Name:     "Panel - New name",
				Model: []byte(`
								{
								  "datasource": "${DS_GDEV-TESTDATA}",
								  "id": 1,
								  "title": "Model - New name",
								  "type": "text"
								}
							`),
			}
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID})
			resp = sc.service.patchHandler(sc.reqContext, cmd)
			require.Equal(t, 200, resp.Status())
			var result = validateAndUnMarshalResponse(t, resp)
			var expected = libraryPanelResult{
				Result: libraryPanel{
					ID:       1,
					OrgID:    1,
					FolderID: newFolder.Id,
					UID:      sc.initialResult.Result.UID,
					Name:     "Panel - New name",
					Model: map[string]interface{}{
						"datasource": "${DS_GDEV-TESTDATA}",
						"id":         float64(1),
						"title":      "Panel - New name",
						"type":       "text",
					},
					Meta: LibraryPanelDTOMeta{
						CanEdit:             true,
						ConnectedDashboards: 2,
						Created:             sc.initialResult.Result.Meta.Created,
						Updated:             result.Result.Meta.Updated,
						CreatedBy: LibraryPanelDTOMetaUser{
							ID:        1,
							Name:      "user_in_db",
							AvatarUrl: "/avatar/402d08de060496d6b6874495fe20f5ad",
						},
						UpdatedBy: LibraryPanelDTOMetaUser{
							ID:        1,
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

	scenarioWithLibraryPanel(t, "When an admin tries to patch a library panel with folder only, it should change folder successfully and return correct result",
		func(t *testing.T, sc scenarioContext) {
			newFolder := createFolderWithACL(t, "NewFolder", sc.user, []folderACLItem{})
			cmd := patchLibraryPanelCommand{
				FolderID: newFolder.Id,
			}
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.patchHandler(sc.reqContext, cmd)
			require.Equal(t, 200, resp.Status())
			var result = validateAndUnMarshalResponse(t, resp)
			sc.initialResult.Result.FolderID = newFolder.Id
			sc.initialResult.Result.Meta.CreatedBy.Name = "user_in_db"
			sc.initialResult.Result.Meta.CreatedBy.AvatarUrl = "/avatar/402d08de060496d6b6874495fe20f5ad"
			if diff := cmp.Diff(sc.initialResult.Result, result.Result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithLibraryPanel(t, "When an admin tries to patch a library panel with name only, it should change name successfully, sync title and return correct result",
		func(t *testing.T, sc scenarioContext) {
			cmd := patchLibraryPanelCommand{
				FolderID: -1,
				Name:     "New Name",
			}
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.patchHandler(sc.reqContext, cmd)
			var result = validateAndUnMarshalResponse(t, resp)
			sc.initialResult.Result.Name = "New Name"
			sc.initialResult.Result.Meta.CreatedBy.Name = "user_in_db"
			sc.initialResult.Result.Meta.CreatedBy.AvatarUrl = "/avatar/402d08de060496d6b6874495fe20f5ad"
			sc.initialResult.Result.Model["title"] = "New Name"
			if diff := cmp.Diff(sc.initialResult.Result, result.Result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithLibraryPanel(t, "When an admin tries to patch a library panel with model only, it should change model successfully and return correct result",
		func(t *testing.T, sc scenarioContext) {
			cmd := patchLibraryPanelCommand{
				FolderID: -1,
				Model:    []byte(`{ "title": "New Model Title", "name": "New Model Name" }`),
			}
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.patchHandler(sc.reqContext, cmd)
			var result = validateAndUnMarshalResponse(t, resp)
			sc.initialResult.Result.Model = map[string]interface{}{
				"title": "Text - Library Panel",
				"name":  "New Model Name",
			}
			sc.initialResult.Result.Meta.CreatedBy.Name = "user_in_db"
			sc.initialResult.Result.Meta.CreatedBy.AvatarUrl = "/avatar/402d08de060496d6b6874495fe20f5ad"
			if diff := cmp.Diff(sc.initialResult.Result, result.Result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithLibraryPanel(t, "When another admin tries to patch a library panel, it should change UpdatedBy successfully and return correct result",
		func(t *testing.T, sc scenarioContext) {
			cmd := patchLibraryPanelCommand{FolderID: -1}
			sc.reqContext.UserId = 2
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.patchHandler(sc.reqContext, cmd)
			var result = validateAndUnMarshalResponse(t, resp)
			sc.initialResult.Result.Meta.UpdatedBy.ID = int64(2)
			sc.initialResult.Result.Meta.CreatedBy.Name = "user_in_db"
			sc.initialResult.Result.Meta.CreatedBy.AvatarUrl = "/avatar/402d08de060496d6b6874495fe20f5ad"
			if diff := cmp.Diff(sc.initialResult.Result, result.Result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithLibraryPanel(t, "When an admin tries to patch a library panel with a name that already exists, it should fail",
		func(t *testing.T, sc scenarioContext) {
			command := getCreateCommand(sc.folder.Id, "Another Panel")
			resp := sc.service.createHandler(sc.reqContext, command)
			var result = validateAndUnMarshalResponse(t, resp)
			cmd := patchLibraryPanelCommand{
				Name: "Text - Library Panel",
			}
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
			resp = sc.service.patchHandler(sc.reqContext, cmd)
			require.Equal(t, 400, resp.Status())
		})

	scenarioWithLibraryPanel(t, "When an admin tries to patch a library panel with a folder where a library panel with the same name already exists, it should fail",
		func(t *testing.T, sc scenarioContext) {
			newFolder := createFolderWithACL(t, "NewFolder", sc.user, []folderACLItem{})
			command := getCreateCommand(newFolder.Id, "Text - Library Panel")
			resp := sc.service.createHandler(sc.reqContext, command)
			var result = validateAndUnMarshalResponse(t, resp)
			cmd := patchLibraryPanelCommand{
				FolderID: 1,
			}
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
			resp = sc.service.patchHandler(sc.reqContext, cmd)
			require.Equal(t, 400, resp.Status())
		})

	scenarioWithLibraryPanel(t, "When an admin tries to patch a library panel in another org, it should fail",
		func(t *testing.T, sc scenarioContext) {
			cmd := patchLibraryPanelCommand{
				FolderID: sc.folder.Id,
			}
			sc.reqContext.OrgId = 2
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.patchHandler(sc.reqContext, cmd)
			require.Equal(t, 404, resp.Status())
		})

	var roleTests = []struct {
		role models.RoleType
	}{
		{models.ROLE_ADMIN},
		{models.ROLE_EDITOR},
		{models.ROLE_VIEWER},
	}

	for _, testCase := range roleTests {
		scenarioWithLibraryPanel(t, fmt.Sprintf("When an %s tries to patch a library panel and the folder doesn't exist, it should fail", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				sc.reqContext.SignedInUser.OrgRole = testCase.role
				cmd := patchLibraryPanelCommand{FolderID: -100}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID})
				resp := sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, 404, resp.Status())
			})
	}

	var generalFolderTests = []struct {
		role   models.RoleType
		status int
	}{
		{models.ROLE_ADMIN, 200},
		{models.ROLE_EDITOR, 200},
		{models.ROLE_VIEWER, 403},
	}

	for _, testCase := range generalFolderTests {
		scenarioWithLibraryPanel(t, fmt.Sprintf("When an %s tries to patch a library panel moving it to the General folder, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				updateFolderACL(t, sc.folder.Id, []folderACLItem{{models.ROLE_EDITOR, models.PERMISSION_EDIT}, {models.ROLE_VIEWER, models.PERMISSION_EDIT}})
				sc.reqContext.SignedInUser.OrgRole = testCase.role
				cmd := patchLibraryPanelCommand{FolderID: 0}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID})
				resp := sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, testCase.status, resp.Status())
			})
	}

	for _, testCase := range generalFolderTests {
		testScenario(t, fmt.Sprintf("When an %s tries to patch a library panel moving it from the General folder, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				updateFolderACL(t, sc.folder.Id, []folderACLItem{{models.ROLE_EDITOR, models.PERMISSION_EDIT}, {models.ROLE_VIEWER, models.PERMISSION_EDIT}})
				command := getCreateCommand(0, "Library Panel")
				resp := sc.service.createHandler(sc.reqContext, command)
				result := validateAndUnMarshalResponse(t, resp)

				sc.reqContext.SignedInUser.OrgRole = testCase.role
				cmd := patchLibraryPanelCommand{FolderID: sc.folder.Id}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, testCase.status, resp.Status())
			})
	}

	var movingFromTests = []struct {
		role   models.RoleType
		status int
	}{
		{models.ROLE_ADMIN, 200},
		{models.ROLE_EDITOR, 403},
		{models.ROLE_VIEWER, 403},
	}

	for _, testCase := range movingFromTests {
		testScenario(t, fmt.Sprintf("When an %s tries to patch a library panel moving it from a folder the user has access to, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				allFolder := createFolderWithACL(t, "AllFolder", sc.user, []folderACLItem{{models.ROLE_EDITOR, models.PERMISSION_EDIT}, {models.ROLE_VIEWER, models.PERMISSION_EDIT}})
				noneFolder := createFolderWithACL(t, "NoneFolder", sc.user, []folderACLItem{{models.ROLE_ADMIN, models.PERMISSION_VIEW}})
				command := getCreateCommand(noneFolder.Id, "Library Panel")
				resp := sc.service.createHandler(sc.reqContext, command)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := patchLibraryPanelCommand{FolderID: allFolder.Id}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, testCase.status, resp.Status())
			})
	}

	var accessTests = []struct {
		role               models.RoleType
		allFolderStatus    int
		adminFolderStatus  int
		editorFolderStatus int
		viewerFolderStatus int
		noneFolderStatus   int
	}{
		{models.ROLE_ADMIN, 200, 200, 200, 200, 200},
		{models.ROLE_EDITOR, 200, 403, 200, 200, 403},
		{models.ROLE_VIEWER, 200, 403, 403, 200, 403},
	}

	for _, testCase := range accessTests {
		scenarioWithLibraryPanel(t, fmt.Sprintf("When an %s tries to patch a library panel moving it to a folder with specific permissions, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				allFolder := createFolderWithACL(t, "AllFolder", sc.user, []folderACLItem{{models.ROLE_EDITOR, models.PERMISSION_EDIT}, {models.ROLE_VIEWER, models.PERMISSION_EDIT}})
				adminFolder := createFolderWithACL(t, "AdminFolder", sc.user, []folderACLItem{{models.ROLE_ADMIN, models.PERMISSION_ADMIN}})
				editorFolder := createFolderWithACL(t, "EditorFolder", sc.user, []folderACLItem{{models.ROLE_EDITOR, models.PERMISSION_EDIT}})
				viewerFolder := createFolderWithACL(t, "ViewerFolder", sc.user, []folderACLItem{{models.ROLE_EDITOR, models.PERMISSION_EDIT}, {models.ROLE_VIEWER, models.PERMISSION_EDIT}})
				noneFolder := createFolderWithACL(t, "NoneFolder", sc.user, []folderACLItem{{models.ROLE_ADMIN, models.PERMISSION_VIEW}})
				command := getCreateCommand(allFolder.Id, "General Folder")
				resp := sc.service.createHandler(sc.reqContext, command)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := patchLibraryPanelCommand{FolderID: allFolder.Id}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, testCase.allFolderStatus, resp.Status())

				cmd = patchLibraryPanelCommand{FolderID: adminFolder.Id}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, testCase.adminFolderStatus, resp.Status())

				cmd = patchLibraryPanelCommand{FolderID: editorFolder.Id}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, testCase.editorFolderStatus, resp.Status())

				cmd = patchLibraryPanelCommand{FolderID: viewerFolder.Id}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, testCase.viewerFolderStatus, resp.Status())

				cmd = patchLibraryPanelCommand{FolderID: noneFolder.Id}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, testCase.noneFolderStatus, resp.Status())
			})
	}
}

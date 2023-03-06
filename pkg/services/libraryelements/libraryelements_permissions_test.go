package libraryelements

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/web"
)

func TestLibraryElementPermissions(t *testing.T) {
	var defaultPermissions = []folderACLItem{}
	var adminOnlyPermissions = []folderACLItem{{org.RoleAdmin, dashboards.PERMISSION_EDIT}}
	var editorOnlyPermissions = []folderACLItem{{org.RoleEditor, dashboards.PERMISSION_EDIT}}
	var editorAndViewerPermissions = []folderACLItem{{org.RoleEditor, dashboards.PERMISSION_EDIT}, {org.RoleViewer, dashboards.PERMISSION_EDIT}}
	var viewerOnlyPermissions = []folderACLItem{{org.RoleViewer, dashboards.PERMISSION_EDIT}}
	var everyonePermissions = []folderACLItem{{org.RoleAdmin, dashboards.PERMISSION_EDIT}, {org.RoleEditor, dashboards.PERMISSION_EDIT}, {org.RoleViewer, dashboards.PERMISSION_EDIT}}
	var noPermissions = []folderACLItem{{org.RoleViewer, dashboards.PERMISSION_VIEW}}
	var folderCases = [][]folderACLItem{
		defaultPermissions,
		adminOnlyPermissions,
		editorOnlyPermissions,
		editorAndViewerPermissions,
		viewerOnlyPermissions,
		everyonePermissions,
		noPermissions,
	}
	var defaultDesc = "default permissions"
	var adminOnlyDesc = "admin only permissions"
	var editorOnlyDesc = "editor only permissions"
	var editorAndViewerDesc = "editor and viewer permissions"
	var viewerOnlyDesc = "viewer only permissions"
	var everyoneDesc = "everyone has editor permissions"
	var noDesc = "everyone has view permissions"
	var accessCases = []struct {
		role   org.RoleType
		items  []folderACLItem
		desc   string
		status int
	}{
		{org.RoleAdmin, defaultPermissions, defaultDesc, 200},
		{org.RoleAdmin, adminOnlyPermissions, adminOnlyDesc, 200},
		{org.RoleAdmin, editorOnlyPermissions, editorOnlyDesc, 200},
		{org.RoleAdmin, editorAndViewerPermissions, editorAndViewerDesc, 200},
		{org.RoleAdmin, viewerOnlyPermissions, viewerOnlyDesc, 200},
		{org.RoleAdmin, everyonePermissions, everyoneDesc, 200},
		{org.RoleAdmin, noPermissions, noDesc, 200},

		{org.RoleEditor, defaultPermissions, defaultDesc, 200},
		{org.RoleEditor, adminOnlyPermissions, adminOnlyDesc, 403},
		{org.RoleEditor, editorOnlyPermissions, editorOnlyDesc, 200},
		{org.RoleEditor, editorAndViewerPermissions, editorAndViewerDesc, 200},
		{org.RoleEditor, viewerOnlyPermissions, viewerOnlyDesc, 403},
		{org.RoleEditor, everyonePermissions, everyoneDesc, 200},
		{org.RoleEditor, noPermissions, noDesc, 403},

		{org.RoleViewer, defaultPermissions, defaultDesc, 403},
		{org.RoleViewer, adminOnlyPermissions, adminOnlyDesc, 403},
		{org.RoleViewer, editorOnlyPermissions, editorOnlyDesc, 403},
		{org.RoleViewer, editorAndViewerPermissions, editorAndViewerDesc, 200},
		{org.RoleViewer, viewerOnlyPermissions, viewerOnlyDesc, 200},
		{org.RoleViewer, everyonePermissions, everyoneDesc, 200},
		{org.RoleViewer, noPermissions, noDesc, 403},
	}

	for _, testCase := range accessCases {
		testScenario(t, fmt.Sprintf("When %s tries to create a library panel in a folder with %s, it should return correct status", testCase.role, testCase.desc),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, testCase.items)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				command := getCreatePanelCommand(folder.ID, "Library Panel Name")
				sc.reqContext.Req.Body = mockRequestBody(command)
				resp := sc.service.createHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to patch a library panel by moving it to a folder with %s, it should return correct status", testCase.role, testCase.desc),
			func(t *testing.T, sc scenarioContext) {
				fromFolder := createFolderWithACL(t, sc.sqlStore, "Everyone", sc.user, everyonePermissions)
				command := getCreatePanelCommand(fromFolder.ID, "Library Panel Name")
				sc.reqContext.Req.Body = mockRequestBody(command)
				resp := sc.service.createHandler(sc.reqContext)
				result := validateAndUnMarshalResponse(t, resp)
				toFolder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, testCase.items)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := model.PatchLibraryElementCommand{FolderID: toFolder.ID, Version: 1, Kind: int64(model.PanelElement)}
				sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result.Result.UID})
				sc.reqContext.Req.Body = mockRequestBody(cmd)
				resp = sc.service.patchHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to patch a library panel by moving it from a folder with %s, it should return correct status", testCase.role, testCase.desc),
			func(t *testing.T, sc scenarioContext) {
				fromFolder := createFolderWithACL(t, sc.sqlStore, "Everyone", sc.user, testCase.items)
				command := getCreatePanelCommand(fromFolder.ID, "Library Panel Name")
				sc.reqContext.Req.Body = mockRequestBody(command)
				resp := sc.service.createHandler(sc.reqContext)
				result := validateAndUnMarshalResponse(t, resp)
				toFolder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, everyonePermissions)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := model.PatchLibraryElementCommand{FolderID: toFolder.ID, Version: 1, Kind: int64(model.PanelElement)}
				sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result.Result.UID})
				sc.reqContext.Req.Body = mockRequestBody(cmd)
				resp = sc.service.patchHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to delete a library panel in a folder with %s, it should return correct status", testCase.role, testCase.desc),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, testCase.items)
				cmd := getCreatePanelCommand(folder.ID, "Library Panel Name")
				sc.reqContext.Req.Body = mockRequestBody(cmd)
				resp := sc.service.createHandler(sc.reqContext)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result.Result.UID})
				resp = sc.service.deleteHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})
	}

	var generalFolderCases = []struct {
		role   org.RoleType
		status int
	}{
		{org.RoleAdmin, 200},
		{org.RoleEditor, 200},
		{org.RoleViewer, 403},
	}

	for _, testCase := range generalFolderCases {
		testScenario(t, fmt.Sprintf("When %s tries to create a library panel in the General folder, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				command := getCreatePanelCommand(0, "Library Panel Name")
				sc.reqContext.Req.Body = mockRequestBody(command)
				resp := sc.service.createHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to patch a library panel by moving it to the General folder, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, everyonePermissions)
				command := getCreatePanelCommand(folder.ID, "Library Panel Name")
				sc.reqContext.Req.Body = mockRequestBody(command)
				resp := sc.service.createHandler(sc.reqContext)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := model.PatchLibraryElementCommand{FolderID: 0, Version: 1, Kind: int64(model.PanelElement)}
				sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result.Result.UID})
				sc.ctx.Req.Body = mockRequestBody(cmd)
				resp = sc.service.patchHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to patch a library panel by moving it from the General folder, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, everyonePermissions)
				command := getCreatePanelCommand(0, "Library Panel Name")
				sc.reqContext.Req.Body = mockRequestBody(command)
				resp := sc.service.createHandler(sc.reqContext)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := model.PatchLibraryElementCommand{FolderID: folder.ID, Version: 1, Kind: int64(model.PanelElement)}
				sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result.Result.UID})
				sc.ctx.Req.Body = mockRequestBody(cmd)
				resp = sc.service.patchHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to delete a library panel in the General folder, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				cmd := getCreatePanelCommand(0, "Library Panel Name")
				sc.reqContext.Req.Body = mockRequestBody(cmd)
				resp := sc.service.createHandler(sc.reqContext)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result.Result.UID})
				resp = sc.service.deleteHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})
	}

	var missingFolderCases = []struct {
		role org.RoleType
	}{
		{org.RoleAdmin},
		{org.RoleEditor},
		{org.RoleViewer},
	}

	for _, testCase := range missingFolderCases {
		testScenario(t, fmt.Sprintf("When %s tries to create a library panel in a folder that doesn't exist, it should fail", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				command := getCreatePanelCommand(-100, "Library Panel Name")
				sc.reqContext.Req.Body = mockRequestBody(command)
				resp := sc.service.createHandler(sc.reqContext)
				require.Equal(t, 404, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to patch a library panel by moving it to a folder that doesn't exist, it should fail", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, everyonePermissions)
				command := getCreatePanelCommand(folder.ID, "Library Panel Name")
				sc.reqContext.Req.Body = mockRequestBody(command)
				resp := sc.service.createHandler(sc.reqContext)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := model.PatchLibraryElementCommand{FolderID: -100, Version: 1, Kind: int64(model.PanelElement)}
				sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result.Result.UID})
				sc.reqContext.Req.Body = mockRequestBody(cmd)
				resp = sc.service.patchHandler(sc.reqContext)
				require.Equal(t, 404, resp.Status())
			})
	}

	var getCases = []struct {
		role     org.RoleType
		statuses []int
	}{
		{org.RoleAdmin, []int{200, 200, 200, 200, 200, 200, 200}},
		{org.RoleEditor, []int{200, 404, 200, 200, 200, 200, 200}},
		{org.RoleViewer, []int{200, 404, 404, 200, 200, 200, 200}},
	}

	for _, testCase := range getCases {
		testScenario(t, fmt.Sprintf("When %s tries to get a library panel, it should return correct response", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				var results []libraryElement
				for i, folderCase := range folderCases {
					folder := createFolderWithACL(t, sc.sqlStore, fmt.Sprintf("Folder%v", i), sc.user, folderCase)
					cmd := getCreatePanelCommand(folder.ID, fmt.Sprintf("Library Panel in Folder%v", i))
					sc.reqContext.Req.Body = mockRequestBody(cmd)
					resp := sc.service.createHandler(sc.reqContext)
					result := validateAndUnMarshalResponse(t, resp)
					result.Result.Meta.CreatedBy.Name = userInDbName
					result.Result.Meta.CreatedBy.AvatarUrl = userInDbAvatar
					result.Result.Meta.UpdatedBy.Name = userInDbName
					result.Result.Meta.UpdatedBy.AvatarUrl = userInDbAvatar
					result.Result.Meta.FolderName = folder.Title
					result.Result.Meta.FolderUID = folder.UID
					results = append(results, result.Result)
				}
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				for i, result := range results {
					sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result.UID})
					resp := sc.service.getHandler(sc.reqContext)
					require.Equal(t, testCase.statuses[i], resp.Status())
				}
			})

		testScenario(t, fmt.Sprintf("When %s tries to get a library panel from General folder, it should return correct response", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				cmd := getCreatePanelCommand(0, "Library Panel in General Folder")
				sc.reqContext.Req.Body = mockRequestBody(cmd)
				resp := sc.service.createHandler(sc.reqContext)
				result := validateAndUnMarshalResponse(t, resp)
				result.Result.Meta.CreatedBy.Name = userInDbName
				result.Result.Meta.CreatedBy.AvatarUrl = userInDbAvatar
				result.Result.Meta.UpdatedBy.Name = userInDbName
				result.Result.Meta.UpdatedBy.AvatarUrl = userInDbAvatar
				result.Result.Meta.FolderName = "General"
				result.Result.Meta.FolderUID = ""
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result.Result.UID})
				resp = sc.service.getHandler(sc.reqContext)
				require.Equal(t, 200, resp.Status())
				var actual libraryElementResult
				err := json.Unmarshal(resp.Body(), &actual)
				require.NoError(t, err)
				if diff := cmp.Diff(result.Result, actual.Result, getCompareOptions()...); diff != "" {
					t.Fatalf("Result mismatch (-want +got):\n%s", diff)
				}
			})
	}

	var getAllCases = []struct {
		role          org.RoleType
		panels        int
		folderIndexes []int
	}{
		{org.RoleAdmin, 7, []int{0, 1, 2, 3, 4, 5, 6}},
		{org.RoleEditor, 6, []int{0, 2, 3, 4, 5, 6}},
		{org.RoleViewer, 5, []int{0, 3, 4, 5, 6}},
	}

	for _, testCase := range getAllCases {
		testScenario(t, fmt.Sprintf("When %s tries to get all library panels, it should return correct response", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				var results []libraryElement
				for i, folderCase := range folderCases {
					folder := createFolderWithACL(t, sc.sqlStore, fmt.Sprintf("Folder%v", i), sc.user, folderCase)
					cmd := getCreatePanelCommand(folder.ID, fmt.Sprintf("Library Panel in Folder%v", i))
					sc.reqContext.Req.Body = mockRequestBody(cmd)
					resp := sc.service.createHandler(sc.reqContext)
					result := validateAndUnMarshalResponse(t, resp)
					result.Result.Meta.CreatedBy.Name = userInDbName
					result.Result.Meta.CreatedBy.AvatarUrl = userInDbAvatar
					result.Result.Meta.UpdatedBy.Name = userInDbName
					result.Result.Meta.UpdatedBy.AvatarUrl = userInDbAvatar
					result.Result.Meta.FolderName = folder.Title
					result.Result.Meta.FolderUID = folder.UID
					results = append(results, result.Result)
				}
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				resp := sc.service.getAllHandler(sc.reqContext)
				require.Equal(t, 200, resp.Status())
				var actual libraryElementsSearch
				err := json.Unmarshal(resp.Body(), &actual)
				require.NoError(t, err)
				require.Equal(t, testCase.panels, len(actual.Result.Elements))
				for _, folderIndex := range testCase.folderIndexes {
					var folderID = int64(folderIndex + 2) // testScenario creates one folder and general folder doesn't count
					var foundExists = false
					var foundResult libraryElement
					var actualExists = false
					var actualResult libraryElement
					for _, result := range results {
						if result.FolderID == folderID {
							foundExists = true
							foundResult = result
							break
						}
					}
					require.Equal(t, foundExists, true)

					for _, result := range actual.Result.Elements {
						if result.FolderID == folderID {
							actualExists = true
							actualResult = result
							break
						}
					}
					require.Equal(t, actualExists, true)

					if diff := cmp.Diff(foundResult, actualResult, getCompareOptions()...); diff != "" {
						t.Fatalf("Result mismatch (-want +got):\n%s", diff)
					}
				}
			})

		testScenario(t, fmt.Sprintf("When %s tries to get all library panels from General folder, it should return correct response", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				cmd := getCreatePanelCommand(0, "Library Panel in General Folder")
				sc.reqContext.Req.Body = mockRequestBody(cmd)
				resp := sc.service.createHandler(sc.reqContext)
				result := validateAndUnMarshalResponse(t, resp)
				result.Result.Meta.CreatedBy.Name = userInDbName
				result.Result.Meta.CreatedBy.AvatarUrl = userInDbAvatar
				result.Result.Meta.UpdatedBy.Name = userInDbName
				result.Result.Meta.UpdatedBy.AvatarUrl = userInDbAvatar
				result.Result.Meta.FolderName = "General"
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				resp = sc.service.getAllHandler(sc.reqContext)
				require.Equal(t, 200, resp.Status())
				var actual libraryElementsSearch
				err := json.Unmarshal(resp.Body(), &actual)
				require.NoError(t, err)
				require.Equal(t, 1, len(actual.Result.Elements))
				if diff := cmp.Diff(result.Result, actual.Result.Elements[0], getCompareOptions()...); diff != "" {
					t.Fatalf("Result mismatch (-want +got):\n%s", diff)
				}
			})
	}
}

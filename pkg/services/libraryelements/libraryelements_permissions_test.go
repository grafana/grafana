package libraryelements

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

func TestLibraryElementPermissions(t *testing.T) {
	var defaultPermissions = []folderACLItem{}
	var adminOnlyPermissions = []folderACLItem{{org.ROLE_ADMIN, models.PERMISSION_EDIT}}
	var editorOnlyPermissions = []folderACLItem{{org.ROLE_EDITOR, models.PERMISSION_EDIT}}
	var editorAndViewerPermissions = []folderACLItem{{org.ROLE_EDITOR, models.PERMISSION_EDIT}, {org.ROLE_VIEWER, models.PERMISSION_EDIT}}
	var viewerOnlyPermissions = []folderACLItem{{org.ROLE_VIEWER, models.PERMISSION_EDIT}}
	var everyonePermissions = []folderACLItem{{org.ROLE_ADMIN, models.PERMISSION_EDIT}, {org.ROLE_EDITOR, models.PERMISSION_EDIT}, {org.ROLE_VIEWER, models.PERMISSION_EDIT}}
	var noPermissions = []folderACLItem{{org.ROLE_VIEWER, models.PERMISSION_VIEW}}
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
		{org.ROLE_ADMIN, defaultPermissions, defaultDesc, 200},
		{org.ROLE_ADMIN, adminOnlyPermissions, adminOnlyDesc, 200},
		{org.ROLE_ADMIN, editorOnlyPermissions, editorOnlyDesc, 200},
		{org.ROLE_ADMIN, editorAndViewerPermissions, editorAndViewerDesc, 200},
		{org.ROLE_ADMIN, viewerOnlyPermissions, viewerOnlyDesc, 200},
		{org.ROLE_ADMIN, everyonePermissions, everyoneDesc, 200},
		{org.ROLE_ADMIN, noPermissions, noDesc, 200},

		{org.ROLE_EDITOR, defaultPermissions, defaultDesc, 200},
		{org.ROLE_EDITOR, adminOnlyPermissions, adminOnlyDesc, 403},
		{org.ROLE_EDITOR, editorOnlyPermissions, editorOnlyDesc, 200},
		{org.ROLE_EDITOR, editorAndViewerPermissions, editorAndViewerDesc, 200},
		{org.ROLE_EDITOR, viewerOnlyPermissions, viewerOnlyDesc, 403},
		{org.ROLE_EDITOR, everyonePermissions, everyoneDesc, 200},
		{org.ROLE_EDITOR, noPermissions, noDesc, 403},

		{org.ROLE_VIEWER, defaultPermissions, defaultDesc, 403},
		{org.ROLE_VIEWER, adminOnlyPermissions, adminOnlyDesc, 403},
		{org.ROLE_VIEWER, editorOnlyPermissions, editorOnlyDesc, 403},
		{org.ROLE_VIEWER, editorAndViewerPermissions, editorAndViewerDesc, 200},
		{org.ROLE_VIEWER, viewerOnlyPermissions, viewerOnlyDesc, 200},
		{org.ROLE_VIEWER, everyonePermissions, everyoneDesc, 200},
		{org.ROLE_VIEWER, noPermissions, noDesc, 403},
	}

	for _, testCase := range accessCases {
		testScenario(t, fmt.Sprintf("When %s tries to create a library panel in a folder with %s, it should return correct status", testCase.role, testCase.desc),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, testCase.items)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				command := getCreatePanelCommand(folder.Id, "Library Panel Name")
				sc.reqContext.Req.Body = mockRequestBody(command)
				resp := sc.service.createHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to patch a library panel by moving it to a folder with %s, it should return correct status", testCase.role, testCase.desc),
			func(t *testing.T, sc scenarioContext) {
				fromFolder := createFolderWithACL(t, sc.sqlStore, "Everyone", sc.user, everyonePermissions)
				command := getCreatePanelCommand(fromFolder.Id, "Library Panel Name")
				sc.reqContext.Req.Body = mockRequestBody(command)
				resp := sc.service.createHandler(sc.reqContext)
				result := validateAndUnMarshalResponse(t, resp)
				toFolder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, testCase.items)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := PatchLibraryElementCommand{FolderID: toFolder.Id, Version: 1, Kind: int64(models.PanelElement)}
				sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result.Result.UID})
				sc.reqContext.Req.Body = mockRequestBody(cmd)
				resp = sc.service.patchHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to patch a library panel by moving it from a folder with %s, it should return correct status", testCase.role, testCase.desc),
			func(t *testing.T, sc scenarioContext) {
				fromFolder := createFolderWithACL(t, sc.sqlStore, "Everyone", sc.user, testCase.items)
				command := getCreatePanelCommand(fromFolder.Id, "Library Panel Name")
				sc.reqContext.Req.Body = mockRequestBody(command)
				resp := sc.service.createHandler(sc.reqContext)
				result := validateAndUnMarshalResponse(t, resp)
				toFolder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, everyonePermissions)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := PatchLibraryElementCommand{FolderID: toFolder.Id, Version: 1, Kind: int64(models.PanelElement)}
				sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result.Result.UID})
				sc.reqContext.Req.Body = mockRequestBody(cmd)
				resp = sc.service.patchHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to delete a library panel in a folder with %s, it should return correct status", testCase.role, testCase.desc),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, testCase.items)
				cmd := getCreatePanelCommand(folder.Id, "Library Panel Name")
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
		{org.ROLE_ADMIN, 200},
		{org.ROLE_EDITOR, 200},
		{org.ROLE_VIEWER, 403},
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
				command := getCreatePanelCommand(folder.Id, "Library Panel Name")
				sc.reqContext.Req.Body = mockRequestBody(command)
				resp := sc.service.createHandler(sc.reqContext)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := PatchLibraryElementCommand{FolderID: 0, Version: 1, Kind: int64(models.PanelElement)}
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

				cmd := PatchLibraryElementCommand{FolderID: folder.Id, Version: 1, Kind: int64(models.PanelElement)}
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
		{org.ROLE_ADMIN},
		{org.ROLE_EDITOR},
		{org.ROLE_VIEWER},
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
				command := getCreatePanelCommand(folder.Id, "Library Panel Name")
				sc.reqContext.Req.Body = mockRequestBody(command)
				resp := sc.service.createHandler(sc.reqContext)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := PatchLibraryElementCommand{FolderID: -100, Version: 1, Kind: int64(models.PanelElement)}
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
		{org.ROLE_ADMIN, []int{200, 200, 200, 200, 200, 200, 200}},
		{org.ROLE_EDITOR, []int{200, 404, 200, 200, 200, 200, 200}},
		{org.ROLE_VIEWER, []int{200, 404, 404, 200, 200, 200, 200}},
	}

	for _, testCase := range getCases {
		testScenario(t, fmt.Sprintf("When %s tries to get a library panel, it should return correct response", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				var results []libraryElement
				for i, folderCase := range folderCases {
					folder := createFolderWithACL(t, sc.sqlStore, fmt.Sprintf("Folder%v", i), sc.user, folderCase)
					cmd := getCreatePanelCommand(folder.Id, fmt.Sprintf("Library Panel in Folder%v", i))
					sc.reqContext.Req.Body = mockRequestBody(cmd)
					resp := sc.service.createHandler(sc.reqContext)
					result := validateAndUnMarshalResponse(t, resp)
					result.Result.Meta.CreatedBy.Name = userInDbName
					result.Result.Meta.CreatedBy.AvatarURL = userInDbAvatar
					result.Result.Meta.UpdatedBy.Name = userInDbName
					result.Result.Meta.UpdatedBy.AvatarURL = userInDbAvatar
					result.Result.Meta.FolderName = folder.Title
					result.Result.Meta.FolderUID = folder.Uid
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
				result.Result.Meta.CreatedBy.AvatarURL = userInDbAvatar
				result.Result.Meta.UpdatedBy.Name = userInDbName
				result.Result.Meta.UpdatedBy.AvatarURL = userInDbAvatar
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
		{org.ROLE_ADMIN, 7, []int{0, 1, 2, 3, 4, 5, 6}},
		{org.ROLE_EDITOR, 6, []int{0, 2, 3, 4, 5, 6}},
		{org.ROLE_VIEWER, 5, []int{0, 3, 4, 5, 6}},
	}

	for _, testCase := range getAllCases {
		testScenario(t, fmt.Sprintf("When %s tries to get all library panels, it should return correct response", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				var results []libraryElement
				for i, folderCase := range folderCases {
					folder := createFolderWithACL(t, sc.sqlStore, fmt.Sprintf("Folder%v", i), sc.user, folderCase)
					cmd := getCreatePanelCommand(folder.Id, fmt.Sprintf("Library Panel in Folder%v", i))
					sc.reqContext.Req.Body = mockRequestBody(cmd)
					resp := sc.service.createHandler(sc.reqContext)
					result := validateAndUnMarshalResponse(t, resp)
					result.Result.Meta.CreatedBy.Name = userInDbName
					result.Result.Meta.CreatedBy.AvatarURL = userInDbAvatar
					result.Result.Meta.UpdatedBy.Name = userInDbName
					result.Result.Meta.UpdatedBy.AvatarURL = userInDbAvatar
					result.Result.Meta.FolderName = folder.Title
					result.Result.Meta.FolderUID = folder.Uid
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
				result.Result.Meta.CreatedBy.AvatarURL = userInDbAvatar
				result.Result.Meta.UpdatedBy.Name = userInDbName
				result.Result.Meta.UpdatedBy.AvatarURL = userInDbAvatar
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

package libraryelements

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
)

func TestLibraryElementPermissions(t *testing.T) {
	var defaultPermissions = []folderACLItem{}
	var adminOnlyPermissions = []folderACLItem{{models.ROLE_ADMIN, models.PERMISSION_EDIT}}
	var editorOnlyPermissions = []folderACLItem{{models.ROLE_EDITOR, models.PERMISSION_EDIT}}
	var editorAndViewerPermissions = []folderACLItem{{models.ROLE_EDITOR, models.PERMISSION_EDIT}, {models.ROLE_VIEWER, models.PERMISSION_EDIT}}
	var viewerOnlyPermissions = []folderACLItem{{models.ROLE_VIEWER, models.PERMISSION_EDIT}}
	var everyonePermissions = []folderACLItem{{models.ROLE_ADMIN, models.PERMISSION_EDIT}, {models.ROLE_EDITOR, models.PERMISSION_EDIT}, {models.ROLE_VIEWER, models.PERMISSION_EDIT}}
	var noPermissions = []folderACLItem{{models.ROLE_VIEWER, models.PERMISSION_VIEW}}
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
		role   models.RoleType
		items  []folderACLItem
		desc   string
		status int
	}{
		{models.ROLE_ADMIN, defaultPermissions, defaultDesc, 200},
		{models.ROLE_ADMIN, adminOnlyPermissions, adminOnlyDesc, 200},
		{models.ROLE_ADMIN, editorOnlyPermissions, editorOnlyDesc, 200},
		{models.ROLE_ADMIN, editorAndViewerPermissions, editorAndViewerDesc, 200},
		{models.ROLE_ADMIN, viewerOnlyPermissions, viewerOnlyDesc, 200},
		{models.ROLE_ADMIN, everyonePermissions, everyoneDesc, 200},
		{models.ROLE_ADMIN, noPermissions, noDesc, 200},
		{models.ROLE_EDITOR, defaultPermissions, defaultDesc, 200},
		{models.ROLE_EDITOR, adminOnlyPermissions, adminOnlyDesc, 403},
		{models.ROLE_EDITOR, editorOnlyPermissions, editorOnlyDesc, 200},
		{models.ROLE_EDITOR, editorAndViewerPermissions, editorAndViewerDesc, 200},
		{models.ROLE_EDITOR, viewerOnlyPermissions, viewerOnlyDesc, 403},
		{models.ROLE_EDITOR, everyonePermissions, everyoneDesc, 200},
		{models.ROLE_EDITOR, noPermissions, noDesc, 403},
		{models.ROLE_VIEWER, defaultPermissions, defaultDesc, 403},
		{models.ROLE_VIEWER, adminOnlyPermissions, adminOnlyDesc, 403},
		{models.ROLE_VIEWER, editorOnlyPermissions, editorOnlyDesc, 403},
		{models.ROLE_VIEWER, editorAndViewerPermissions, editorAndViewerDesc, 200},
		{models.ROLE_VIEWER, viewerOnlyPermissions, viewerOnlyDesc, 200},
		{models.ROLE_VIEWER, everyonePermissions, everyoneDesc, 200},
		{models.ROLE_VIEWER, noPermissions, noDesc, 403},
	}

	for _, testCase := range accessCases {
		testScenario(t, fmt.Sprintf("When %s tries to create a library panel in a folder with %s, it should return correct status", testCase.role, testCase.desc),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, testCase.items)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				command := getCreatePanelCommand(folder.Id, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to patch a library panel by moving it to a folder with %s, it should return correct status", testCase.role, testCase.desc),
			func(t *testing.T, sc scenarioContext) {
				fromFolder := createFolderWithACL(t, sc.sqlStore, "Everyone", sc.user, everyonePermissions)
				command := getCreatePanelCommand(fromFolder.Id, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				result := validateAndUnMarshalResponse(t, resp)
				toFolder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, testCase.items)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := patchLibraryElementCommand{FolderID: toFolder.Id, Version: 1, Kind: int64(models.PanelElement)}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to patch a library panel by moving it from a folder with %s, it should return correct status", testCase.role, testCase.desc),
			func(t *testing.T, sc scenarioContext) {
				fromFolder := createFolderWithACL(t, sc.sqlStore, "Everyone", sc.user, testCase.items)
				command := getCreatePanelCommand(fromFolder.Id, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				result := validateAndUnMarshalResponse(t, resp)
				toFolder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, everyonePermissions)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := patchLibraryElementCommand{FolderID: toFolder.Id, Version: 1, Kind: int64(models.PanelElement)}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to delete a library panel in a folder with %s, it should return correct status", testCase.role, testCase.desc),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, testCase.items)
				cmd := getCreatePanelCommand(folder.Id, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, cmd)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.deleteHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})
	}

	var generalFolderCases = []struct {
		role   models.RoleType
		status int
	}{
		{models.ROLE_ADMIN, 200},
		{models.ROLE_EDITOR, 200},
		{models.ROLE_VIEWER, 403},
	}

	for _, testCase := range generalFolderCases {
		testScenario(t, fmt.Sprintf("When %s tries to create a library panel in the General folder, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				command := getCreatePanelCommand(0, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to patch a library panel by moving it to the General folder, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, everyonePermissions)
				command := getCreatePanelCommand(folder.Id, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := patchLibraryElementCommand{FolderID: 0, Version: 1, Kind: int64(models.PanelElement)}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to patch a library panel by moving it from the General folder, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, everyonePermissions)
				command := getCreatePanelCommand(0, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := patchLibraryElementCommand{FolderID: folder.Id, Version: 1, Kind: int64(models.PanelElement)}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to delete a library panel in the General folder, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				cmd := getCreatePanelCommand(0, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, cmd)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.deleteHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})
	}

	var missingFolderCases = []struct {
		role models.RoleType
	}{
		{models.ROLE_ADMIN},
		{models.ROLE_EDITOR},
		{models.ROLE_VIEWER},
	}

	for _, testCase := range missingFolderCases {
		testScenario(t, fmt.Sprintf("When %s tries to create a library panel in a folder that doesn't exist, it should fail", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				command := getCreatePanelCommand(-100, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				require.Equal(t, 404, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to patch a library panel by moving it to a folder that doesn't exist, it should fail", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, everyonePermissions)
				command := getCreatePanelCommand(folder.Id, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := patchLibraryElementCommand{FolderID: -100, Version: 1, Kind: int64(models.PanelElement)}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, 404, resp.Status())
			})
	}

	var getCases = []struct {
		role     models.RoleType
		statuses []int
	}{
		{models.ROLE_ADMIN, []int{200, 200, 200, 200, 200, 200, 200}},
		{models.ROLE_EDITOR, []int{200, 404, 200, 200, 200, 200, 200}},
		{models.ROLE_VIEWER, []int{200, 404, 404, 200, 200, 200, 200}},
	}

	for _, testCase := range getCases {
		testScenario(t, fmt.Sprintf("When %s tries to get a library panel, it should return correct response", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				var results []libraryElement
				for i, folderCase := range folderCases {
					folder := createFolderWithACL(t, sc.sqlStore, fmt.Sprintf("Folder%v", i), sc.user, folderCase)
					cmd := getCreatePanelCommand(folder.Id, fmt.Sprintf("Library Panel in Folder%v", i))
					resp := sc.service.createHandler(sc.reqContext, cmd)
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
					sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.UID})
					resp := sc.service.getHandler(sc.reqContext)
					require.Equal(t, testCase.statuses[i], resp.Status())
				}
			})

		testScenario(t, fmt.Sprintf("When %s tries to get a library panel from General folder, it should return correct response", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				cmd := getCreatePanelCommand(0, "Library Panel in General Folder")
				resp := sc.service.createHandler(sc.reqContext, cmd)
				result := validateAndUnMarshalResponse(t, resp)
				result.Result.Meta.CreatedBy.Name = userInDbName
				result.Result.Meta.CreatedBy.AvatarURL = userInDbAvatar
				result.Result.Meta.UpdatedBy.Name = userInDbName
				result.Result.Meta.UpdatedBy.AvatarURL = userInDbAvatar
				result.Result.Meta.FolderName = "General"
				result.Result.Meta.FolderUID = ""
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
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
		role          models.RoleType
		panels        int
		folderIndexes []int
	}{
		{models.ROLE_ADMIN, 7, []int{0, 1, 2, 3, 4, 5, 6}},
		{models.ROLE_EDITOR, 6, []int{0, 2, 3, 4, 5, 6}},
		{models.ROLE_VIEWER, 5, []int{0, 3, 4, 5, 6}},
	}

	for _, testCase := range getAllCases {
		testScenario(t, fmt.Sprintf("When %s tries to get all library panels, it should return correct response", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				var results []libraryElement
				for i, folderCase := range folderCases {
					folder := createFolderWithACL(t, sc.sqlStore, fmt.Sprintf("Folder%v", i), sc.user, folderCase)
					cmd := getCreatePanelCommand(folder.Id, fmt.Sprintf("Library Panel in Folder%v", i))
					resp := sc.service.createHandler(sc.reqContext, cmd)
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
				resp := sc.service.createHandler(sc.reqContext, cmd)
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

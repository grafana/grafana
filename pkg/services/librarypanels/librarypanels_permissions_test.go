package librarypanels

import (
	"encoding/json"
	"fmt"
	"strconv"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestLibraryPanelPermissions(t *testing.T) {
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

				command := getCreateCommand(folder.Id, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to patch a library panel by moving it to a folder with %s, it should return correct status", testCase.role, testCase.desc),
			func(t *testing.T, sc scenarioContext) {
				fromFolder := createFolderWithACL(t, sc.sqlStore, "Everyone", sc.user, everyonePermissions)
				command := getCreateCommand(fromFolder.Id, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				result := validateAndUnMarshalResponse(t, resp)
				toFolder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, testCase.items)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := patchLibraryPanelCommand{FolderID: toFolder.Id, Version: 1}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to patch a library panel by moving it from a folder with %s, it should return correct status", testCase.role, testCase.desc),
			func(t *testing.T, sc scenarioContext) {
				fromFolder := createFolderWithACL(t, sc.sqlStore, "Everyone", sc.user, testCase.items)
				command := getCreateCommand(fromFolder.Id, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				result := validateAndUnMarshalResponse(t, resp)
				toFolder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, everyonePermissions)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := patchLibraryPanelCommand{FolderID: toFolder.Id, Version: 1}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to delete a library panel in a folder with %s, it should return correct status", testCase.role, testCase.desc),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, testCase.items)
				cmd := getCreateCommand(folder.Id, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, cmd)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.deleteHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to connect a library panel in a folder with %s, it should return correct status", testCase.role, testCase.desc),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, testCase.items)
				dashboard := createDashboard(t, sc.sqlStore, sc.user, "Some Folder Dash", folder.Id)
				cmd := getCreateCommand(folder.Id, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, cmd)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID, ":dashboardId": strconv.FormatInt(dashboard.Id, 10)})
				resp = sc.service.connectHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to disconnect a library panel in a folder with %s, it should return correct status", testCase.role, testCase.desc),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, testCase.items)
				dashboard := createDashboard(t, sc.sqlStore, sc.user, "Some Folder Dash", folder.Id)
				cmd := getCreateCommand(folder.Id, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, cmd)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID, ":dashboardId": strconv.FormatInt(dashboard.Id, 10)})
				resp = sc.service.connectHandler(sc.reqContext)
				require.Equal(t, 200, resp.Status())
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID, ":dashboardId": strconv.FormatInt(dashboard.Id, 10)})
				resp = sc.service.disconnectHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to delete all library panels in a folder with %s, it should return correct status", testCase.role, testCase.desc),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, testCase.items)
				cmd := getCreateCommand(folder.Id, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, cmd)
				validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				err := sc.service.DeleteLibraryPanelsInFolder(sc.reqContext, folder.Uid)
				switch testCase.status {
				case 200:
					require.NoError(t, err)
				case 403:
					require.EqualError(t, err, models.ErrFolderAccessDenied.Error())
				default:
					t.Fatalf("Unrecognized test case status %d", testCase.status)
				}
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

				command := getCreateCommand(0, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to patch a library panel by moving it to the General folder, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, everyonePermissions)
				command := getCreateCommand(folder.Id, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := patchLibraryPanelCommand{FolderID: 0, Version: 1}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to patch a library panel by moving it from the General folder, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, everyonePermissions)
				command := getCreateCommand(0, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := patchLibraryPanelCommand{FolderID: folder.Id, Version: 1}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to delete a library panel in the General folder, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				cmd := getCreateCommand(0, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, cmd)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.deleteHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to connect a library panel in the General folder, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				dashboard := createDashboard(t, sc.sqlStore, sc.user, "General Folder Dash", 0)
				cmd := getCreateCommand(0, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, cmd)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID, ":dashboardId": strconv.FormatInt(dashboard.Id, 10)})
				resp = sc.service.connectHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to disconnect a library panel in the General folder, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				dashboard := createDashboard(t, sc.sqlStore, sc.user, "General Folder Dash", 0)
				cmd := getCreateCommand(0, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, cmd)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID, ":dashboardId": strconv.FormatInt(dashboard.Id, 10)})
				resp = sc.service.connectHandler(sc.reqContext)
				require.Equal(t, 200, resp.Status())
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID, ":dashboardId": strconv.FormatInt(dashboard.Id, 10)})
				resp = sc.service.disconnectHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to get connected dashboards in the General folder for a library panel in the General folder, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				dashboard := createDashboard(t, sc.sqlStore, sc.user, "General Folder Dash", 0)
				cmd := getCreateCommand(0, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, cmd)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID, ":dashboardId": strconv.FormatInt(dashboard.Id, 10)})
				resp = sc.service.connectHandler(sc.reqContext)
				require.Equal(t, 200, resp.Status())
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.getConnectedDashboardsHandler(sc.reqContext)
				require.Equal(t, 200, resp.Status())
				var dashResult libraryPanelDashboardsResult
				err := json.Unmarshal(resp.Body(), &dashResult)
				require.NoError(t, err)
				require.Equal(t, 200, resp.Status())
				require.Equal(t, 1, len(dashResult.Result))
				require.Equal(t, dashboard.Id, dashResult.Result[0])
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

				command := getCreateCommand(-100, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				require.Equal(t, 404, resp.Status())
			})

		testScenario(t, fmt.Sprintf("When %s tries to patch a library panel by moving it to a folder that doesn't exist, it should fail", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				folder := createFolderWithACL(t, sc.sqlStore, "Folder", sc.user, everyonePermissions)
				command := getCreateCommand(folder.Id, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				result := validateAndUnMarshalResponse(t, resp)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				cmd := patchLibraryPanelCommand{FolderID: -100, Version: 1}
				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.patchHandler(sc.reqContext, cmd)
				require.Equal(t, 404, resp.Status())
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
				var results []libraryPanel
				for i, folderCase := range folderCases {
					folder := createFolderWithACL(t, sc.sqlStore, fmt.Sprintf("Folder%v", i), sc.user, folderCase)
					cmd := getCreateCommand(folder.Id, fmt.Sprintf("Library Panel in Folder%v", i))
					resp := sc.service.createHandler(sc.reqContext, cmd)
					result := validateAndUnMarshalResponse(t, resp)
					result.Result.Meta.CreatedBy.Name = UserInDbName
					result.Result.Meta.CreatedBy.AvatarUrl = UserInDbAvatar
					result.Result.Meta.UpdatedBy.Name = UserInDbName
					result.Result.Meta.UpdatedBy.AvatarUrl = UserInDbAvatar
					result.Result.Meta.FolderName = folder.Title
					result.Result.Meta.FolderUID = folder.Uid
					results = append(results, result.Result)
				}
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				resp := sc.service.getAllHandler(sc.reqContext)
				require.Equal(t, 200, resp.Status())
				var actual libraryPanelsSearch
				err := json.Unmarshal(resp.Body(), &actual)
				require.NoError(t, err)
				require.Equal(t, testCase.panels, len(actual.Result.LibraryPanels))
				for _, folderIndex := range testCase.folderIndexes {
					var folderID = int64(folderIndex + 2) // testScenario creates one folder and general folder doesn't count
					var foundResult libraryPanel
					var actualResult libraryPanel
					for _, result := range results {
						if result.FolderID == folderID {
							foundResult = result
							break
						}
					}
					require.NotEmpty(t, foundResult)

					for _, result := range actual.Result.LibraryPanels {
						if result.FolderID == folderID {
							actualResult = result
							break
						}
					}
					require.NotEmpty(t, actualResult)

					if diff := cmp.Diff(foundResult, actualResult, getCompareOptions()...); diff != "" {
						t.Fatalf("Result mismatch (-want +got):\n%s", diff)
					}
				}
			})

		testScenario(t, fmt.Sprintf("When %s tries to get all library panels from General folder, it should return correct response", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				cmd := getCreateCommand(0, "Library Panel in General Folder")
				resp := sc.service.createHandler(sc.reqContext, cmd)
				result := validateAndUnMarshalResponse(t, resp)
				result.Result.Meta.CreatedBy.Name = UserInDbName
				result.Result.Meta.CreatedBy.AvatarUrl = UserInDbAvatar
				result.Result.Meta.UpdatedBy.Name = UserInDbName
				result.Result.Meta.UpdatedBy.AvatarUrl = UserInDbAvatar
				result.Result.Meta.FolderName = "General"
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				resp = sc.service.getAllHandler(sc.reqContext)
				require.Equal(t, 200, resp.Status())
				var actual libraryPanelsSearch
				err := json.Unmarshal(resp.Body(), &actual)
				require.NoError(t, err)
				require.Equal(t, 1, len(actual.Result.LibraryPanels))
				if diff := cmp.Diff(result.Result, actual.Result.LibraryPanels[0], getCompareOptions()...); diff != "" {
					t.Fatalf("Result mismatch (-want +got):\n%s", diff)
				}
			})

		testScenario(t, fmt.Sprintf("When %s tries to get connected dashboards for a library panel, it should return correct connected dashboard IDs", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				cmd := getCreateCommand(0, "Library Panel in General Folder")
				resp := sc.service.createHandler(sc.reqContext, cmd)
				result := validateAndUnMarshalResponse(t, resp)
				for i, folderCase := range folderCases {
					folder := createFolderWithACL(t, sc.sqlStore, fmt.Sprintf("Folder%v", i), sc.user, folderCase)
					dashboard := createDashboard(t, sc.sqlStore, sc.user, "Some Folder Dash", folder.Id)
					sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID, ":dashboardId": strconv.FormatInt(dashboard.Id, 10)})
					resp = sc.service.connectHandler(sc.reqContext)
					require.Equal(t, 200, resp.Status())
				}
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.getConnectedDashboardsHandler(sc.reqContext)
				require.Equal(t, 200, resp.Status())

				var dashResult libraryPanelDashboardsResult
				err := json.Unmarshal(resp.Body(), &dashResult)
				require.NoError(t, err)
				require.Equal(t, testCase.panels, len(dashResult.Result))
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
				var results []libraryPanel
				for i, folderCase := range folderCases {
					folder := createFolderWithACL(t, sc.sqlStore, fmt.Sprintf("Folder%v", i), sc.user, folderCase)
					cmd := getCreateCommand(folder.Id, fmt.Sprintf("Library Panel in Folder%v", i))
					resp := sc.service.createHandler(sc.reqContext, cmd)
					result := validateAndUnMarshalResponse(t, resp)
					result.Result.Meta.CreatedBy.Name = UserInDbName
					result.Result.Meta.CreatedBy.AvatarUrl = UserInDbAvatar
					result.Result.Meta.UpdatedBy.Name = UserInDbName
					result.Result.Meta.UpdatedBy.AvatarUrl = UserInDbAvatar
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
				cmd := getCreateCommand(0, "Library Panel in General Folder")
				resp := sc.service.createHandler(sc.reqContext, cmd)
				result := validateAndUnMarshalResponse(t, resp)
				result.Result.Meta.CreatedBy.Name = UserInDbName
				result.Result.Meta.CreatedBy.AvatarUrl = UserInDbAvatar
				result.Result.Meta.UpdatedBy.Name = UserInDbName
				result.Result.Meta.UpdatedBy.AvatarUrl = UserInDbAvatar
				result.Result.Meta.FolderName = "General"
				result.Result.Meta.FolderUID = ""
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID})
				resp = sc.service.getHandler(sc.reqContext)
				require.Equal(t, 200, resp.Status())
				var actual libraryPanelResult
				err := json.Unmarshal(resp.Body(), &actual)
				require.NoError(t, err)
				if diff := cmp.Diff(result.Result, actual.Result, getCompareOptions()...); diff != "" {
					t.Fatalf("Result mismatch (-want +got):\n%s", diff)
				}
			})
	}
}

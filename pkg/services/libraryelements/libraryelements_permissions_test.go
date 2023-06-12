package libraryelements

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/web"
)

func TestLibraryElementPermissionsGeneralFolder(t *testing.T) {
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
				folder := createFolder(t, sc, "Folder")
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
				folder := createFolder(t, sc, "Folder")
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

func TestLibraryElementCreatePermissions(t *testing.T) {
	var accessCases = []struct {
		permissions map[string][]string
		desc        string
		status      int
	}{
		{
			desc: "can create library elements when granted write access to the correct folder",
			permissions: map[string][]string{
				dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("Folder")},
				dashboards.ActionFoldersRead:  {dashboards.ScopeFoldersProvider.GetResourceAllScope()},
			},
			status: http.StatusOK,
		},
		{
			desc: "can create library elements when granted write access to all folders",
			permissions: map[string][]string{
				dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersProvider.GetResourceAllScope()},
				dashboards.ActionFoldersRead:  {dashboards.ScopeFoldersProvider.GetResourceAllScope()},
			},
			status: http.StatusOK,
		},
		{
			desc: "can't create library elements when granted write access to the wrong folder",
			permissions: map[string][]string{
				dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("Other_folder")},
				dashboards.ActionFoldersRead:  {dashboards.ScopeFoldersProvider.GetResourceAllScope()},
			},
			status: http.StatusForbidden,
		},
		{
			desc: "can't create library elements when granted read access to the right folder",
			permissions: map[string][]string{
				dashboards.ActionFoldersRead: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("Folder")},
			},
			status: http.StatusForbidden,
		},
	}

	for _, testCase := range accessCases {
		testScenario(t, testCase.desc,
			func(t *testing.T, sc scenarioContext) {
				folder := createFolder(t, sc, "Folder")
				sc.reqContext.SignedInUser.Permissions = map[int64]map[string][]string{
					1: testCase.permissions,
				}

				command := getCreatePanelCommand(folder.ID, "Library Panel Name")
				sc.reqContext.Req.Body = mockRequestBody(command)
				resp := sc.service.createHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})
	}
}

func TestLibraryElementPatchPermissions(t *testing.T) {
	var accessCases = []struct {
		permissions map[string][]string
		desc        string
		status      int
	}{
		{
			desc: "can move library elements when granted write access to the source and destination folders",
			permissions: map[string][]string{
				dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("FromFolder"), dashboards.ScopeFoldersProvider.GetResourceScopeUID("ToFolder")},
				dashboards.ActionFoldersRead:  {dashboards.ScopeFoldersProvider.GetResourceAllScope()},
			},
			status: http.StatusOK,
		},
		{
			desc: "can move library elements when granted write access to all folders",
			permissions: map[string][]string{
				dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersProvider.GetResourceAllScope()},
				dashboards.ActionFoldersRead:  {dashboards.ScopeFoldersProvider.GetResourceAllScope()},
			},
			status: http.StatusOK,
		},
		{
			desc: "can't move library elements when granted write access only to the source folder",
			permissions: map[string][]string{
				dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("FromFolder")},
				dashboards.ActionFoldersRead:  {dashboards.ScopeFoldersProvider.GetResourceAllScope()},
			},
			status: http.StatusForbidden,
		},
		{
			desc: "can't move library elements when granted write access to the destination folder",
			permissions: map[string][]string{
				dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("ToFolder")},
				dashboards.ActionFoldersRead:  {dashboards.ScopeFoldersProvider.GetResourceAllScope()},
			},
			status: http.StatusForbidden,
		},
	}

	for _, testCase := range accessCases {
		testScenario(t, testCase.desc,
			func(t *testing.T, sc scenarioContext) {
				fromFolder := createFolder(t, sc, "FromFolder")
				command := getCreatePanelCommand(fromFolder.ID, "Library Panel Name")
				sc.reqContext.Req.Body = mockRequestBody(command)
				resp := sc.service.createHandler(sc.reqContext)
				result := validateAndUnMarshalResponse(t, resp)

				toFolder := createFolder(t, sc, "ToFolder")

				sc.reqContext.SignedInUser.Permissions = map[int64]map[string][]string{
					1: testCase.permissions,
				}

				cmd := model.PatchLibraryElementCommand{FolderID: toFolder.ID, Version: 1, Kind: int64(model.PanelElement)}
				sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result.Result.UID})
				sc.reqContext.Req.Body = mockRequestBody(cmd)
				resp = sc.service.patchHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})
	}
}

func TestLibraryElementDeletePermissions(t *testing.T) {
	var accessCases = []struct {
		permissions map[string][]string
		desc        string
		status      int
	}{
		{
			desc: "can delete library elements when granted write access to the correct folder",
			permissions: map[string][]string{
				dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("Folder")},
			},
			status: http.StatusOK,
		},
		{
			desc: "can delete library elements when granted write access to all folders",
			permissions: map[string][]string{
				dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersProvider.GetResourceAllScope()},
			},
			status: http.StatusOK,
		},
		{
			desc: "can't delete library elements when granted write access to the wrong folder",
			permissions: map[string][]string{
				dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("Other_folder")},
			},
			status: http.StatusForbidden,
		},
		{
			desc: "can't delete library elements when granted read access to the right folder",
			permissions: map[string][]string{
				dashboards.ActionFoldersRead: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("Folder")},
			},
			status: http.StatusForbidden,
		},
	}

	for _, testCase := range accessCases {
		testScenario(t, testCase.desc,
			func(t *testing.T, sc scenarioContext) {
				folder := createFolder(t, sc, "Folder")
				command := getCreatePanelCommand(folder.ID, "Library Panel Name")
				sc.reqContext.Req.Body = mockRequestBody(command)
				resp := sc.service.createHandler(sc.reqContext)
				result := validateAndUnMarshalResponse(t, resp)

				sc.reqContext.SignedInUser.Permissions = map[int64]map[string][]string{
					1: testCase.permissions,
				}

				sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result.Result.UID})
				resp = sc.service.deleteHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})
	}
}

func TestLibraryElementsWithMissingFolders(t *testing.T) {
	testScenario(t, "When a user tries to create a library panel in a folder that doesn't exist, it should fail",
		func(t *testing.T, sc scenarioContext) {
			command := getCreatePanelCommand(-100, "Library Panel Name")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 404, resp.Status())
		})

	testScenario(t, "When a user tries to patch a library panel by moving it to a folder that doesn't exist, it should fail",
		func(t *testing.T, sc scenarioContext) {
			folder := createFolder(t, sc, "Folder")
			command := getCreatePanelCommand(folder.ID, "Library Panel Name")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			result := validateAndUnMarshalResponse(t, resp)

			cmd := model.PatchLibraryElementCommand{FolderID: -100, Version: 1, Kind: int64(model.PanelElement)}
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result.Result.UID})
			sc.reqContext.Req.Body = mockRequestBody(cmd)
			resp = sc.service.patchHandler(sc.reqContext)
			require.Equal(t, 404, resp.Status())
		})
}

func TestLibraryElementsGetPermissions(t *testing.T) {
	var getCases = []struct {
		permissions map[string][]string
		desc        string
		status      int
	}{
		{
			desc: "can get a library element when granted read access to all folders",
			permissions: map[string][]string{
				dashboards.ActionFoldersRead: {dashboards.ScopeFoldersProvider.GetResourceAllScope()},
			},
			status: http.StatusOK,
		},
		{
			desc: "can't list library element when granted read access to the wrong folder",
			permissions: map[string][]string{
				dashboards.ActionFoldersRead: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("Other_folder")},
			},
			status: http.StatusNotFound,
		},
	}
	for _, testCase := range getCases {
		testScenario(t, testCase.desc,
			func(t *testing.T, sc scenarioContext) {
				folder := createFolder(t, sc, "Folder")
				cmd := getCreatePanelCommand(folder.ID, "Library Panel")
				sc.reqContext.Req.Body = mockRequestBody(cmd)
				resp := sc.service.createHandler(sc.reqContext)
				result := validateAndUnMarshalResponse(t, resp)
				result.Result.Meta.CreatedBy.Name = userInDbName
				result.Result.Meta.CreatedBy.AvatarUrl = userInDbAvatar
				result.Result.Meta.UpdatedBy.Name = userInDbName
				result.Result.Meta.UpdatedBy.AvatarUrl = userInDbAvatar
				result.Result.Meta.FolderName = folder.Title
				result.Result.Meta.FolderUID = folder.UID

				sc.reqContext.SignedInUser.OrgRole = org.RoleViewer
				sc.reqContext.SignedInUser.Permissions = map[int64]map[string][]string{
					1: testCase.permissions,
				}

				sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result.Result.UID})
				resp = sc.service.getHandler(sc.reqContext)
				require.Equal(t, testCase.status, resp.Status())
			})
	}
}

func TestLibraryElementsGetAllPermissions(t *testing.T) {
	var getCases = []struct {
		permissions         map[string][]string
		desc                string
		status              int
		expectedResultCount int
	}{
		{
			desc: "can get all library elements when granted read access to all folders",
			permissions: map[string][]string{
				dashboards.ActionFoldersRead: {dashboards.ScopeFoldersProvider.GetResourceAllScope()},
			},
			expectedResultCount: 2,
			status:              http.StatusOK,
		},
		{
			desc:                "can't get any library element when doesn't have access to any folders",
			permissions:         map[string][]string{},
			expectedResultCount: 0,
			status:              http.StatusOK,
		},
	}
	for _, testCase := range getCases {
		testScenario(t, testCase.desc,
			func(t *testing.T, sc scenarioContext) {
				for i := 1; i <= 2; i++ {
					folder := createFolder(t, sc, fmt.Sprintf("Folder%d", i))
					cmd := getCreatePanelCommand(folder.ID, fmt.Sprintf("Library Panel %d", i))
					sc.reqContext.Req.Body = mockRequestBody(cmd)
					resp := sc.service.createHandler(sc.reqContext)
					result := validateAndUnMarshalResponse(t, resp)
					result.Result.Meta.FolderUID = folder.UID
				}

				sc.reqContext.SignedInUser.OrgRole = org.RoleViewer
				sc.reqContext.SignedInUser.Permissions = map[int64]map[string][]string{
					1: testCase.permissions,
				}

				resp := sc.service.getAllHandler(sc.reqContext)
				require.Equal(t, 200, resp.Status())
				var actual libraryElementsSearch
				err := json.Unmarshal(resp.Body(), &actual)
				require.NoError(t, err)
				require.Equal(t, testCase.expectedResultCount, len(actual.Result.Elements))
			})
	}
}

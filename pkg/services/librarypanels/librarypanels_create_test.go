package librarypanels

import (
	"fmt"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
)

var roleTests = []struct {
	role models.RoleType
}{
	{models.ROLE_ADMIN},
	{models.ROLE_EDITOR},
	{models.ROLE_VIEWER},
}

var generalFolderTests = []struct {
	role   models.RoleType
	status int
}{
	{models.ROLE_ADMIN, 200},
	{models.ROLE_EDITOR, 200},
	{models.ROLE_VIEWER, 403},
}

var noFolderAccessTests = []struct {
	role               models.RoleType
	adminFolderStatus  int
	editorFolderStatus int
	viewerFolderStatus int
	noneFolderStatus   int
}{
	{models.ROLE_ADMIN, 200, 200, 200, 200},
	{models.ROLE_EDITOR, 403, 200, 200, 403},
	{models.ROLE_VIEWER, 403, 403, 200, 403},
}

func TestCreateLibraryPanel(t *testing.T) {
	scenarioWithLibraryPanel(t, "When an admin tries to create a library panel that already exists, it should fail",
		func(t *testing.T, sc scenarioContext) {
			command := getCreateCommand(sc.folder.Id, "Text - Library Panel")
			resp := sc.service.createHandler(sc.reqContext, command)
			require.Equal(t, 400, resp.Status())
		})

	scenarioWithLibraryPanel(t, "When an admin tries to create a library panel that does not exists, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			var expected = libraryPanelResult{
				Result: libraryPanel{
					ID:       1,
					OrgID:    1,
					FolderID: 1,
					UID:      sc.initialResult.Result.UID,
					Name:     "Text - Library Panel",
					Model: map[string]interface{}{
						"datasource": "${DS_GDEV-TESTDATA}",
						"id":         float64(1),
						"title":      "Text - Library Panel",
						"type":       "text",
					},
					Meta: LibraryPanelDTOMeta{
						CanEdit:             true,
						ConnectedDashboards: 0,
						Created:             sc.initialResult.Result.Meta.Created,
						Updated:             sc.initialResult.Result.Meta.Updated,
						CreatedBy: LibraryPanelDTOMetaUser{
							ID:        1,
							Name:      "signed_in_user",
							AvatarUrl: "/avatar/37524e1eb8b3e32850b57db0a19af93b",
						},
						UpdatedBy: LibraryPanelDTOMetaUser{
							ID:        1,
							Name:      "signed_in_user",
							AvatarUrl: "/avatar/37524e1eb8b3e32850b57db0a19af93b",
						},
					},
				},
			}
			if diff := cmp.Diff(expected, sc.initialResult, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	testScenario(t, "When an admin tries to create a library panel where name and panel title differ, it should update panel title",
		func(t *testing.T, sc scenarioContext) {
			command := getCreateCommand(1, "Library Panel Name")
			resp := sc.service.createHandler(sc.reqContext, command)
			var result = validateAndUnMarshalResponse(t, resp)
			var expected = libraryPanelResult{
				Result: libraryPanel{
					ID:       1,
					OrgID:    1,
					FolderID: 1,
					UID:      result.Result.UID,
					Name:     "Library Panel Name",
					Model: map[string]interface{}{
						"datasource": "${DS_GDEV-TESTDATA}",
						"id":         float64(1),
						"title":      "Library Panel Name",
						"type":       "text",
					},
					Meta: LibraryPanelDTOMeta{
						CanEdit:             true,
						ConnectedDashboards: 0,
						Created:             result.Result.Meta.Created,
						Updated:             result.Result.Meta.Updated,
						CreatedBy: LibraryPanelDTOMetaUser{
							ID:        1,
							Name:      "signed_in_user",
							AvatarUrl: "/avatar/37524e1eb8b3e32850b57db0a19af93b",
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

	for _, testCase := range roleTests {
		testScenario(t, fmt.Sprintf("When an %s tries to create a library panel and the folder doesn't exist, it should fail", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				sc.reqContext.SignedInUser.OrgRole = testCase.role
				command := getCreateCommand(-1, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				require.Equal(t, 404, resp.Status())
			})
	}

	for _, testCase := range generalFolderTests {
		testScenario(t, fmt.Sprintf("When an %s tries to create a library panel in the General folder, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				sc.reqContext.SignedInUser.OrgRole = testCase.role
				command := getCreateCommand(0, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				require.Equal(t, testCase.status, resp.Status())
			})
	}

	for _, testCase := range noFolderAccessTests {
		testScenario(t, fmt.Sprintf("When an %s tries to create a library panel in a folder the user has no access to, it should return correct status", testCase.role),
			func(t *testing.T, sc scenarioContext) {
				adminFolder := createFolderWithACL(t, "AdminFolder", sc.user, models.ROLE_ADMIN, models.PERMISSION_ADMIN)
				editorFolder := createFolderWithACL(t, "EditorFolder", sc.user, models.ROLE_EDITOR, models.PERMISSION_EDIT)
				viewerFolder := createFolderWithACL(t, "ViewerFolder", sc.user, models.ROLE_VIEWER, models.PERMISSION_EDIT)
				noneFolder := createFolderWithACL(t, "NoneFolder", sc.user, models.ROLE_VIEWER, models.PERMISSION_VIEW)
				sc.reqContext.SignedInUser.OrgRole = testCase.role

				command := getCreateCommand(adminFolder.Id, "Library Panel Name")
				resp := sc.service.createHandler(sc.reqContext, command)
				require.Equal(t, testCase.adminFolderStatus, resp.Status())

				command = getCreateCommand(editorFolder.Id, "Library Panel Name")
				resp = sc.service.createHandler(sc.reqContext, command)
				require.Equal(t, testCase.editorFolderStatus, resp.Status())

				command = getCreateCommand(viewerFolder.Id, "Library Panel Name")
				resp = sc.service.createHandler(sc.reqContext, command)
				require.Equal(t, testCase.viewerFolderStatus, resp.Status())

				command = getCreateCommand(noneFolder.Id, "Library Panel Name")
				resp = sc.service.createHandler(sc.reqContext, command)
				require.Equal(t, testCase.noneFolderStatus, resp.Status())
			})
	}
}

package navbarpreferences

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
)

func TestCreateNavbarPreference(t *testing.T) {
	testScenario(t, "When an admin tries to create a navbar preference that already exists, it should fail",
		func(t *testing.T, sc scenarioContext) {
			command := getCreatePanelCommand(sc.folder.Id, "Text - Library Panel")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 400, resp.Status())
		})

	testScenario(t, "When an admin tries to create a library panel that does not exists, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			var expected = libraryElementResult{
				Result: libraryElement{
					ID:          1,
					OrgID:       1,
					FolderID:    1,
					UID:         sc.initialResult.Result.UID,
					Name:        "Text - Library Panel",
					Kind:        int64(models.PanelElement),
					Type:        "text",
					Description: "A description",
					Model: map[string]interface{}{
						"datasource":  "${DS_GDEV-TESTDATA}",
						"description": "A description",
						"id":          float64(1),
						"title":       "Text - Library Panel",
						"type":        "text",
					},
					Version: 1,
					Meta: LibraryElementDTOMeta{
						ConnectedDashboards: 0,
						Created:             sc.initialResult.Result.Meta.Created,
						Updated:             sc.initialResult.Result.Meta.Updated,
						CreatedBy: LibraryElementDTOMetaUser{
							ID:        1,
							Name:      "signed_in_user",
							AvatarURL: "/avatar/37524e1eb8b3e32850b57db0a19af93b",
						},
						UpdatedBy: LibraryElementDTOMetaUser{
							ID:        1,
							Name:      "signed_in_user",
							AvatarURL: "/avatar/37524e1eb8b3e32850b57db0a19af93b",
						},
					},
				},
			}
			command := getCreateNavbarPreferenceCommand("explore", true)
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			if diff := cmp.Diff(expected, resp, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})
}

package navbarpreferences

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestCreateNavbarPreference(t *testing.T) {
	/* testScenario(t, "When an admin tries to create a navbar preference that already exists, it should fail",
	func(t *testing.T, sc scenarioContext) {
		command := getCreatePanelCommand(sc.folder.Id, "Text - Library Panel")
		sc.reqContext.Req.Body = mockRequestBody(command)
		resp := sc.service.createHandler(sc.reqContext)
		require.Equal(t, 400, resp.Status())
	})
	*/
	testScenario(t, "When an admin tries to create a navigation preference that does not exists, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			var expected = NavbarPreferenceResponse{
				Result: NavbarPreferenceDTO{
					ID:             1,
					OrgID:          1,
					UserID:         1,
					NavItemID:      "explore",
					HideFromNavbar: true,
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

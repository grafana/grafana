package navbarpreferences

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestCreateNavbarPreference(t *testing.T) {
	testScenario(t, "When an admin tries to create a navigation preference that does not exists, it should succeed with a 201",
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
			var result = validateAndUnMarshalResponse(t, resp, 201)
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})
}

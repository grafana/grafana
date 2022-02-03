package navbarpreferences

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
)

func TestCreateNavbarPreference(t *testing.T) {
	// TODO update this test to check it does an update instead
	testScenario(t, "When an admin tries to create a navbar preference that already exists, it should fail",
		func(t *testing.T, sc scenarioContext) {
			// Create a navbar preference
			command := getCreateNavbarPreferenceCommand("explore", true)
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			// Create another navbar preference with the same id
			command2 := getCreateNavbarPreferenceCommand("explore", true)
			sc.reqContext.Req.Body = mockRequestBody(command2)
			resp2 := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 400, resp2.Status())
		})
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
			var result = validateAndUnMarshalResponse(t, resp)
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})
}

package features

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationFeatures(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Enable a random flag -- check that it is reported as enabled
	flag := featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs
	// the test below tests using enable_api = true, without that, the runtime_config has been instructed to skip the API
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		OpenFeatureAPIEnabled: true,
		AppModeProduction:     true,
		DisableAnonymous:      false, // allow anon user
		EnableFeatureToggles: []string{
			flag, // used in test below
		},
	})

	// The evaluation endpoint is served on two prefixes: the canonical /ofrep path and
	// the deprecated API-server-flavored path kept for backwards compatibility.
	paths := map[string]string{
		"canonical /ofrep path":               "/ofrep/v1/evaluate/flags/" + flag,
		"deprecated api-server-flavored path": "/apis/features.grafana.app/v0alpha1/namespaces/default/ofrep/v1/evaluate/flags/" + flag,
	}

	// The endpoint has no ReqSignedIn gate, so both signed-in and anonymous callers can
	// reach it -- anonymous access matters because the frontend evaluates flags before a
	// user is logged in. With the static provider the result is identical for both: public
	// flag gating only applies to the remote provider path. A zero-value User sends no
	// credentials, producing an anonymous request.
	users := map[string]apis.User{
		"logged-in as admin": helper.Org1.Admin,
		"anonymous":          {},
	}

	expectedBody := `{
		"value": true,
		"key":"` + flag + `",
		"reason":"static provider evaluation result",
		"variant":"default"}`

	for pathName, path := range paths {
		for userName, user := range users {
			t.Run("Test evaluate flags: "+pathName+", "+userName, func(t *testing.T) {
				rsp := apis.DoRequest(helper, apis.RequestParams{
					Method: http.MethodPost,
					Path:   path,
					User:   user,
				}, &map[string]any{})

				require.Equal(t, 200, rsp.Response.StatusCode)
				require.JSONEq(t, expectedBody, string(rsp.Body))
			})
		}
	}
}

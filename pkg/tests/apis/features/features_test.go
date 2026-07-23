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
	// the deprecated API-server-flavored path kept for backwards compatibility. Both
	// must return the same result.
	paths := map[string]string{
		"canonical /ofrep path":               "/ofrep/v1/evaluate/flags/" + flag,
		"deprecated api-server-flavored path": "/apis/features.grafana.app/v0alpha1/namespaces/default/ofrep/v1/evaluate/flags/" + flag,
	}

	for name, path := range paths {
		t.Run("Test evaluate flags: "+name, func(t *testing.T) {
			rsp := apis.DoRequest(helper, apis.RequestParams{
				Method: http.MethodPost,
				Path:   path,
				User:   helper.Org1.Admin,
			}, &map[string]any{})

			require.Equal(t, 200, rsp.Response.StatusCode)
			require.JSONEq(t, `{
				"value": true,
				"key":"`+flag+`",
				"reason":"static provider evaluation result",
				"variant":"default"}`, string(rsp.Body))
		})
	}
}

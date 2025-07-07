package features

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationFeatures(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	// Enable a random flag -- check that it is reported as enabled
	flag := featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true,
		DisableAnonymous:  false, // allow anon user
		EnableFeatureToggles: []string{
			flag, // used in test below
		},
	})

	t.Run("Test evaluate flags", func(t *testing.T) {
		rsp := apis.DoRequest(helper, apis.RequestParams{
			Method: http.MethodPost,
			Path:   "/apis/features.grafana.app/v0alpha1/namespaces/default/ofrep/v1/evaluate/flags/" + flag,
			User:   helper.Org1.Admin,
		}, &map[string]any{})

		require.Equal(t, 200, rsp.Response.StatusCode)
		require.JSONEq(t, `{
			"Value": true,
			"FlagKey": "`+flag+`",
			"FlagType": 0,
			"Variant": "enabled",
			"Reason": "STATIC",
			"ErrorCode": "",
			"ErrorMessage": "",
			"FlagMetadata": {}
		}`, string(rsp.Body))
	})
}

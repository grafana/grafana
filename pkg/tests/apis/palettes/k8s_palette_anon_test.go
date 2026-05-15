package palettes

import (
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

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

// TestIntegrationPalette_AnonymousGET verifies Phase G: with anonymous auth enabled,
// a raw HTTP GET (no credentials) reaches the palettes authorizer and returns 200.
// ReqSignedIn on /apis/* allows anonymous viewers when auth.anonymous.enabled is true,
// so no extra allowlist route (unlike snapshots) is required.
func TestIntegrationPalette_AnonymousGET(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		DisableAnonymous:  false,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
		},
	})

	ns := helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID())
	uid := helper.Org1.Admin.Identity.GetIdentifier()
	name := fmt.Sprintf("user-%s-anonget", uid)

	body := fmt.Sprintf(`{
		"apiVersion": "palettes.grafana.app/v0alpha1",
		"kind": "Palette",
		"metadata": {"name": %q, "namespace": %q},
		"spec": {
			"id": "anonget",
			"displayName": "Anon GET probe",
			"colors": ["#aabbcc"],
			"shareWith": []
		}
	}`, name, ns)

	// Named PUT matches how other app-platform resources are exercised in integration tests
	// (collection POST is rejected with "mutating request without a name" in this stack).
	putPath := fmt.Sprintf("/apis/palettes.grafana.app/v0alpha1/namespaces/%s/palettes/%s", ns, name)
	createRsp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPut,
		Path:   putPath,
		Body:   []byte(body),
	}, &map[string]any{})
	require.True(t, createRsp.Response.StatusCode == http.StatusOK || createRsp.Response.StatusCode == http.StatusCreated,
		"seed palette: PUT %s -> %d: %s", putPath, createRsp.Response.StatusCode, string(createRsp.Body))

	getPath := fmt.Sprintf("/apis/palettes.grafana.app/v0alpha1/namespaces/%s/palettes/%s", ns, name)
	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr()
	anonClient := &http.Client{
		Timeout: 30 * time.Second,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("http://%s%s", addr, getPath), nil)
	require.NoError(t, err)
	getRsp, err := anonClient.Do(req)
	require.NoError(t, err)
	t.Cleanup(func() { _ = getRsp.Body.Close() })
	getBody, _ := io.ReadAll(getRsp.Body)
	require.Equal(t, http.StatusOK, getRsp.StatusCode,
		"anonymous GET palettes/%s: %s", name, string(getBody))

	listPath := fmt.Sprintf("/apis/palettes.grafana.app/v0alpha1/namespaces/%s/palettes", ns)
	listReq, err := http.NewRequest(http.MethodGet, fmt.Sprintf("http://%s%s", addr, listPath), nil)
	require.NoError(t, err)
	listRsp, err := anonClient.Do(listReq)
	require.NoError(t, err)
	t.Cleanup(func() { _ = listRsp.Body.Close() })
	require.GreaterOrEqual(t, listRsp.StatusCode, 400,
		"anonymous LIST should be rejected (got %d)", listRsp.StatusCode)
}

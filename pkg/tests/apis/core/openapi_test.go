package core

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/version"
	apimachineryversion "k8s.io/apimachinery/pkg/version"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationOpenAPIs(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	check := []schema.GroupVersion{{
		Group:   "dashboard.grafana.app",
		Version: "v0alpha1",
	}, {
		Group:   "folder.grafana.app",
		Version: "v0alpha1",
	}, {
		Group:   "peakq.grafana.app",
		Version: "v0alpha1",
	}}

	h := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagKubernetesFoldersServiceV2, // Will be default on by G12
			featuremgmt.FlagQueryService,               // Query Library
		},
	})

	t.Run("check valid version response", func(t *testing.T) {
		disco := h.NewDiscoveryClient()
		req := disco.RESTClient().Get().
			Prefix("version").
			SetHeader("Accept", "application/json")

		result := req.Do(context.Background())
		require.NoError(t, result.Error())

		raw, err := result.Raw()
		require.NoError(t, err)
		info := apimachineryversion.Info{}
		err = json.Unmarshal(raw, &info)
		require.NoError(t, err)

		// Make sure the gitVersion is parsable
		v, err := version.Parse(info.GitVersion)
		require.NoError(t, err)
		require.Equal(t, info.Major, fmt.Sprintf("%d", v.Major()))
		require.Equal(t, info.Minor, fmt.Sprintf("%d", v.Minor()))
	})

	t.Run("build open", func(t *testing.T) {
		// Now write each OpenAPI spec to a static file
		dir := filepath.Join("..", "..", "..", "..", "openapi")
		for _, gv := range check {
			path := fmt.Sprintf("/openapi/v3/apis/%s/%s", gv.Group, gv.Version)
			rsp := apis.DoRequest(h, apis.RequestParams{
				Method: http.MethodGet,
				Path:   path,
				User:   h.Org1.Admin,
			}, &apis.AnyResource{})

			require.NotNil(t, rsp.Response)
			require.Equal(t, 200, rsp.Response.StatusCode, path)

			var prettyJSON bytes.Buffer
			err := json.Indent(&prettyJSON, rsp.Body, "", "  ")
			require.NoError(t, err)
			pretty := prettyJSON.String()

			write := false
			fpath := filepath.Join(dir, fmt.Sprintf("%s-%s.json", gv.Group, gv.Version))

			// nolint:gosec
			// We can ignore the gosec G304 warning since this is a test and the function is only called with explicit paths
			body, err := os.ReadFile(fpath)
			if err == nil {
				if !assert.JSONEq(t, string(body), pretty) {
					t.Logf("openapi spec has changed: %s", path)
					t.Fail()
					write = true
				}
			} else {
				t.Errorf("missing openapi spec for: %s", path)
				write = true
			}

			if write {
				e2 := os.WriteFile(fpath, []byte(pretty), 0644)
				if e2 != nil {
					t.Errorf("error writing file: %s", e2.Error())
				}
			}
		}
	})
}

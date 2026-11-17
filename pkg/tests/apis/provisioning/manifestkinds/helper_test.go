package manifestkinds

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	grafanafs "github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

const (
	testAppID    = "test-app-with-backend"
	testAppGroup = testAppID + ".ext.grafana.app"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// runGrafana starts Grafana with the test app plugin installed. The manifest of the plugin opts
// the Thing kind in to provisioning, and not the Widget kind.
func runGrafana(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	return common.RunGrafana(t, func(opts *testinfra.GrafanaOpts) {
		opts.EnableFeatureToggles = append(opts.EnableFeatureToggles,
			featuremgmt.FlagApppluginsRegisterAPIServer,
			featuremgmt.FlagGrafanaUseRouterMiddleware,
		)
		opts.UnifiedStorageConfig["app."+testAppID] = setting.UnifiedStorageConfig{DualWriterMode: grafanarest.Mode5}

		// The router finds the plugin in the plugins directory, so the directory exists before the start.
		dir, cfgPath := testinfra.CreateGrafDir(t, *opts)
		_, thisFile, _, ok := runtime.Caller(0)
		require.True(t, ok)
		repoRoot := filepath.Join(filepath.Dir(thisFile), "..", "..", "..", "..", "..")
		pluginDir := filepath.Join(dir, "plugins", testAppID)
		require.NoError(t, grafanafs.CopyRecursive(filepath.Join(repoRoot, "pkg", "plugins", "manager", "testdata", testAppID), pluginDir))
		writeManifest(t, filepath.Join(repoRoot, "pkg", "tests", "apis", "appplugin", "testdata", "app-sdk-manifest.json"), filepath.Join(pluginDir, "app-sdk-manifest.json"))
		opts.Dir, opts.DirPath = dir, cfgPath
	})
}

func thingsClient(t *testing.T, helper *common.ProvisioningTestHelper) dynamic.ResourceInterface {
	t.Helper()
	return helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default",
		GVR:       schema.GroupVersionResource{Group: testAppGroup, Version: "v1", Resource: "things"},
	}).Resource
}

// writeManifest copies the app manifest of the test app, with provisioning enabled for the Thing kind.
func writeManifest(t *testing.T, src, dst string) {
	t.Helper()
	raw, err := os.ReadFile(src) //nolint:gosec
	require.NoError(t, err)
	var manifest map[string]any
	require.NoError(t, json.Unmarshal(raw, &manifest))
	versions, _, _ := unstructured.NestedSlice(manifest, "spec", "versions")
	for _, version := range versions {
		kinds, _, _ := unstructured.NestedSlice(version.(map[string]any), "kinds")
		for _, kind := range kinds {
			if kind.(map[string]any)["kind"] == "Thing" {
				kind.(map[string]any)["extensions"] = map[string]any{"provisioning": map[string]any{"enabled": true}}
			}
		}
		version.(map[string]any)["kinds"] = kinds
	}
	require.NoError(t, unstructured.SetNestedSlice(manifest, versions, "spec", "versions"))
	raw, err = json.Marshal(manifest)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(dst, raw, 0o600))
}

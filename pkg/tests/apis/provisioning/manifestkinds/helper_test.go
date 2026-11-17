package manifestkinds

import (
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
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

// runGrafana starts Grafana with the test app plugin installed. The manifest of the plugin
// (testdata/app-sdk-manifest.json) opts the Thing kind in to provisioning, and not the Widget kind.
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
		require.NoError(t, grafanafs.CopyFile(filepath.Join(filepath.Dir(thisFile), "testdata", "app-sdk-manifest.json"), filepath.Join(pluginDir, "app-sdk-manifest.json")))
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

package appplugin

import (
	"context"
	"fmt"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	grafanafs "github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const testAppID = "test-app"

var gvrSettings = schema.GroupVersionResource{
	Group:    testAppID + ".grafana.app",
	Version:  "v0alpha1",
	Resource: "settings",
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationAppPluginSettings(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("DualWriterMode %d", mode), func(t *testing.T) {
			helper := setupHelper(t, mode)
			ctx := context.Background()

			client := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  gvrSettings,
			})

			// writeSettings writes a known settings state with a fresh secret and returns
			// the resulting object. Each subtest calls this to establish its own baseline.
			writeSettings := func(t *testing.T) *unstructured.Unstructured {
				t.Helper()
				_, err := client.Resource.Update(ctx, &unstructured.Unstructured{
					Object: map[string]any{
						"apiVersion": testAppID + ".grafana.app/v0alpha1",
						"kind":       "Settings",
						"metadata":   map[string]any{"name": testAppID},
						"spec": map[string]any{
							"enabled":  true,
							"pinned":   true,
							"jsonData": map[string]any{"url": "https://api.example.com"},
						},
						"secure": map[string]any{
							"apiKey": map[string]any{"create": "my-secret-value"},
						},
					},
				}, metav1.UpdateOptions{})
				require.NoError(t, err)
				obj, err := client.Resource.Get(ctx, testAppID, metav1.GetOptions{})
				require.NoError(t, err)
				return obj
			}

			t.Run("update persists jsonData and returns secure key references", func(t *testing.T) {
				obj := writeSettings(t)

				require.Equal(t, testAppID, obj.GetName())

				spec, ok := obj.Object["spec"].(map[string]any)
				require.True(t, ok)
				require.Equal(t, true, spec["enabled"])
				require.Equal(t, true, spec["pinned"])
				require.Equal(t, map[string]any{"url": "https://api.example.com"}, spec["jsonData"])

				// Secure values are top-level and must be returned as opaque name references, never raw values.
				secure, ok := obj.Object["secure"].(map[string]any)
				require.True(t, ok, "expected top-level secure field")
				apiKeyVal, ok := secure["apiKey"].(map[string]any)
				require.True(t, ok, "expected apiKey entry in secure")
				name, _ := apiKeyVal["name"].(string)
				require.NotEmpty(t, name, "expected name reference for apiKey")
				if mode < rest.Mode5 {
					// Legacy storage uses a deterministic hash prefix.
					require.Contains(t, name, "lps-sv-", "name should use the legacy plugin secure value prefix")
				}
			})

			t.Run("list returns the settings resource after write", func(t *testing.T) {
				writeSettings(t)

				list, err := client.Resource.List(ctx, metav1.ListOptions{})
				require.NoError(t, err)
				require.Len(t, list.Items, 1)
				require.Equal(t, testAppID, list.Items[0].GetName())
			})

			t.Run("update with name-only entry keeps existing value", func(t *testing.T) {
				// Establish a known state with a fresh secret, then capture the name reference.
				obj := writeSettings(t)
				secure, ok := obj.Object["secure"].(map[string]any)
				require.True(t, ok, "expected top-level secure field")
				apiKeyVal, ok := secure["apiKey"].(map[string]any)
				require.True(t, ok, "expected apiKey entry in secure")
				existingName, ok := apiKeyVal["name"].(string)
				require.True(t, ok, "expected name string in apiKey")

				// Update sending back the name reference — should be a no-op for the secure value.
				_, err := client.Resource.Update(ctx, &unstructured.Unstructured{
					Object: map[string]any{
						"apiVersion": testAppID + ".grafana.app/v0alpha1",
						"kind":       "Settings",
						"metadata":   map[string]any{"name": testAppID},
						"spec": map[string]any{
							"enabled":  true,
							"pinned":   true,
							"jsonData": map[string]any{"url": "https://api.example.com"},
						},
						"secure": map[string]any{
							"apiKey": map[string]any{"name": existingName},
						},
					},
				}, metav1.UpdateOptions{})
				require.NoError(t, err)

				obj, err = client.Resource.Get(ctx, testAppID, metav1.GetOptions{})
				require.NoError(t, err)
				secure, ok = obj.Object["secure"].(map[string]any)
				require.True(t, ok, "expected top-level secure field")
				_, hasAPIKey := secure["apiKey"]
				require.True(t, hasAPIKey, "apiKey should still be present after name-only update")
			})

			t.Run("get not-found for wrong name", func(t *testing.T) {
				_, err := client.Resource.Get(ctx, "does-not-exist", metav1.GetOptions{})
				require.Error(t, err)
				statusErr := helper.AsStatusError(err)
				require.Equal(t, metav1.StatusReasonNotFound, statusErr.Status().Reason)
			})

			// ActionAppAccess is granted to RoleViewer (and therefore all org roles),
			// so editors and viewers can read and write plugin settings just like admins.
			t.Run("editor and viewer can get settings", func(t *testing.T) {
				writeSettings(t)

				for _, user := range []apis.User{helper.Org1.Editor, helper.Org1.Viewer} {
					t.Run(string(user.Identity.GetOrgRole()), func(t *testing.T) {
						c := helper.GetResourceClient(apis.ResourceClientArgs{
							User: user,
							GVR:  gvrSettings,
						})
						obj, err := c.Resource.Get(ctx, testAppID, metav1.GetOptions{})
						require.NoError(t, err)
						require.Equal(t, testAppID, obj.GetName())
					})
				}
			})
		})
	}
}

func setupHelper(t *testing.T, mode rest.DualWriterMode) *apis.K8sTestHelper {
	t.Helper()

	baseOpts := testinfra.GrafanaOpts{
		DisableAnonymous:                 true,
		OpenFeatureAPIEnabled:            true,
		SecretsManagerEnableDBMigrations: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagAppPluginAPIServer,
		},
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			fmt.Sprintf("settings.%s.grafana.app", testAppID): {
				DualWriterMode: mode,
			},
		},
	}

	// Create the grafana dir, then copy the test-app plugin into its plugins directory
	// so RegisterAPIService discovers it and registers the test-app.grafana.app API group.
	dir, cfgPath := testinfra.CreateGrafDir(t, baseOpts)

	_, thisFile, _, ok := runtime.Caller(0)
	require.True(t, ok)
	repoRoot := filepath.Join(filepath.Dir(thisFile), "..", "..", "..", "..")
	testAppSrc := filepath.Join(repoRoot, "pkg", "plugins", "manager", "testdata", "test-app")
	testAppDst := filepath.Join(dir, "plugins", "test-app")

	require.NoError(t, grafanafs.CopyRecursive(testAppSrc, testAppDst))

	helper := apis.NewK8sTestHelperWithOpts(t, apis.K8sTestHelperOpts{
		GrafanaOpts: testinfra.GrafanaOpts{
			Dir:     dir,
			DirPath: cfgPath,
		},
	})
	t.Cleanup(func() { helper.Shutdown() })
	return helper
}

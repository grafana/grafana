package appplugin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	grafanafs "github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const instanceName = "instance" // the name is always "instance"
const testAppID = "test-app-with-backend"

var gvrSettings = schema.GroupVersionResource{
	Group:    testAppID,
	Version:  "v0alpha1",
	Resource: "app",
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationAppPluginSettings(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode5} //rest.Mode0, rest.Mode2, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("DualWriterMode %d", mode), func(t *testing.T) {
			helper := setupHelper(t, mode)
			ctx := context.Background()

			client := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  gvrSettings,
			})

			// Render the openapi spec
			if mode == rest.Mode5 {
				apis.VerifyOpenAPISnapshots(t, "testdata", gvrSettings.GroupVersion(), helper)
			}

			if true {
				return
			}

			// writeSettings writes a known settings state with a fresh secret and returns
			// the resulting object. Each subtest calls this to establish its own baseline.
			writeSettings := func(t *testing.T) *unstructured.Unstructured {
				t.Helper()
				_, err := client.Resource.Update(ctx, &unstructured.Unstructured{
					Object: map[string]any{
						"apiVersion": testAppID + "/v0alpha1",
						"kind":       "Settings",
						"metadata":   map[string]any{"name": instanceName},
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
				obj, err := client.Resource.Get(ctx, instanceName, metav1.GetOptions{})
				require.NoError(t, err)
				return obj
			}

			t.Run("patch updates settings using resourceVersion test", func(t *testing.T) {
				var current *unstructured.Unstructured
				var err error
				if mode == rest.Mode5 {
					current = writeSettings(t)
				} else {
					current, err = client.Resource.Get(ctx, instanceName, metav1.GetOptions{})
					require.NoError(t, err)
				}

				require.NotEmpty(t, current.GetResourceVersion(), "PATCH test op needs a resourceVersion")

				enabledValue := true
				pinnedValue := true
				expectedJSONData := any(nil)
				if mode == rest.Mode5 {
					enabledValue = false
					pinnedValue = true
					expectedJSONData = map[string]any{"url": "https://api.example.com"}
				}

				patchData, err := json.Marshal([]map[string]any{
					{
						"op":    "test",
						"path":  "/metadata/resourceVersion",
						"value": current.GetResourceVersion(),
					},
					{
						"op":    "replace",
						"path":  "/spec/enabled",
						"value": enabledValue,
					},
					{
						"op":    "replace",
						"path":  "/spec/pinned",
						"value": pinnedValue,
					},
				})
				require.NoError(t, err)

				obj, err := client.Resource.Patch(ctx, instanceName, types.JSONPatchType, patchData, metav1.PatchOptions{})
				require.NoError(t, err)

				require.Equal(t, instanceName, obj.GetName())
				if mode < rest.Mode5 {
					require.NotEmpty(t, obj.GetUID(), "PATCH needs the legacy-backed settings resource to look persisted")
				}
				require.NotEmpty(t, obj.GetResourceVersion(), "PATCH response should include a resourceVersion")

				spec, ok := obj.Object["spec"].(map[string]any)
				require.True(t, ok)
				require.Equal(t, enabledValue, spec["enabled"])
				require.Equal(t, pinnedValue, spec["pinned"])
				require.Equal(t, expectedJSONData, spec["jsonData"])
			})

			t.Run("patch with stale resourceVersion test fails after separate update", func(t *testing.T) {
				var current *unstructured.Unstructured
				var err error
				if mode == rest.Mode5 {
					current = writeSettings(t)
				} else {
					current, err = client.Resource.Get(ctx, instanceName, metav1.GetOptions{})
					require.NoError(t, err)
				}

				staleRV := current.GetResourceVersion()
				require.NotEmpty(t, staleRV, "stale patch test needs an initial resourceVersion")

				updateSpec := map[string]any{
					"enabled":  true,
					"pinned":   false,
					"jsonData": nil,
				}
				if mode == rest.Mode5 {
					updateSpec = map[string]any{
						"enabled":  false,
						"pinned":   false,
						"jsonData": map[string]any{"url": "https://updated.example.com"},
					}
				}

				_, err = client.Resource.Update(ctx, &unstructured.Unstructured{
					Object: map[string]any{
						"apiVersion": testAppID + "/v0alpha1",
						"kind":       "Settings",
						"metadata":   map[string]any{"name": instanceName},
						"spec":       updateSpec,
					},
				}, metav1.UpdateOptions{})
				require.NoError(t, err)

				var latest *unstructured.Unstructured
				require.Eventually(t, func() bool {
					latest, err = client.Resource.Get(ctx, instanceName, metav1.GetOptions{})
					require.NoError(t, err)
					if latest.GetResourceVersion() != staleRV {
						return true
					}

					updateSpec["pinned"] = !(updateSpec["pinned"].(bool))
					_, err = client.Resource.Update(ctx, &unstructured.Unstructured{
						Object: map[string]any{
							"apiVersion": testAppID + "/v0alpha1",
							"kind":       "Settings",
							"metadata":   map[string]any{"name": instanceName},
							"spec":       updateSpec,
						},
					}, metav1.UpdateOptions{})
					require.NoError(t, err)
					return false
				}, 3*time.Second, 25*time.Millisecond, "separate update should advance resourceVersion")

				patchData, err := json.Marshal([]map[string]any{
					{
						"op":    "test",
						"path":  "/metadata/resourceVersion",
						"value": staleRV,
					},
					{
						"op":    "replace",
						"path":  "/spec/pinned",
						"value": true,
					},
				})
				require.NoError(t, err)

				_, err = client.Resource.Patch(ctx, instanceName, types.JSONPatchType, patchData, metav1.PatchOptions{})
				helper.RequireApiErrorStatus(err, metav1.StatusReasonInvalid, http.StatusUnprocessableEntity)
			})

			t.Run("update persists jsonData and returns secure key references", func(t *testing.T) {
				obj := writeSettings(t)

				require.Equal(t, instanceName, obj.GetName())

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
				require.Equal(t, instanceName, list.Items[0].GetName())
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
						"apiVersion": testAppID + "/v0alpha1",
						"kind":       "Settings",
						"metadata":   map[string]any{"name": instanceName},
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

				obj, err = client.Resource.Get(ctx, instanceName, metav1.GetOptions{})
				require.NoError(t, err)
				secure, ok = obj.Object["secure"].(map[string]any)
				require.True(t, ok, "expected top-level secure field")
				_, hasAPIKey := secure["apiKey"]
				require.True(t, hasAPIKey, "apiKey should still be present after name-only update")
			})

			t.Run("patch can add a new secure value", func(t *testing.T) {
				writeSettings(t)

				obj, err := client.Resource.Patch(ctx, instanceName, types.JSONPatchType, []byte(`[
						{"op":"add","path":"/secure/patchedSecret","value":{"create":"patched-secret-value"}}
					]`), metav1.PatchOptions{})
				require.NoError(t, err)

				secure, ok := obj.Object["secure"].(map[string]any)
				require.True(t, ok, "expected top-level secure field")

				patchedSecret, ok := secure["patchedSecret"].(map[string]any)
				require.True(t, ok, "expected patchedSecret entry in secure")

				name, _ := patchedSecret["name"].(string)
				require.NotEmpty(t, name, "expected name reference for patchedSecret")
				if mode < rest.Mode5 {
					require.Contains(t, name, "lps-sv-", "name should use the legacy plugin secure value prefix")
				}
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
						obj, err := c.Resource.Get(ctx, instanceName, metav1.GetOptions{})
						require.NoError(t, err)
						require.Equal(t, instanceName, obj.GetName())
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
			featuremgmt.FlagApppluginsRegisterAPIServer,
		},
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			fmt.Sprintf("app.%s", testAppID): {
				DualWriterMode: mode,
			},
		},
	}

	// Create the grafana dir, then copy the test-app plugin into its plugins directory
	// so RegisterAPIService discovers it and registers the test-app API group.
	dir, cfgPath := testinfra.CreateGrafDir(t, baseOpts)

	_, thisFile, _, ok := runtime.Caller(0)
	require.True(t, ok)
	repoRoot := filepath.Join(filepath.Dir(thisFile), "..", "..", "..", "..")
	testAppSrc := filepath.Join(repoRoot, "pkg", "plugins", "manager", "testdata", testAppID)
	testAppDst := filepath.Join(dir, "plugins", testAppID)

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

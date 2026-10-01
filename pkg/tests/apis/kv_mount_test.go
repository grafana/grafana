package apis

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// openAPIPathsFor fetches the OpenAPI v3 spec for a given group+version and
// returns the set of path strings from Paths.Paths.
func openAPIPathsFor(t *testing.T, h *K8sTestHelper, group, version string) map[string]struct{} {
	t.Helper()
	path := fmt.Sprintf("/openapi/v3/apis/%s/%s", group, version)
	rsp := DoRequest(h, RequestParams{
		Method: http.MethodGet,
		Path:   path,
		User:   h.Org1.Admin,
	}, &spec3.OpenAPI{})
	require.NotNilf(t, rsp.Response, "OpenAPI request must get a response (%s)", path)
	require.Equalf(t, http.StatusOK, rsp.Response.StatusCode,
		"OpenAPI request must return 200 for %s", path)
	require.NotNilf(t, rsp.Result, "OpenAPI spec must be non-nil for %s", path)
	result := make(map[string]struct{})
	if rsp.Result.Paths != nil {
		for p := range rsp.Result.Paths.Paths {
			result[p] = struct{}{}
		}
	}
	return result
}

// openAPISchemaNamesFor returns the component schema names in the OpenAPI v3
// document of the given group-version.
func openAPISchemaNamesFor(t *testing.T, h *K8sTestHelper, group, version string) []string {
	t.Helper()
	rsp := DoRequest(h, RequestParams{
		Method: http.MethodGet,
		Path:   fmt.Sprintf("/openapi/v3/apis/%s/%s", group, version),
		User:   h.Org1.Admin,
	}, &spec3.OpenAPI{})
	require.NotNil(t, rsp.Result)
	var names []string
	if rsp.Result.Components != nil {
		for name := range rsp.Result.Components.Schemas {
			names = append(names, name)
		}
	}
	return names
}

// hasPathSuffix returns true if any path in paths has the given suffix.
func hasPathSuffix(paths map[string]struct{}, suffix string) bool {
	for p := range paths {
		if strings.HasSuffix(p, suffix) {
			return true
		}
	}
	return false
}

// pathsWithSuffix returns all paths that have the given suffix, for reporting.
func pathsWithSuffix(paths map[string]struct{}, suffix string) []string {
	var result []string
	for p := range paths {
		if strings.HasSuffix(p, suffix) {
			result = append(result, p)
		}
	}
	return result
}

// TestIntegrationKVMount_ToggleOn verifies that when the storage.resourceKV
// toggle is enabled:
//   - The server starts successfully.
//   - OpenAPI for dashboard.grafana.app/v1 contains dashboards/{name}/kv and
//     dashboards/{name}/kv:batch paths.
//   - OpenAPI for dashboard.grafana.app/v0alpha1 also contains those paths.
//   - OpenAPI for playlist.grafana.app/v1 contains playlists/{name}/kv.
//   - A non-declaring kind in the dashboard group (snapshots in v0alpha1) has
//     NO /kv path.
func TestIntegrationKVMount_ToggleOn(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	h := NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true,
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagStorageResourceKV,
		},
	})

	t.Run("server_starts", func(t *testing.T) {
		// Starting the helper above verifies the server can start with the
		// toggle on. Reaching this subtest without panic is the assertion.
	})

	t.Run("dashboard_v1_has_kv_paths", func(t *testing.T) {
		paths := openAPIPathsFor(t, h, "dashboard.grafana.app", "v1")

		assert.True(t, hasPathSuffix(paths, "dashboards/{name}/kv"),
			"dashboard.grafana.app/v1 must expose dashboards/{name}/kv; found paths: %v",
			pathsWithSuffix(paths, "/kv"))
		assert.True(t, hasPathSuffix(paths, "dashboards/{name}/kv:batch"),
			"dashboard.grafana.app/v1 must expose dashboards/{name}/kv:batch; found paths: %v",
			pathsWithSuffix(paths, "/kv:batch"))
	})

	t.Run("dashboard_v0alpha1_has_kv_paths", func(t *testing.T) {
		paths := openAPIPathsFor(t, h, "dashboard.grafana.app", "v0alpha1")

		assert.True(t, hasPathSuffix(paths, "dashboards/{name}/kv"),
			"dashboard.grafana.app/v0alpha1 must expose dashboards/{name}/kv")
		assert.True(t, hasPathSuffix(paths, "dashboards/{name}/kv:batch"),
			"dashboard.grafana.app/v0alpha1 must expose dashboards/{name}/kv:batch")
	})

	t.Run("playlist_v1_has_kv_path", func(t *testing.T) {
		paths := openAPIPathsFor(t, h, "playlist.grafana.app", "v1")

		assert.True(t, hasPathSuffix(paths, "playlists/{name}/kv"),
			"playlist.grafana.app/v1 must expose playlists/{name}/kv; found paths: %v",
			pathsWithSuffix(paths, "/kv"))
		assert.True(t, hasPathSuffix(paths, "playlists/{name}/kv:batch"),
			"playlist.grafana.app/v1 must expose playlists/{name}/kv:batch")
	})

	t.Run("snapshot_in_dashboard_v0alpha1_has_no_kv_path", func(t *testing.T) {
		// Snapshot does NOT declare KV in the manifest; it must not get a kv path.
		paths := openAPIPathsFor(t, h, "dashboard.grafana.app", "v0alpha1")

		assert.False(t, hasPathSuffix(paths, "snapshots/{name}/kv"),
			"snapshots must NOT have a /kv path (non-declaring kind); found: %v",
			pathsWithSuffix(paths, "snapshots/{name}/kv"))
	})
}

// TestIntegrationKVMount_ToggleOff verifies that when the storage.resourceKV
// toggle is disabled, no /kv paths appear in the OpenAPI for declaring kinds.
func TestIntegrationKVMount_ToggleOff(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	h := NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true,
		DisableAnonymous:  true,
		// Toggle intentionally NOT included.
	})

	t.Run("dashboard_v1_has_no_kv_paths", func(t *testing.T) {
		paths := openAPIPathsFor(t, h, "dashboard.grafana.app", "v1")

		assert.False(t, hasPathSuffix(paths, "/kv"),
			"dashboard.grafana.app/v1 must NOT expose any /kv paths when toggle is off; found: %v",
			pathsWithSuffix(paths, "/kv"))
	})

	t.Run("playlist_v1_has_no_kv_paths", func(t *testing.T) {
		paths := openAPIPathsFor(t, h, "playlist.grafana.app", "v1")

		assert.False(t, hasPathSuffix(paths, "/kv"),
			"playlist.grafana.app/v1 must NOT expose any /kv paths when toggle is off; found: %v",
			pathsWithSuffix(paths, "/kv"))
	})
	t.Run("no_KVResponse_schema_when_off", func(t *testing.T) {
		for _, gv := range [][2]string{{"dashboard.grafana.app", "v1"}, {"playlist.grafana.app", "v1"}} {
			for _, name := range openAPISchemaNamesFor(t, h, gv[0], gv[1]) {
				assert.NotContains(t, name, "KVResponse", "%s/%s must not include the KVResponse schema", gv[0], gv[1])
			}
		}
	})
}

package resources

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestIsGrafanaOwnedAnnotation(t *testing.T) {
	owned := []string{
		utils.AnnoKeyCreatedBy,
		utils.AnnoKeyUpdatedBy,
		utils.AnnoKeyUpdatedTimestamp,
		utils.AnnoKeyFolder,
		utils.AnnoKeyBlob,
		utils.AnnoKeyMessage,
		utils.AnnoKeyGrantPermissions,
		utils.AnnoKeyManagerKind,
		utils.AnnoKeyManagerIdentity,
		utils.AnnoKeyManagerAllowsEdits,
		utils.AnnoKeyManagerSuspended,
		utils.AnnoKeySourcePath,
		utils.AnnoKeySourceChecksum,
		utils.AnnoKeySourceTimestamp,
		utils.AnnoKeyKubectlLastAppliedConfig,
		"grafana.app/repoPath",      // legacy source key
		"grafana.app/folderTitle",   // frontend shim
		"grafana.app/saved-from-ui", // frontend audit stamp
		"grafana.com/updatedBy",     // app-sdk common metadata
		"alerting.grafana.app/x",
		"cloud.grafana.com/x",
		"GRAFANA.APP/x",
		"grafana.app/a/b",
		"grafana.app/usecrossdashboardvariables", // the allowlist is an exact match
		"kubernetes.io/change-cause",
		"k8s.io/x",
	}
	for _, key := range owned {
		t.Run(key, func(t *testing.T) {
			require.True(t, IsGrafanaOwnedAnnotation(key))
		})
	}

	user := []string{
		utils.AnnoKeyUseCrossDashboardVariables,
		"team",
		"grafana.app",
		"/foo",
		"",
		"example.com/owner",
		"grafana.app.user.example/foo",
		"notgrafana.app/x",
		"example.com/grafana.app",
		"app.kubernetes.io/name",
	}
	for _, key := range user {
		t.Run("user "+key, func(t *testing.T) {
			require.False(t, IsGrafanaOwnedAnnotation(key))
		})
	}
}

func TestStripGrafanaOwnedAnnotations(t *testing.T) {
	t.Run("removes owned keys of any value type and keeps user keys untouched", func(t *testing.T) {
		obj := map[string]any{"metadata": map[string]any{
			"name": "dash",
			"annotations": map[string]any{
				utils.AnnoKeyCreatedBy:                  "user:1",
				utils.AnnoKeyManagerKind:                true,
				utils.AnnoKeyUseCrossDashboardVariables: `{"global":"all","folder":"none"}`,
				"example.com/owner":                     "team-a",
				"example.com/count":                     float64(3),
			},
			"labels": map[string]any{"grafana.app/lifecycle": "draft"},
		}}

		stripGrafanaOwnedAnnotations(obj)

		require.Equal(t, map[string]any{"metadata": map[string]any{
			"name": "dash",
			"annotations": map[string]any{
				utils.AnnoKeyUseCrossDashboardVariables: `{"global":"all","folder":"none"}`,
				"example.com/owner":                     "team-a",
				"example.com/count":                     float64(3),
			},
			"labels": map[string]any{"grafana.app/lifecycle": "draft"},
		}}, obj, "labels are out of scope and must not be touched")
	})

	t.Run("drops the annotations field when only owned keys were present", func(t *testing.T) {
		obj := map[string]any{"metadata": map[string]any{
			"name":        "dash",
			"annotations": map[string]any{utils.AnnoKeyFolder: "f"},
		}}

		stripGrafanaOwnedAnnotations(obj)

		require.Equal(t, map[string]any{"metadata": map[string]any{"name": "dash"}}, obj)
	})

	t.Run("tolerates missing or malformed metadata", func(t *testing.T) {
		for _, obj := range []map[string]any{
			{},
			{"metadata": "not-a-map"},
			{"metadata": map[string]any{"annotations": "not-a-map"}},
		} {
			want := deepCopyMap(t, obj)
			require.NotPanics(t, func() { stripGrafanaOwnedAnnotations(obj) })
			require.Equal(t, want, obj)
		}
	})
}

func TestUserAnnotations(t *testing.T) {
	obj := map[string]any{"metadata": map[string]any{"annotations": map[string]any{
		utils.AnnoKeyFolder:                     "f",
		utils.AnnoKeyUseCrossDashboardVariables: `{"global":"all"}`,
		"example.com/owner":                     "team-a",
	}}}

	kept := userAnnotations(obj)

	require.Equal(t, map[string]any{
		utils.AnnoKeyUseCrossDashboardVariables: `{"global":"all"}`,
		"example.com/owner":                     "team-a",
	}, kept)
	kept["example.com/owner"] = "changed"
	require.Equal(t, "team-a", obj["metadata"].(map[string]any)["annotations"].(map[string]any)["example.com/owner"],
		"the result must be a copy")

	require.Nil(t, userAnnotations(map[string]any{"metadata": map[string]any{"annotations": map[string]any{utils.AnnoKeyFolder: "f"}}}))
	require.Nil(t, userAnnotations(map[string]any{}))
}

func deepCopyMap(t *testing.T, in map[string]any) map[string]any {
	t.Helper()
	out := make(map[string]any, len(in))
	for k, v := range in {
		if m, ok := v.(map[string]any); ok {
			out[k] = deepCopyMap(t, m)
			continue
		}
		out[k] = v
	}
	return out
}

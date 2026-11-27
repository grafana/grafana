package resources

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestOmitAnnotationFromFile(t *testing.T) {
	omitted := []string{
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
		"grafana.app.thisShouldBeIgnored",
		"grafana.app/alsoThisOne",
		"grafana.app",
		"grafana.app.user.example/foo",
		"notgrafana.app/x",
		"example.com/grafana.app",
		"grafana.app/usecrossdashboardvariables", // the allowlist is an exact match
	}
	for _, key := range omitted {
		t.Run(key, func(t *testing.T) {
			require.True(t, OmitAnnotationFromFile(key))
		})
	}

	user := []string{
		AnnoKeyUseCrossDashboardVariables,
		"team",
		"/foo",
		"",
		"example.com/owner",
		"kubernetes.io/change-cause",
		"k8s.io/x",
	}
	for _, key := range user {
		t.Run("user "+key, func(t *testing.T) {
			require.False(t, OmitAnnotationFromFile(key))
		})
	}
}

func TestOmitNotUserAnnotations(t *testing.T) {
	obj := map[string]any{"metadata": map[string]any{"annotations": map[string]any{
		"example.com/owner":                   "team-a",
		"example.com/empty":                   nil,
		AnnoKeyUseCrossDashboardVariables:     `{"global":"all"}`,
		"example.com/flag":                    true,
		"example.com/count":                   int64(3),
		"example.com/ratio":                   1.5,
		"example.com/map":                     map[string]any{"global": "all"},
		"example.com/list":                    []any{"a"},
		utils.AnnoKeyManagerKind:              "plugin",
		"grafana.app/enabled":                 true, // ignored for its key, so not reported
		"grafana.com/updatedBy":               "x",
		utils.AnnoKeyKubectlLastAppliedConfig: "{}",
	}}}

	dropped := omitNotUserAnnotations(obj)

	require.Equal(t, []string{"example.com/count", "example.com/flag", "example.com/list", "example.com/map", "example.com/ratio"}, dropped)
	require.Equal(t, map[string]any{"metadata": map[string]any{"annotations": map[string]any{
		"example.com/owner":               "team-a",
		"example.com/empty":               nil,
		AnnoKeyUseCrossDashboardVariables: `{"global":"all"}`,
	}}}, obj)
	require.Nil(t, omitNotUserAnnotations(map[string]any{"metadata": map[string]any{"name": "dash"}}))
}

func TestHasRemovedAnnotations(t *testing.T) {
	withAnnotations := func(annotations map[string]any) *unstructured.Unstructured {
		return &unstructured.Unstructured{Object: map[string]any{"metadata": map[string]any{"name": "x", "annotations": annotations}}}
	}
	kept := withAnnotations(map[string]any{"example.com/kept": "v"})
	for _, tt := range []struct {
		name     string
		path     string
		original map[string]any
		want     bool
	}{
		{name: "user annotation removed from a dashboard", path: "dash.json", original: map[string]any{"example.com/owner": "team-a"}},
		{name: "Grafana-owned annotation removed from a dashboard", path: "dash.json", original: map[string]any{"grafana.app/createdBy": "user:1"}, want: true},
		{name: "user annotation removed from a folder manifest", path: "team/_folder.json", original: map[string]any{"example.com/owner": "team-a"}, want: true},
		{name: "folder manifest with a non-string annotation", path: "team/_folder.json", original: map[string]any{"example.com/enabled": true, "example.com/owner": "team-a"}},
		{name: "nothing removed", path: "team/_folder.json", original: map[string]any{"example.com/kept": "v"}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, HasRemovedAnnotations(tt.path, withAnnotations(tt.original), kept))
		})
	}
}

package resources

import (
	"testing"

	"github.com/stretchr/testify/require"

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
		"grafana.app",
		"/foo",
		"",
		"example.com/owner",
		"grafana.app.user.example/foo",
		"notgrafana.app/x",
		"example.com/grafana.app",
		"kubernetes.io/change-cause",
		"k8s.io/x",
	}
	for _, key := range user {
		t.Run("user "+key, func(t *testing.T) {
			require.False(t, OmitAnnotationFromFile(key))
		})
	}
}

func TestDropNonStringAnnotations(t *testing.T) {
	obj := map[string]any{"metadata": map[string]any{"annotations": map[string]any{
		"example.com/owner": "team-a",
		"example.com/empty": nil,
		"example.com/flag":  true,
		"example.com/count": int64(3),
		"example.com/ratio": 1.5,
		"example.com/map":   map[string]any{"global": "all"},
		"example.com/list":  []any{"a"},
	}}}

	dropped := dropNonStringAnnotations(obj)

	require.Equal(t, []string{"example.com/count", "example.com/flag", "example.com/list", "example.com/map", "example.com/ratio"}, dropped)
	require.Equal(t, map[string]any{"metadata": map[string]any{"annotations": map[string]any{
		"example.com/owner": "team-a",
		"example.com/empty": nil,
	}}}, obj)
	require.Nil(t, dropNonStringAnnotations(map[string]any{"metadata": map[string]any{"name": "dash"}}))
}

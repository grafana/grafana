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

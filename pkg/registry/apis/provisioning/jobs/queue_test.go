package jobs

import (
	"testing"

	"github.com/stretchr/testify/assert"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestIsOrphanCleanupAction(t *testing.T) {
	tests := []struct {
		action   provisioning.JobAction
		expected bool
	}{
		{provisioning.JobActionReleaseResources, true},
		{provisioning.JobActionDeleteResources, true},
		{provisioning.JobActionPull, false},
		{provisioning.JobActionPush, false},
		{provisioning.JobActionDelete, false},
		{provisioning.JobActionMigrate, false},
		{provisioning.JobActionMove, false},
		{provisioning.JobActionPullRequest, false},
		{provisioning.JobActionFixFolderMetadata, false},
	}

	for _, tt := range tests {
		t.Run(string(tt.action), func(t *testing.T) {
			assert.Equal(t, tt.expected, IsOrphanCleanupAction(tt.action))
		})
	}
}

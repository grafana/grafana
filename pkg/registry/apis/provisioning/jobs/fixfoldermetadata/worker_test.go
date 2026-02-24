package fixfoldermetadata

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

func TestWorker_IsSupported(t *testing.T) {
	w := NewWorker()

	tests := []struct {
		name     string
		action   provisioning.JobAction
		expected bool
	}{
		{name: "fix-folder-metadata action", action: provisioning.JobActionFixFolderMetadata, expected: true},
		{name: "pull action", action: provisioning.JobActionPull, expected: false},
		{name: "push action", action: provisioning.JobActionPush, expected: false},
		{name: "delete action", action: provisioning.JobActionDelete, expected: false},
		{name: "move action", action: provisioning.JobActionMove, expected: false},
		{name: "migrate action", action: provisioning.JobActionMigrate, expected: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			job := provisioning.Job{Spec: provisioning.JobSpec{Action: tt.action}}
			require.Equal(t, tt.expected, w.IsSupported(context.Background(), job))
		})
	}
}

func TestWorker_Process(t *testing.T) {
	w := NewWorker()
	ctx := context.Background()
	progress := jobs.NewMockJobProgressRecorder(t)

	progress.EXPECT().SetMessage(ctx, "fixFolderMetadata (no-op)").Return()
	progress.EXPECT().SetFinalMessage(ctx, "fixFolderMetadata completed (no-op placeholder)").Return()

	job := provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-job",
			Namespace: "default",
		},
		Spec: provisioning.JobSpec{
			Action:     provisioning.JobActionFixFolderMetadata,
			Repository: "test-repo",
		},
	}

	err := w.Process(ctx, nil, job, progress)
	require.NoError(t, err)
}

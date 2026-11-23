package v0alpha1_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/utils/ptr"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestJobStatus_ToSyncStatus(t *testing.T) {
	tests := []struct {
		name        string
		status      v0alpha1.JobStatus
		wantMessage []string
	}{
		{
			name: "errors take precedence",
			status: v0alpha1.JobStatus{
				State:    new(v0alpha1.JobStateError),
				Message:  new("completed with errors"),
				Errors:   []string{"error one", "error two"},
				Warnings: []string{"warning"},
			},
			wantMessage: []string{"error one", "error two"},
		},
		{
			name: "warnings used when no errors",
			status: v0alpha1.JobStatus{
				State:    new(v0alpha1.JobStateWarning),
				Message:  new("completed with warnings"),
				Warnings: []string{"warning"},
			},
			wantMessage: []string{"warning"},
		},
		{
			name: "error state falls back to job message",
			status: v0alpha1.JobStatus{
				State:   new(v0alpha1.JobStateError),
				Message: new("create repository resources client: boom"),
			},
			wantMessage: []string{"create repository resources client: boom"},
		},
		{
			name: "success message is not copied",
			status: v0alpha1.JobStatus{
				State:   new(v0alpha1.JobStateSuccess),
				Message: new("completed successfully"),
			},
			wantMessage: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			syncStatus := tt.status.ToSyncStatus("test-job")
			assert.Equal(t, "test-job", syncStatus.Job)
			assert.Equal(t, ptr.Deref(tt.status.State, ""), syncStatus.State)
			assert.Equal(t, tt.wantMessage, syncStatus.Message)
		})
	}
}

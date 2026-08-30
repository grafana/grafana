package jobs

import (
	"testing"

	"github.com/stretchr/testify/assert"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestCommitMessage(t *testing.T) {
	tests := []struct {
		name           string
		specMessage    string
		defaultMessage string
		want           string
	}{
		{
			name:           "spec message takes precedence when both set",
			specMessage:    "from job spec",
			defaultMessage: "fallback",
			want:           "from job spec",
		},
		{
			name:           "falls back to default when spec message empty",
			specMessage:    "",
			defaultMessage: "fallback",
			want:           "fallback",
		},
		{
			name:           "returns empty when both empty",
			specMessage:    "",
			defaultMessage: "",
			want:           "",
		},
		{
			name:           "spec message used even when default empty",
			specMessage:    "from job spec",
			defaultMessage: "",
			want:           "from job spec",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			job := provisioning.Job{
				Spec: provisioning.JobSpec{
					Message: tt.specMessage,
				},
			}
			got := CommitMessage(job, tt.defaultMessage)
			assert.Equal(t, tt.want, got)
		})
	}
}

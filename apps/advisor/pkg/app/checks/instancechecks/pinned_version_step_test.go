package instancechecks

import (
	"context"
	"testing"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPinnedVersionStep(t *testing.T) {
	tests := []struct {
		name        string
		step        *pinnedVersionStep
		input       any
		wantFailure bool
		wantErr     bool
	}{
		{
			name: "should return error for invalid input type",
			step: &pinnedVersionStep{
				BuildBranch: "test-branch",
			},
			input:   123, // invalid type
			wantErr: true,
		},
		{
			name: "should return nil for non-pinned version item",
			step: &pinnedVersionStep{
				BuildBranch: "test-branch",
			},
			input:       "other_item",
			wantFailure: false,
			wantErr:     false,
		},
		{
			name: "should return nil for HEAD build branch",
			step: &pinnedVersionStep{
				BuildBranch: "HEAD",
			},
			input:       pinnedVersion,
			wantFailure: false,
			wantErr:     false,
		},
		{
			name: "should return failure for pinned version",
			step: &pinnedVersionStep{
				BuildBranch: "v9.5.0",
			},
			input:       pinnedVersion,
			wantFailure: true,
			wantErr:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			failures, err := tt.step.Run(context.Background(), logging.DefaultLogger, &advisor.CheckSpec{}, tt.input)

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)

			if tt.wantFailure {
				require.Len(t, failures, 1)
				assert.Equal(t, advisor.CheckReportFailureSeverityLow, failures[0].Severity)
				assert.Equal(t, "pinned_version", failures[0].ItemID)
				assert.Equal(t, "Grafana version is pinned", failures[0].Item)
			} else {
				assert.Empty(t, failures)
			}
		})
	}
}

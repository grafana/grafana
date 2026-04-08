package instancechecks

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCheck_IsCloudInstance_Logic(t *testing.T) {
	tests := []struct {
		name            string
		stackID         string
		expectedCloud   bool
		expectedSteps   int
		expectedStepID  string
		expectedItems   int
		expectedItemID  string
	}{
		{
			name:            "empty stackID should run out of support check",
			stackID:         "",
			expectedCloud:   false,
			expectedSteps:   1,
			expectedStepID:  outOfSupportVersion,
			expectedItems:   1,
			expectedItemID:  outOfSupportVersion,
		},
		{
			name:            "non-empty stackID should run pinned version check",
			stackID:         "12345",
			expectedCloud:   true,
			expectedSteps:   1,
			expectedStepID:  pinnedVersion,
			expectedItems:   1,
			expectedItemID:  pinnedVersion,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &setting.Cfg{
				StackID:      tt.stackID,
				BuildBranch:  "v10.0.0",
				BuildVersion: "10.0.0",
				BuildStamp:   time.Now().Unix(),
			}

			check := New(cfg).(*check)

			// Verify isCloudInstance field is set correctly
			assert.Equal(t, tt.expectedCloud, check.isCloudInstance)

			// Verify Steps() returns the correct steps
			steps := check.Steps()
			require.Len(t, steps, tt.expectedSteps)
			assert.Equal(t, tt.expectedStepID, steps[0].ID())

			// Verify Items() returns the correct items
			items, err := check.Items(context.Background())
			require.NoError(t, err)
			require.Len(t, items, tt.expectedItems)
			assert.Equal(t, tt.expectedItemID, items[0])
		})
	}
}

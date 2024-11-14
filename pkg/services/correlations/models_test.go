package correlations

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCorrelationModels(t *testing.T) {
	t.Run("CreateCorrelationCommand Validate", func(t *testing.T) {
		t.Run("Successfully validates a correct create command", func(t *testing.T) {
			targetUid := "targetUid"
			config := &CorrelationConfig{
				Field:  "field",
				Target: map[string]any{},
			}
			cmd := &CreateCorrelationCommand{
				SourceUID: "some-uid",
				OrgId:     1,
				TargetUID: &targetUid,
				Config:    *config,
				Type:      query,
			}

			require.NoError(t, cmd.Validate())
		})

		t.Run("Fails if target UID is not set and config type = query", func(t *testing.T) {
			config := &CorrelationConfig{
				Field:  "field",
				Target: map[string]any{},
				Type:   query,
			}
			cmd := &CreateCorrelationCommand{
				SourceUID: "some-uid",
				OrgId:     1,
				Config:    *config,
			}

			require.Error(t, cmd.Validate())
		})

		t.Run("Fails if config type is unknown", func(t *testing.T) {
			config := &CorrelationConfig{
				Field:  "field",
				Target: map[string]any{},
				Type:   "unknown config type",
			}
			cmd := &CreateCorrelationCommand{
				SourceUID: "some-uid",
				OrgId:     1,
				Config:    *config,
			}

			require.Error(t, cmd.Validate())
		})
	})

	t.Run("CorrelationConfigType Validate", func(t *testing.T) {
		t.Run("Successfully validates a correct type", func(t *testing.T) {
			type test struct {
				input     CorrelationType
				assertion require.ErrorAssertionFunc
			}

			tests := []test{
				{input: "query", assertion: require.NoError},
				{input: "link", assertion: require.Error},
			}

			for _, tc := range tests {
				tc.assertion(t, tc.input.Validate())
			}
		})
	})

	t.Run("CorrelationConfig JSON Marshaling", func(t *testing.T) {
		t.Run("Applies a default empty object if target is not defined", func(t *testing.T) {
			config := CorrelationConfig{
				Field: "field",
			}

			data, err := json.Marshal(config)
			require.NoError(t, err)

			require.Equal(t, `{"field":"field","target":{}}`, string(data))
		})
	})
}

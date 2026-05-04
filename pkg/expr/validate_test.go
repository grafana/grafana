package expr

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateExpressionModel(t *testing.T) {
	testCases := []struct {
		name         string
		model        string
		expectType   CommandType
		expectErr    bool
		expectUnknow bool // expect ErrUnknownExpressionType
	}{
		{
			name:       "empty model is a no-op",
			model:      ``,
			expectType: TypeUnknown,
		},
		{
			name:         "missing type is unknown",
			model:        `{"refId":"A"}`,
			expectType:   TypeUnknown,
			expectErr:    true,
			expectUnknow: true,
		},
		{
			name: "valid classic_conditions",
			model: `{
				"type":"classic_conditions",
				"conditions":[{"type":"query","evaluator":{"params":[0],"type":"gt"},"query":{"params":["A"]},"reducer":{"type":"last","params":[]}}]
			}`,
			expectType: TypeClassicConditions,
		},
		{
			name: "malformed classic_conditions missing query.params fails",
			model: `{
				"type":"classic_conditions",
				"conditions":[{"type":"query","evaluator":{"params":[0],"type":"gt"},"query":{},"reducer":{"type":"last","params":[]}}]
			}`,
			expectType: TypeClassicConditions,
			expectErr:  true,
		},
		{
			name:       "valid math",
			model:      `{"type":"math","expression":"$A + 1"}`,
			expectType: TypeMath,
		},
		{
			name:       "malformed math missing expression fails",
			model:      `{"type":"math"}`,
			expectType: TypeMath,
			expectErr:  true,
		},
		{
			name:       "valid threshold",
			model:      `{"type":"threshold","expression":"A","conditions":[{"evaluator":{"type":"gt","params":[0]}}]}`,
			expectType: TypeThreshold,
		},
		{
			name:       "malformed threshold without expression fails",
			model:      `{"type":"threshold","conditions":[]}`,
			expectType: TypeThreshold,
			expectErr:  true,
		},
		{
			name:       "sql is skipped (no cfg/toggles available at validate time)",
			model:      `{"type":"sql","expression":"SELECT * FROM A"}`,
			expectType: TypeSQL,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			gotType, err := ValidateExpressionModel("A", json.RawMessage(tc.model))
			assert.Equal(t, tc.expectType, gotType)
			if tc.expectErr {
				require.Error(t, err)
				if tc.expectUnknow {
					assert.True(t, errors.Is(err, ErrUnknownExpressionType))
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

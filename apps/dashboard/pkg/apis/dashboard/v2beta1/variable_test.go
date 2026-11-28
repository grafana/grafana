package v2beta1

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestVariableOptionValueUnmarshal(t *testing.T) {
	tests := []struct {
		name      string
		valueJSON string
		wantValue string
	}{
		{
			name:      "string value",
			valueJSON: `"1"`,
			wantValue: "1",
		},
		{
			name:      "numeric value",
			valueJSON: `1`,
			wantValue: "1",
		},
		{
			name:      "numeric float value",
			valueJSON: `1.5`,
			wantValue: "1.5",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var variable Variable
			payload := fmt.Sprintf(`{"kind":"Variable","spec":{"kind":"CustomVariable","spec":{"name":"repro","current":{"text":"1","value":"1"},"options":[{"text":"A","value":%s}]}}}`, tt.valueJSON)

			err := json.Unmarshal([]byte(payload), &variable)
			require.NoError(t, err)
			require.NotNil(t, variable.Spec.CustomVariableKind)
			require.Len(t, variable.Spec.CustomVariableKind.Spec.Options, 1)
			require.NotNil(t, variable.Spec.CustomVariableKind.Spec.Options[0].Value.String)
			require.Equal(t, tt.wantValue, *variable.Spec.CustomVariableKind.Spec.Options[0].Value.String)
		})
	}
}

func TestVariableOptionArrayValueUnmarshal(t *testing.T) {
	tests := []struct {
		name      string
		valueJSON string
		wantValue []string
	}{
		{
			name:      "string array value",
			valueJSON: `["a", "b"]`,
			wantValue: []string{"a", "b"},
		},
		{
			name:      "numeric array value",
			valueJSON: `[1, 2]`,
			wantValue: []string{"1", "2"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var variable Variable
			payload := fmt.Sprintf(`{"kind":"Variable","spec":{"kind":"CustomVariable","spec":{"name":"repro","current":{"text":"1","value":"1"},"options":[{"text":"A","value":%s}]}}}`, tt.valueJSON)

			err := json.Unmarshal([]byte(payload), &variable)
			require.NoError(t, err)
			require.NotNil(t, variable.Spec.CustomVariableKind)
			require.Len(t, variable.Spec.CustomVariableKind.Spec.Options, 1)
			require.Equal(t, tt.wantValue, variable.Spec.CustomVariableKind.Spec.Options[0].Value.ArrayOfString)
		})
	}
}

func TestQueryVariableOptionValueUnmarshal(t *testing.T) {
	var variable Variable
	payload := `{"kind":"Variable","spec":{"kind":"QueryVariable","spec":{"name":"repro","current":{"text":"1","value":"1"},"query":{"kind":"DataQuery","group":"infinity","version":"v0","spec":{}},"options":[{"text":"A","value":1}]}}}`

	err := json.Unmarshal([]byte(payload), &variable)
	require.NoError(t, err)
	require.NotNil(t, variable.Spec.QueryVariableKind)
	require.Len(t, variable.Spec.QueryVariableKind.Spec.Options, 1)
	require.NotNil(t, variable.Spec.QueryVariableKind.Spec.Options[0].Value.String)
	require.Equal(t, "1", *variable.Spec.QueryVariableKind.Spec.Options[0].Value.String)
}

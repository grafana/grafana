package models

import (
	"errors"
	"fmt"
	"math"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/stretchr/testify/require"
)

func TestInstanceStateType_IsValid(t *testing.T) {
	testCases := []struct {
		instanceType     InstanceStateType
		expectedValidity bool
	}{
		{
			instanceType:     InstanceStateFiring,
			expectedValidity: true,
		},
		{
			instanceType:     InstanceStateNormal,
			expectedValidity: true,
		},
		{
			instanceType:     InstanceStatePending,
			expectedValidity: true,
		},
		{
			instanceType:     InstanceStateNoData,
			expectedValidity: true,
		},
		{
			instanceType:     InstanceStateError,
			expectedValidity: true,
		},
		{
			instanceType:     InstanceStateRecovering,
			expectedValidity: true,
		},
		{
			instanceType:     InstanceStateType("notAValidInstanceStateType"),
			expectedValidity: false,
		},
	}

	for _, tc := range testCases {
		t.Run(buildTestInstanceStateTypeIsValidName(tc.instanceType, tc.expectedValidity), func(t *testing.T) {
			require.Equal(t, tc.expectedValidity, tc.instanceType.IsValid())
		})
	}
}

func buildTestInstanceStateTypeIsValidName(instanceType InstanceStateType, expectedValidity bool) string {
	if expectedValidity {
		return fmt.Sprintf("%q should be valid", instanceType)
	}
	return fmt.Sprintf("%q should not be valid", instanceType)
}

func TestValidateAlertInstance(t *testing.T) {
	testCases := []struct {
		name         string
		orgId        int64
		uid          string
		currentState InstanceStateType
		err          error
	}{
		{
			name:         "fails if orgID is empty",
			orgId:        0,
			uid:          "validUid",
			currentState: InstanceStateNormal,
			err:          errors.New("alert instance is invalid due to missing alert rule organisation"),
		},
		{
			name:         "fails if uid is empty",
			orgId:        1,
			uid:          "",
			currentState: InstanceStateNormal,
			err:          errors.New("alert instance is invalid due to missing alert rule uid"),
		},
		{
			name:         "fails if current state is not valid",
			orgId:        1,
			uid:          "validUid",
			currentState: InstanceStateType("notAValidType"),
			err:          errors.New("alert instance is invalid because the state 'notAValidType' is invalid"),
		},
		{
			name:         "ok if validated fields are correct",
			orgId:        1,
			uid:          "validUid",
			currentState: InstanceStateNormal,
			err:          nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			instance := AlertInstanceGen(func(instance *AlertInstance) {
				instance.RuleOrgID = tc.orgId
				instance.RuleUID = tc.uid
				instance.CurrentState = tc.currentState
			})

			require.Equal(t, tc.err, ValidateAlertInstance(*instance))
		})
	}
}

func TestJsonifyValues(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]float64
		expected map[string]any
	}{
		{
			name:     "nil map",
			input:    nil,
			expected: nil,
		},
		{
			name:     "empty map",
			input:    map[string]float64{},
			expected: map[string]any{},
		},
		{
			name:     "regular float values",
			input:    map[string]float64{"A": 1.5, "B": -2.0, "C": 0},
			expected: map[string]any{"A": 1.5, "B": -2.0, "C": 0.0},
		},
		{
			name:     "NaN value",
			input:    map[string]float64{"A": math.NaN()},
			expected: map[string]any{"A": "NaN"},
		},
		{
			name:     "positive infinity",
			input:    map[string]float64{"A": math.Inf(1)},
			expected: map[string]any{"A": "+Inf"},
		},
		{
			name:     "negative infinity",
			input:    map[string]float64{"A": math.Inf(-1)},
			expected: map[string]any{"A": "-Inf"},
		},
		{
			name:     "mixed values",
			input:    map[string]float64{"A": math.NaN(), "B": math.Inf(1), "C": math.Inf(-1), "D": 10.5},
			expected: map[string]any{"A": "NaN", "B": "+Inf", "C": "-Inf", "D": 10.5},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := jsonifyValues(tt.input)
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestUnjsonifyValues(t *testing.T) {
	tests := []struct {
		name        string
		input       map[string]any
		expected    map[string]float64
		expectedErr string
	}{
		{
			name:     "nil map",
			input:    nil,
			expected: nil,
		},
		{
			name:     "empty map",
			input:    map[string]any{},
			expected: map[string]float64{},
		},
		{
			name:     "regular float values",
			input:    map[string]any{"A": 1.5, "B": -2.0, "C": 0.0},
			expected: map[string]float64{"A": 1.5, "B": -2.0, "C": 0.0},
		},
		{
			name:     "NaN string",
			input:    map[string]any{"A": "NaN"},
			expected: map[string]float64{"A": math.NaN()},
		},
		{
			name:     "positive infinity string",
			input:    map[string]any{"A": "+Inf"},
			expected: map[string]float64{"A": math.Inf(1)},
		},
		{
			name:     "negative infinity string",
			input:    map[string]any{"A": "-Inf"},
			expected: map[string]float64{"A": math.Inf(-1)},
		},
		{
			name:     "mixed values",
			input:    map[string]any{"A": "NaN", "B": "+Inf", "C": "-Inf", "D": 10.5},
			expected: map[string]float64{"A": math.NaN(), "B": math.Inf(1), "C": math.Inf(-1), "D": 10.5},
		},
		{
			name:        "invalid string value",
			input:       map[string]any{"A": "invalid"},
			expectedErr: `invalid string value for key "A": "invalid"`,
		},
		{
			name:        "invalid type (int)",
			input:       map[string]any{"A": 42},
			expectedErr: `invalid value type for key "A": int`,
		},
		{
			name:        "invalid type (bool)",
			input:       map[string]any{"A": true},
			expectedErr: `invalid value type for key "A": bool`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := unjsonifyValues(tt.input)
			if tt.expectedErr != "" {
				require.EqualError(t, err, tt.expectedErr)
				return
			}
			require.NoError(t, err)
			require.True(t, cmp.Equal(tt.expected, result, cmpopts.EquateNaNs()), "mismatch: %s", cmp.Diff(tt.expected, result, cmpopts.EquateNaNs()))
		})
	}
}

func TestJsonifyUnjsonifyRoundTrip(t *testing.T) {
	tests := []struct {
		name  string
		input map[string]float64
	}{
		{
			name:  "regular values",
			input: map[string]float64{"A": 1.5, "B": -2.0, "C": 0},
		},
		{
			name:  "special values",
			input: map[string]float64{"A": math.NaN(), "B": math.Inf(1), "C": math.Inf(-1)},
		},
		{
			name:  "mixed values",
			input: map[string]float64{"A": math.NaN(), "B": math.Inf(1), "C": math.Inf(-1), "D": 10.5, "E": 0},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			jsonified := jsonifyValues(tt.input)
			result, err := unjsonifyValues(jsonified)
			require.NoError(t, err)
			require.True(t, cmp.Equal(tt.input, result, cmpopts.EquateNaNs()), "round-trip mismatch: %s", cmp.Diff(tt.input, result, cmpopts.EquateNaNs()))
		})
	}
}

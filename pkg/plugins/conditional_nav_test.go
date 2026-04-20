package plugins

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConditionalNav_UnmarshalJSON(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expected    ConditionalNav
		expectError bool
	}{
		{
			name:     "boolean true",
			input:    `true`,
			expected: AddToNavBool(true),
		},
		{
			name:     "boolean false",
			input:    `false`,
			expected: AddToNavBool(false),
		},
		{
			name:     "feature flag name",
			input:    `"my-feature-flag"`,
			expected: AddToNavFeatureFlag("my-feature-flag"),
		},
		{
			name:     "dotted feature flag name",
			input:    `"assistant.frontend.workspace"`,
			expected: AddToNavFeatureFlag("assistant.frontend.workspace"),
		},
		{
			name:        "number is rejected",
			input:       `123`,
			expectError: true,
		},
		{
			name:        "array is rejected",
			input:       `[true]`,
			expectError: true,
		},
		{
			name:        "object is rejected",
			input:       `{"flag": "x"}`,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var got ConditionalNav
			err := json.Unmarshal([]byte(tt.input), &got)
			if tt.expectError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.expected, got)
		})
	}
}

func TestConditionalNav_MarshalJSON(t *testing.T) {
	tests := []struct {
		name     string
		input    ConditionalNav
		expected string
	}{
		{
			name:     "boolean true",
			input:    AddToNavBool(true),
			expected: `true`,
		},
		{
			name:     "boolean false",
			input:    AddToNavBool(false),
			expected: `false`,
		},
		{
			name:     "feature flag",
			input:    AddToNavFeatureFlag("my-flag"),
			expected: `"my-flag"`,
		},
		{
			name:     "zero value",
			input:    ConditionalNav{},
			expected: `false`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := json.Marshal(tt.input)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, string(data))
		})
	}
}

func TestConditionalNav_MarshalRoundTrip(t *testing.T) {
	values := []ConditionalNav{
		AddToNavBool(true),
		AddToNavBool(false),
		AddToNavFeatureFlag("assistant.frontend.workspace"),
	}

	for _, original := range values {
		data, err := json.Marshal(original)
		require.NoError(t, err)

		var restored ConditionalNav
		err = json.Unmarshal(data, &restored)
		require.NoError(t, err)
		assert.Equal(t, original, restored)
	}
}

func TestConditionalNav_IsEnabled(t *testing.T) {
	alwaysEnabled := func(string) bool { return true }
	alwaysDisabled := func(string) bool { return false }

	tests := []struct {
		name           string
		nav            ConditionalNav
		featureEnabled func(string) bool
		expected       bool
	}{
		{
			name:           "literal true ignores feature function",
			nav:            AddToNavBool(true),
			featureEnabled: alwaysDisabled,
			expected:       true,
		},
		{
			name:           "literal false ignores feature function",
			nav:            AddToNavBool(false),
			featureEnabled: alwaysEnabled,
			expected:       false,
		},
		{
			name:           "feature flag enabled",
			nav:            AddToNavFeatureFlag("my-flag"),
			featureEnabled: alwaysEnabled,
			expected:       true,
		},
		{
			name:           "feature flag disabled",
			nav:            AddToNavFeatureFlag("my-flag"),
			featureEnabled: alwaysDisabled,
			expected:       false,
		},
		{
			name: "feature flag checked by name",
			nav:  AddToNavFeatureFlag("target-flag"),
			featureEnabled: func(flag string) bool {
				return flag == "target-flag"
			},
			expected: true,
		},
		{
			name: "feature flag checked by name - mismatch",
			nav:  AddToNavFeatureFlag("other-flag"),
			featureEnabled: func(flag string) bool {
				return flag == "target-flag"
			},
			expected: false,
		},
		{
			name:           "zero value resolves to false",
			nav:            ConditionalNav{},
			featureEnabled: alwaysEnabled,
			expected:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, tt.nav.IsEnabled(tt.featureEnabled))
		})
	}
}

func TestConditionalNav_InIncludesStruct(t *testing.T) {
	t.Run("deserialize includes with boolean addToNav", func(t *testing.T) {
		input := `{"name": "Test", "type": "page", "addToNav": true}`
		var inc Includes
		err := json.Unmarshal([]byte(input), &inc)
		require.NoError(t, err)
		assert.Equal(t, AddToNavBool(true), inc.AddToNav)
	})

	t.Run("deserialize includes with feature flag addToNav", func(t *testing.T) {
		input := `{"name": "Test", "type": "page", "addToNav": "my-feature"}`
		var inc Includes
		err := json.Unmarshal([]byte(input), &inc)
		require.NoError(t, err)
		assert.Equal(t, AddToNavFeatureFlag("my-feature"), inc.AddToNav)
	})

	t.Run("deserialize includes with missing addToNav defaults to false", func(t *testing.T) {
		input := `{"name": "Test", "type": "page"}`
		var inc Includes
		err := json.Unmarshal([]byte(input), &inc)
		require.NoError(t, err)
		assert.False(t, inc.AddToNav.IsEnabled(func(string) bool { return true }))
	})
}

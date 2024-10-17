package state

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestNewSyncLabels(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]string
		expected data.Labels
	}{
		{
			name:     "initialize with non-empty map",
			input:    map[string]string{"key1": "value1"},
			expected: data.Labels(map[string]string{"key1": "value1"}),
		},
		{
			name:     "initialize with empty map",
			input:    map[string]string{},
			expected: data.Labels{},
		},
		{
			name:     "initialize with nil map",
			input:    nil,
			expected: data.Labels{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			sl := NewSyncLabels(tc.input)
			require.NotNil(t, sl)
			require.Equal(t, tc.expected, sl.GetAll())
		})
	}
}

func TestSetAndGet(t *testing.T) {
	tests := []struct {
		name         string
		key          string
		value        string
		lookupKey    string
		expectedVal  string
		expectedBool bool
	}{
		{
			name:         "set and get existing key",
			key:          "key1",
			value:        "value1",
			lookupKey:    "key1",
			expectedVal:  "value1",
			expectedBool: true,
		},
		{
			name:         "get nonexistent key",
			key:          "key1",
			value:        "value1",
			lookupKey:    "key2",
			expectedVal:  "",
			expectedBool: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			sl := NewSyncLabels(nil)
			sl.Set(tc.key, tc.value)

			value, ok := sl.Get(tc.lookupKey)
			require.Equal(t, tc.expectedBool, ok)
			require.Equal(t, tc.expectedVal, value)
		})
	}
}

func TestSetAll(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]string
		expected data.Labels
	}{
		{
			name:     "set multiple key-value pairs",
			input:    map[string]string{"key1": "value1", "key2": "value2"},
			expected: data.Labels(map[string]string{"key1": "value1", "key2": "value2"}),
		},
		{
			name:     "set empty map",
			input:    map[string]string{},
			expected: data.Labels{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			sl := NewSyncLabels(nil)
			sl.SetAll(tc.input)

			require.Equal(t, tc.expected, sl.GetAll())
		})
	}
}

func TestLen(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]string
		expected int
	}{
		{
			name:     "map with multiple key-value pairs",
			input:    map[string]string{"key1": "value1", "key2": "value2"},
			expected: 2,
		},
		{
			name:     "empty map",
			input:    map[string]string{},
			expected: 0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			sl := NewSyncLabels(tc.input)
			require.Equal(t, tc.expected, sl.Len())
		})
	}
}

func TestDelete(t *testing.T) {
	tests := []struct {
		name      string
		input     map[string]string
		deleteKey string
		expected  data.Labels
	}{
		{
			name:      "delete existing key",
			input:     map[string]string{"key1": "value1", "key2": "value2"},
			deleteKey: "key1",
			expected:  data.Labels(map[string]string{"key2": "value2"}),
		},
		{
			name:      "delete non-existing key",
			input:     map[string]string{"key1": "value1"},
			deleteKey: "key2",
			expected:  data.Labels(map[string]string{"key1": "value1"}),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			sl := NewSyncLabels(tc.input)
			sl.Delete(tc.deleteKey)

			_, ok := sl.Get(tc.deleteKey)
			require.False(t, ok)
			require.Equal(t, tc.expected, sl.GetAll())
		})
	}
}

func TestRange(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]string
		expected map[string]string
	}{
		{
			name:     "iterate over multiple key-value pairs",
			input:    map[string]string{"key1": "value1", "key2": "value2"},
			expected: map[string]string{"key1": "value1", "key2": "value2"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			sl := NewSyncLabels(tc.input)

			iteratedOver := make(map[string]string)
			sl.Range(func(k, v string) bool {
				iteratedOver[k] = v
				return true
			})

			require.Equal(t, tc.expected, iteratedOver)
		})
	}
}

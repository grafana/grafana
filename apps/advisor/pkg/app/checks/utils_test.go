package checks

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestGetNamespace(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expected    string
		expectedErr string
	}{
		{
			name:     "empty stack ID",
			input:    "",
			expected: metav1.NamespaceDefault,
		},
		{
			name:     "valid stack ID",
			input:    "1234567890",
			expected: "stacks-1234567890",
		},
		{
			name:        "invalid stack ID",
			input:       "invalid",
			expected:    "",
			expectedErr: "invalid stack id: invalid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := GetNamespace(tt.input)
			if tt.expectedErr != "" {
				assert.EqualError(t, err, tt.expectedErr)
			} else {
				assert.NoError(t, err)
			}
			assert.Equal(t, tt.expected, result)
		})
	}
}

func Test_GetDefaultEvaluationInterval(t *testing.T) {
	t.Run("default", func(t *testing.T) {
		interval, err := GetDefaultEvaluationInterval(map[string]string{})
		assert.NoError(t, err)
		assert.Equal(t, 7*24*time.Hour, interval)
	})

	t.Run("invalid", func(t *testing.T) {
		interval, err := GetDefaultEvaluationInterval(map[string]string{"evaluation_interval": "invalid"})
		assert.Error(t, err)
		assert.Zero(t, interval)
	})

	t.Run("custom", func(t *testing.T) {
		interval, err := GetDefaultEvaluationInterval(map[string]string{"evaluation_interval": "1h"})
		assert.NoError(t, err)
		assert.Equal(t, time.Hour, interval)
	})
}

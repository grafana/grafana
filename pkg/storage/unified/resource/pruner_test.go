package resource

import "testing"

func TestPrunerValidate(t *testing.T) {
	tests := []struct {
		name     string
		key      PruningKey
		expected bool
	}{
		{
			name: "valid key",
			key: PruningKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "deployments",
				Name:      "my-deployment",
			},
			expected: true,
		},
		{
			name: "missing namespace",
			key: PruningKey{
				Group:    "apps",
				Resource: "deployments",
				Name:     "my-deployment",
			},
			expected: false,
		},
		{
			name: "missing group",
			key: PruningKey{
				Namespace: "default",
				Resource:  "deployments",
				Name:      "my-deployment",
			},
			expected: false,
		},
		{
			name: "missing resource",
			key: PruningKey{
				Namespace: "default",
				Group:     "apps",
				Name:      "my-deployment",
			},
			expected: false,
		},
		{
			name: "missing name",
			key: PruningKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "deployments",
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.key.Validate()
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

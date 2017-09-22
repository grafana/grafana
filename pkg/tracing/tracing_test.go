package tracing

import "testing"

func TestGroupSplit(t *testing.T) {
	tests := []struct {
		input    string
		expected map[string]string
	}{
		{
			input: "tag1:value1,tag2:value2",
			expected: map[string]string{
				"tag1": "value1",
				"tag2": "value2",
			},
		},
		{
			input:    "",
			expected: map[string]string{},
		},
		{
			input:    "tag1",
			expected: map[string]string{},
		},
	}

	for _, test := range tests {
		tags := splitTagSettings(test.input)
		for k, v := range test.expected {
			value, exists := tags[k]
			if !exists || value != v {
				t.Errorf("tags does not match %v ", test)
			}
		}
	}
}

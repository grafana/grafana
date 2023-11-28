package request_test

import (
	"testing"

	grafanarequest "github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

func TestParseNamespace(t *testing.T) {
	tests := []struct {
		name      string
		namespace string
		expected  grafanarequest.NamespaceInfo
		expectErr bool
	}{
		{
			name: "empty namespace",
			expected: grafanarequest.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "incorrect number of parts",
			namespace: "org-123-a",
			expectErr: true,
			expected: grafanarequest.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "org id not a number",
			namespace: "org-invalid",
			expectErr: true,
			expected: grafanarequest.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "valid org id",
			namespace: "org-123",
			expected: grafanarequest.NamespaceInfo{
				OrgID: 123,
			},
		},
		{
			name:      "org should not be 1 in the namespace",
			namespace: "org-1",
			expectErr: true,
			expected: grafanarequest.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "can not be negative",
			namespace: "org--5",
			expectErr: true,
			expected: grafanarequest.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "can not be zero",
			namespace: "org-0",
			expectErr: true,
			expected: grafanarequest.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "default is org 1",
			namespace: "default",
			expected: grafanarequest.NamespaceInfo{
				OrgID: 1,
			},
		},
		{
			name:      "valid stack",
			namespace: "stack-abcdef",
			expected: grafanarequest.NamespaceInfo{
				OrgID:   1,
				StackID: "abcdef",
			},
		},
		{
			name:      "invalid stack id",
			namespace: "stack-",
			expectErr: true,
			expected: grafanarequest.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "invalid stack id (too short)",
			namespace: "stack-1",
			expectErr: true,
			expected: grafanarequest.NamespaceInfo{
				OrgID:   -1,
				StackID: "1",
			},
		},
		{
			name:      "other namespace",
			namespace: "anything",
			expected: grafanarequest.NamespaceInfo{
				OrgID: -1,
				Value: "anything",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info, err := grafanarequest.ParseNamespace(tt.namespace)
			if tt.expectErr != (err != nil) {
				t.Errorf("ParseNamespace() returned %+v, expected an error", info)
			}
			if info.OrgID != tt.expected.OrgID {
				t.Errorf("ParseNamespace() [OrgID] returned %d, expected %d", info.OrgID, tt.expected.OrgID)
			}
			if info.StackID != tt.expected.StackID {
				t.Errorf("ParseNamespace() [StackID] returned %s, expected %s", info.StackID, tt.expected.StackID)
			}
			if info.Value != tt.namespace {
				t.Errorf("ParseNamespace() [Value] returned %s, expected %s", info.Value, tt.namespace)
			}
		})
	}
}

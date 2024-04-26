package request_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

func TestParseNamespace(t *testing.T) {
	tests := []struct {
		name      string
		namespace string
		expected  request.NamespaceInfo
		expectErr bool
	}{
		{
			name: "empty namespace",
			expected: request.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "incorrect number of parts",
			namespace: "org-123-a",
			expectErr: true,
			expected: request.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "org id not a number",
			namespace: "org-invalid",
			expectErr: true,
			expected: request.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "valid org id",
			namespace: "org-123",
			expected: request.NamespaceInfo{
				OrgID: 123,
			},
		},
		{
			name:      "org should not be 1 in the namespace",
			namespace: "org-1",
			expectErr: true,
			expected: request.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "can not be negative",
			namespace: "org--5",
			expectErr: true,
			expected: request.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "can not be zero",
			namespace: "org-0",
			expectErr: true,
			expected: request.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "default is org 1",
			namespace: "default",
			expected: request.NamespaceInfo{
				OrgID: 1,
			},
		},
		{
			name:      "invalid stack id (must be an int)",
			expectErr: true,
			namespace: "stack-abcdef",
			expected: request.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "invalid stack id (must be provided)",
			namespace: "stack-",
			expectErr: true,
			expected: request.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "invalid stack id (cannot be 0)",
			namespace: "stack-0",
			expectErr: true,
			expected: request.NamespaceInfo{
				OrgID: -1,
			},
		},
		{
			name:      "valid stack",
			namespace: "stack-1",
			expected: request.NamespaceInfo{
				OrgID:   1,
				StackID: "1",
			},
		},
		{
			name:      "other namespace",
			namespace: "anything",
			expected: request.NamespaceInfo{
				OrgID: -1,
				Value: "anything",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info, err := request.ParseNamespace(tt.namespace)
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

func TestNamespaceMapper(t *testing.T) {
	tests := []struct {
		name     string
		cfg      string
		orgId    int64
		expected string
	}{
		{
			name:     "default namespace",
			orgId:    1,
			expected: "default",
		},
		{
			name:     "with org",
			orgId:    123,
			expected: "org-123",
		},
		{
			name:     "with stackId",
			cfg:      "abc",
			orgId:    123, // ignored
			expected: "stack-abc",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mapper := request.GetNamespaceMapper(&setting.Cfg{StackID: tt.cfg})
			require.Equal(t, tt.expected, mapper(tt.orgId))
		})
	}
}

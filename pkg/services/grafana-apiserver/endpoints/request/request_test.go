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
		ok        bool
	}{
		{
			name: "empty namespace",
			expected: grafanarequest.NamespaceInfo{
				OrgID: -1,
			},
			ok: true,
		},
		{
			name:      "incorrect number of parts",
			namespace: "org-123-a",
			ok:        false,
		},
		{
			name:      "org id not a number",
			namespace: "org-invalid",
			ok:        false,
		},
		{
			name:      "valid org id",
			namespace: "org-123",
			expected: grafanarequest.NamespaceInfo{
				OrgID: 123,
			},
			ok: true,
		},
		{
			name:      "org should not be 1 in the namespace",
			namespace: "org-1",
			ok:        false,
		},
		{
			name:      "can not be negative",
			namespace: "org--5",
			ok:        false,
		},
		{
			name:      "can not be zero",
			namespace: "org-0",
			ok:        false,
		},
		{
			name:      "default is org 1",
			namespace: "default",
			expected: grafanarequest.NamespaceInfo{
				OrgID: 1,
			},
			ok: true,
		},
		{
			name:      "valid stack",
			namespace: "stack-abcdef",
			expected: grafanarequest.NamespaceInfo{
				OrgID:   1,
				StackID: "abcdef",
			},
			ok: true,
		},
		{
			name:      "invalid stack id",
			namespace: "stack-",
			ok:        false,
		},
		{
			name:      "other namespace",
			namespace: "anything",
			ok:        true,
			expected: grafanarequest.NamespaceInfo{
				OrgID: -1,
				Other: "anything",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info, err := grafanarequest.ParseNamespace(tt.namespace)
			isOK := err == nil
			if isOK != tt.ok {
				t.Errorf("ParseNamespace() returned %+v, expected an error", info)
			}
			if info.OrgID != tt.expected.OrgID {
				t.Errorf("ParseNamespace() [OrgID] returned %d, expected %d", info.OrgID, tt.expected.OrgID)
			}
			if info.StackID != tt.expected.StackID {
				t.Errorf("ParseNamespace() [StackID] returned %s, expected %s", info.StackID, tt.expected.StackID)
			}
			if info.Other != tt.expected.Other {
				t.Errorf("ParseNamespace() [Other] returned %s, expected %s", info.Other, tt.expected.Other)
			}
		})
	}
}

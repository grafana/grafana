package request_test

import (
	"context"
	"testing"

	"k8s.io/apiserver/pkg/endpoints/request"

	grafanarequest "github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

func TestOrgIDFrom(t *testing.T) {
	tests := []struct {
		name     string
		ctx      context.Context
		expected int64
		ok       bool
	}{
		{
			name:     "empty namespace",
			ctx:      context.Background(),
			expected: 0,
			ok:       false,
		},
		{
			name:     "incorrect number of parts",
			ctx:      request.WithNamespace(context.Background(), "org-123-a"),
			expected: 0,
			ok:       false,
		},
		{
			name:     "incorrect prefix",
			ctx:      request.WithNamespace(context.Background(), "abc-123"),
			expected: 0,
			ok:       false,
		},
		{
			name:     "org id not a number",
			ctx:      request.WithNamespace(context.Background(), "org-invalid"),
			expected: 0,
			ok:       false,
		},
		{
			name:     "valid org id",
			ctx:      request.WithNamespace(context.Background(), "org-123"),
			expected: 123,
			ok:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual, ok := grafanarequest.OrgIDFrom(tt.ctx)
			if actual != tt.expected {
				t.Errorf("OrgIDFrom() returned %d, expected %d", actual, tt.expected)
			}
			if ok != tt.ok {
				t.Errorf("OrgIDFrom() returned %t, expected %t", ok, tt.ok)
			}
		})
	}
}

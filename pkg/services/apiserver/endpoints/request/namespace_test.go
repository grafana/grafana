package request_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

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

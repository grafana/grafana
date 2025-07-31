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
		// an invalid use-case, but just documenting that it's handled as stack-0
		// this currently prevents the need to have the Mapper return (mapped, err) instead of just mapped.
		// err checking is avoided for now to keep the usage fluent
		{
			name:     "with stackId",
			cfg:      "abc",
			orgId:    123,        // ignored
			expected: "stacks-0", // we parse to int and default to 0
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mapper := request.GetNamespaceMapper(setting.ProvideService(&setting.Cfg{StackID: tt.cfg}))
			require.Equal(t, tt.expected, mapper(tt.orgId))
		})
	}
}

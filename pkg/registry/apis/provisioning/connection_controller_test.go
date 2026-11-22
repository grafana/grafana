package provisioning

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestConnectionControllerService_IsDisabled(t *testing.T) {
	tests := []struct {
		name    string
		builder *APIBuilder
		want    bool
	}{
		{name: "provisioning disabled", builder: nil, want: true},
		{name: "controllers disabled", builder: &APIBuilder{onlyApiServer: true}, want: true},
		{name: "controllers enabled", builder: &APIBuilder{}, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := ProvideConnectionControllerService(tt.builder, nil)
			require.Equal(t, tt.want, svc.IsDisabled())
		})
	}
}

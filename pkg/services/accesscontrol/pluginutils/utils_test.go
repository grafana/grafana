package pluginutils

import (
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/stretchr/testify/require"
)

func TestToRegistrations(t *testing.T) {
	tests := []struct {
		name string
		regs []plugins.RoleRegistration
		want []ac.RoleRegistration
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ToRegistrations(tt.regs)
			require.Equal(t, tt.want, got)
		})
	}
}

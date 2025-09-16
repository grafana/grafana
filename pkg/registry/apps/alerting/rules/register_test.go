package rules

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/stretchr/testify/require"
)

func TestRegisterAppInstaller_UnifiedAlertingEnabled(t *testing.T) {
	tests := []struct {
		name            string
		enabled         bool
		expectInstaller bool
	}{
		{name: "unified_alerting disabled returns nil installer", enabled: false, expectInstaller: false},
		{name: "unified_alerting enabled returns installer", enabled: true, expectInstaller: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			enabled := tt.enabled
			cfg := &setting.Cfg{UnifiedAlerting: setting.UnifiedAlertingSettings{Enabled: &enabled}}
			ng := &ngalert.AlertNG{Cfg: cfg}

			inst, err := RegisterAppInstaller(cfg, ng)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.expectInstaller {
				require.NotNil(t, inst)
			} else {
				require.Nil(t, inst)
			}
		})
	}
}

package setting

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestReadGRPCServerSettings_KeepaliveMinTime(t *testing.T) {
	tests := []struct {
		name     string
		ini      string
		expected time.Duration
	}{
		{name: "unset uses default", ini: "[grpc_server]\n", expected: DefaultGRPCServerKeepaliveMinTime},
		{name: "empty uses default", ini: "[grpc_server]\nkeepalive_min_time =\n", expected: DefaultGRPCServerKeepaliveMinTime},
		{name: "explicit value", ini: "[grpc_server]\nkeepalive_min_time = 1m\n", expected: time.Minute},
		{name: "zero disables enforcement policy", ini: "[grpc_server]\nkeepalive_min_time = 0\n", expected: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			iniFile, err := ini.Load([]byte(tt.ini))
			require.NoError(t, err)

			cfg := &Cfg{}
			require.NoError(t, readGRPCServerSettings(cfg, iniFile))
			require.Equal(t, tt.expected, cfg.GRPCServer.KeepaliveMinTime)
		})
	}
}

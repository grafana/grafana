package nats

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestBuildTLSConfig(t *testing.T) {
	t.Run("minimal config", func(t *testing.T) {
		tc, err := buildTLSConfig(setting.NATSTLSSettings{ServerName: "nats.example", InsecureSkipVerify: true})
		require.NoError(t, err)
		require.Equal(t, "nats.example", tc.ServerName)
		require.True(t, tc.InsecureSkipVerify)
		require.Nil(t, tc.RootCAs)
		require.Empty(t, tc.Certificates)
	})

	t.Run("invalid config errors", func(t *testing.T) {
		tests := []struct {
			name     string
			settings setting.NATSTLSSettings
		}{
			{"client cert without key", setting.NATSTLSSettings{CertPath: "/only/cert.pem"}},
			{"client key without cert", setting.NATSTLSSettings{KeyPath: "/only/key.pem"}},
			{"missing ca path", setting.NATSTLSSettings{CACertPath: "/does/not/exist.pem"}},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				_, err := buildTLSConfig(tt.settings)
				require.Error(t, err)
			})
		}
	})
}

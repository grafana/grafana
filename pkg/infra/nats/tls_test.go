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

	t.Run("client cert requires both halves", func(t *testing.T) {
		_, err := buildTLSConfig(setting.NATSTLSSettings{CertPath: "/only/cert.pem"})
		require.Error(t, err)
		_, err = buildTLSConfig(setting.NATSTLSSettings{KeyPath: "/only/key.pem"})
		require.Error(t, err)
	})

	t.Run("bad ca path errors", func(t *testing.T) {
		_, err := buildTLSConfig(setting.NATSTLSSettings{CACertPath: "/does/not/exist.pem"})
		require.Error(t, err)
	})
}

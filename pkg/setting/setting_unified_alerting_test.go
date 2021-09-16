package setting

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestCfg_ReadUnifiedAlertingSettings(t *testing.T) {
	cfg := NewCfg()
	err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
	require.NoError(t, err)

	// It sets the correct defaults.
	{
		require.Equal(t, 60*time.Second, cfg.AdminConfigPollInterval)
		require.Equal(t, 60*time.Second, cfg.AlertmanagerConfigPollInterval)
		require.Equal(t, 15*time.Second, cfg.HAPeerTimeout)
		require.Equal(t, "0.0.0.0:9094", cfg.HAListenAddr)
		require.Equal(t, "", cfg.HAAdvertiseAddr)
		require.Len(t, cfg.HAPeers, 0)
		require.Equal(t, 200*time.Millisecond, cfg.HAGossipInterval)
		require.Equal(t, 60*time.Second, cfg.HAPushPullInterval)
	}

	// With peers set, it correctly parses them.
	{
		require.Len(t, cfg.HAPeers, 0)
		s, err := cfg.Raw.NewSection("unified_alerting")
		require.NoError(t, err)
		_, err = s.NewKey("ha_peers", "hostname1:9090,hostname2:9090,hostname3:9090")
		require.NoError(t, err)

		require.NoError(t, cfg.ReadUnifiedAlertingSettings(cfg.Raw))
		require.Len(t, cfg.HAPeers, 3)
		require.ElementsMatch(t, []string{"hostname1:9090", "hostname2:9090", "hostname3:9090"}, cfg.HAPeers)
	}
}

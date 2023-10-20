package setting

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestCfg_readWebhooksSettings(t *testing.T) {
	cfg := NewCfg()
	err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
	require.NoError(t, err)

	{
		require.Equal(t, cfg.Webhooks.Timeout, 30*time.Second)
	}

}

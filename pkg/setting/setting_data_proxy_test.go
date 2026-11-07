package setting

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestReadDataProxySettings_Timeout(t *testing.T) {
	for _, tc := range []struct {
		desc       string
		ini        string
		timeout    int
		configured bool
	}{
		{desc: "missing key", ini: "[dataproxy]\n", timeout: 30},
		{desc: "empty value", ini: "[dataproxy]\ntimeout =\n", timeout: 30},
		{desc: "explicit value", ini: "[dataproxy]\ntimeout = 45\n", timeout: 45, configured: true},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			f, err := ini.Load([]byte(tc.ini))
			require.NoError(t, err)
			cfg := NewCfg()
			require.NoError(t, readDataProxySettings(f, cfg))
			require.Equal(t, tc.timeout, cfg.DataProxyTimeout)
			require.Equal(t, tc.configured, cfg.DataProxyTimeoutConfigured)
		})
	}
}

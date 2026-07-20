package envvars

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPermittedHostEnvVars_respectsPLUGIN_UNIX_SOCKET_DIR(t *testing.T) {
	customTmp := t.TempDir()
	t.Setenv("PLUGIN_UNIX_SOCKET_DIR", customTmp)

	vars := PermittedHostEnvVars()

	var count int
	for _, v := range vars {
		if strings.HasPrefix(v, "PLUGIN_UNIX_SOCKET_DIR=") {
			require.Equal(t, "PLUGIN_UNIX_SOCKET_DIR="+customTmp, v, "PLUGIN_UNIX_SOCKET_DIR should be forwarded when set")
			count++
		}
	}
	require.Equal(t, 1, count, "PLUGIN_UNIX_SOCKET_DIR should appear exactly once in PermittedHostEnvVars when set")
}

func TestPermittedHostEnvVarNames_includesPLUGIN_UNIX_SOCKET_DIR(t *testing.T) {
	names := PermittedHostEnvVarNames()
	require.Contains(t, names, "PLUGIN_UNIX_SOCKET_DIR", "PLUGIN_UNIX_SOCKET_DIR must be in permitted host env var names for restricted environments")
}

func TestPermittedHostEnvVars_PLUGIN_UNIX_SOCKET_DIR_Unset(t *testing.T) {
	prev, hadTMPDIR := os.LookupEnv("PLUGIN_UNIX_SOCKET_DIR")
	if hadTMPDIR {
		defer t.Setenv("PLUGIN_UNIX_SOCKET_DIR", prev)
	}
	_ = os.Unsetenv("PLUGIN_UNIX_SOCKET_DIR")

	vars := PermittedHostEnvVars()

	for _, v := range vars {
		if strings.HasPrefix(v, "PLUGIN_UNIX_SOCKET_DIR=") {
			t.Fatal("PLUGIN_UNIX_SOCKET_DIR should not be present when unset")
		}
	}
}

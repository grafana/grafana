package envvars

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPermittedHostEnvVars_respectsTMPDIR(t *testing.T) {
	customTmp := t.TempDir()
	t.Setenv("TMPDIR", customTmp)

	vars := PermittedHostEnvVars()

	var count int
	for _, v := range vars {
		if strings.HasPrefix(v, "TMPDIR=") {
			require.Equal(t, "TMPDIR="+customTmp, v, "TMPDIR should be forwarded when set")
			count++
		}
	}
	require.Equal(t, 1, count, "TMPDIR should appear exactly once in PermittedHostEnvVars when set")
}

func TestPermittedHostEnvVarNames_includesTMPDIR(t *testing.T) {
	names := PermittedHostEnvVarNames()
	require.Contains(t, names, "TMPDIR", "TMPDIR must be in permitted host env var names for restricted environments")
}

func TestPermittedHostEnvVars_TMPDIRUnset(t *testing.T) {
	prev, hadTMPDIR := os.LookupEnv("TMPDIR")
	if hadTMPDIR {
		defer t.Setenv("TMPDIR", prev)
	}
	_ = os.Unsetenv("TMPDIR")

	vars := PermittedHostEnvVars()

	for _, v := range vars {
		if strings.HasPrefix(v, "TMPDIR=") {
			t.Fatal("TMPDIR should not be present when unset")
		}
	}
}

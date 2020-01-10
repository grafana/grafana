package setting

import (
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDynamicSettingsSupport(t *testing.T) {
	cfg := NewCfg()

	envKey := "GF_FOO_BAR"
	sectionName := "foo"
	keyName := "bar"
	expected := "dynamic value"

	os.Setenv(envKey, expected)
	defer func() { os.Unsetenv(envKey) }()

	value := cfg.DynamicSection(sectionName).Key(keyName).MustString("default value")
	require.Equal(t, expected, value)
}

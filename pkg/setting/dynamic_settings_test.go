package setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDynamicSettingsSupport_Override(t *testing.T) {
	cfg := NewCfg()
	envKey := "GF_FOO_BAR"
	sectionName := "foo"
	keyName := "bar"
	expected := "dynamic value"

	t.Setenv(envKey, expected)

	value := cfg.SectionWithEnvOverrides(sectionName).Key(keyName).MustString("default value")
	require.Equal(t, expected, value)
}

func TestDynamicSettingsSupport_NoOverride(t *testing.T) {
	cfg := NewCfg()

	sectionName := "foo"
	keyName := "bar"
	expected := "default value"

	_, err := cfg.Raw.Section(sectionName).NewKey(keyName, expected)
	require.NoError(t, err)
	value := cfg.SectionWithEnvOverrides(sectionName).Key(keyName).String()
	require.Equal(t, expected, value)
}

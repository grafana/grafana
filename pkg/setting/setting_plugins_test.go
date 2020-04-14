package setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPluginSettings(t *testing.T) {
	cfg := NewCfg()
	sec, err := cfg.Raw.NewSection("plugin")
	require.NoError(t, err)
	_, err = sec.NewKey("key", "value")
	require.NoError(t, err)

	sec, err = cfg.Raw.NewSection("plugin.plugin")
	require.NoError(t, err)
	_, err = sec.NewKey("key1", "value1")
	require.NoError(t, err)
	_, err = sec.NewKey("key2", "value2")
	require.NoError(t, err)

	sec, err = cfg.Raw.NewSection("plugin.plugin2")
	require.NoError(t, err)
	_, err = sec.NewKey("key3", "value3")
	require.NoError(t, err)
	_, err = sec.NewKey("key4", "value4")
	require.NoError(t, err)

	sec, err = cfg.Raw.NewSection("other")
	require.NoError(t, err)
	_, err = sec.NewKey("keySomething", "whatever")
	require.NoError(t, err)

	ps := extractPluginSettings(cfg.Raw.Sections())
	require.Len(t, ps, 2)
	require.Len(t, ps["plugin"], 2)
	require.Equal(t, ps["plugin"]["key1"], "value1")
	require.Equal(t, ps["plugin"]["key2"], "value2")
	require.Len(t, ps["plugin2"], 2)
	require.Equal(t, ps["plugin2"]["key3"], "value3")
	require.Equal(t, ps["plugin2"]["key4"], "value4")
}

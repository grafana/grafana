package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestLoadSmtpStaticHeaders(t *testing.T) {
	t.Run("will load valid headers", func(t *testing.T) {
		f := ini.Empty()
		cfg := NewCfg()
		s, err := f.NewSection("smtp.static_headers")
		require.NoError(t, err)
		cfg.Raw = f
		_, err = s.NewKey("foo", "foo_val")
		_, err = s.NewKey("bar", "bar_val")
		require.NoError(t, err)

		err = cfg.readGrafanaSmtpStaticHeaders()
		require.NoError(t, err)

		assert.Equal(t, "foo_val", cfg.Smtp.StaticHeaders["foo"])
		assert.Equal(t, "bar_val", cfg.Smtp.StaticHeaders["bar"])
	})

	t.Run("will load no headers when section is defined with no keys", func(t *testing.T) {
		f := ini.Empty()
		cfg := NewCfg()
		_, err := f.NewSection("smtp.static_headers")
		require.NoError(t, err)
		cfg.Raw = f

		err = cfg.readGrafanaSmtpStaticHeaders()
		require.NoError(t, err)

		assert.Empty(t, cfg.Smtp.StaticHeaders)
	})

	t.Run("will load no headers when section is not defined", func(t *testing.T) {
		f := ini.Empty()
		cfg := NewCfg()
		cfg.Raw = f

		err := cfg.readGrafanaSmtpStaticHeaders()
		require.NoError(t, err)

		assert.Empty(t, cfg.Smtp.StaticHeaders)
	})

	t.Run("will return error when headers is not valid label", func(t *testing.T) {
		f := ini.Empty()
		cfg := NewCfg()
		s, err := f.NewSection("smtp.static_headers")
		require.NoError(t, err)
		_, err = s.NewKey("bad label", "value")
		require.NoError(t, err)
		cfg.Raw = f

		err = cfg.readGrafanaSmtpStaticHeaders()
		require.Error(t, err)
	})
}

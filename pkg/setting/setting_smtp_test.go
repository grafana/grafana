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
		_, err = s.NewKey("Foo-Header", "foo_val")
		require.NoError(t, err)
		_, err = s.NewKey("Bar", "bar_val")
		require.NoError(t, err)

		err = cfg.readGrafanaSmtpStaticHeaders()
		require.NoError(t, err)

		assert.Equal(t, "foo_val", cfg.Smtp.StaticHeaders["Foo-Header"])
		assert.Equal(t, "bar_val", cfg.Smtp.StaticHeaders["Bar"])
	})

	t.Run("will load no static headers into smtp config when section is defined but has no keys", func(t *testing.T) {
		f := ini.Empty()
		cfg := NewCfg()
		_, err := f.NewSection("smtp.static_headers")
		require.NoError(t, err)
		cfg.Raw = f

		err = cfg.readGrafanaSmtpStaticHeaders()
		require.NoError(t, err)

		assert.Empty(t, cfg.Smtp.StaticHeaders)
	})

	t.Run("will load no static headers into smtp config when section is not defined", func(t *testing.T) {
		f := ini.Empty()
		cfg := NewCfg()
		cfg.Raw = f

		err := cfg.readGrafanaSmtpStaticHeaders()
		require.NoError(t, err)

		assert.Empty(t, cfg.Smtp.StaticHeaders)
	})

	t.Run("will return error when header label is not in valid format", func(t *testing.T) {
		f := ini.Empty()
		cfg := NewCfg()
		s, err := f.NewSection("smtp.static_headers")
		require.NoError(t, err)
		_, err = s.NewKey("header with spaces", "value")
		require.NoError(t, err)
		cfg.Raw = f

		err = cfg.readGrafanaSmtpStaticHeaders()
		require.Error(t, err)
	})
}

func TestSmtpHeaderValidation(t *testing.T) {
	testCases := []struct {
		input    string
		expected bool
	}{
		//valid
		{"Foo", true},
		{"Foo-Bar", true},
		{"Foo123-Bar123", true},

		//invalid
		{"foo", false},
		{"Foo Bar", false},
		{"123Foo", false},
		{"Foo.Bar", false},
		{"foo-bar", false},
		{"foo-Bar", false},
		{"Foo-bar", false},
		{"-Bar", false},
		{"Foo--", false},
	}

	for _, tc := range testCases {
		assert.Equal(t, validHeader(tc.input), tc.expected)
	}
}

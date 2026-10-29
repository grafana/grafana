package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func newStaticHeadersSection(t *testing.T, headers map[string]string) *ini.Section {
	t.Helper()
	section, err := ini.Empty().NewSection("smtp.static_headers")
	require.NoError(t, err)
	for name, value := range headers {
		_, err = section.NewKey(name, value)
		require.NoError(t, err)
	}
	return section
}

func TestReadGrafanaSmtpStaticHeaders(t *testing.T) {
	t.Run("will load valid headers", func(t *testing.T) {
		section := newStaticHeadersSection(t, map[string]string{
			"Foo-Header": "foo_val",
			"Bar":        "bar_val",
		})

		staticHeaders, err := readGrafanaSmtpStaticHeaders(section)
		require.NoError(t, err)

		assert.Equal(t, "foo_val", staticHeaders["Foo-Header"])
		assert.Equal(t, "bar_val", staticHeaders["Bar"])
	})

	t.Run("will load no static headers when section is defined but has no keys", func(t *testing.T) {
		section := newStaticHeadersSection(t, nil)

		staticHeaders, err := readGrafanaSmtpStaticHeaders(section)
		require.NoError(t, err)

		assert.Empty(t, staticHeaders)
	})

	t.Run("will load no static headers when section is not defined", func(t *testing.T) {
		section := ini.Empty().Section("smtp.static_headers")

		staticHeaders, err := readGrafanaSmtpStaticHeaders(section)
		require.NoError(t, err)

		assert.Empty(t, staticHeaders)
	})

	t.Run("will return error when header label is not in valid format", func(t *testing.T) {
		section := newStaticHeadersSection(t, map[string]string{
			"header with spaces": "value",
		})

		_, err := readGrafanaSmtpStaticHeaders(section)
		require.Error(t, err)
	})
}

func TestReadSmtpSettings(t *testing.T) {
	t.Run("will populate settings from the ini file", func(t *testing.T) {
		f := ini.Empty()
		smtp, err := f.NewSection("smtp")
		require.NoError(t, err)
		_, err = smtp.NewKey("enabled", "true")
		require.NoError(t, err)
		_, err = smtp.NewKey("host", "localhost:25")
		require.NoError(t, err)
		_, err = smtp.NewKey("ehlo_identity", "custom-identity")
		require.NoError(t, err)

		headers, err := f.NewSection("smtp.static_headers")
		require.NoError(t, err)
		_, err = headers.NewKey("Foo-Header", "foo_val")
		require.NoError(t, err)

		settings, err := ReadSmtpSettings(f, "instance-name")
		require.NoError(t, err)

		assert.True(t, settings.Enabled)
		assert.Equal(t, "localhost:25", settings.Host)
		assert.Equal(t, "custom-identity", settings.EhloIdentity)
		assert.Equal(t, "foo_val", settings.StaticHeaders["Foo-Header"])
	})

	t.Run("will fall back to instance name for ehlo identity when unset", func(t *testing.T) {
		settings, err := ReadSmtpSettings(ini.Empty(), "instance-name")
		require.NoError(t, err)

		assert.Equal(t, "instance-name", settings.EhloIdentity)
	})

	t.Run("will return error when a static header label is not in valid format", func(t *testing.T) {
		f := ini.Empty()
		headers, err := f.NewSection("smtp.static_headers")
		require.NoError(t, err)
		_, err = headers.NewKey("header with spaces", "value")
		require.NoError(t, err)

		_, err = ReadSmtpSettings(f, "instance-name")
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

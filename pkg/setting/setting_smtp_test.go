package setting

import (
	"net/netip"
	"strings"
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

func readSecuritySmtp(t *testing.T, keys map[string]string) (SmtpSettings, error) {
	t.Helper()
	iniFile := ini.Empty()
	section, err := iniFile.NewSection("security.smtp")
	require.NoError(t, err)
	for name, value := range keys {
		_, err = section.NewKey(name, value)
		require.NoError(t, err)
	}
	return ReadSmtpSettings(iniFile, "instance-name")
}

func TestReadSmtpHostLists(t *testing.T) {
	t.Run("empty section gives empty lists", func(t *testing.T) {
		settings, err := ReadSmtpSettings(ini.Empty(), "instance-name")
		require.NoError(t, err)

		assert.True(t, settings.HostAllowList.IsEmpty())
		assert.True(t, settings.HostDenyList.IsEmpty())
	})

	t.Run("splits mixed entries into hostnames and prefixes", func(t *testing.T) {
		settings, err := readSecuritySmtp(t, map[string]string{
			"host_deny_list":  "10.0.0.0/8 168.63.129.16 SmtpProxy. ::1",
			"host_allow_list": "Relay.Example.com, 192.168.1.5/24",
		})
		require.NoError(t, err)

		assert.Equal(t, []string{"smtpproxy"}, settings.HostDenyList.Hostnames)
		assert.Equal(t, []netip.Prefix{
			netip.MustParsePrefix("10.0.0.0/8"),
			netip.MustParsePrefix("168.63.129.16/32"),
			netip.MustParsePrefix("::1/128"),
		}, settings.HostDenyList.Prefixes)
		assert.Equal(t, []string{"relay.example.com"}, settings.HostAllowList.Hostnames)
		assert.Equal(t, []netip.Prefix{netip.MustParsePrefix("192.168.1.0/24")}, settings.HostAllowList.Prefixes)
	})

	t.Run("returns an error naming the key and the entry for an invalid entry", func(t *testing.T) {
		for _, entry := range []string{"10.0.0.0/33", "300.1.1.1/8"} {
			_, err := readSecuritySmtp(t, map[string]string{"host_deny_list": entry})
			require.ErrorContains(t, err, "host_deny_list")
			require.ErrorContains(t, err, entry)

			_, err = readSecuritySmtp(t, map[string]string{"host_allow_list": entry})
			require.ErrorContains(t, err, "host_allow_list")
			require.ErrorContains(t, err, entry)
		}
	})

	t.Run("rejects entries that would never match", func(t *testing.T) {
		for _, value := range []string{
			`[::1] 10.0.0.0/8`,
			`["10.0.0.0/8", ]`,
			`[""]`,
			`10.0.0.0\8`,
			`169.254.169.254:25`,
			`010.0.0.1`,
			`10.0.0.256`,
			`http://metadata`,
			`fe80::1%eth0`,
			`a..b`,
			`relay.example.com]`,
			`[relay.example.com`,
			`]relay.example.com[`,
			`-bad.example`,
			`bad-.example`,
			`::ffff:0.0.0.0/80`,
			strings.Repeat("a", 64) + ".example",
			strings.Repeat("a.", 127) + "a",
		} {
			for _, key := range []string{"host_deny_list", "host_allow_list"} {
				_, err := readSecuritySmtp(t, map[string]string{key: value})
				require.ErrorContains(t, err, key, "value %q", value)
			}
		}
	})

	t.Run("accepts valid entries in every supported form", func(t *testing.T) {
		testCases := []struct {
			name         string
			value        string
			wantHosts    []string
			wantPrefixes []string
		}{
			{
				name:         "JSON list",
				value:        `["10.0.0.0/8", "smtpproxy"]`,
				wantHosts:    []string{"smtpproxy"},
				wantPrefixes: []string{"10.0.0.0/8"},
			},
			{
				name:         "bracketed IPv6 address not at the start",
				value:        `10.0.0.0/8 [::1]`,
				wantPrefixes: []string{"10.0.0.0/8", "::1/128"},
			},
			{
				name:         "IPv4-mapped IPv6 prefix becomes an IPv4 prefix",
				value:        `::ffff:10.0.0.0/104`,
				wantPrefixes: []string{"10.0.0.0/8"},
			},
			{
				name:      "underscore in a hostname",
				value:     `smtp_proxy.internal`,
				wantHosts: []string{"smtp_proxy.internal"},
			},
			{
				name:      "trailing dot and mixed case",
				value:     `SmtpProxy.`,
				wantHosts: []string{"smtpproxy"},
			},
		}
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				settings, err := readSecuritySmtp(t, map[string]string{"host_deny_list": tc.value})
				require.NoError(t, err)

				assert.Equal(t, tc.wantHosts, settings.HostDenyList.Hostnames)
				var gotPrefixes []string
				for _, prefix := range settings.HostDenyList.Prefixes {
					gotPrefixes = append(gotPrefixes, prefix.String())
				}
				assert.Equal(t, tc.wantPrefixes, gotPrefixes)
			})
		}
	})
}

func TestSmtpHostListMatching(t *testing.T) {
	settings, err := readSecuritySmtp(t, map[string]string{"host_deny_list": "10.0.0.0/8 Bad.Example ::1"})
	require.NoError(t, err)
	list := settings.HostDenyList

	assert.False(t, list.IsEmpty())
	assert.True(t, list.MatchesHost("bad.example"))
	assert.True(t, list.MatchesHost("BAD.example."))
	assert.True(t, list.MatchesHost("[bad.example]"))
	assert.False(t, list.MatchesHost("sub.bad.example"))
	assert.True(t, list.MatchesAddr(netip.MustParseAddr("10.1.2.3")))
	assert.True(t, list.MatchesAddr(netip.MustParseAddr("::ffff:10.1.2.3")))
	assert.True(t, list.MatchesAddr(netip.MustParseAddr("::1")))
	assert.True(t, list.MatchesAddr(netip.MustParseAddr("::1%eth0")))
	assert.False(t, list.MatchesAddr(netip.MustParseAddr("8.8.8.8")))
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

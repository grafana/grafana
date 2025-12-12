package setting

import (
	"regexp"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestReadDataProxySettings(t *testing.T) {
	t.Run("should use default values when ini is empty", func(t *testing.T) {
		f := ini.Empty()
		proxy := ReadDataProxySettings(f)

		assertDataProxyDefaults(t, proxy)
	})

	t.Run("should use default values when section exists with no values", func(t *testing.T) {
		f := ini.Empty()
		_, err := f.NewSection("dataproxy")
		require.NoError(t, err)

		proxy := ReadDataProxySettings(f)

		assertDataProxyDefaults(t, proxy)
	})

	t.Run("should use custom values when section has overrides", func(t *testing.T) {
		iniFile := `
[dataproxy]
send_user_header = true
logging = true
timeout = 60
dialTimeout = 20
keep_alive_seconds = 60
tls_handshake_timeout_seconds = 20
expect_continue_timeout_seconds = 2
max_conns_per_host = 100
max_idle_connections = 50
idle_conn_timeout_seconds = 120
response_limit = 5242880
row_limit = 500000
user_agent = CustomAgent/1.0
`
		f, err := ini.Load([]byte(iniFile))
		require.NoError(t, err)

		proxy := ReadDataProxySettings(f)

		assert.True(t, proxy.SendUserHeader)
		assert.True(t, proxy.Logging)
		assert.Equal(t, 60, proxy.Timeout)
		assert.Equal(t, 20, proxy.DialTimeout)
		assert.Equal(t, 60, proxy.KeepAlive)
		assert.Equal(t, 20, proxy.TLSHandshakeTimeout)
		assert.Equal(t, 2, proxy.ExpectContinueTimeout)
		assert.Equal(t, 100, proxy.MaxConnsPerHost)
		assert.Equal(t, 50, proxy.MaxIdleConns)
		assert.Equal(t, 120, proxy.IdleConnTimeout)
		assert.Equal(t, int64(5242880), proxy.ResponseLimit)
		assert.Equal(t, int64(500000), proxy.RowLimit)
		assert.Equal(t, "CustomAgent/1.0", proxy.UserAgent)
	})

	t.Run("should set default row limit when row_limit is zero", func(t *testing.T) {
		iniFile := `
[dataproxy]
row_limit = 0
`
		f, err := ini.Load([]byte(iniFile))
		require.NoError(t, err)

		proxy := ReadDataProxySettings(f)

		assert.Equal(t, defaultDataProxyRowLimit, proxy.RowLimit)
	})

	t.Run("should set default row limit when row_limit is negative", func(t *testing.T) {
		iniFile := `
[dataproxy]
row_limit = -100
`
		f, err := ini.Load([]byte(iniFile))
		require.NoError(t, err)

		proxy := ReadDataProxySettings(f)

		assert.Equal(t, defaultDataProxyRowLimit, proxy.RowLimit)
	})
}

func assertDataProxyDefaults(t *testing.T, proxy ProxySettings) {
	t.Helper()

	assert.False(t, proxy.SendUserHeader)
	assert.False(t, proxy.Logging)
	assert.Equal(t, 30, proxy.Timeout)
	assert.Equal(t, 10, proxy.DialTimeout)
	assert.Equal(t, 30, proxy.KeepAlive)
	assert.Equal(t, 10, proxy.TLSHandshakeTimeout)
	assert.Equal(t, 1, proxy.ExpectContinueTimeout)
	assert.Equal(t, 0, proxy.MaxConnsPerHost)
	assert.Equal(t, 0, proxy.MaxIdleConns)
	assert.Equal(t, 90, proxy.IdleConnTimeout)
	assert.Equal(t, int64(0), proxy.ResponseLimit)
	assert.Equal(t, defaultDataProxyRowLimit, proxy.RowLimit)

	// UserAgent should match "Grafana/{version}" pattern
	assert.Regexp(t, regexp.MustCompile(`^Grafana/.*`), proxy.UserAgent)
}

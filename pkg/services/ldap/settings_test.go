package ldap

import (
	"crypto/tls"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadingLDAPSettings(t *testing.T) {
	actualConfig, err := readConfig("testdata/ldap.toml")
	assert.Nil(t, err, "No error when reading ldap config")
	assert.EqualValues(t, "127.0.0.1", actualConfig.Servers[0].Host)
	assert.EqualValues(t, "tls1.3", actualConfig.Servers[0].MinTLSVersion)
	assert.EqualValues(t, uint16(tls.VersionTLS13), actualConfig.Servers[0].minTLSVersion)
	assert.EqualValues(t, []string{"TLS_CHACHA20_POLY1305_SHA256", "TLS_AES_128_GCM_SHA256"}, actualConfig.Servers[0].TLSCiphers)
	assert.ElementsMatch(t, []uint16{tls.TLS_CHACHA20_POLY1305_SHA256, tls.TLS_AES_128_GCM_SHA256}, actualConfig.Servers[0].tlsCiphers)
}

func TestReadingLDAPSettingsWithEnvVariable(t *testing.T) {
	t.Setenv("ENV_PASSWORD", "MySecret")

	actualConfig, err := readConfig("testdata/ldap.toml")
	require.NoError(t, err)
	assert.EqualValues(t, "MySecret", actualConfig.Servers[0].BindPassword)
}

func TestReadingLDAPSettingsUsingCache(t *testing.T) {
	cfg := &Config{
		Enabled:        true,
		ConfigFilePath: "testdata/ldap.toml",
	}

	// cache is empty initially
	assert.Nil(t, config)

	firstActualConfig, err := GetConfig(cfg)

	// cache has been initialized
	assert.NotNil(t, config)
	assert.EqualValues(t, *firstActualConfig, *config)
	assert.Nil(t, err)
	assert.EqualValues(t, "127.0.0.1", config.Servers[0].Host)

	// make sure the cached config is returned on subsequent calls
	cachedConfig := config
	secondActualConfig, err := GetConfig(cfg)

	assert.Equal(t, cachedConfig, secondActualConfig)
	assert.Nil(t, err)
}

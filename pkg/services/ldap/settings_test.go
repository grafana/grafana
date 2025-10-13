package ldap

import (
	"crypto/tls"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadingLDAPSettings(t *testing.T) {
	config, err := readConfig("testdata/ldap.toml")
	assert.Nil(t, err, "No error when reading ldap config")
	assert.EqualValues(t, "127.0.0.1", config.Servers[0].Host)
	assert.EqualValues(t, "tls1.3", config.Servers[0].MinTLSVersion)
	assert.EqualValues(t, uint16(tls.VersionTLS13), config.Servers[0].MinTLSVersionID)
	assert.EqualValues(t, []string{"TLS_CHACHA20_POLY1305_SHA256", "TLS_AES_128_GCM_SHA256"}, config.Servers[0].TLSCiphers)
	assert.ElementsMatch(t, []uint16{tls.TLS_CHACHA20_POLY1305_SHA256, tls.TLS_AES_128_GCM_SHA256}, config.Servers[0].TLSCipherIDs)
}

func TestReadingLDAPSettingsWithEnvVariable(t *testing.T) {
	t.Setenv("ENV_PASSWORD", "MySecret")

	config, err := readConfig("testdata/ldap.toml")
	require.NoError(t, err)
	assert.EqualValues(t, "MySecret", config.Servers[0].BindPassword)
}

func TestReadingLDAPSettingsUsingCache(t *testing.T) {
	cfg := &Config{
		Enabled:        true,
		ConfigFilePath: "testdata/ldap.toml",
	}

	// cache is empty initially
	assert.Nil(t, cachedConfig.config)

	firstConfig, err := GetConfig(cfg)

	// cache has been initialized
	assert.NotNil(t, cachedConfig.config)
	assert.EqualValues(t, *firstConfig, *cachedConfig.config)
	assert.Nil(t, err)
	assert.EqualValues(t, "127.0.0.1", cachedConfig.config.Servers[0].Host)

	// make sure the cached config is returned on subsequent calls
	config := cachedConfig.config
	secondConfig, err := GetConfig(cfg)

	assert.Equal(t, config, secondConfig)
	assert.Nil(t, err)
}

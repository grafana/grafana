package ldap

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadingLDAPSettings(t *testing.T) {
	config, err := readConfig("testdata/ldap.toml")
	assert.Nil(t, err, "No error when reading ldap config")
	assert.EqualValues(t, "127.0.0.1", config.Servers[0].Host)
}

func TestReadingLDAPSettingsWithEnvVariable(t *testing.T) {
	err := os.Setenv("ENV_PASSWORD", "MySecret")
	require.NoError(t, err)

	config, err := readConfig("testdata/ldap.toml")
	require.NoError(t, err)
	assert.EqualValues(t, "MySecret", config.Servers[0].BindPassword)
}

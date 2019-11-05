package ldap

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestReadingLDAPSettings(t *testing.T) {
	config, err := readConfig("testdata/ldap.toml")
	assert.Nil(t, err, "No error when reading ldap config")
	assert.EqualValues(t, "127.0.0.1", config.Servers[0].Host)
}

func TestReadingLDAPSettingsWithEnvVariable(t *testing.T) {
	os.Setenv("ENV_PASSWORD", "MySecret")

	config, err := readConfig("testdata/ldap.toml")
	assert.Nil(t, err, "No error when reading ldap config")
	assert.EqualValues(t, "MySecret", config.Servers[0].BindPassword)
}

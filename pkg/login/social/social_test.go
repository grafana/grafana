package social

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestReadingSimpleGroupMappingSettings(t *testing.T) {
	config, err := readConfig("testdata/simple.toml")
	assert.Nil(t, err, "No error when reading oauth config")
	count := len(config.GroupMappings)
	assert.EqualValues(t, 1, count)
	if count != 1 {
		return
	}
	assert.EqualValues(t, "role", config.GroupMappings[0].RoleAttributePath)
}

func TestReadingFullGroupMappingSettings(t *testing.T) {
	config, err := readConfig("testdata/full.toml")
	assert.Nil(t, err, "No error when reading oauth config")
	count := len(config.GroupMappings)
	assert.EqualValues(t, 3, count)
	if count != 3 {
		return
	}
	assert.EqualValues(t, "contains(info.groups[*], 'admin') && 'Admin'", config.GroupMappings[0].RoleAttributePath)
	assert.EqualValues(t, true, *config.GroupMappings[0].IsGrafanaAdmin)
}

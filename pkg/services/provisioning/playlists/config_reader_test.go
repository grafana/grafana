package playlists

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

const (
	nonExistingDir   = "testdata/nonExistingDir"
	emptyDir         = "testdata/emptyDir"
	invalidYamlDir   = "testdata/invalidYaml"
	interpolationDir = "testdata/interpolation"
	orgIdDir         = "testdata/orgId"
	noUidDir         = "testdata/noUid"
	noItemDir        = "testdata/noItem"
)

func TestNonExistingDir(t *testing.T) {
	// Should skip directory if it does not exist
	cfgReader := configReader{logger}
	cfgs, err := cfgReader.readConfig(nonExistingDir)
	assert.Nil(t, err)
	assert.Len(t, cfgs, 0)
}

func TestEmptyDir(t *testing.T) {
	// Should skip empty directory
	cfgReader := configReader{logger}
	cfgs, err := cfgReader.readConfig(emptyDir)
	assert.Nil(t, err)
	assert.Len(t, cfgs, 0)
}

func TestInvalidYaml(t *testing.T) {
	// Should throw error if YAML file is malformed
	cfgReader := configReader{logger}
	_, err := cfgReader.readConfig(invalidYamlDir)
	assert.NotNil(t, err)
}

func TestInterpolation(t *testing.T) {
	os.Setenv("PLAYLIST_NAME", "theName")
	defer os.Unsetenv("PLAYLIST_NAME")

	cfgReader := configReader{logger}
	cfgs, err := cfgReader.readConfig(interpolationDir)
	assert.Nil(t, err)
	assert.Len(t, cfgs, 1)
	cfg := cfgs[0]

	assert.Len(t, cfg.Playlists, 1)
	assert.Equal(t, "theName", cfg.Playlists[0].Name)
}

func TestOrgId(t *testing.T) {
	cfgReader := configReader{logger}
	cfgs, err := cfgReader.readConfig(orgIdDir)
	assert.Nil(t, err)
	assert.Len(t, cfgs, 1)
	assert.Len(t, cfgs[0].Playlists, 4)

	// No org defined: defaults to organization ID 1
	noOrgDefined := cfgs[0].Playlists[0]
	assert.Equal(t, int64(1), noOrgDefined.OrgId)

	// org_id defined
	orgIdDefined := cfgs[0].Playlists[1]
	assert.Equal(t, int64(2), orgIdDefined.OrgId)

	// org_name defined
	orgNameDefined := cfgs[0].Playlists[2]
	assert.Equal(t, int64(0), orgNameDefined.OrgId)

	// both org_id and org_name defined: keep org_id
	orgDefinedTwice := cfgs[0].Playlists[3]
	assert.Equal(t, int64(2), orgDefinedTwice.OrgId)

	// Works also for deletion
	assert.Len(t, cfgs[0].DeletePlaylists, 3)
	delNoOrgId := cfgs[0].DeletePlaylists[0]
	assert.Equal(t, int64(1), delNoOrgId.OrgId)
	delOrgId := cfgs[0].DeletePlaylists[1]
	assert.Equal(t, int64(2), delOrgId.OrgId)
	delOrgName := cfgs[0].DeletePlaylists[2]
	assert.Equal(t, int64(0), delOrgName.OrgId)
}

func TestNoUid(t *testing.T) {
	cfgReader := configReader{logger}
	_, err := cfgReader.readConfig(noUidDir)
	assert.NotNil(t, err)
	assert.True(t, strings.Contains(err.Error(), "uid"))
}

func TestNoItem(t *testing.T) {
	cfgReader := configReader{logger}
	_, err := cfgReader.readConfig(noItemDir)
	assert.NotNil(t, err)
	assert.True(t, strings.Contains(err.Error(), "item"))
}

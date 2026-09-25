package bootstrap

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestValidPackaging(t *testing.T) {
	for _, valid := range []string{"dev", "deb", "rpm", "docker", "brew", "hosted", "unknown"} {
		assert.Equal(t, valid, validPackaging(valid))
	}
	assert.Equal(t, "unknown", validPackaging("something-else"))
	assert.Equal(t, "unknown", validPackaging(""))
}

func TestGetBuildstamp(t *testing.T) {
	t.Run("parses a valid unix timestamp", func(t *testing.T) {
		assert.Equal(t, int64(1700000000), getBuildstamp(BuildInfo{BuildStamp: "1700000000"}))
	})

	t.Run("falls back to now for an unparseable stamp", func(t *testing.T) {
		before := time.Now().Unix()
		got := getBuildstamp(BuildInfo{BuildStamp: "not-a-number"})
		assert.GreaterOrEqual(t, got, before)
	})

	t.Run("falls back to now for a zero stamp", func(t *testing.T) {
		before := time.Now().Unix()
		got := getBuildstamp(BuildInfo{BuildStamp: "0"})
		assert.GreaterOrEqual(t, got, before)
	})
}

func TestSetBuildInfo(t *testing.T) {
	opts := BuildInfo{
		Version:          "1.2.3",
		Commit:           "abc123",
		EnterpriseCommit: "def456",
		BuildBranch:      "main",
		BuildStamp:       "1700000000",
	}

	SetBuildInfo(opts, "deb", true)

	assert.Equal(t, "1.2.3", setting.BuildVersion)
	assert.Equal(t, "abc123", setting.BuildCommit)
	assert.Equal(t, "def456", setting.EnterpriseBuildCommit)
	assert.Equal(t, int64(1700000000), setting.BuildStamp)
	assert.Equal(t, "main", setting.BuildBranch)
	assert.True(t, setting.IsEnterprise)
	assert.Equal(t, "deb", setting.Packaging)

	t.Run("isEnterprise is set from the argument", func(t *testing.T) {
		SetBuildInfo(opts, "deb", false)
		require.False(t, setting.IsEnterprise)
	})

	t.Run("invalid packaging is normalized to unknown", func(t *testing.T) {
		SetBuildInfo(opts, "not-real", true)
		require.Equal(t, "unknown", setting.Packaging)
	})
}

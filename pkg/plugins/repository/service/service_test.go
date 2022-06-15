package service

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/repository"
)

func TestSelectVersion(t *testing.T) {
	i := &Service{log: &fakeLogger{}}

	t.Run("Should return error when requested version does not exist", func(t *testing.T) {
		_, err := i.selectVersion(createPlugin(versionArg{version: "version"}), "1.1.1", repository.CompatabilityOpts{})
		require.Error(t, err)
	})

	t.Run("Should return error when no version supports current arch", func(t *testing.T) {
		_, err := i.selectVersion(createPlugin(versionArg{version: "version", arch: []string{"non-existent"}}), "", repository.CompatabilityOpts{})
		require.Error(t, err)
	})

	t.Run("Should return error when requested version does not support current arch", func(t *testing.T) {
		_, err := i.selectVersion(createPlugin(
			versionArg{version: "2.0.0"},
			versionArg{version: "1.1.1", arch: []string{"non-existent"}},
		), "1.1.1", repository.CompatabilityOpts{})
		require.Error(t, err)
	})

	t.Run("Should return latest available for arch when no version specified", func(t *testing.T) {
		ver, err := i.selectVersion(createPlugin(
			versionArg{version: "2.0.0", arch: []string{"non-existent"}},
			versionArg{version: "1.0.0"},
		), "", repository.CompatabilityOpts{})
		require.NoError(t, err)
		require.Equal(t, "1.0.0", ver.Version)
	})

	t.Run("Should return latest version when no version specified", func(t *testing.T) {
		ver, err := i.selectVersion(createPlugin(versionArg{version: "2.0.0"}, versionArg{version: "1.0.0"}), "", repository.CompatabilityOpts{})
		require.NoError(t, err)
		require.Equal(t, "2.0.0", ver.Version)
	})

	t.Run("Should return requested version", func(t *testing.T) {
		ver, err := i.selectVersion(createPlugin(versionArg{version: "2.0.0"}, versionArg{version: "1.0.0"}), "1.0.0", repository.CompatabilityOpts{})
		require.NoError(t, err)
		require.Equal(t, "1.0.0", ver.Version)
	})
}

type versionArg struct {
	version string
	arch    []string
}

func createPlugin(versions ...versionArg) *repository.Plugin {
	p := &repository.Plugin{
		Versions: []repository.Version{},
	}

	for _, version := range versions {
		ver := repository.Version{
			Version: version.version,
			Commit:  fmt.Sprintf("commit_%s", version.version),
			URL:     fmt.Sprintf("url_%s", version.version),
		}
		if version.arch != nil {
			ver.Arch = map[string]repository.ArchMeta{}
			for _, arch := range version.arch {
				ver.Arch[arch] = repository.ArchMeta{
					SHA256: fmt.Sprintf("sha256_%s", arch),
				}
			}
		}
		p.Versions = append(p.Versions, ver)
	}

	return p
}

type fakeLogger struct{}

func (f *fakeLogger) Successf(_ string, _ ...interface{}) {}
func (f *fakeLogger) Failuref(_ string, _ ...interface{}) {}
func (f *fakeLogger) Info(_ ...interface{})               {}
func (f *fakeLogger) Infof(_ string, _ ...interface{})    {}
func (f *fakeLogger) Debug(_ ...interface{})              {}
func (f *fakeLogger) Debugf(_ string, _ ...interface{})   {}
func (f *fakeLogger) Warn(_ ...interface{})               {}
func (f *fakeLogger) Warnf(_ string, _ ...interface{})    {}
func (f *fakeLogger) Error(_ ...interface{})              {}
func (f *fakeLogger) Errorf(_ string, _ ...interface{})   {}

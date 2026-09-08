package configprovider

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

func newProvider(t *testing.T, raw *ini.File) *OSSConfigProvider {
	t.Helper()
	return &OSSConfigProvider{
		Cfg: &setting.Cfg{Raw: raw},
		log: log.New("configprovider.test"),
	}
}

func newIniFile(t *testing.T, contents string) *ini.File {
	t.Helper()
	file, err := ini.Load([]byte(contents))
	require.NoError(t, err)
	return file
}

func TestOSSConfigProvider_Get(t *testing.T) {
	cfg := &setting.Cfg{Raw: ini.Empty()}
	provider := &OSSConfigProvider{Cfg: cfg, log: log.New("configprovider.test")}

	got, err := provider.Get(context.Background())
	require.NoError(t, err)
	require.Same(t, cfg, got)
}

func TestOSSConfigProvider_GetSections(t *testing.T) {
	raw := newIniFile(t, `
[auth]
login_maximum_inactive_lifetime_duration = 7d
disable_login_form = true

[server]
http_port = 3000
`)

	t.Run("returns requested section with its keys", func(t *testing.T) {
		provider := newProvider(t, raw)

		result, err := provider.GetSections(context.Background(), "auth")
		require.NoError(t, err)

		require.True(t, result.HasSection("auth"))
		require.False(t, result.HasSection("server"))
		require.Equal(t, "7d", result.Section("auth").Key("login_maximum_inactive_lifetime_duration").String())
		require.Equal(t, "true", result.Section("auth").Key("disable_login_form").String())
	})

	t.Run("returns multiple requested sections", func(t *testing.T) {
		provider := newProvider(t, raw)

		result, err := provider.GetSections(context.Background(), "auth", "server")
		require.NoError(t, err)

		require.True(t, result.HasSection("auth"))
		require.True(t, result.HasSection("server"))
		require.Equal(t, "3000", result.Section("server").Key("http_port").String())
	})

	t.Run("skips sections that do not exist", func(t *testing.T) {
		provider := newProvider(t, raw)

		result, err := provider.GetSections(context.Background(), "auth", "does_not_exist")
		require.NoError(t, err)

		require.True(t, result.HasSection("auth"))
		require.False(t, result.HasSection("does_not_exist"))
	})

	t.Run("returns empty file when no sections requested", func(t *testing.T) {
		provider := newProvider(t, raw)

		result, err := provider.GetSections(context.Background())
		require.NoError(t, err)

		// ini always carries the implicit DEFAULT section.
		require.Equal(t, []string{ini.DefaultSection}, result.SectionStrings())
	})

	t.Run("does not mutate the source config", func(t *testing.T) {
		provider := newProvider(t, raw)

		result, err := provider.GetSections(context.Background(), "auth")
		require.NoError(t, err)

		result.Section("auth").Key("disable_login_form").SetValue("false")
		require.Equal(t, "true", raw.Section("auth").Key("disable_login_form").String())
	})

	t.Run("returns the default section requested by empty name", func(t *testing.T) {
		withDefaults := newIniFile(t, `
global_key = global_val

[auth]
disable_login_form = true
`)
		provider := newProvider(t, withDefaults)

		result, err := provider.GetSections(context.Background(), "")
		require.NoError(t, err)

		require.Equal(t, "global_val", result.Section(ini.DefaultSection).Key("global_key").String())
	})
}

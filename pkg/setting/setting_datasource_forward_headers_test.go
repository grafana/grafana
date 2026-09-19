package setting

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func loadCfgWithSection(t *testing.T, section, body string) *Cfg {
	t.Helper()
	iniStr := "[" + section + "]\n" + body
	f, err := ini.Load([]byte(iniStr))
	require.NoError(t, err)
	cfg := &Cfg{}
	require.NoError(t, readDataSourceForwardHeadersSettings(f, cfg))
	return cfg
}

func TestDataSourceForwardHeadersSettings_DefaultMerge(t *testing.T) {
	cfg := loadCfgWithSection(t, "datasource_forward_headers", "deny_list = X-Custom\n")
	require.Equal(t, "merge", cfg.DataSourceForwardHeadersDenyListMode)
	// Built-in default deny-list is prepended.
	require.Equal(t, DefaultDataSourceForwardHeadersDenyList[0], cfg.DataSourceForwardHeadersDenyList[0])
	require.Contains(t, cfg.DataSourceForwardHeadersDenyList, "X-Custom")
	require.Greater(t, len(cfg.DataSourceForwardHeadersDenyList), len(DefaultDataSourceForwardHeadersDenyList))
}

func TestDataSourceForwardHeadersSettings_Replace(t *testing.T) {
	cfg := loadCfgWithSection(t, "datasource_forward_headers",
		"deny_list = X-Custom, X-Foo-[]\ndeny_list_mode = replace\n")
	require.Equal(t, "replace", cfg.DataSourceForwardHeadersDenyListMode)
	require.Equal(t, []string{"X-Custom", "X-Foo-[]"}, cfg.DataSourceForwardHeadersDenyList)
}

func TestDataSourceForwardHeadersSettings_ReplaceEmptyFallsBackToDefaults(t *testing.T) {
	// An empty deny_list under replace mode should not leave admins with an
	// empty deny-list (which would allow allow-listing sensitive headers).
	cfg := loadCfgWithSection(t, "datasource_forward_headers", "deny_list_mode = replace\n")
	require.Equal(t, "replace", cfg.DataSourceForwardHeadersDenyListMode)
	require.Equal(t, DefaultDataSourceForwardHeadersDenyList, cfg.DataSourceForwardHeadersDenyList)
}

func TestDataSourceForwardHeadersSettings_ReplaceWhitespaceOnlyFallsBackToDefaults(t *testing.T) {
	// A whitespace-only deny_list is not the same as an absent one, but it
	// still contains no real entries and must not wipe the built-in
	// deny-list in replace mode.
	cfg := loadCfgWithSection(t, "datasource_forward_headers", "deny_list = \"   \"\ndeny_list_mode = replace\n")
	require.Equal(t, "replace", cfg.DataSourceForwardHeadersDenyListMode)
	require.Equal(t, DefaultDataSourceForwardHeadersDenyList, cfg.DataSourceForwardHeadersDenyList)
}

func TestDataSourceForwardHeadersSettings_ReplaceCommaOnlyFallsBackToDefaults(t *testing.T) {
	// A comma-only deny_list yields zero parsed entries after trimming, and
	// must not wipe the built-in deny-list in replace mode either.
	cfg := loadCfgWithSection(t, "datasource_forward_headers", "deny_list = \" , \"\ndeny_list_mode = replace\n")
	require.Equal(t, "replace", cfg.DataSourceForwardHeadersDenyListMode)
	require.Equal(t, DefaultDataSourceForwardHeadersDenyList, cfg.DataSourceForwardHeadersDenyList)
}

func TestDataSourceForwardHeadersSettings_KillSwitch(t *testing.T) {
	cfg := loadCfgWithSection(t, "datasource_forward_headers", "deny_list = [], X-Anything\n")
	require.Equal(t, []string{"[]"}, cfg.DataSourceForwardHeadersDenyList)
}

func TestDataSourceForwardHeadersSettings_UnknownModeCoercesToMerge(t *testing.T) {
	cfg := loadCfgWithSection(t, "datasource_forward_headers", "deny_list_mode = bogus\n")
	require.Equal(t, "merge", cfg.DataSourceForwardHeadersDenyListMode)
	require.Equal(t, DefaultDataSourceForwardHeadersDenyList, cfg.DataSourceForwardHeadersDenyList)
}

func TestDataSourceForwardHeadersSettings_NoSection(t *testing.T) {
	f, err := ini.Load([]byte(""))
	require.NoError(t, err)
	cfg := &Cfg{}
	require.NoError(t, readDataSourceForwardHeadersSettings(f, cfg))
	require.Equal(t, "merge", cfg.DataSourceForwardHeadersDenyListMode)
	require.Equal(t, DefaultDataSourceForwardHeadersDenyList, cfg.DataSourceForwardHeadersDenyList)
}

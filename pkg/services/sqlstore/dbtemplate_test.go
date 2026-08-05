package sqlstore

import (
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func TestIntegrationBuildSQLiteOSSTemplate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Test-scoped key: always exercises build+publish, never the real OSS canonical.
	path, err := buildSQLiteTemplate(&dbTemplateRequest{
		key:        "sqlite3:builder-invariant-test",
		dbMigrator: migrations.ProvideOSSMigrations(featuremgmt.WithFeatures()),
		cfg:        setting.NewCfg(),
		features:   featuremgmt.WithFeatures(),
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = os.Remove(path) })

	info, err := os.Stat(path)
	require.NoError(t, err)
	assert.Greater(t, info.Size(), int64(0), "template must not be an empty file")

	// The WAL must be folded in: only then is a single-file copy a complete database.
	assert.NoFileExists(t, path+"-wal")
	assert.NoFileExists(t, path+"-shm")

	engine, err := xorm.NewEngine("sqlite3", "file:"+path+"?mode=ro")
	require.NoError(t, err)
	t.Cleanup(func() { _ = engine.Close() })

	// migration_log is what makes copies skip already-applied migrations.
	var applied int64
	found, err := engine.SQL("SELECT count(1) FROM migration_log").Get(&applied)
	require.NoError(t, err)
	require.True(t, found)
	assert.Greater(t, applied, int64(400), "template must carry the full OSS migration log (currently ~421 entries)")

	for _, table := range []string{"user", "org", "dashboard"} {
		exists, err := engine.IsTableExist(table)
		require.NoError(t, err)
		assert.True(t, exists, "core table %q missing from template schema", table)
	}
}

var (
	customBaseTable   = migrator.Table{Name: "custom_base", Columns: []*migrator.Column{{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true}}}
	customCanaryTable = migrator.Table{Name: "custom_canary", Columns: []*migrator.Column{{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true}}}
)

type customMigrations struct{}

func (customMigrations) AddMigration(mg *migrator.Migrator) {
	mg.AddCreateMigration()
	mg.AddMigration("create custom_base table", migrator.NewAddTableMigration(customBaseTable))
	if mg.Cfg == nil {
		return
	}
	mg.AddMigration("create custom_canary table", migrator.NewAddTableMigration(customCanaryTable))
}

type baseMigrations struct{}

func (baseMigrations) AddMigration(mg *migrator.Migrator) {
	mg.AddCreateMigration()
	mg.AddMigration("create custom_base table", migrator.NewAddTableMigration(customBaseTable))
}

func TestDBTemplateFingerprintDistinguishesMigrationSets(t *testing.T) {
	customKey, err := dbTemplateFingerprint(setting.NewCfg(), nil, customMigrations{})
	require.NoError(t, err)

	baseKey, err := dbTemplateFingerprint(setting.NewCfg(), nil, baseMigrations{})
	require.NoError(t, err)

	assert.NotEqual(t, baseKey, customKey, "fingerprint registration must use a non-nil config")
}

func TestDBTemplateFingerprintConfigIdentity(t *testing.T) {
	defaultKey, err := dbTemplateFingerprint(setting.NewCfg(), nil, baseMigrations{})
	require.NoError(t, err)

	t.Run("raw settings are part of the identity", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.Raw.Section("auth").Key("disable_login_form").SetValue("true")
		key, err := dbTemplateFingerprint(cfg, nil, baseMigrations{})
		require.NoError(t, err)
		assert.NotEqual(t, defaultKey, key, "configs with different raw settings must not share a template")
	})

	t.Run("feature flags are part of the identity", func(t *testing.T) {
		key, err := dbTemplateFingerprint(setting.NewCfg(), map[string]bool{"someFlag": true}, baseMigrations{})
		require.NoError(t, err)
		assert.NotEqual(t, defaultKey, key, "different feature flags must not share a template")
	})

	t.Run("the infra-owned database section is not part of the identity", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.Raw.Section("database").Key("connection_string").SetValue("file:somewhere-else")
		key, err := dbTemplateFingerprint(cfg, nil, baseMigrations{})
		require.NoError(t, err)
		assert.Equal(t, defaultKey, key, "NewTestStore rewrites [database] per store (see WithCfg), so a reused cfg must keep a stable key")
	})
}

var cfgMarkerTable = migrator.Table{Name: "cfg_marker", Columns: []*migrator.Column{{Name: "marker", Type: migrator.DB_NVarchar, Length: 190}}}

// markerMigration records the config and feature values it observed while running.
type markerMigration struct {
	migrator.MigrationBase
}

func (markerMigration) SQL(migrator.Dialect) string { return "code migration" }

func (markerMigration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	marker := mg.Cfg.Raw.Section("test").Key("marker").MustString("missing")
	//nolint:staticcheck // not yet migrated to OpenFeature
	flagged := mg.Cfg.IsFeatureToggleEnabled("markerFlag")
	_, err := sess.Exec("INSERT INTO cfg_marker (marker) VALUES (?)", fmt.Sprintf("%s:%t", marker, flagged))
	return err
}

type markerMigrations struct{}

func (markerMigrations) AddMigration(mg *migrator.Migrator) {
	mg.AddCreateMigration()
	mg.AddMigration("create cfg_marker table", migrator.NewAddTableMigration(cfgMarkerTable))
	mg.AddMigration("insert cfg marker", &markerMigration{})
}

func TestIntegrationDBTemplateBuiltWithCallerConfig(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Setenv("GRAFANA_TEST_DB_TEMPLATE", "true")
	// use a custom TMPDIR to keep tests isolated
	t.Setenv("TMPDIR", t.TempDir())

	cfg := setting.NewCfg()
	cfg.Raw.Section("test").Key("marker").SetValue("from-caller")

	store := NewTestStore(t, WithMigrator(markerMigrations{}), WithCfg(cfg), WithFeatureFlags("markerFlag"))

	var marker string
	found, err := store.GetEngine().SQL("SELECT marker FROM cfg_marker").Get(&marker)
	require.NoError(t, err)
	require.True(t, found, "the marker migration must have run during the template build")
	assert.Equal(t, "from-caller:true", marker, "migrated with the caller config")
}

func TestIntegrationDBTemplateNotSharedAcrossMigrationSets(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Setenv("GRAFANA_TEST_DB_TEMPLATE", "true")
	// use a custom TMPDIR to keep tests isolated
	t.Setenv("TMPDIR", t.TempDir())

	custom := NewTestStore(t, WithMigrator(customMigrations{}))
	exists, err := custom.GetEngine().IsTableExist("custom_canary")
	require.NoError(t, err)
	require.True(t, exists, "the custom set runs with a non-nil config and must create its canary table")

	base := NewTestStore(t, WithMigrator(baseMigrations{}))
	exists, err = base.GetEngine().IsTableExist("custom_canary")
	require.NoError(t, err)
	assert.False(t, exists, "the base set must not inherit the canary table from the custom set's template")
}

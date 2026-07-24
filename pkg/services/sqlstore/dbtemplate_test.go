package sqlstore

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func TestIntegrationBuildSQLiteOSSTemplate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Test-scoped key: always exercises build+publish, never the real OSS canonical.
	path, err := buildSQLiteTemplate(migrations.ProvideOSSMigrations(featuremgmt.WithFeatures()), "sqlite3:builder-invariant-test")
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

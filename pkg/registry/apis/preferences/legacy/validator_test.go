package legacy

import (
	"testing"

	"github.com/stretchr/testify/require"

	_ "github.com/grafana/grafana/pkg/util/sqlite"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func TestCountLegacy(t *testing.T) {
	eng, err := xorm.NewEngine("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { _ = eng.Close() })

	for _, ddl := range []string{
		`CREATE TABLE preferences (id INTEGER PRIMARY KEY, org_id INTEGER, user_id INTEGER, team_id INTEGER)`,
		`CREATE TABLE user (id INTEGER PRIMARY KEY, uid TEXT)`,
		`CREATE TABLE team (id INTEGER PRIMARY KEY, uid TEXT)`,
	} {
		_, err = eng.Exec(ddl)
		require.NoError(t, err)
	}

	// Users 1 & 2 exist; user 99 does not (orphan). Team 1 exists; team 88 does not.
	_, err = eng.Exec(`INSERT INTO user (id, uid) VALUES (1, 'uA'), (2, 'uB')`)
	require.NoError(t, err)
	_, err = eng.Exec(`INSERT INTO team (id, uid) VALUES (1, 'tA')`)
	require.NoError(t, err)

	_, err = eng.Exec(`INSERT INTO preferences (id, org_id, user_id, team_id) VALUES
		(1, 1, 0, 0),    -- namespace row
		(2, 1, 1, 0),    -- user uA
		(3, 1, 2, 0),    -- user uB
		(4, 1, 2, 0),    -- DUPLICATE of user uB (collapses in unified storage)
		(5, 1, 0, 1),    -- team tA
		(6, 1, 99, 0),   -- orphan user (skipped on read path)
		(7, 1, 0, 88),   -- orphan team (skipped on read path)
		(8, 2, 1, 0)     -- different org, excluded
	`)
	require.NoError(t, err)

	v := &preferencesCountValidator{}
	sess := eng.NewSession()
	t.Cleanup(func() { sess.Close() })

	count, err := v.countLegacy(sess, 1)
	require.NoError(t, err)

	// Distinct owners in org 1: namespace, user uA, user uB, team tA = 4.
	// The duplicate uB row and both orphan rows must not inflate the count.
	require.Equal(t, int64(4), count)
}

package xorm

import (
	"testing"

	_ "github.com/grafana/grafana/pkg/util/sqlite"
	"github.com/grafana/grafana/pkg/util/xorm/core"
	"github.com/stretchr/testify/require"
)

type LeakRule struct {
	Id    int64
	Guid  string
	Title string
}

type LeakUser struct {
	Id  int64
	Uid string
}

func newLeakEngine(t *testing.T) *Engine {
	t.Helper()

	eng, err := NewEngine("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, eng.Close()) })

	_, err = eng.Exec("CREATE TABLE leak_rule (id INTEGER PRIMARY KEY, guid TEXT, title TEXT)")
	require.NoError(t, err)
	_, err = eng.Exec("CREATE TABLE leak_user (id INTEGER PRIMARY KEY, uid TEXT)")
	require.NoError(t, err)
	_, err = eng.Exec("INSERT INTO leak_rule (id, guid, title) VALUES (1, 'g1', 't1')")
	require.NoError(t, err)
	_, err = eng.Exec("INSERT INTO leak_user (id, uid) VALUES (1, 'u1')")
	require.NoError(t, err)

	return eng
}

// Sessions are shared between services through the request context, so state left
// on the session by one query must not change the next query on an unrelated table.
func TestSessionStateDoesNotLeakBetweenOperations(t *testing.T) {
	t.Run("after Rows", func(t *testing.T) {
		eng := newLeakEngine(t)
		sess := eng.NewSession()
		defer sess.Close()

		rows, err := sess.Table("leak_rule").Rows(new(LeakRule))
		require.NoError(t, err)
		require.True(t, rows.Next())
		require.NoError(t, rows.Scan(new(LeakRule)))
		require.NoError(t, rows.Close())

		var users []LeakUser
		require.NoError(t, sess.Table("leak_user").Find(&users))
		require.Len(t, users, 1)
	})

	t.Run("after Update", func(t *testing.T) {
		eng := newLeakEngine(t)
		sess := eng.NewSession()
		defer sess.Close()

		updated, err := sess.Table(LeakRule{}).ID(1).AllCols().Omit("guid").Update(&LeakRule{Title: "t2"})
		require.NoError(t, err)
		require.Equal(t, int64(1), updated)

		var users []LeakUser
		require.NoError(t, sess.Table("leak_user").Find(&users))
		require.Len(t, users, 1)
	})

	t.Run("after Delete", func(t *testing.T) {
		eng := newLeakEngine(t)
		sess := eng.NewSession()
		defer sess.Close()

		_, err := sess.Table(LeakRule{}).ID(1).Delete(&LeakRule{})
		require.NoError(t, err)

		var users []LeakUser
		require.NoError(t, sess.Table("leak_user").Find(&users))
		require.Len(t, users, 1)
	})

	// These operations return before they reach the database, which used to leave the
	// table and column list behind on the session.
	t.Run("after Update that has nothing to update", func(t *testing.T) {
		eng := newLeakEngine(t)
		sess := eng.NewSession()
		defer sess.Close()

		_, err := sess.Table(LeakRule{}).ID(1).Cols("unknown_column").Update(&LeakRule{})
		require.Error(t, err)

		var users []LeakUser
		require.NoError(t, sess.Table("leak_user").Find(&users))
		require.Len(t, users, 1)
	})

	t.Run("after InsertMulti with nothing to insert", func(t *testing.T) {
		eng := newLeakEngine(t)
		sess := eng.NewSession()
		defer sess.Close()

		inserted, err := sess.Table(LeakRule{}).Cols("guid").InsertMulti(&[]LeakRule{})
		require.NoError(t, err)
		require.Zero(t, inserted)

		var users []LeakUser
		require.NoError(t, sess.Table("leak_user").Find(&users))
		require.Len(t, users, 1)
	})

	t.Run("after Rows that fails to build a query", func(t *testing.T) {
		eng := newLeakEngine(t)
		sess := eng.NewSession()
		defer sess.Close()

		_, err := sess.Table(LeakRule{}).ID(core.PK{1, 2}).Rows(new(LeakRule))
		require.Error(t, err)

		var users []LeakUser
		require.NoError(t, sess.Table("leak_user").Find(&users))
		require.Len(t, users, 1)
	})

	t.Run("after buffered Iterate", func(t *testing.T) {
		eng := newLeakEngine(t)
		sess := eng.NewSession()
		defer sess.Close()

		visited := 0
		err := sess.Table(LeakRule{}).Cols("guid").BufferSize(1).Iterate(new(LeakRule), func(int, interface{}) error {
			visited++
			return nil
		})
		require.NoError(t, err)
		require.Equal(t, 1, visited)

		var users []LeakUser
		require.NoError(t, sess.Table("leak_user").Find(&users))
		require.Len(t, users, 1)
	})

	t.Run("after Count", func(t *testing.T) {
		eng := newLeakEngine(t)
		sess := eng.NewSession()
		defer sess.Close()

		count, err := sess.Table(LeakRule{}).Where("guid = ?", "g1").Count()
		require.NoError(t, err)
		require.Equal(t, int64(1), count)

		var users []LeakUser
		require.NoError(t, sess.Table("leak_user").Find(&users))
		require.Len(t, users, 1)
	})
}

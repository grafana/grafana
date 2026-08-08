// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"testing"

	_ "github.com/grafana/grafana/pkg/util/sqlite"
	"github.com/stretchr/testify/require"
)

// TestUpdateWithMapBean verifies that Update() with a map bean inside a transaction
// does not panic. Go panics when a map is used as a map key; the old code attempted
// to store bean in session.afterUpdateBeans (map[any]...) without guarding for this.
func TestUpdateWithMapBean(t *testing.T) {
	eng, err := NewEngine("sqlite3", ":memory:")
	require.NoError(t, err)
	defer eng.Close()

	_, err = eng.Exec("CREATE TABLE test_map_update (id INTEGER PRIMARY KEY, name TEXT)")
	require.NoError(t, err)

	_, err = eng.Exec("INSERT INTO test_map_update (id, name) VALUES (1, 'original')")
	require.NoError(t, err)

	t.Run("update with map bean in transaction does not panic", func(t *testing.T) {
		sess := eng.NewSession()
		defer sess.Close()

		err := sess.Begin()
		require.NoError(t, err)

		// Register an after-closure so len(session.afterClosures) > 0, which is
		// required to enter the afterUpdateBeans map-key path that used to panic.
		afterCalled := false
		sess.After(func(any) { afterCalled = true })

		// map[string]any is valid for dynamic column updates in xorm.
		bean := map[string]any{"name": "updated"}

		require.NotPanics(t, func() {
			_, err = sess.Table("test_map_update").Where("id = ?", 1).Update(bean)
		})
		require.NoError(t, err)

		err = sess.Commit()
		require.NoError(t, err)

		// after-closures are not invoked for map beans (they can't be tracked),
		// but the update must still succeed without panicking.
		_ = afterCalled
	})

	t.Run("update with map bean verifies the row was actually updated", func(t *testing.T) {
		var name string
		_, err := eng.SQL("SELECT name FROM test_map_update WHERE id = 1").Get(&name)
		require.NoError(t, err)
		require.Equal(t, "updated", name)
	})
}

// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"testing"

	_ "github.com/grafana/grafana/pkg/util/sqlite"
	"github.com/stretchr/testify/require"
)

// TestUpdateWithMapBean verifies that calling Update() with a map bean inside
// a transaction does not panic. Previously, xorm used the bean value directly
// as a key in session.afterUpdateBeans (a map[any]...), which causes a runtime
// panic in Go when the bean is itself a map type, because maps are not hashable
// and cannot be used as map keys.
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

		// Using a map as the bean is valid xorm usage for dynamic updates.
		// Inside a transaction (non-autocommit), the old code would attempt to
		// store this map in session.afterUpdateBeans using the map itself as the
		// key, triggering a runtime panic.
		bean := map[string]any{"name": "updated"}

		require.NotPanics(t, func() {
			_, err = sess.Table("test_map_update").Where("id = ?", 1).Update(bean)
		})
		require.NoError(t, err)

		err = sess.Commit()
		require.NoError(t, err)
	})

	t.Run("update with map bean verifies the row was actually updated", func(t *testing.T) {
		var name string
		_, err := eng.SQL("SELECT name FROM test_map_update WHERE id = 1").Get(&name)
		require.NoError(t, err)
		require.Equal(t, "updated", name)
	})
}

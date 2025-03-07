package xorm

import (
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

func TestNewEngine(t *testing.T) {
	t.Run("successfully create a new engine", func(t *testing.T) {
		eng, err := NewEngine("sqlite3", ":memory:")
		require.NoError(t, err)
		require.NotNil(t, eng)
		require.Equal(t, "sqlite3", eng.DriverName())
	})

	t.Run("insert object", func(t *testing.T) {
		eng, err := NewEngine("sqlite3", ":memory:")
		require.NoError(t, err)
		require.NotNil(t, eng)

		_, err = eng.Exec("CREATE TABLE test_struct (id int primary key, comment text)")
		require.NoError(t, err)

		id, err := eng.Insert(testStruct{Comment: "test comment"})
		require.NoError(t, err)
		require.Equal(t, int64(1), id)
	})
}

type testStruct struct {
	ID      int64
	Comment string
}

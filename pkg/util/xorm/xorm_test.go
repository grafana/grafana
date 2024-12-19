package xorm

import (
	"testing"

	"github.com/stretchr/testify/require"
	_ "modernc.org/sqlite"
)

func TestNewEngine(t *testing.T) {
	t.Run("successfully create a new engine", func(t *testing.T) {
		eng, err := NewEngine("sqlite3", "./test.db")
		require.NoError(t, err)
		require.NotNil(t, eng)
		require.Equal(t, "sqlite3", eng.DriverName())
	})
}

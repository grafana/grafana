package xorm

import (
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

func TestNewEngine(t *testing.T) {
	t.Run("successfully create a new engine", func(t *testing.T) {
		eng, err := NewEngine("sqlite3", "./test.db")
		require.NoError(t, err)
		require.NotNil(t, eng)
		require.Equal(t, "sqlite3", eng.DriverName())
	})
}

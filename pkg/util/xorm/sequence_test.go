package xorm

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSequenceGenerator(t *testing.T) {
	eng, err := NewEngine("sqlite3", ":memory:")
	require.NoError(t, err)
	require.NotNil(t, eng)
	require.Equal(t, "sqlite3", eng.DriverName())

	_, err = eng.Exec("CREATE TABLE `autoincrement_sequences` (`name` STRING(128) NOT NULL PRIMARY KEY, `next_value` INT64 NOT NULL)")
	require.NoError(t, err)

	sg := newSequenceGenerator(eng.db.DB)
	val, err := sg.Next(context.Background(), "test", "test")
	require.NoError(t, err)
	require.Equal(t, int64(1), val)

	val, err = sg.Next(context.Background(), "test", "different")
	require.NoError(t, err)
	require.Equal(t, int64(1), val)

	val, err = sg.Next(context.Background(), "test", "different")
	require.NoError(t, err)
	require.Equal(t, int64(2), val)
}

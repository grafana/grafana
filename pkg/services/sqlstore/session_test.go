package sqlstore

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

func TestRetryingOnFailures(t *testing.T) {
	store := InitTestDB(t)
	store.dbCfg.QueryRetries = 5

	funcToTest := map[string]func(ctx context.Context, callback DBTransactionFunc) error{
		"WithDbSession":    store.WithDbSession,
		"WithNewDbSession": store.WithNewDbSession,
	}

	for name, f := range funcToTest {
		t.Run(fmt.Sprintf("%s should return the error immediately if it's other than sqlite3.ErrLocked or sqlite3.ErrBusy", name), func(t *testing.T) {
			i := 0
			callback := func(sess *DBSession) error {
				i++
				return errors.New("some error")
			}
			err := f(context.Background(), callback)
			require.Error(t, err)
			require.Equal(t, 1, i)
		})

		t.Run(fmt.Sprintf("%s should return the sqlite3.Error if all retries have failed", name), func(t *testing.T) {
			i := 0
			callback := func(sess *DBSession) error {
				i++
				return sqlite3.Error{Code: sqlite3.ErrBusy}
			}
			err := f(context.Background(), callback)
			require.Error(t, err)
			var driverErr sqlite3.Error
			require.ErrorAs(t, err, &driverErr)
			require.Equal(t, store.dbCfg.QueryRetries, i)
		})

		t.Run(fmt.Sprintf("%s should not return the error if successive retries succeed", name), func(t *testing.T) {
			i := 0
			callback := func(sess *DBSession) error {
				i++
				var err error
				switch {
				case store.dbCfg.QueryRetries == i:
					err = nil
				default:
					err = sqlite3.Error{Code: sqlite3.ErrBusy}
				}
				return err
			}
			err := f(context.Background(), callback)
			require.NoError(t, err)
			require.Equal(t, store.dbCfg.QueryRetries, i)
		})
	}

	// Check SQL query
	sess := store.GetSqlxSession()
	rows, err := sess.Query(context.Background(), `SELECT "hello",2.3,4`)
	t.Cleanup(func() {
		err := rows.Close()
		require.NoError(t, err)
	})
	require.NoError(t, err)
	require.True(t, rows.Next()) // first row

	str1 := ""
	val2 := float64(100.1)
	val3 := int64(200)
	err = rows.Scan(&str1, &val2, &val3)
	require.NoError(t, err)
	require.Equal(t, "hello", str1)
	require.Equal(t, 2.3, val2)
	require.Equal(t, int64(4), val3)
	require.False(t, rows.Next()) // no more rows
}

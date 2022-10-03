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
		"WithDbSession()":    store.WithDbSession,
		"WithNewDbSession()": store.WithNewDbSession,
	}

	for name, f := range funcToTest {
		i := 0
		t.Run(fmt.Sprintf("%s should return the error immediately if it's other than sqlite3.ErrLocked or sqlite3.ErrBusy", name), func(t *testing.T) {
			err := f(context.Background(), func(sess *DBSession) error {
				i++
				return errors.New("some error")
			})
			require.Error(t, err)
			require.Equal(t, i, 1)
		})

		i = 0
		t.Run(fmt.Sprintf("%s should return the sqlite3.Error if all retries have failed", name), func(t *testing.T) {
			err := f(context.Background(), func(sess *DBSession) error {
				i++
				return sqlite3.Error{Code: sqlite3.ErrBusy}
			})
			require.Error(t, err)
			var driverErr sqlite3.Error
			require.ErrorAs(t, err, &driverErr)
			require.Equal(t, i, store.dbCfg.QueryRetries+1)
		})

		i = 0
		t.Run(fmt.Sprintf("%s should not return the error if successive retries succeed", name), func(t *testing.T) {
			err := f(context.Background(), func(sess *DBSession) error {
				var err error
				switch {
				case i >= store.dbCfg.QueryRetries:
					err = nil
				default:
					err = sqlite3.Error{Code: sqlite3.ErrBusy}
				}
				i++
				return err
			})
			require.NoError(t, err)
			require.Equal(t, i, store.dbCfg.QueryRetries+1)
		})
	}
}

package sqlstore

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func TestIntegration_RetryingDisabled(t *testing.T) {
	store, _ := InitTestDB(t)
	retryErrors := getRetryErrors(t, store)

	require.Equal(t, 0, store.dbCfg.QueryRetries)

	funcToTest := map[string]func(ctx context.Context, callback DBTransactionFunc) error{
		"WithDbSession": store.WithDbSession,
	}

	for name, f := range funcToTest {
		t.Run(fmt.Sprintf("%s should return the error immediately", name), func(t *testing.T) {
			i := 0
			callback := func(sess *DBSession) error {
				i++
				return errors.New("some error")
			}
			err := f(context.Background(), callback)
			require.Error(t, err)
			require.Equal(t, 1, i)
		})

		for _, e := range retryErrors {
			t.Run(fmt.Sprintf("%s should return the sqlite3.Error %v immediately", name, e), func(t *testing.T) {
				i := 0
				callback := func(sess *DBSession) error {
					i++
					return e
				}
				err := f(context.Background(), callback)
				require.Error(t, err)
				require.Equal(t, 1, i)
			})
		}

		t.Run(fmt.Sprintf("%s should not return error if the callback succeeds", name), func(t *testing.T) {
			i := 0
			callback := func(sess *DBSession) error {
				i++
				return nil
			}
			err := f(context.Background(), callback)
			require.NoError(t, err)
			require.Equal(t, 1, i)
		})
	}
}

func TestIntegration_RetryingOnFailures(t *testing.T) {
	store, _ := InitTestDB(t)
	retryErrors := getRetryErrors(t, store)
	store.dbCfg.QueryRetries = 5

	funcToTest := map[string]func(ctx context.Context, callback DBTransactionFunc) error{
		"WithDbSession": store.WithDbSession,
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

		for _, e := range retryErrors {
			t.Run(fmt.Sprintf("%s should return the error %v if all retries have failed", name, e), func(t *testing.T) {
				i := 0
				callback := func(sess *DBSession) error {
					i++
					return e
				}
				err := f(context.Background(), callback)
				require.Error(t, err)
				require.Equal(t, store.dbCfg.QueryRetries, i)
			})
		}

		t.Run(fmt.Sprintf("%s should not return the error if successive retries succeed", name), func(t *testing.T) {
			i := 0
			callback := func(sess *DBSession) error {
				i++
				var err error
				switch {
				case store.dbCfg.QueryRetries == i:
					err = nil
				default:
					err = retryErrors[0]
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

func getRetryErrors(t *testing.T, store *SQLStore) []error {
	var retryErrors []error
	switch store.GetDialect().DriverName() {
	case migrator.SQLite:
		retryErrors = []error{sqlite3.Error{Code: sqlite3.ErrBusy}, sqlite3.Error{Code: sqlite3.ErrLocked}}
	case migrator.Spanner:
		retryErrors = []error{grpcstatus.Error(codes.Aborted, "aborted transaction")}
	}

	if len(retryErrors) == 0 {
		t.Skip("This test only works with sqlite or spanner")
	}
	return retryErrors
}

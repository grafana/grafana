package migrator

import (
	"errors"
	"testing"
	"testing/synctest"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

func TestPostgresLock(t *testing.T) {
	if core.QueryDriver("sqlmock") == nil {
		core.RegisterDriver("sqlmock", core.QueryDriver(Postgres))
	}

	queryErr := errors.New("lock query failed")
	for _, tc := range []struct {
		name         string
		timeout      int
		results      []bool
		queryErr     error
		queryDelay   time.Duration
		wantErr      error
		wantDuration time.Duration
	}{
		{
			name:    "free lock returns immediately",
			timeout: 60,
			results: []bool{true},
		},
		{
			name:         "held lock is retried until released",
			timeout:      60,
			results:      []bool{false, false, true},
			wantDuration: 200 * time.Millisecond,
		},
		{
			name:         "held lock waits until timeout",
			timeout:      1,
			results:      make([]bool, 10),
			wantErr:      ErrLockDB,
			wantDuration: time.Second,
		},
		{
			name:         "retry wait is capped by remaining timeout",
			timeout:      1,
			results:      []bool{false},
			queryDelay:   950 * time.Millisecond,
			wantErr:      ErrLockDB,
			wantDuration: time.Second,
		},
		{
			name:    "zero timeout fails immediately when held",
			results: []bool{false},
			wantErr: ErrLockDB,
		},
		{
			name:    "zero timeout succeeds immediately when free",
			results: []bool{true},
		},
		{
			name:     "query error returns immediately",
			timeout:  60,
			queryErr: queryErr,
			wantErr:  queryErr,
		},
		{
			name:         "query error stops retries",
			timeout:      60,
			results:      []bool{false},
			queryErr:     queryErr,
			wantErr:      queryErr,
			wantDuration: 100 * time.Millisecond,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				const dsn = "dbname=migrator_lock"
				mockDB, mock, err := sqlmock.NewWithDSN(dsn, sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
				require.NoError(t, err)
				t.Cleanup(func() { _ = mockDB.Close() })

				engine, err := xorm.NewEngine("sqlmock", dsn)
				require.NoError(t, err)
				t.Cleanup(func() { _ = engine.Close() })
				session := engine.NewSession()
				t.Cleanup(session.Close)
				mock.ExpectBegin()
				require.NoError(t, session.Begin())

				const key = "123"
				const query = "SELECT pg_try_advisory_lock($1)"
				for _, result := range tc.results {
					mock.ExpectQuery(query).WithArgs(key).
						WillDelayFor(tc.queryDelay).
						WillReturnRows(sqlmock.NewRows([]string{"pg_try_advisory_lock"}).AddRow(result)).
						RowsWillBeClosed()
				}
				if tc.queryErr != nil {
					mock.ExpectQuery(query).WithArgs(key).WillReturnError(tc.queryErr)
				}
				mock.ExpectRollback()

				start := time.Now()
				err = NewPostgresDialect().Lock(LockCfg{Session: session, Key: key, Timeout: tc.timeout})
				require.ErrorIs(t, err, tc.wantErr)
				require.Equal(t, tc.wantDuration, time.Since(start))
				require.NoError(t, session.Rollback())
				require.NoError(t, mock.ExpectationsWereMet())
			})
		})
	}
}

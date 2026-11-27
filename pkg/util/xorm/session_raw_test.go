package xorm

import (
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/grafana/grafana/pkg/util/xorm/core"
	"github.com/stretchr/testify/require"
)

func TestRows2MapsReturnsIterationErrorWithoutPartialRows(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	streamErr := errors.New("stream failed after first row")
	mock.ExpectQuery("SELECT dashboard_uid").WillReturnRows(
		sqlmock.NewRows([]string{"dashboard_uid"}).
			AddRow("dashboard-a").
			AddRow("dashboard-b").
			RowError(1, streamErr),
	).RowsWillBeClosed()

	sqlRows, err := db.Query("SELECT dashboard_uid")
	require.NoError(t, err)
	rows, err := rows2maps(&core.Rows{Rows: sqlRows})
	require.NoError(t, sqlRows.Close())
	require.ErrorIs(t, err, streamErr)
	require.Nil(t, rows)
	require.NoError(t, mock.ExpectationsWereMet())
}

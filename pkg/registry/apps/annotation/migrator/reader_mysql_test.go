package migrator

import (
	"context"
	"errors"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
)

// annotationCols is the column set (and order) that queryBatch scans.
var annotationCols = []string{
	"id", "epoch", "epoch_end", "dashboard_uid", "panel_id", "text",
	"data", "created", "updated", "uid", "is_service_account",
}

func newMockReader(t *testing.T) (*MySQLReader, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	return NewMySQLReader(db), mock
}

func TestMySQLReader_CountUserAnnotations(t *testing.T) {
	r, mock := newMockReader(t)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT COUNT(*) FROM annotation WHERE org_id = ? AND alert_id = 0")).
		WithArgs(int64(7)).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(42)))

	count, err := r.CountUserAnnotations(context.Background(), 7)
	require.NoError(t, err)
	require.Equal(t, int64(42), count)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestMySQLReader_ReadBatch_MapsRowsAndResolvesTags(t *testing.T) {
	r, mock := newMockReader(t)

	// Only user annotations (alert_id = 0), keyset on id.
	mock.ExpectQuery(regexp.QuoteMeta("a.alert_id = 0 AND a.id > ?")).
		WithArgs(int64(1), int64(0), 2).
		WillReturnRows(sqlmock.NewRows(annotationCols).
			AddRow(int64(10), int64(1000), int64(2000), "dash", int64(5), "deploy", `{"k":1}`, int64(500), int64(600), "user-uid", int64(0)).
			AddRow(int64(11), int64(1500), int64(0), "", int64(0), "point", "", int64(0), int64(0), "sa-uid", int64(1)))

	// Tags are resolved in a second query for the batch's ids.
	mock.ExpectQuery(regexp.QuoteMeta("FROM annotation_tag")).
		WithArgs(int64(10), int64(11)).
		WillReturnRows(sqlmock.NewRows([]string{"annotation_id", "key", "value"}).
			AddRow(int64(10), "team", "ops").
			AddRow(int64(10), "prod", "").
			AddRow(int64(11), "env", "dev"))

	batch, err := r.ReadBatch(context.Background(), 1, 0, 2)
	require.NoError(t, err)
	require.Len(t, batch, 2)

	// Column order in the SELECT must line up with the scan targets.
	a := batch[0]
	require.Equal(t, int64(10), a.ID)
	require.Equal(t, int64(1000), a.Epoch)
	require.Equal(t, int64(2000), a.EpochEnd)
	require.Equal(t, "dash", a.DashboardUID)
	require.Equal(t, int64(5), a.PanelID)
	require.Equal(t, "deploy", a.Text)
	require.Equal(t, `{"k":1}`, a.Data)
	require.Equal(t, int64(500), a.Created)
	require.Equal(t, int64(600), a.Updated)
	require.Equal(t, "user-uid", a.UserUID)
	require.False(t, a.UserIsServiceAccount)
	// "key:value" for a valued tag, bare "key" when the value is empty.
	require.Equal(t, []string{"team:ops", "prod"}, a.Tags)

	b := batch[1]
	require.True(t, b.UserIsServiceAccount, "is_service_account=1 maps to true")
	require.Equal(t, []string{"env:dev"}, b.Tags)

	require.NoError(t, mock.ExpectationsWereMet())
}

func TestMySQLReader_ReadChangedBatch_KeysetAndOrdering(t *testing.T) {
	r, mock := newMockReader(t)

	// Assert the (updated, id) keyset predicate and ordering, plus that the
	// cursor value is bound twice (for `updated >` and `updated =`).
	pattern := `a\.updated > \? OR \(a\.updated = \? AND a\.id > \?\).*ORDER BY a\.updated ASC, a\.id ASC`
	mock.ExpectQuery(pattern).
		WithArgs(int64(1), int64(100), int64(100), int64(5), 10).
		WillReturnRows(sqlmock.NewRows(annotationCols).
			AddRow(int64(6), int64(1000), int64(0), "", int64(0), "x", "", int64(0), int64(150), "", int64(0)))
	mock.ExpectQuery(regexp.QuoteMeta("FROM annotation_tag")).
		WithArgs(int64(6)).
		WillReturnRows(sqlmock.NewRows([]string{"annotation_id", "key", "value"}))

	batch, err := r.ReadChangedBatch(context.Background(), 1, 100, 5, 10)
	require.NoError(t, err)
	require.Len(t, batch, 1)
	require.Equal(t, int64(6), batch[0].ID)
	require.Equal(t, int64(150), batch[0].Updated)
	require.Empty(t, batch[0].Tags)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestMySQLReader_ReadBatch_EmptySkipsTagQuery(t *testing.T) {
	r, mock := newMockReader(t)
	mock.ExpectQuery(regexp.QuoteMeta("a.alert_id = 0 AND a.id > ?")).
		WithArgs(int64(1), int64(999), 2).
		WillReturnRows(sqlmock.NewRows(annotationCols))

	batch, err := r.ReadBatch(context.Background(), 1, 999, 2)
	require.NoError(t, err)
	require.Empty(t, batch)
	// No tag query was expected; if ReadBatch had issued one against the empty
	// batch, sqlmock would have failed it as unexpected.
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestMySQLReader_ReadBatch_PropagatesQueryError(t *testing.T) {
	r, mock := newMockReader(t)
	mock.ExpectQuery(regexp.QuoteMeta("a.alert_id = 0 AND a.id > ?")).
		WithArgs(int64(1), int64(0), 2).
		WillReturnError(errors.New("boom"))

	_, err := r.ReadBatch(context.Background(), 1, 0, 2)
	require.ErrorContains(t, err, "boom")
	require.NoError(t, mock.ExpectationsWereMet())
}

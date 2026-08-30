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

func TestMySQLReader_Totals(t *testing.T) {
	r, mock := newMockReader(t)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT COUNT(*), COALESCE(MAX(id), 0) FROM annotation WHERE org_id = ? AND alert_id = 0")).
		WithArgs(int64(7)).
		WillReturnRows(sqlmock.NewRows([]string{"count", "max_id"}).AddRow(int64(42), int64(913)))

	totals, err := r.Totals(context.Background(), 7)
	require.NoError(t, err)
	require.Equal(t, LegacyTotals{Count: 42, MaxID: 913}, totals)
	require.NoError(t, mock.ExpectationsWereMet())
}

// An empty tenant must report a zero max, not a NULL the scan cannot read.
func TestMySQLReader_TotalsOnEmptyTenant(t *testing.T) {
	r, mock := newMockReader(t)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT COUNT(*), COALESCE(MAX(id), 0)")).
		WithArgs(int64(7)).
		WillReturnRows(sqlmock.NewRows([]string{"count", "max_id"}).AddRow(int64(0), int64(0)))

	totals, err := r.Totals(context.Background(), 7)
	require.NoError(t, err)
	require.Equal(t, LegacyTotals{}, totals)
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
	require.Equal(t, []string{"prod", "team:ops"}, a.Tags)

	b := batch[1]
	require.True(t, b.UserIsServiceAccount, "is_service_account=1 maps to true")
	require.Equal(t, []string{"env:dev"}, b.Tags)

	require.NoError(t, mock.ExpectationsWereMet())
}

func TestMySQLReader_ReadChangedBatch_KeysetAndOrdering(t *testing.T) {
	r, mock := newMockReader(t)

	// The cursor is bound twice: once for `updated >`, once for `updated =`.
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

func TestMySQLReader_LatestChange(t *testing.T) {
	r, mock := newMockReader(t)
	mock.ExpectQuery(`ORDER BY a\.updated DESC, a\.id DESC.*LIMIT 1`).
		WithArgs(int64(7)).
		WillReturnRows(sqlmock.NewRows([]string{"updated", "id"}).AddRow(int64(1700), int64(42)))

	cursor, err := r.LatestChange(context.Background(), 7)
	require.NoError(t, err)
	require.Equal(t, UpdateCursor{Updated: 1700, ID: 42}, cursor)
	require.NoError(t, mock.ExpectationsWereMet())
}

// No user annotations is not an error: the zero cursor is the start of the timeline.
func TestMySQLReader_LatestChange_NoRows(t *testing.T) {
	r, mock := newMockReader(t)
	mock.ExpectQuery(`ORDER BY a\.updated DESC, a\.id DESC`).
		WithArgs(int64(7)).
		WillReturnRows(sqlmock.NewRows([]string{"updated", "id"}))

	cursor, err := r.LatestChange(context.Background(), 7)
	require.NoError(t, err)
	require.Equal(t, UpdateCursor{}, cursor)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestMySQLReader_LatestChange_PropagatesQueryError(t *testing.T) {
	r, mock := newMockReader(t)
	mock.ExpectQuery(`ORDER BY a\.updated DESC, a\.id DESC`).
		WithArgs(int64(7)).
		WillReturnError(errors.New("boom"))

	_, err := r.LatestChange(context.Background(), 7)
	require.ErrorContains(t, err, "boom")
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
	// No tag query was expected, so sqlmock fails if ReadBatch issued one.
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

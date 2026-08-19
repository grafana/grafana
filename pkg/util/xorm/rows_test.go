package xorm

import (
	"testing"

	_ "github.com/grafana/grafana/pkg/util/sqlite"
	"github.com/grafana/grafana/pkg/util/xorm/core"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type rowsScanSource struct {
	ID          int64  `xorm:"'id' pk"`
	SourceValue string `xorm:"source_value"`
}

func (rowsScanSource) TableName() string {
	return "rows_scan_source"
}

type rowsScanTarget struct {
	ID          int64  `xorm:"'id' pk"`
	TargetValue string `xorm:"target_value"`
}

func (rowsScanTarget) TableName() string {
	return "rows_scan_target"
}

type rowsScanHookState struct {
	statementClean bool
}

type rowsScanSourceWithHook struct {
	ID          int64              `xorm:"'id' pk"`
	SourceValue string             `xorm:"source_value"`
	hookState   *rowsScanHookState `xorm:"-"`
}

func (rowsScanSourceWithHook) TableName() string {
	return "rows_scan_source"
}

func (r *rowsScanSourceWithHook) AfterLoad(session *Session) {
	r.hookState.statementClean = statementMappingIsClean(session)
}

func statementMappingIsClean(session *Session) bool {
	return session.statement.RefTable == nil &&
		session.statement.AltTableName == "" &&
		session.statement.tableName == "" &&
		session.statement.ColumnStr == "" &&
		session.statement.RawSQL == ""
}

func TestRowsScanDoesNotLeakStatementMapping(t *testing.T) {
	eng, err := NewEngine("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, eng.Close()) })

	require.NoError(t, eng.Sync(new(rowsScanSource), new(rowsScanTarget)))
	_, err = eng.Insert(&rowsScanSource{ID: 1, SourceValue: "source"})
	require.NoError(t, err)
	_, err = eng.Insert(&rowsScanSource{ID: 2, SourceValue: "second source"})
	require.NoError(t, err)
	_, err = eng.Insert(&rowsScanTarget{ID: 1, TargetValue: "target"})
	require.NoError(t, err)

	session := eng.NewSession()
	t.Cleanup(session.Close)

	rows, err := session.Asc("id").Rows(new(rowsScanSource))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, rows.Close()) })

	for _, expected := range []rowsScanSource{
		{ID: 1, SourceValue: "source"},
		{ID: 2, SourceValue: "second source"},
	} {
		require.True(t, rows.Next())
		var source rowsScanSource
		require.NoError(t, rows.Scan(&source))
		require.Equal(t, expected, source)
		assert.True(t, statementMappingIsClean(session))
	}
	require.NoError(t, rows.Close())

	var targets []rowsScanTarget
	require.NoError(t, session.Table("rows_scan_target").Find(&targets))
	require.Equal(t, []rowsScanTarget{{ID: 1, TargetValue: "target"}}, targets)
}

func TestRowsScanRunsAfterLoadWithCleanStatement(t *testing.T) {
	eng, err := NewEngine("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, eng.Close()) })

	require.NoError(t, eng.Sync(new(rowsScanSource)))
	_, err = eng.Insert(&rowsScanSource{ID: 1, SourceValue: "source"})
	require.NoError(t, err)

	session := eng.NewSession()
	t.Cleanup(session.Close)

	rows, err := session.Rows(new(rowsScanSourceWithHook))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, rows.Close()) })
	require.True(t, rows.Next())

	hookState := new(rowsScanHookState)
	source := rowsScanSourceWithHook{hookState: hookState}
	require.NoError(t, rows.Scan(&source))
	require.True(t, hookState.statementClean)
}

func TestRowsScanRawSQLUsesCursorMappingWithoutLeakingIt(t *testing.T) {
	eng, err := NewEngine("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, eng.Close()) })

	require.NoError(t, eng.Sync(new(rowsScanSource)))
	_, err = eng.Insert(&rowsScanSource{ID: 1, SourceValue: "source"})
	require.NoError(t, err)

	session := eng.NewSession()
	t.Cleanup(session.Close)

	rows, err := session.SQL("SELECT id, source_value FROM rows_scan_source").Rows(new(rowsScanSource))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, rows.Close()) })
	require.True(t, rows.Next())

	var source rowsScanSource
	require.NoError(t, rows.Scan(&source))
	require.Equal(t, rowsScanSource{ID: 1, SourceValue: "source"}, source)
	require.True(t, statementMappingIsClean(session))
}

func TestRowsConstructionErrorResetsStatement(t *testing.T) {
	eng, err := NewEngine("sqlite3", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, eng.Close()) })

	session := eng.NewSession()
	t.Cleanup(session.Close)

	_, err = session.ID(core.PK{1, 2}).Rows(new(rowsScanSource))
	require.ErrorContains(t, err, "expect 1 primarykeys, there are 2")
	require.True(t, statementMappingIsClean(session))
	require.Nil(t, session.statement.idParam)
}

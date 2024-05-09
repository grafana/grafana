package sqlstash

import (
	_ "embed"
	"encoding/json"
	"testing"
	"text/template"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash/sqltemplate"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash/sqltemplate/sqltemplatetest"
)

// Embedded test data.
var (
	//go:embed testdata/kind_version_lock.sql
	dataKindVersionLock string
	//go:embed testdata/kind_version_lock_sqlite.sql
	dataKindVersionLockSQLite string
	//go:embed testdata/kind_version_inc.sql
	dataKindVersionInc string
	//go:embed testdata/entity_insert.sql
	dataEntityInsert string
	//go:embed testdata/entity_history_insert.sql
	dataEntityHistoryInsert string
)

func TestTemplatesGolden(t *testing.T) {
	t.Parallel()

	newSQLKindVersionLockRequest := func(d sqltemplate.Dialect) any {
		return sqlKindVersionLockRequest{
			Dialect: d,
			Args:    new(sqltemplate.Args),
			Entity:  new(entity.Entity),
		}
	}

	newSQLKindVersionIncRequest := func(d sqltemplate.Dialect) any {
		return sqlKindVersionIncRequest{
			Dialect: d,
			Args:    new(sqltemplate.Args),
			Entity:  new(entity.Entity),
		}
	}

	newSQLEntityInsertRequest := func(d sqltemplate.Dialect, tableEntity bool) any {
		return sqlEntityInsertRequest{
			Dialect: d,
			Args:    new(sqltemplate.Args),
			Entity: &entity.Entity{
				Origin: new(entity.EntityOriginInfo),
			},
			Serialized:  new(entitySerializedData),
			TableEntity: tableEntity,
		}
	}

	testCases := []struct {
		tmpl        *template.Template
		expectedSQL string
		data        any
	}{

		// sqlKindVersionLock
		{
			tmpl:        sqlKindVersionLock,
			expectedSQL: dataKindVersionLock,
			data:        newSQLKindVersionLockRequest(sqltemplate.MySQL),
		},
		{
			tmpl:        sqlKindVersionLock,
			expectedSQL: dataKindVersionLock,
			data:        newSQLKindVersionLockRequest(sqltemplate.PostgreSQL),
		},
		{
			tmpl:        sqlKindVersionLock,
			expectedSQL: dataKindVersionLockSQLite,
			data:        newSQLKindVersionLockRequest(sqltemplate.SQLite),
		},

		// sqlKindVersionInc
		{
			tmpl:        sqlKindVersionInc,
			expectedSQL: dataKindVersionInc,
			data:        newSQLKindVersionIncRequest(sqltemplate.MySQL),
		},
		{
			tmpl:        sqlKindVersionInc,
			expectedSQL: dataKindVersionInc,
			data:        newSQLKindVersionIncRequest(sqltemplate.PostgreSQL),
		},
		{
			tmpl:        sqlKindVersionInc,
			expectedSQL: dataKindVersionInc,
			data:        newSQLKindVersionIncRequest(sqltemplate.SQLite),
		},

		// sqlEntityInsert: entity table
		{
			tmpl:        sqlEntityInsert,
			expectedSQL: dataEntityInsert,
			data:        newSQLEntityInsertRequest(sqltemplate.MySQL, true),
		},
		{
			tmpl:        sqlEntityInsert,
			expectedSQL: dataEntityInsert,
			data:        newSQLEntityInsertRequest(sqltemplate.PostgreSQL, true),
		},
		{
			tmpl:        sqlEntityInsert,
			expectedSQL: dataEntityInsert,
			data:        newSQLEntityInsertRequest(sqltemplate.SQLite, true),
		},

		// sqlEntityInsert: entity_history table
		{
			tmpl:        sqlEntityInsert,
			expectedSQL: dataEntityHistoryInsert,
			data:        newSQLEntityInsertRequest(sqltemplate.MySQL, false),
		},
		{
			tmpl:        sqlEntityInsert,
			expectedSQL: dataEntityHistoryInsert,
			data:        newSQLEntityInsertRequest(sqltemplate.PostgreSQL, false),
		},
		{
			tmpl:        sqlEntityInsert,
			expectedSQL: dataEntityHistoryInsert,
			data:        newSQLEntityInsertRequest(sqltemplate.SQLite, false),
		},
	}

	for i, tc := range testCases {
		require.NoError(t, sqltemplatetest.Golden(
			tc.tmpl,
			tc.expectedSQL,
			tc.data,
		), "test case with index #%d", i)
	}
}

func TestNewEntitySerializedData(t *testing.T) {
	t.Parallel()

	// test data for maps
	someMap := map[string]string{
		"alpha": "aleph",
		"beta":  "beth",
	}
	someMapJSONb, err := json.Marshal(someMap)
	require.NoError(t, err)
	someMapJSON := string(someMapJSONb)

	// test data for errors
	someErrors := []*entity.EntityErrorInfo{
		{
			Code:        1,
			Message:     "not cool",
			DetailsJson: []byte(`"nothing to add"`),
		},
	}
	someErrorsJSONb, err := json.Marshal(someErrors)
	require.NoError(t, err)
	someErrorsJSON := string(someErrorsJSONb)

	t.Run("happy path - nothing to serialize", func(t *testing.T) {
		t.Parallel()

		d, err := newEntitySerializedData(&entity.Entity{
			Labels: map[string]string{},
			Fields: map[string]string{},
			Errors: []*entity.EntityErrorInfo{},
		})
		require.NoError(t, err)

		require.JSONEq(t, `{}`, string(d.Labels))
		require.JSONEq(t, `{}`, string(d.Fields))
		require.JSONEq(t, `[]`, string(d.Errors))

		// nil Go Object/Slice map to empty JSON Object/Array for consistency

		d, err = newEntitySerializedData(new(entity.Entity))
		require.NoError(t, err)

		require.JSONEq(t, `{}`, string(d.Labels))
		require.JSONEq(t, `{}`, string(d.Fields))
		require.JSONEq(t, `[]`, string(d.Errors))
	})

	t.Run("happy path - everything to serialize", func(t *testing.T) {
		t.Parallel()

		d, err := newEntitySerializedData(&entity.Entity{
			Labels: someMap,
			Fields: someMap,
			Errors: someErrors,
		})
		require.NoError(t, err)

		require.JSONEq(t, someMapJSON, string(d.Labels))
		require.JSONEq(t, someMapJSON, string(d.Fields))
		require.JSONEq(t, someErrorsJSON, string(d.Errors))
	})

	// NOTE: the error path for serialization is not reachable as far as we can
	// predict. If you find a way to simulate a serialization error, consider
	// raising awareness of such case(s) and add the corresponding tests here
}

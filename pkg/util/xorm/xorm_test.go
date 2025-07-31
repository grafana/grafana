package xorm

import (
	"encoding/json"
	"testing"

	_ "github.com/grafana/grafana/pkg/util/sqlite"
	"github.com/stretchr/testify/require"
)

func TestBasicOperationsWithSqlite(t *testing.T) {
	eng, err := NewEngine("sqlite3", ":memory:")
	require.NoError(t, err)
	require.NotNil(t, eng)
	require.Equal(t, "sqlite3", eng.DriverName())

	_, err = eng.Exec("CREATE TABLE test_struct (id int primary key, comment text, json text)")
	require.NoError(t, err)

	testBasicOperations(t, eng)
}

func testBasicOperations(t *testing.T, eng *Engine) {
	t.Run("insert object", func(t *testing.T) {
		obj := &TestStruct{Comment: "test comment"}
		_, err := eng.Insert(obj)
		require.NoError(t, err)
		require.Equal(t, int64(1), obj.Id)
	})

	t.Run("update object with json field", func(t *testing.T) {
		sess := eng.NewSession()
		defer sess.Close()

		obj := &TestStruct{Comment: "new comment"}
		_, err := sess.Insert(obj)
		require.NoError(t, err)
		require.NotZero(t, obj.Id)

		obj.Json = json.RawMessage(`{"test": "test", "key": null}`)
		_, err = sess.Update(obj)
		require.NoError(t, err)
	})
}

type TestStruct struct {
	Id      int64
	Comment string
	Json    json.RawMessage
}

func TestRandomID(t *testing.T) {
	type RandomIDRecord struct {
		ID      int64 `xorm:"'id' pk randomid"`
		Comment string
	}

	eng, err := NewEngine("sqlite3", ":memory:")
	require.NoError(t, err)
	require.NoError(t, eng.Sync(new(RandomIDRecord)))

	// Test sequence of different snowflake values
	testCases := []struct {
		name    string
		id      int64
		comment string
	}{
		{"first insert", 42, "first comment"},
		{"second insert", 123, "second comment"},
		{"third insert", 1337, "third comment"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			eng.randomIDGen = func() int64 { return tc.id }

			obj := &RandomIDRecord{Comment: tc.comment}
			_, err := eng.Insert(obj)
			require.NoError(t, err)
			require.Equal(t, tc.id, obj.ID, "ID should match current snowflake value")

			// Verify database entry
			var retrieved RandomIDRecord
			has, err := eng.ID(tc.id).Get(&retrieved)
			require.NoError(t, err)
			require.True(t, has)
			require.Equal(t, tc.comment, retrieved.Comment)
		})
	}
}

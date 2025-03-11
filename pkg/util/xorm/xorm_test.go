package xorm

import (
	"encoding/json"
	"testing"

	_ "github.com/mattn/go-sqlite3"
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

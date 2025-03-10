//go:build enterprise || pro

package xorm

import (
	"fmt"
	"testing"

	"cloud.google.com/go/spanner/spannertest"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

func TestBasicOperationsWithSpanner(t *testing.T) {
	span, err := spannertest.NewServer("localhost:0")
	require.NoError(t, err)
	defer span.Close()

	eng, err := NewEngine("spanner", fmt.Sprintf("%s/projects/test/instances/test/databases/test;usePlainText=true", span.Addr))
	require.NoError(t, err)
	require.NotNil(t, eng)
	require.Equal(t, "spanner", eng.DriverName())

	_, err = eng.Exec("CREATE TABLE test_struct (id int64, comment string(max), json string(max)) primary key (id)")
	require.NoError(t, err)

	// Currently broken because simple INSERT into spannertest doesn't work: https://github.com/googleapis/go-sql-spanner/issues/392
	// testBasicOperations(t, eng)
}

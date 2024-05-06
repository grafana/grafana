package sql

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParse(t *testing.T) {
	sql := "select * from foo"
	tables, err := parseTables((sql))
	assert.Nil(t, err)

	assert.Equal(t, "foo", tables[0])
}

func TestParseWithComma(t *testing.T) {
	sql := "select * from foo,bar"
	tables, err := parseTables((sql))
	assert.Nil(t, err)

	assert.Equal(t, "foo", tables[0])
	assert.Equal(t, "bar", tables[1])
}

func TestParseWithCommas(t *testing.T) {
	sql := "select * from foo,bar,baz"
	tables, err := parseTables((sql))
	assert.Nil(t, err)

	assert.Equal(t, "foo", tables[0])
	assert.Equal(t, "bar", tables[1])
	assert.Equal(t, "baz", tables[2])
}

func TestArray(t *testing.T) {
	sql := "SELECT array_value(1, 2, 3)"
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, 0, len(tables))
}

func TestArray2(t *testing.T) {
	sql := "SELECT array_value(1, 2, 3)[2]"
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, 0, len(tables))
}

func TestXxx(t *testing.T) {
	sql := "SELECT [3, 2, 1]::INT[3];"
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, 0, len(tables))
}

func TestParseSubquery(t *testing.T) {
	sql := "select * from (select * from people limit 1)"
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, 1, len(tables))
	assert.Equal(t, "people", tables[0])
}

func TestJoin(t *testing.T) {
	sql := `select * from A
	JOIN B ON A.name = B.name
	LIMIT 10`
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, 2, len(tables))
	assert.Equal(t, "A", tables[0])
	assert.Equal(t, "B", tables[1])
}

func TestRightJoin(t *testing.T) {
	sql := `select * from A
	RIGHT JOIN B ON A.name = B.name
	LIMIT 10`
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, 2, len(tables))
	assert.Equal(t, "A", tables[0])
	assert.Equal(t, "B", tables[1])
}

func TestAliasWithJoin(t *testing.T) {
	sql := `select * from A as X
	RIGHT JOIN B ON A.name = X.name
	LIMIT 10`
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, 2, len(tables))
	assert.Equal(t, "A", tables[0])
	assert.Equal(t, "B", tables[1])
}

func TestAlias(t *testing.T) {
	sql := `select * from A as X LIMIT 10`
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, 1, len(tables))
	assert.Equal(t, "A", tables[0])
}

func TestParens(t *testing.T) {
	sql := `SELECT  t1.Col1,
	t2.Col1,
	t3.Col1
	FROM    table1 AS t1
	LEFT JOIN	(
	table2 AS t2
	INNER JOIN table3 AS t3 ON t3.Col1 = t2.Col1
	) ON t2.Col1 = t1.Col1;`
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, 3, len(tables))
	assert.Equal(t, "table1", tables[0])
	assert.Equal(t, "table2", tables[1])
	assert.Equal(t, "table3", tables[2])
}

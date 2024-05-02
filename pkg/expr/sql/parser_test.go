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

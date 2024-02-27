package sql

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParse(t *testing.T) {
	sql := "select * from foo"
	tables, err := parseTables((sql))
	assert.Nil(t, err)

	assert.Equal(t, "FOO", tables[0])
}

func TestParseWithComma(t *testing.T) {
	sql := "select * from foo,bar"
	tables, err := parseTables((sql))
	assert.Nil(t, err)

	assert.Equal(t, "FOO", tables[0])
	assert.Equal(t, "BAR", tables[1])
}

func TestParseWithCommas(t *testing.T) {
	sql := "select * from foo,bar,baz"
	tables, err := parseTables((sql))
	assert.Nil(t, err)

	assert.Equal(t, "FOO", tables[0])
	assert.Equal(t, "BAR", tables[1])
	assert.Equal(t, "BAZ", tables[2])
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

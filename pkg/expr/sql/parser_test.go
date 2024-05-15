package sql

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParse(t *testing.T) {
	t.Skip()
	sql := "select * from foo"
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, "foo", tables[0])
}

func TestParseWithComma(t *testing.T) {
	t.Skip()
	sql := "select * from foo,bar"
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, "bar", tables[0])
	assert.Equal(t, "foo", tables[1])
}

func TestParseWithCommas(t *testing.T) {
	t.Skip()
	sql := "select * from foo,bar,baz"
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, "bar", tables[0])
	assert.Equal(t, "baz", tables[1])
	assert.Equal(t, "foo", tables[2])
}

func TestArray(t *testing.T) {
	t.Skip()
	sql := "SELECT array_value(1, 2, 3)"
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, 0, len(tables))
}

func TestArray2(t *testing.T) {
	t.Skip()
	sql := "SELECT array_value(1, 2, 3)[2]"
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, 0, len(tables))
}

func TestXxx(t *testing.T) {
	t.Skip()
	sql := "SELECT [3, 2, 1]::INT[3];"
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, 0, len(tables))
}

func TestParseSubquery(t *testing.T) {
	t.Skip()
	sql := "select * from (select * from people limit 1)"
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, 1, len(tables))
	assert.Equal(t, "people", tables[0])
}

func TestJoin(t *testing.T) {
	t.Skip()
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
	t.Skip()
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
	t.Skip()
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
	t.Skip()
	sql := `select * from A as X LIMIT 10`
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, 1, len(tables))
	assert.Equal(t, "A", tables[0])
}

func TestError(t *testing.T) {
	t.Skip()
	sql := `select * from zzz aaa zzz`
	_, err := TablesList((sql))
	assert.NotNil(t, err)
}

func TestParens(t *testing.T) {
	t.Skip()
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

func TestWith(t *testing.T) {
	t.Skip()
	sql := `WITH

	current_month AS (
	  select 
		distinct "Month(ISO)" as mth
	  from A
	  ORDER BY mth DESC
	  LIMIT 1
	), 
	
	last_month_bill AS (
	  select
		CAST (
		  sum(
			CAST(BillableSeries AS INTEGER)
		  ) AS INTEGER
		) AS BillableSeries,
		"Month(ISO)",
		label_namespace
		-- , B.activeseries_count
	  from A
	  JOIN current_month
		ON current_month.mth = A."Month(ISO)"
	  	JOIN B
	  	ON B.namespace = A.label_namespace
	  GROUP BY
		label_namespace,
		"Month(ISO)"
	  ORDER BY BillableSeries DESC
	)
	
	SELECT
	  last_month_bill.*,
	  BEE.activeseries_count
	FROM last_month_bill
	JOIN BEE
	  ON BEE.namespace = last_month_bill.label_namespace`

	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, 5, len(tables))
	assert.Equal(t, "A", tables[0])
	assert.Equal(t, "B", tables[1])
	assert.Equal(t, "BEE", tables[2])
}

func TestWithQuote(t *testing.T) {
	t.Skip()
	sql := "select *,'junk' from foo"
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, "foo", tables[0])
}

func TestWithQuote2(t *testing.T) {
	t.Skip()
	sql := "SELECT json_serialize_sql('SELECT 1')"
	tables, err := TablesList((sql))
	assert.Nil(t, err)

	assert.Equal(t, 0, len(tables))
}

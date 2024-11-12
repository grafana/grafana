package sql

import (
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/xwb1989/sqlparser"
)

var logger = log.New("sql_expr")

// TablesList returns a list of tables for the sql statement
func TablesList(rawSQL string) ([]string, error) {

	stmt, err := sqlparser.Parse(rawSQL)
	if err != nil {
		logger.Error("error parsing sql", "error", err.Error(), "sql", rawSQL)
		return nil, fmt.Errorf("error parsing sql: %s", err.Error())
	}

	tables := []string{}
	sqlparser.Walk(func(node sqlparser.SQLNode) (kontinue bool, err error) {
		switch n := node.(type) {
		case *sqlparser.AliasedTableExpr:
			// Use type assertion to get the underlying TableName
			tables = append(tables, n.Expr.(sqlparser.TableName).Name.String())
		case *sqlparser.TableName:
			tables = append(tables, n.Name.String())
		}
		return true, nil
	}, stmt)

	sort.Strings(tables)

	// Remove 'dual' table if it exists
	// This is a special table in MySQL that always returns a single row with a single column
	// See: https://dev.mysql.com/doc/refman/5.7/en/select.html#:~:text=You%20are%20permitted%20to%20specify%20DUAL%20as%20a%20dummy%20table%20name%20in%20situations%20where%20no%20tables%20are%20referenced
	for i, table := range tables {
		if table == "dual" {
			tables = append(tables[:i], tables[i+1:]...)
			break
		}
	}

	logger.Debug("tables found in sql", "tables", tables)

	return tables, nil
}

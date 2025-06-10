package sql

import (
	"fmt"
	"sort"
	"strings"

	"github.com/dolthub/vitess/go/vt/sqlparser"
	"github.com/grafana/grafana/pkg/infra/log"
)

var logger = log.New("sql_expr")

// TablesList returns a list of tables for the sql statement excluding
// CTEs and the 'dual' table. The list is sorted alphabetically.
func TablesList(rawSQL string) ([]string, error) {
	stmt, err := sqlparser.Parse(rawSQL)
	if err != nil {
		logger.Error("error parsing sql", "error", err.Error(), "sql", rawSQL)
		return nil, fmt.Errorf("error parsing sql: %s", err.Error())
	}

	tables := make(map[string]struct{})
	cteNames := make(map[string]struct{})

	walkSubtree := func(node sqlparser.SQLNode) error {
		err = sqlparser.Walk(func(node sqlparser.SQLNode) (kontinue bool, err error) {
			switch v := node.(type) {
			case *sqlparser.CommonTableExpr:
				// Track CTE name from the As field
				cteName := v.As.String()
				if cteName != "" {
					cteNames[strings.ToLower(cteName)] = struct{}{}
				}

			case *sqlparser.AliasedTableExpr:
				if tableName, ok := v.Expr.(sqlparser.TableName); ok {
					tables[tableName.Name.String()] = struct{}{}
				}
			case *sqlparser.TableName:
				tables[v.Name.String()] = struct{}{}
			}
			return true, nil
		}, node)

		if err != nil {
			logger.Error("error walking sql", "error", err, "node", node)
			return fmt.Errorf("failed to parse SQL expression: %w", err)
		}
		return nil
	}

	if err := walkSubtree(stmt); err != nil {
		return nil, err
	}

	result := make([]string, 0, len(tables))
	for table := range tables {
		// Remove 'dual' table if it exists
		// This is a special table in MySQL that always returns a single row with a single column
		// See: https://dev.mysql.com/doc/refman/5.7/en/select.html#:~:text=You%20are%20permitted%20to%20specify%20DUAL%20as%20a%20dummy%20table%20name%20in%20situations%20where%20no%20tables%20are%20referenced
		if table == "dual" {
			continue
		}

		// Skip CTEs
		if _, ok := cteNames[strings.ToLower(table)]; ok {
			continue
		}
		result = append(result, table)
	}

	sort.Strings(result)

	logger.Debug("tables found in sql", "tables", tables)

	return result, nil
}

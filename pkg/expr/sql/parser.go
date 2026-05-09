package sql

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/dolthub/vitess/go/vt/sqlparser"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// ExtractFunctionNames parses rawSQL and returns a deduplicated, sorted list of
// SQL function names (lower-cased) found in the query. It covers regular FuncExpr
// calls as well as the special AST node types that the parser creates for
// GROUP_CONCAT, EXTRACT, TIMESTAMPDIFF/TIMESTAMPADD, TRIM, and CHAR.
//
// Only function names are returned. No column names, literal values, or table
// names, so the result is safe to use in metrics labels.
func ExtractFunctionNames(rawSQL string) ([]string, error) {
	stmt, err := sqlparser.Parse(rawSQL)
	if err != nil {
		return nil, fmt.Errorf("error parsing sql: %s", err.Error())
	}

	seen := make(map[string]struct{})
	_ = sqlparser.Walk(func(node sqlparser.SQLNode) (bool, error) {
		switch v := node.(type) {
		case *sqlparser.FuncExpr:
			seen[strings.ToLower(v.Name.String())] = struct{}{}
		case *sqlparser.GroupConcatExpr:
			seen["group_concat"] = struct{}{}
		case *sqlparser.ExtractFuncExpr:
			// ExtractFuncExpr.Name is the token string, e.g. "EXTRACT" — normalise it.
			seen[strings.ToLower(v.Name)] = struct{}{}
		case *sqlparser.TimestampFuncExpr:
			if v.Name != "" {
				seen[strings.ToLower(v.Name)] = struct{}{}
			}
		case *sqlparser.TrimExpr:
			seen["trim"] = struct{}{}
		case *sqlparser.CharExpr:
			seen["char"] = struct{}{}
		case *sqlparser.ConvertExpr:
			// ConvertExpr.Name is the token string: "cast" or "convert".
			if v.Name != "" {
				seen[strings.ToLower(v.Name)] = struct{}{}
			}
		}
		return true, nil
	}, stmt)

	result := make([]string, 0, len(seen))
	for name := range seen {
		result = append(result, name)
	}
	sort.Strings(result)
	return result, nil
}

// TablesList returns a list of tables for the sql statement excluding
// CTEs and the 'dual' table. The list is sorted alphabetically.
func TablesList(ctx context.Context, rawSQL string) ([]string, error) {
	logger := backend.NewLoggerWith("logger", "expr.sql").FromContext(ctx)
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

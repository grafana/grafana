package sql

import (
	"errors"
	"strings"

	parser "github.com/krasun/gosqlparser"
	"github.com/xwb1989/sqlparser"
)

// TablesList returns a list of tables for the sql statement
// TODO: should we just return all query refs instead of trying to parse them from the sql?
func TablesList(rawSQL string) ([]string, error) {
	stmt, err := sqlparser.Parse(rawSQL)
	if err != nil {
		tables, err := parse(rawSQL)
		if err != nil {
			return parseTables(rawSQL)
		}
		return tables, nil
	}

	tables := []string{}
	switch kind := stmt.(type) {
	case *sqlparser.Select:
		for _, from := range kind.From {
			tables = append(tables, getTables(from)...)
		}
	default:
		return parseTables(rawSQL)
	}
	if len(tables) == 0 {
		return parseTables(rawSQL)
	}
	return validateTables(tables), nil
}

func validateTables(tables []string) []string {
	validTables := []string{}
	for _, table := range tables {
		if strings.ToUpper(table) != "DUAL" {
			validTables = append(validTables, table)
		}
	}
	return validTables
}

func joinTables(join *sqlparser.JoinTableExpr) []string {
	t := getTables(join.LeftExpr)
	t = append(t, getTables(join.RightExpr)...)
	return t
}

func getTables(te sqlparser.TableExpr) []string {
	tables := []string{}
	switch v := te.(type) {
	case *sqlparser.AliasedTableExpr:
		tables = append(tables, nodeValue(v.Expr))
		return tables
	case *sqlparser.JoinTableExpr:
		tables = append(tables, joinTables(v)...)
		return tables
	case *sqlparser.ParenTableExpr:
		for _, e := range v.Exprs {
			tables = getTables(e)
		}
	default:
		tables = append(tables, unknownExpr(te)...)
	}
	return tables
}

func unknownExpr(te sqlparser.TableExpr) []string {
	tables := []string{}
	fromClause := nodeValue(te)
	upperFromClause := strings.ToUpper(fromClause)
	if strings.Contains(upperFromClause, "JOIN") {
		return extractTablesFrom(fromClause)
	}
	if upperFromClause != "DUAL" && !strings.HasPrefix(fromClause, "(") {
		if strings.Contains(upperFromClause, " AS") {
			name := stripAlias(fromClause)
			tables = append(tables, name)
			return tables
		}
		tables = append(tables, fromClause)
	}
	return tables
}

func nodeValue(node sqlparser.SQLNode) string {
	buf := sqlparser.NewTrackedBuffer(nil)
	node.Format(buf)
	return buf.String()
}

func extractTablesFrom(stmt string) []string {
	// example: A join B on A.name = B.name
	tables := []string{}
	parts := strings.Split(stmt, " ")
	for _, part := range parts {
		part = strings.ToUpper(part)
		if isJoin(part) {
			continue
		}
		if strings.Contains(part, "ON") {
			break
		}
		if part != "" {
			if !existsInList(part, tables) {
				tables = append(tables, part)
			}
		}
	}
	return tables
}

func stripAlias(table string) string {
	tableParts := []string{}
	for _, part := range strings.Split(table, " ") {
		if strings.ToUpper(part) == "AS" {
			break
		}
		tableParts = append(tableParts, part)
	}
	return strings.Join(tableParts, " ")
}

// uses a simple tokenizer
func parse(rawSQL string) ([]string, error) {
	query, err := parser.Parse(rawSQL)
	if err != nil {
		return nil, err
	}
	if query.GetType() == parser.StatementSelect {
		sel, ok := query.(*parser.Select)
		if ok {
			return []string{sel.Table}, nil
		}
	}
	return nil, err
}

// parseTables uses a simple tokenizer to parse tables from a SQL statement
func parseTables(rawSQL string) ([]string, error) {
	checkSql := strings.ToUpper(rawSQL)
	rawSQL = strings.ReplaceAll(rawSQL, "\n", " ")
	rawSQL = strings.ReplaceAll(rawSQL, "\r", " ")
	if strings.HasPrefix(checkSql, "SELECT") || strings.HasPrefix(rawSQL, "WITH") {
		tables := []string{}
		tokens := strings.Split(rawSQL, " ")
		checkNext := false
		takeNext := false
		for _, token := range tokens {
			t := strings.ToUpper(token)
			t = strings.TrimSpace(t)

			if takeNext {
				if !existsInList(token, tables) {
					tables = append(tables, token)
				}
				checkNext = false
				takeNext = false
				continue
			}
			if checkNext {
				if strings.Contains(t, "(") {
					checkNext = false
					continue
				}
				if strings.Contains(t, ",") {
					values := strings.Split(token, ",")
					for _, v := range values {
						v := strings.TrimSpace(v)
						if v != "" {
							if !existsInList(token, tables) {
								tables = append(tables, v)
							}
						} else {
							takeNext = true
							break
						}
					}
					continue
				}
				if !existsInList(token, tables) {
					tables = append(tables, token)
				}
				checkNext = false
			}
			if t == "FROM" {
				checkNext = true
			}
		}
		return tables, nil
	}
	return nil, errors.New("not a select statement")
}

func existsInList(table string, list []string) bool {
	for _, t := range list {
		if t == table {
			return true
		}
	}
	return false
}

var joins = []string{"JOIN", "INNER", "LEFT", "RIGHT", "FULL", "OUTER"}

func isJoin(token string) bool {
	token = strings.ToUpper(token)
	for _, join := range joins {
		if token == join {
			return true
		}
	}
	return false
}

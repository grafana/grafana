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
			buf := sqlparser.NewTrackedBuffer(nil)
			from.Format(buf)
			fromClause := buf.String()
			upperFromClause := strings.ToUpper(fromClause)
			if strings.Contains(upperFromClause, "JOIN") {
				return extractTablesFrom(fromClause), nil
			}
			if upperFromClause != "DUAL" && !strings.HasPrefix(fromClause, "(") {
				if strings.Contains(upperFromClause, " AS") {
					name := stripAlias(fromClause)
					tables = append(tables, name)
					continue
				}
				tables = append(tables, fromClause)
			}
		}
	default:
		return parseTables(rawSQL)
	}
	if len(tables) == 0 {
		return parseTables(rawSQL)
	}
	return tables, nil
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

package sql

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/jeremywohl/flatten"
)

const (
	TABLE_NAME    = "table_name"
	ERROR         = ".error"
	ERROR_MESSAGE = ".error_message"
)

var logger = log.New("sql_expr")

// TablesList returns a list of tables for the sql statement
func TablesList(rawSQL string) ([]string, error) {
	db := NewInMemoryDB()
	rawSQL = strings.Replace(rawSQL, "'", "''", -1)
	cmd := fmt.Sprintf("SELECT json_serialize_sql('%s')", rawSQL)
	ret, err := db.RunCommands([]string{cmd})
	if err != nil {
		logger.Error("error serializing sql", "error", err.Error(), "sql", rawSQL, "cmd", cmd)
		return nil, fmt.Errorf("error serializing sql: %s", err.Error())
	}

	ast := []map[string]any{}
	err = json.Unmarshal([]byte(ret), &ast)
	if err != nil {
		logger.Error("error converting json sql to ast", "error", err.Error(), "ret", ret)
		return nil, fmt.Errorf("error converting json to ast: %s", err.Error())
	}

	return tablesFromAST(ast)
}

// tablesFromAST returns a list of tables from the ast
func tablesFromAST(ast []map[string]any) ([]string, error) {
	flat, err := flatten.Flatten(ast[0], "", flatten.DotStyle)
	if err != nil {
		logger.Error("error flattening ast", "error", err.Error(), "ast", ast)
		return nil, fmt.Errorf("error flattening ast: %s", err.Error())
	}

	tables := []string{}
	for k, v := range flat {
		if strings.HasSuffix(k, ERROR) {
			v, ok := v.(bool)
			if ok && v {
				logger.Error("error in sql", "error", k)
				return nil, astError(k, flat)
			}
		}
		if strings.Contains(k, TABLE_NAME) {
			table, ok := v.(string)
			if ok && !existsInList(table, tables) {
				tables = append(tables, v.(string))
			}
		}
	}
	sort.Strings(tables)

	logger.Debug("tables found in sql", "tables", tables)

	return tables, nil
}

func astError(k string, flat map[string]any) error {
	key := strings.Replace(k, ERROR, "", 1)
	message, ok := flat[key+ERROR_MESSAGE]
	if !ok {
		message = "unknown error in sql"
	}
	return fmt.Errorf("error in sql: %s", message)
}

func existsInList(table string, list []string) bool {
	for _, t := range list {
		if t == table {
			return true
		}
	}
	return false
}

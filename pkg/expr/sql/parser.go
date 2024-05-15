package sql

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/jeremywohl/flatten"
	"github.com/scottlepp/go-duck/duck"
)

const (
	TABLE_NAME    = "table_name"
	ERROR         = ".error"
	ERROR_MESSAGE = ".error_message"
)

// TablesList returns a list of tables for the sql statement
func TablesList(rawSQL string) ([]string, error) {
	duckDB := duck.NewInMemoryDB()
	rawSQL = strings.Replace(rawSQL, "'", "''", -1)
	cmd := fmt.Sprintf("SELECT json_serialize_sql('%s')", rawSQL)
	ret, err := duckDB.RunCommands([]string{cmd})
	if err != nil {
		return nil, fmt.Errorf("error serializing sql: %s", err.Error())
	}

	ast := []map[string]any{}
	err = json.Unmarshal([]byte(ret), &ast)
	if err != nil {
		return nil, fmt.Errorf("error converting json to ast: %s", err.Error())
	}

	return tablesFromAST(ast)
}

func tablesFromAST(ast []map[string]any) ([]string, error) {
	flat, err := flatten.Flatten(ast[0], "", flatten.DotStyle)
	if err != nil {
		return nil, fmt.Errorf("error flattening ast: %s", err.Error())
	}

	tables := []string{}
	for k, v := range flat {
		if strings.HasSuffix(k, ERROR) {
			v, ok := v.(bool)
			if ok && v {
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

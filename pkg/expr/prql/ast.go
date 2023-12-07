package prql

import (
	"os/exec"
	"strings"
)

func Tables(sql string) ([]string, error) {
	// TODO - couldn't find a good go ast lib
	data, err := exec.Command("node", "./prql-node/ast.js", sql).Output()
	if err != nil {
		return []string{""}, err
	}
	output := string(data)
	tables := strings.Split(output, ",")

	cleanTables := []string{}
	// the js lib returns tables like this
	// \n  'select::null::table_0'\n]\n
	for _, t := range tables {
		if strings.Contains(t, "table_") || strings.Contains(t, "label") || strings.Contains(t, "_meta") { // ignore alias tables the prql to sql generates
			continue
		}
		// strip junk
		table := strings.ReplaceAll(t, "[", "")
		table = strings.ReplaceAll(table, "]", "")
		table = strings.ReplaceAll(table, "select", "")
		table = strings.ReplaceAll(table, "null", "")
		table = strings.ReplaceAll(table, "::", "")
		table = strings.ReplaceAll(table, "\n", "")
		table = strings.ReplaceAll(table, "'", "")
		table = strings.TrimSpace(table)
		if len(table) > 0 {
			cleanTables = append(cleanTables, table)
		}
	}
	return cleanTables, nil
}

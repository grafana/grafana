package sql

import (
	"errors"

	"github.com/blastrain/vitess-sqlparser/sqlparser"
)

// TablesList returns a list of tables for the sql statement
func TablesList(rawSQL string) ([]string, error) {
	stmt, err := sqlparser.Parse(rawSQL)
	if err != nil {
		return nil, err
	}

	tables := []string{}
	switch kind := stmt.(type) {
	case *sqlparser.Select:
		for _, t := range kind.From {
			buf := sqlparser.NewTrackedBuffer(nil)
			t.Format(buf)
			tables = append(tables, buf.String())
		}
	default:
		return nil, errors.New("not a select statement")
	}
	return tables, nil
}

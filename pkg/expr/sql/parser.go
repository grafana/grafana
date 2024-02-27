package sql

import (
	"errors"

	parser "github.com/krasun/gosqlparser"
	"github.com/xwb1989/sqlparser"
)

// TablesList returns a list of tables for the sql statement
func TablesList(rawSQL string) ([]string, error) {
	stmt, err := sqlparser.Parse(rawSQL)
	if err != nil {
		return parse(rawSQL)
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

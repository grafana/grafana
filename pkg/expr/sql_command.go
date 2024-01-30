package expr

import (
	"errors"

	"vitess.io/vitess/go/vt/sqlparser"
)

// SQLCommand is an expression to run SQL over results
type SQLCommand struct {
	query       string
	varsToQuery []string
	timeRange   TimeRange
	refID       string
}

// NewPRQLCommand creates a new PRQLCMD.
func NewSQLCommand(refID, rawSQL string, tr TimeRange) (*SQLCommand, error) {
	stmt, err := sqlparser.Parse(rawSQL)
	if err != nil {
		return nil, err
	}

	tables := []string{}
	switch kind := stmt.(type) {
	case *sqlparser.Select:
		// _ = stmt
		selectStmt := kind

		for _, t := range selectStmt.From {
			buf := sqlparser.NewTrackedBuffer(nil)
			t.Format(buf)
			tables = append(tables, buf.String())
		}
	default:
		return nil, errors.New("Not a select statement")
	}

	return &SQLCommand{
		query:       rawSQL,
		varsToQuery: tables,
		timeRange:   tr,
		refID:       refID,
	}, nil
}

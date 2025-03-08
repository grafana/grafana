package sqltemplate

import (
	"errors"
	"strings"
)

// PostgreSQL is an implementation of Dialect for the PostgreSQL DMBS.
var PostgreSQL = postgresql{
	rowLockingClauseMap: rowLockingClauseAll,
	argPlaceholderFunc:  argFmtPositional,
	name:                "postgres",
}

var _ Dialect = PostgreSQL

// PostgreSQL-specific errors.
var (
	ErrPostgreSQLUnsupportedIdent = errors.New("identifiers in PostgreSQL cannot contain the character with code zero")
)

type postgresql struct {
	standardIdent
	rowLockingClauseMap
	argPlaceholderFunc
	name
}

func (p postgresql) Ident(s string) (string, error) {
	if strings.Contains(s, ".") {
		parts := strings.Split(s, ".")
		quoted := make([]string, len(parts))
		for i, part := range parts {
			q, err := p.standardIdent.Ident(part)
			if err != nil {
				return "", err
			}
			quoted[i] = q
		}
		return strings.Join(quoted, "."), nil
	}
	return p.standardIdent.Ident(s)
}

func (postgresql) CurrentEpoch() string {
	return "(EXTRACT(EPOCH FROM statement_timestamp()) * 1000000)::BIGINT"
}

// JsonExtract returns the SQL expression to extract a value from a JSON column in PostgreSQL.
// In PostgreSQL, we use the ->> operator to extract text values from JSON.
func (postgresql) JsonExtract(tableAlias string, column string, fieldKey string) string {
	columnRef := column
	if tableAlias != "" {
		columnRef = tableAlias + "." + column
	}
	// ->> operator in PostgreSQL already extracts as text
	return columnRef + "->>" + "'" + fieldKey + "'"
}

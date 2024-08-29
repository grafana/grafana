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
	// See:
	//	https://www.postgresql.org/docs/current/sql-syntax-lexical.html
	if strings.IndexByte(s, 0) != -1 {
		return "", ErrPostgreSQLUnsupportedIdent
	}

	return p.standardIdent.Ident(s)
}

func (postgresql) CurrentEpoch() string {
	return "EXTRACT(EPOCH FROM clock_timestamp()) * 1000000::BIGINT"
}

package sqltemplate

import (
	"errors"
	"fmt"
	"strings"
)

// PostgreSQL is an implementation of Dialect for the PostgreSQL DMBS.
var PostgreSQL = postgresql{}

var (
	ErrPostgreSQLUnsupportedIdent = errors.New("identifiers in PostgreSQL cannot contain the character with code zero")
)

type postgresql struct{}

func (p postgresql) DialectName() string {
	return "postgres"
}

func (p postgresql) ArgPlaceholder(argNum int) string {
	return fmt.Sprintf("$%d", argNum)
}

func (p postgresql) SelectFor(s ...string) (string, error) {
	return rowLockingClauseAll.SelectFor(s...)
}

func (p postgresql) Ident(s string) (string, error) {
	// See:
	//	https://www.postgresql.org/docs/current/sql-syntax-lexical.html
	if strings.IndexByte(s, 0) != -1 {
		return "", ErrPostgreSQLUnsupportedIdent
	}

	return standardIdent(s)
}

func (postgresql) CurrentEpoch() string {
	return "(EXTRACT(EPOCH FROM statement_timestamp()) * 1000000)::BIGINT"
}

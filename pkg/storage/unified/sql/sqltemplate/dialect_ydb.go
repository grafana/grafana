package sqltemplate

import (
	"fmt"
)

// YDB is an implementation of Dialect for the YDB DMBS.
var YDB = ydb{}

// var (
// 	ErrydbUnsupportedIdent = errors.New("identifiers in ydb cannot contain the character with code zero")
// )

type ydb struct{}

func (p ydb) DialectName() string {
	return "ydb"
}

func (p ydb) ArgPlaceholder(argNum int) string {
	return fmt.Sprintf("$%d", argNum)
}

func (p ydb) SelectFor(s ...string) (string, error) {
	return rowLockingClauseAll.SelectFor(s...)
}

func (p ydb) Ident(s string) (string, error) {
	return "`" + s + "`", nil
}

func (ydb) CurrentEpoch() string {
	return "(EXTRACT(EPOCH FROM statement_timestamp()) * 1000000)::BIGINT"
}

package sqltemplate

// SQLite is an implementation of Dialect for the SQLite DMBS.
var SQLite sqlite

var _ Dialect = SQLite

type sqlite struct {
	// See:
	//	https://www.sqlite.org/lang_keywords.html
	standardIdent
}

func (sqlite) SelectFor(s ...string) (string, error) {
	return rowLockingClauseAll(false).SelectFor(s...)
}

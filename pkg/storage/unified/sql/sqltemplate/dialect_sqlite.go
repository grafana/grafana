package sqltemplate

// SQLite is an implementation of Dialect for the SQLite DMBS.
var SQLite = sqlite{}

type sqlite struct{}

func (s sqlite) DialectName() string {
	return "sqlite"
}

func (s sqlite) Ident(i string) (string, error) {
	// See:
	//	https://www.sqlite.org/lang_keywords.html
	return standardIdent(i)
}

func (s sqlite) ArgPlaceholder(argNum int) string {
	return "?"
}

func (s sqlite) SelectFor(s2 ...string) (string, error) {
	return rowLockingClauseMap(nil).SelectFor(s2...)
}

func (sqlite) CurrentEpoch() string {
	// Alternative approaches like `unixepoch('subsecond') * 1000000` returns millisecond precision.
	return "CAST((julianday('now') - 2440587.5) * 86400000000.0 AS BIGINT)"
}

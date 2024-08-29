package sqltemplate

// SQLite is an implementation of Dialect for the SQLite DMBS.
var SQLite = sqlite{
	argPlaceholderFunc: argFmtSQL92,
	name:               "sqlite",
}

var _ Dialect = SQLite

type sqlite struct {
	// See:
	//	https://www.sqlite.org/lang_keywords.html
	standardIdent
	rowLockingClauseMap
	argPlaceholderFunc
	name
}

func (sqlite) CurrentEpoch() string {
	// Alternative approaches like `unixepoch('subsecond') * 1000000` returns millisecond precision.
	return "CAST((julianday('now') - 2440587.5) * 86400000000.0 AS INTEGER)"
}

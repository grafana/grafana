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

// CurrentEpoch returns the epoch time in microseconds (strftime('%s','now') * 1000000)
func (sqlite) CurrentEpoch() string {
	// Alternative approaches like `unixepoch('subsecond') * 1000000` returns millisecond precision.
	return "CAST((julianday('now') - 2440587.5) * 86400000000.0 AS BIGINT)"
}

// JsonExtract returns the SQL expression to extract a value from a JSON column in SQLite.
// SQLite supports JSON_EXTRACT from version 3.38.0 (2022).
func (sqlite) JsonExtract(tableAlias string, column string, fieldKey string) string {
	columnRef := column
	if tableAlias != "" {
		columnRef = tableAlias + "." + column
	}
	// Cast the extracted JSON value to TEXT
	return "CAST(json_extract(" + columnRef + ", '$." + fieldKey + "') AS TEXT)"
}

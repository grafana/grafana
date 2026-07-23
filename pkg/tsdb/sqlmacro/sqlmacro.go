// Package sqlmacro holds the shared Grafana SQL macro pattern and the trailing
// SQLCommenter tag handling used by the MySQL, PostgreSQL and Microsoft SQL
// Server datasources, so the three engines do not drift apart on either.
package sqlmacro

import (
	"regexp"
	"strings"
)

// Expr is the regular-expression source matching a complete Grafana macro call
// of the form $name(...). It is exported so every datasource expands macros with
// the exact same pattern.
const Expr = `\$([_a-zA-Z0-9]+)\(([^\)]*)\)`

// RegExp matches a complete Grafana macro call $name(...).
var RegExp = regexp.MustCompile(Expr)

// sqlCommenterRegExp validates a SQLCommenter attribution comment made of one or
// more key='value' pairs, e.g. /*application='grafana',source='bi'*/. Keys allow
// '%' for the URL-encoded serialization; values allow escaped quotes (\') and any
// other byte. The tag is forwarded to the database verbatim and never
// interpolated, so the value charset does not need to defend against macros -
// the caller has already ensured the comment contains no internal */.
var sqlCommenterRegExp = regexp.MustCompile(`^/\*\s*[a-zA-Z0-9%_.-]+='(?:\\.|[^'\\])*'(\s*,\s*[a-zA-Z0-9%_.-]+='(?:\\.|[^'\\])*')*\s*\*/$`)

// SplitTrailingSQLCommenter splits a trailing SQLCommenter attribution tag off
// the end of sql. It returns the query without the tag and the tag itself
// (including any trailing ';'), or the original query and an empty string when
// there is none. Callers re-append the tag verbatim after interpolation, so it
// reaches the database unchanged and no macro can complete across the comment
// boundary in either direction.
//
// lineCommentMarkers holds the engine's line-comment introducers ("--" for all
// three engines, plus "#" for MySQL). Only markers the engine actually treats
// as comments should be passed: "#" is ordinary syntax in T-SQL (#temp tables)
// and PostgreSQL (#> JSON operators), and checking it there would drop valid
// tags.
func SplitTrailingSQLCommenter(sql string, lineCommentMarkers ...string) (string, string) {
	trimmed := strings.TrimRight(sql, " \t\r\n")
	for strings.HasSuffix(trimmed, ";") {
		trimmed = strings.TrimRight(strings.TrimSuffix(trimmed, ";"), " \t\r\n")
	}
	if !strings.HasSuffix(trimmed, "*/") {
		return sql, ""
	}
	open := strings.LastIndex(trimmed, "/*")
	if open < 0 {
		return sql, ""
	}
	comment := trimmed[open:]
	if len(comment) < len("/**/") {
		return sql, ""
	}
	// The block comment must be self-contained: an internal */ means the database
	// would close the comment early, leaving executable text we must not move.
	if strings.Contains(comment[2:len(comment)-2], "*/") {
		return sql, ""
	}
	if !sqlCommenterRegExp.MatchString(comment) {
		return sql, ""
	}
	// A tag-shaped block inside a trailing line comment is not executable SQL and
	// must not be revived: if the text before the tag on its own line contains a
	// line-comment marker, leave the query untouched. This is conservative - a
	// marker inside a string literal on that line also prevents splitting, which
	// just falls back to the tag being stripped like any comment.
	lineStart := strings.LastIndexByte(trimmed[:open], '\n') + 1
	for _, marker := range lineCommentMarkers {
		if strings.Contains(trimmed[lineStart:open], marker) {
			return sql, ""
		}
	}
	return sql[:open], sql[open:]
}

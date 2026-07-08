// Package sqlmacro holds the shared Grafana SQL macro definitions used by the
// MySQL, PostgreSQL and Microsoft SQL Server datasources. Keeping the macro
// expression and the "does this text contain a macro" guard in one place stops
// the three datasources from drifting apart, and stops the guard that decides
// which SQL comments are safe to forward to the database from drifting away from
// the expression that actually expands macros.
package sqlmacro

import "regexp"

// Expr is the regular-expression source matching a complete Grafana macro call
// of the form $name(...). It is exported so every datasource expands macros with
// the exact same pattern the comment guard uses to detect them.
const Expr = `\$([_a-zA-Z0-9]+)\(([^\)]*)\)`

// RegExp matches a complete Grafana macro call $name(...).
var RegExp = regexp.MustCompile(Expr)

// macroTokenRegExp matches any Grafana macro token, including forms that are not
// (yet) a complete call:
//   - the parenthesis-less $__interval / $__interval_ms / $__unixEpoch* family,
//     which the datasource engines expand with a plain string replacement; and
//   - a paren-form macro that may be complete ($__timeFilter(col)) or only
//     partially present ($__timeFilter( ), e.g. when it sits inside a comment and
//     would otherwise complete across the comment boundary once the surrounding
//     SQL is interpolated.
//
// A bare $name with neither the $__ prefix nor a following '(' (for example a
// PostgreSQL $1 positional parameter) is intentionally not treated as a token.
var macroTokenRegExp = regexp.MustCompile(`\$(__[a-zA-Z0-9_]*|[_a-zA-Z0-9]+\s*\()`)

// ContainsMacro reports whether s contains a Grafana macro token. It is used to
// decide whether a SQL comment must be stripped before interpolation: a comment
// with no macro token is inert and safe to forward to the database (for example
// a SQLCommenter attribution tag), whereas any macro token - complete, partial,
// or the parenthesis-less $__interval family - must be removed so interpolation
// cannot smuggle a live macro, or an expression that completes across the
// comment boundary, into the executed query.
func ContainsMacro(s string) bool {
	return macroTokenRegExp.MatchString(s)
}

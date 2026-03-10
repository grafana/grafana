package prometheus

import "regexp"

var (
	// Matches [$__rate_interval], [$__interval], [$__range], [${__rate_interval}]
	builtinDurationVarRegex = regexp.MustCompile(`\[\$(?:\{__[a-zA-Z_]+\}|__[a-zA-Z_]+)\]`)
	// Matches [$interval], [${custom_interval}]
	userDurationVarRegex = regexp.MustCompile(`\[(\$(?:\{[^}]+\}|[a-zA-Z_][a-zA-Z0-9_]*))\]`)
	// Matches by(...) and without(...) clauses
	groupingClauseRegex = regexp.MustCompile(`\b(by|without)\s*\(([^)]*)\)`)
	// Matches any $var or ${var} reference
	varRefRegex     = regexp.MustCompile(`\$(?:\{[^}]+\}|[a-zA-Z_][a-zA-Z0-9_]*)`)
	defaultDuration = "[5m]"
)

// interpolateForParsing replaces Grafana template variables with parseable
// placeholders so the PromQL parser can extract metric names.
//
// Handles:
//   - Duration vars ([$__rate_interval], [$interval]) → [5m]
//   - Grouping vars (by($var)) → by(placeholder_label)
//   - Label vars ({ns=~"$namespace"}) → unchanged (already valid literals)
func interpolateForParsing(expr string) string {
	expr = builtinDurationVarRegex.ReplaceAllString(expr, defaultDuration)
	expr = userDurationVarRegex.ReplaceAllString(expr, defaultDuration)
	expr = groupingClauseRegex.ReplaceAllStringFunc(expr, replaceGroupingVars)
	return expr
}

// replaceGroupingVars substitutes $var references inside by()/without() with
// a valid label name. Returns unchanged if no variables are present.
func replaceGroupingVars(match string) string {
	parts := groupingClauseRegex.FindStringSubmatch(match)
	if len(parts) != 3 {
		return match
	}
	content := parts[2]
	if !varRefRegex.MatchString(content) {
		return match
	}
	keyword := parts[1]
	replaced := varRefRegex.ReplaceAllString(content, "placeholder_label")
	return keyword + "(" + replaced + ")"
}

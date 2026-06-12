package loki

import (
	"fmt"
	"regexp"
	"strings"
)

const (
	grafanaSQLHintParser     = "PARSER"
	grafanaSQLHintPattern    = "PATTERN"
	grafanaSQLHintRegexpExpr = "REGEXP_EXPR"
)

var logQLNamedCaptureRE = regexp.MustCompile(`\(\?P<[a-zA-Z_][a-zA-Z0-9_]*>`)

// parserHintsFromSchemaContext extracts parser-related hints from ColumnsRequest.SchemaContext.
func parserHintsFromSchemaContext(schemaContext map[string]string) map[string]string {
	if len(schemaContext) == 0 {
		return nil
	}
	out := make(map[string]string)
	for k, v := range schemaContext {
		key := strings.ToUpper(strings.TrimSpace(k))
		if isParserRelatedHintKey(key) && strings.TrimSpace(v) != "" {
			out[key] = strings.TrimSpace(v)
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func isParserRelatedHintKey(key string) bool {
	switch key {
	case grafanaSQLHintParser, grafanaSQLHintPattern, grafanaSQLHintRegexpExpr:
		return true
	default:
		return false
	}
}

// buildParserStage constructs the LogQL parser stage fragment from table hints.
// Returns "" when no parser hints are set.
func buildParserStage(hints map[string]string) (string, error) {
	parser := strings.ToLower(hintGet(hints, grafanaSQLHintParser))
	pattern := hintGet(hints, grafanaSQLHintPattern)
	regexpExpr := hintGet(hints, grafanaSQLHintRegexpExpr)

	if parser == "" {
		if pattern != "" {
			return "", fmt.Errorf("parser('pattern') hint required when pattern() is set")
		}
		if regexpExpr != "" {
			return "", fmt.Errorf("parser('regexp') hint required when regexp_expr() is set")
		}
		return "", nil
	}
	if pattern != "" && parser != "pattern" {
		return "", fmt.Errorf("pattern() requires parser('pattern'); got parser(%q)", parser)
	}
	if regexpExpr != "" && parser != "regexp" {
		return "", fmt.Errorf("regexp_expr() requires parser('regexp'); got parser(%q)", parser)
	}

	switch parser {
	case "json", "logfmt", "unpack":
		return parser, nil
	case "pattern":
		if pattern == "" {
			return "", fmt.Errorf("pattern() hint required when parser('pattern') is set")
		}
		return `pattern "` + escapeLogQLDoubleQuoted(pattern) + `"`, nil
	case "regexp":
		if regexpExpr == "" {
			return "", fmt.Errorf("regexp_expr() hint required when parser('regexp') is set")
		}
		if !logQLNamedCaptureRE.MatchString(regexpExpr) {
			return "", fmt.Errorf("regexp must contain at least one named sub-match (?P<name>...)")
		}
		return "regexp `" + escapeLogQLBacktick(regexpExpr) + "`", nil
	default:
		return "", fmt.Errorf("unsupported parser %q; use json, logfmt, unpack, pattern, or regexp", parser)
	}
}

func escapeLogQLDoubleQuoted(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for i := 0; i < len(s); i++ {
		switch c := s[i]; c {
		case '\\', '"':
			b.WriteByte('\\')
			b.WriteByte(c)
		default:
			b.WriteByte(c)
		}
	}
	return b.String()
}

func escapeLogQLBacktick(s string) string {
	return strings.ReplaceAll(s, "`", "\\`")
}

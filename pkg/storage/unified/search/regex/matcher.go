// Package regex validates unified search regexes independently of the search backend.
package regex

import (
	"errors"
	"fmt"
	"regexp"
	"regexp/syntax"
	"strings"
)

// Matcher describes a whole-value regex. Backends translate Expression's
// normalized operations and ranges rather than the original source spelling.
// CaseInsensitive applies only to the value, never a structural label prefix.
// Consumers must treat Expression as read-only.
type Matcher struct {
	Expression      *syntax.Regexp
	CaseInsensitive bool
}

// Parse validates the supported subset and removes redundant whole-value
// anchors. Case folding stays separate from the AST so backend adapters can apply
// it to the value without changing a flattened label's literal key.
func Parse(expression string) (Matcher, error) {
	caseInsensitive := strings.HasPrefix(expression, "(?i)")
	if caseInsensitive {
		expression = strings.TrimPrefix(expression, "(?i)")
	}
	parsed, err := syntax.Parse(expression, (syntax.Perl|syntax.DotNL)&^syntax.UnicodeGroups)
	// PerlX expands shorthand classes and quoted literals into the AST that each
	// backend translates, rather than forwarding engine-specific source syntax.
	// Disabling UnicodeGroups excludes property escapes; DotNL gives dot
	// Prometheus value semantics. Validation checks the resulting operations/flags.
	if err != nil {
		return Matcher{}, fmt.Errorf("invalid regular expression: %w", err)
	}
	if caseInsensitive {
		// Compare normalized expressions with the original leading mode in effect.
		// Parsing after stripping it otherwise loses case-disabling transitions.
		original, err := syntax.Parse(expression, (syntax.Perl|syntax.DotNL|syntax.FoldCase)&^syntax.UnicodeGroups)
		if err != nil {
			return Matcher{}, fmt.Errorf("invalid regular expression: %w", err)
		}
		folded, err := syntax.Parse(parsed.String(), (syntax.Perl|syntax.DotNL|syntax.FoldCase)&^syntax.UnicodeGroups)
		if err != nil {
			return Matcher{}, fmt.Errorf("invalid regular expression: %w", err)
		}
		if original.String() != folded.String() {
			return Matcher{}, errors.New("regular expression disables leading case folding")
		}
	}
	// Only top-level text anchors are redundant under whole-value matching.
	// Nested anchors remain in the AST and are rejected by validation below.
	parsed = trimWholeTermAnchors(parsed)
	if err := validateRegexNode(parsed); err != nil {
		return Matcher{}, err
	}
	return Matcher{Expression: parsed, CaseInsensitive: caseInsensitive}, nil
}

// SplitLabel separates a literal key from its regex value at the first "=".
// Keys containing "=" remain ambiguous in the existing flattened encoding.
func SplitLabel(expression string) (prefix, value string, err error) {
	key, value, found := strings.Cut(expression, "=")
	if !found || key == "" {
		return "", "", errors.New("flattened label regex requires a literal key=value expression")
	}
	return key + "=", value, nil
}

// MatchAll describes every value, including empty strings and newlines.
func MatchAll() Matcher {
	return Matcher{Expression: &syntax.Regexp{
		Op: syntax.OpStar, Sub: []*syntax.Regexp{{Op: syntax.OpAnyChar}},
	}}
}

// Compile provides whole-value execution for backends that enumerate terms.
// Native-query adapters can instead translate Expression and CaseInsensitive.
// The optional literal prefix is outside the value's case-folding scope.
func (m Matcher) Compile(prefix string) (*regexp.Regexp, error) {
	pattern := m.Expression.String()
	if m.CaseInsensitive {
		pattern = "(?i:" + pattern + ")"
	}
	compiled, err := regexp.Compile("^(?:" + regexp.QuoteMeta(prefix) + "(?:" + pattern + "))$")
	if err != nil {
		return nil, fmt.Errorf("invalid regular expression: %w", err)
	}
	return compiled, nil
}

// MatchesEmpty determines whether an absent field or label matches this value.
func (m Matcher) MatchesEmpty() (bool, error) {
	compiled, err := m.Compile("")
	if err != nil {
		return false, err
	}
	return compiled.MatchString(""), nil
}

func validateRegexNode(expression *syntax.Regexp) error {
	if expression.Flags&syntax.FoldCase != 0 {
		return errors.New("regular expression uses embedded case folding; use leading (?i) instead")
	}
	if expression.Op == syntax.OpCapture && expression.Name != "" {
		return errors.New("regular expression uses unsupported named capture")
	}
	if expression.Flags&syntax.NonGreedy != 0 {
		return errors.New("regular expression uses unsupported lazy quantifier")
	}
	switch expression.Op {
	case syntax.OpNoMatch, syntax.OpEmptyMatch, syntax.OpLiteral, syntax.OpCharClass, syntax.OpAnyChar, syntax.OpAnyCharNotNL,
		syntax.OpCapture, syntax.OpStar, syntax.OpPlus, syntax.OpQuest,
		syntax.OpRepeat, syntax.OpConcat, syntax.OpAlternate:
	default:
		return fmt.Errorf("regular expression uses unsupported syntax operation %s", expression.Op)
	}
	for _, child := range expression.Sub {
		if err := validateRegexNode(child); err != nil {
			return err
		}
	}
	return nil
}

// trimWholeTermAnchors removes only top-level text anchors, which are redundant
// because every term is matched in full. Line or nested anchors remain and are
// rejected by validateRegexNode.
func trimWholeTermAnchors(expression *syntax.Regexp) *syntax.Regexp {
	if expression.Op == syntax.OpBeginText || expression.Op == syntax.OpEndText {
		return &syntax.Regexp{Op: syntax.OpEmptyMatch}
	}
	if expression.Op != syntax.OpConcat {
		return expression
	}

	start := 0
	for start < len(expression.Sub) && expression.Sub[start].Op == syntax.OpBeginText {
		start++
	}
	end := len(expression.Sub)
	for end > start && expression.Sub[end-1].Op == syntax.OpEndText {
		end--
	}
	if start == 0 && end == len(expression.Sub) {
		return expression
	}
	expression.Sub = expression.Sub[start:end]
	switch len(expression.Sub) {
	case 0:
		return &syntax.Regexp{Op: syntax.OpEmptyMatch}
	case 1:
		return expression.Sub[0]
	default:
		return expression
	}
}

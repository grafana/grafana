// Package regex validates unified search regexes independently of the search backend.
package regex

import (
	"errors"
	"fmt"
	"regexp/syntax"
	"strings"
)

// Matcher describes whole-value matching using a validated parsed representation.
// Backends must translate its operations without changing their matching semantics.
type Matcher struct {
	// Expression is read-only; backend adapters must not mutate it.
	Expression *syntax.Regexp
	// CaseInsensitive enables whole-value case folding.
	CaseInsensitive bool
}

// Parse accepts the search regex subset and removes redundant outer anchors.
// Only one leading (?i) is allowed; other modes and special groups are rejected.
func Parse(expression string) (Matcher, error) {
	caseInsensitive := strings.HasPrefix(expression, "(?i)")
	if caseInsensitive {
		expression = strings.TrimPrefix(expression, "(?i)")
	}
	// Excluding PerlX rejects embedded modes before parsing can erase them.
	parsed, err := syntax.Parse(expression, syntax.ClassNL|syntax.OneLine|syntax.DotNL)
	if err != nil {
		return Matcher{}, fmt.Errorf("invalid regular expression: %w", err)
	}
	// Trim redundant outer text anchors for whole-value matching, nested anchors are rejected.
	parsed = trimWholeTermAnchors(parsed)
	if err := validateRegexNode(parsed); err != nil {
		return Matcher{}, err
	}
	return Matcher{Expression: parsed, CaseInsensitive: caseInsensitive}, nil
}

// MatchAll describes every value, including empty strings and newlines.
func MatchAll() Matcher {
	return Matcher{Expression: &syntax.Regexp{
		Op: syntax.OpStar, Sub: []*syntax.Regexp{{Op: syntax.OpAnyChar}},
	}}
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
	case syntax.OpStar, syntax.OpPlus, syntax.OpQuest, syntax.OpRepeat:
		// Without PerlX, lazy-looking quantifiers can change empty-value matching.
		switch expression.Sub[0].Op {
		case syntax.OpStar, syntax.OpPlus, syntax.OpQuest, syntax.OpRepeat:
			return errors.New("regular expression uses unsupported successive quantifiers")
		default:
		}
	case syntax.OpNoMatch, syntax.OpEmptyMatch, syntax.OpLiteral, syntax.OpCharClass, syntax.OpAnyChar, syntax.OpAnyCharNotNL,
		syntax.OpCapture, syntax.OpConcat, syntax.OpAlternate:
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

// trimWholeTermAnchors removes top-level text anchors, which are redundant
// because every term is matched in full. Nested anchors remain and are
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

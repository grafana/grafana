// Package regex validates unified search regexes independently of the search backend.
package regex

import (
	"errors"
	"fmt"
	"regexp"
	"regexp/syntax"
	"strings"
)

// Matcher is a whole-value regex with a read-only, normalized AST.
// Search engines should normalize expressions with Parse.
type Matcher struct {
	// Expression is a read-only regex expression with the normalized AST.
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
	if err := validateSource(expression); err != nil {
		return Matcher{}, err
	}
	// Perl parses greedy repetition and shorthand classes; DotNL includes newlines.
	parsed, err := syntax.Parse(expression, (syntax.Perl|syntax.DotNL)&^syntax.UnicodeGroups)
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

// Reject syntax that Go may simplify or treat as literals before validating the AST.
func validateSource(expression string) error {
	classStart := -1
	for i := 0; i < len(expression); i++ {
		c := expression[i]
		if c == '\\' {
			i++
			if i == len(expression) || !strings.ContainsRune("\\.*+?()|[]{}^$-nrtdDwW", rune(expression[i])) {
				return errors.New("regular expression uses an unsupported escape")
			}
			continue
		}
		if classStart >= 0 {
			if c == '[' && i+1 < len(expression) && expression[i+1] == ':' {
				return errors.New("regular expression uses an unsupported POSIX class")
			}
			if c == ']' && i > classStart {
				classStart = -1
			}
			continue
		}
		switch c {
		case '[':
			classStart = i + 1
			if classStart < len(expression) && expression[classStart] == '^' {
				classStart++
			}
		case '(':
			if i+1 < len(expression) && expression[i+1] == '?' {
				return errors.New("regular expression uses an unsupported group or flag")
			}
		case '{':
			repetition := boundedRepetition.FindString(expression[i:])
			if repetition == "" {
				return errors.New("regular expression uses an invalid bounded repetition")
			}
			i += len(repetition) - 1
		case '}':
			return errors.New("regular expression requires escaping literal braces")
		}
	}
	return nil
}

var boundedRepetition = regexp.MustCompile(`^\{(0|[1-9][0-9]*)(,(0|[1-9][0-9]*)?)?\}`)

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

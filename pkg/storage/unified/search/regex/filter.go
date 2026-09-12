package regex

import (
	"fmt"
	"regexp"
)

// Filter matches a field value or a flattened label such as "severity=critical".
// LabelPrefix is the literal "severity=" part (empty for ordinary fields);
// ValueMatcher applies only to "critical", including any case folding.
// MatchMissing is true when the value regex matches an absent field or label.
type Filter struct {
	ValueMatcher Matcher
	LabelPrefix  string
	MatchMissing bool
}

func ParseFilter(field, expression string, flattenedLabel bool) (Filter, error) {
	var prefix string
	var err error
	if flattenedLabel {
		prefix, expression, err = SplitLabel(expression)
		if err != nil {
			return Filter{}, err
		}
	}
	matcher, err := Parse(expression)
	if err != nil {
		return Filter{}, fmt.Errorf("invalid regex for field %s: %w", field, err)
	}
	// An absent label is evaluated as an empty value, not an empty encoded term.
	empty, err := matcher.MatchesEmpty()
	if err != nil {
		return Filter{}, fmt.Errorf("invalid regex for field %s: %w", field, err)
	}
	return Filter{ValueMatcher: matcher, LabelPrefix: prefix, MatchMissing: empty}, nil
}

// Existence matches any value for the same field or literal label key.
func (f Filter) Existence() Filter {
	return Filter{ValueMatcher: MatchAll(), LabelPrefix: f.LabelPrefix, MatchMissing: true}
}

// Compile returns whole-term execution and a safe dictionary scan prefix.
func (f Filter) Compile() (pattern *regexp.Regexp, prefix string, complete bool, err error) {
	pattern, err = f.ValueMatcher.Compile(f.LabelPrefix)
	if err != nil {
		return nil, "", false, err
	}
	prefix, complete = pattern.LiteralPrefix()
	// A folded value cannot narrow a case-sensitive dictionary scan.
	if f.ValueMatcher.CaseInsensitive {
		prefix, complete = f.LabelPrefix, false
	}
	return pattern, prefix, complete, nil
}

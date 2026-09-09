package search

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"regexp/syntax"
	"strings"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/mapping"
	blevesearch "github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/query"
	"github.com/blevesearch/bleve/v2/search/searcher"
	index "github.com/blevesearch/bleve_index_api"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const maxRegexTerms = 10000

// boundedRegexQuery expands a portable regexp against the field dictionary at
// search time. The query is intentionally not bleve's native regexp query:
// that query can enumerate an unbounded number of terms before the caller can
// enforce a limit.
type boundedRegexQuery struct {
	field         string
	pattern       *regexp.Regexp
	literalPrefix string
	complete      bool
}

func newBoundedRegexQuery(field, expression string) (*boundedRegexQuery, error) {
	normalized := stripOuterRegexAnchors(expression)
	if hasInlineRegexFlags(normalized) {
		return nil, errors.New("regular expression uses unsupported inline flags")
	}
	// Use the Perl/RE2-compatible grammar so the parser recognizes the same
	// escapes as Go's regexp engine; validatePortableRegex narrows it to the
	// backend-independent subset below.
	parsed, err := syntax.Parse(normalized, syntax.Perl)
	if err != nil {
		return nil, fmt.Errorf("invalid regular expression: %w", err)
	}
	if err := validatePortableRegex(parsed); err != nil {
		return nil, err
	}

	compiled, err := regexp.Compile(normalized)
	if err != nil {
		return nil, fmt.Errorf("invalid regular expression: %w", err)
	}
	// LiteralPrefix reports whether the whole expression is one literal. In
	// that case the dictionary need not be enumerated at all.
	prefix, complete := compiled.LiteralPrefix()
	if prefix == "" {
		return nil, errors.New("regular expression must have a literal prefix")
	}
	// The dictionary expansion is only a prefix-bounded prefilter. Anchor the
	// actual predicate so a regex matches the complete indexed keyword value.
	fullTerm, err := regexp.Compile("^(?:" + normalized + ")$")
	if err != nil {
		return nil, fmt.Errorf("invalid regular expression: %w", err)
	}

	return &boundedRegexQuery{
		field:         field,
		pattern:       fullTerm,
		literalPrefix: prefix,
		complete:      complete,
	}, nil
}

// Searcher implements query.Query. It expands only the dictionary terms under
// the literal prefix and refuses a query before constructing a disjunction that
// would exceed the fixed expansion budget.
func (q *boundedRegexQuery) Searcher(ctx context.Context, reader index.IndexReader, _ mapping.IndexMapping, options blevesearch.SearcherOptions) (blevesearch.Searcher, error) {
	if q.complete {
		return searcher.NewTermSearcher(ctx, reader, q.literalPrefix, q.field, 1, options)
	}

	terms, err := q.matchingTerms(ctx, reader)
	if err != nil {
		return nil, err
	}
	if len(terms) == 0 {
		return query.NewMatchNoneQuery().Searcher(ctx, reader, nil, options)
	}
	// The fixed regex expansion limit is enforced above. Do not apply Bleve's
	// optional clause limit as a second, backend-specific limit: it would make
	// an otherwise valid portable regex fail at a different threshold.
	return searcher.NewMultiTermSearcher(ctx, reader, terms, q.field, 1, options, false)
}

func (q *boundedRegexQuery) matchingTerms(ctx context.Context, reader index.IndexReader) (terms []string, err error) {
	dict, err := reader.FieldDictPrefix(q.field, []byte(q.literalPrefix))
	if err != nil {
		return nil, err
	}
	defer func() {
		if closeErr := dict.Close(); err == nil && closeErr != nil {
			err = closeErr
		}
	}()

	terms = make([]string, 0, maxRegexTerms)
	inspected := 0
	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		entry, nextErr := dict.Next()
		if nextErr != nil {
			return nil, nextErr
		}
		if entry == nil {
			break
		}

		inspected++
		if inspected > maxRegexTerms {
			return nil, &regexExpansionError{field: q.field}
		}
		if matchesEntireTerm(q.pattern, entry.Term) {
			terms = append(terms, entry.Term)
		}
	}
	blevesearch.RecordSearchCost(ctx, blevesearch.AddM, dict.BytesRead())
	return terms, nil
}

func matchesEntireTerm(pattern *regexp.Regexp, value string) bool {
	match := pattern.FindStringIndex(value)
	return match != nil && match[0] == 0 && match[1] == len(value)
}

// stripOuterRegexAnchors accepts anchors that are redundant because search
// terms are always matched in their entirety. Anchors elsewhere remain in the
// syntax tree and are rejected by validatePortableRegex.
func stripOuterRegexAnchors(expression string) string {
	if strings.HasPrefix(expression, "^") {
		expression = expression[1:]
	}
	if strings.HasSuffix(expression, "$") && !isEscaped(expression) {
		expression = expression[:len(expression)-1]
	}
	return expression
}

func isEscaped(value string) bool {
	index := len(value) - 1
	backslashes := 0
	for index > 0 && value[index-1] == '\\' {
		backslashes++
		index--
	}
	return backslashes%2 == 1
}

func hasInlineRegexFlags(expression string) bool {
	inClass := false
	for i := 0; i < len(expression); i++ {
		switch expression[i] {
		case '\\':
			i++
		case '[':
			inClass = true
		case ']':
			inClass = false
		case '(':
			if !inClass && i+2 < len(expression) && expression[i+1] == '?' {
				// These are mode flags (or '-' beginning flag removal); rejecting
				// them keeps the contract case-sensitive and portable.
				switch expression[i+2] {
				case 'i', 'm', 's', 'U', '-':
					return true
				}
			}
		}
	}
	return false
}

// validatePortableRegex rejects syntax the parser accepts but the portable
// contract does not: case-sensitive, whole-term RE2-style matching without
// inline flags, assertions, named captures, or lazy repetition. Constructs
// the parser cannot represent fail during Parse.
func validatePortableRegex(parsed *syntax.Regexp) error {
	const parserFlags = syntax.ClassNL | syntax.OneLine | syntax.PerlX | syntax.UnicodeGroups
	if parsed.Flags&^parserFlags != 0 {
		return errors.New("regular expression uses unsupported inline flags")
	}

	switch parsed.Op {
	case syntax.OpBeginLine, syntax.OpEndLine, syntax.OpBeginText, syntax.OpEndText,
		syntax.OpWordBoundary, syntax.OpNoWordBoundary:
		return errors.New("regular expression uses unsupported zero-width assertions")
	case syntax.OpCapture:
		if parsed.Name != "" {
			return errors.New("regular expression uses unsupported named capture")
		}
	case syntax.OpStar, syntax.OpPlus, syntax.OpQuest, syntax.OpRepeat:
		if parsed.Flags&syntax.NonGreedy != 0 {
			return errors.New("regular expression uses unsupported lazy quantifier")
		}
	}

	for _, child := range parsed.Sub {
		if err := validatePortableRegex(child); err != nil {
			return err
		}
	}
	return nil
}

type regexExpansionError struct {
	field string
}

func (e *regexExpansionError) Error() string {
	return fmt.Sprintf("regular expression on field %q exceeds the %d-term expansion limit", e.field, maxRegexTerms)
}

func (e *regexExpansionError) Status() metav1.Status {
	return metav1.Status{
		Status:  metav1.StatusFailure,
		Reason:  metav1.StatusReasonBadRequest,
		Message: e.Error(),
		Code:    http.StatusBadRequest,
	}
}

func regexErrorFromResult(result *bleve.SearchResult) error {
	if result == nil || result.Status == nil {
		return nil
	}
	var expansionErr *regexExpansionError
	for _, err := range result.Status.Errors {
		if errors.As(err, &expansionErr) {
			return err
		}
	}
	return nil
}

func (b *bleveIndex) regexRequirementQuery(req *resourcepb.Requirement, negate bool) (query.Query, *resourcepb.ErrorResult) {
	if len(req.Values) != 1 {
		return nil, resource.NewBadRequestError(fmt.Sprintf("operator %s on field %s takes exactly one value", req.Operator, req.Key))
	}

	kf, ok := b.regexKeywordFieldFor(req.Key)
	if !ok || !kf.filterable {
		return nil, resource.NewBadRequestError(fmt.Sprintf("field %s does not support regex filtering", req.Key))
	}
	if kf.lowered {
		return nil, resource.NewBadRequestError(fmt.Sprintf("field %s does not support case-sensitive regex filtering", req.Key))
	}

	regex, err := newBoundedRegexQuery(kf.name, req.Values[0])
	if err != nil {
		return nil, resource.NewBadRequestError(fmt.Sprintf("invalid regex for field %s: %v", req.Key, err))
	}
	if !negate {
		return regex, nil
	}

	boolQuery := bleve.NewBooleanQuery()
	boolQuery.AddMustNot(regex)
	boolQuery.AddMust(bleve.NewMatchAllQuery())
	return boolQuery, nil
}

func (b *bleveIndex) regexKeywordFieldFor(key string) (keywordField, bool) {
	if kf, ok := b.keywordFieldFor(key); ok {
		return kf, true
	}
	if b.labelsAreKeyword && strings.HasPrefix(key, labelFieldPrefix) {
		return keywordField{name: key, filterable: true}, true
	}
	return keywordField{}, false
}

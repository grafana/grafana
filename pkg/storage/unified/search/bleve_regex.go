package search

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"regexp/syntax"
	"strings"
	"unicode"

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

const (
	maxRegexDictionaryTerms = 10_000
	maxRegexExpandedTerms   = 10_000
)

// Request translation

func (b *bleveIndex) regexRequirementQuery(req *resourcepb.Requirement, negate bool) (query.Query, *resourcepb.ErrorResult) {
	if len(req.Values) != 1 {
		return nil, resource.NewBadRequestError(fmt.Sprintf("operator %s on field %s takes exactly one value", req.Operator, req.Key))
	}

	kf, ok := b.regexKeywordFieldFor(req.Key)
	if !ok || !kf.filterable {
		return nil, resource.NewBadRequestError(fmt.Sprintf("field %s does not support regex filtering", req.Key))
	}
	if kf.lowered {
		return nil, resource.NewBadRequestError(fmt.Sprintf("field %s does not support regex filtering because it does not preserve original case", req.Key))
	}

	matcher, err := normalizeRegex(req.Values[0])
	if err != nil {
		return nil, resource.NewBadRequestError(fmt.Sprintf("invalid regex for field %s: %v", req.Key, err))
	}
	regex, err := newBoundedRegexQueryFromMatcher(kf.name, matcher)
	if err != nil {
		return nil, resource.NewBadRequestError(fmt.Sprintf("invalid regex for field %s: %v", req.Key, err))
	}

	// Prometheus evaluates an absent label as the empty string. For flattened
	// label fields, apply that rule to the value expression and use the label
	// key/value prefix to determine whether that label exists. Other fields use the
	// field-level existence query because their regex matches the whole value.
	matchesEmpty := regex.pattern.MatchString("")
	var exists query.Query
	if valueMatchesEmpty, labelExists, ok, err := flattenedLabelRegexSemantics(kf.name, matcher, regex.pattern); err != nil {
		return nil, resource.NewBadRequestError(fmt.Sprintf("invalid regex for field %s: %v", req.Key, err))
	} else if ok {
		matchesEmpty = valueMatchesEmpty
		exists = labelExists
	}
	if matchesEmpty {
		if exists == nil {
			existsMatcher, err := normalizeRegex("(?s).*")
			if err != nil {
				return nil, resource.NewBadRequestError(fmt.Sprintf("invalid regex for field %s: %v", req.Key, err))
			}
			exists, err = newBoundedRegexQueryFromMatcher(kf.name, existsMatcher)
			if err != nil {
				return nil, resource.NewBadRequestError(fmt.Sprintf("invalid regex for field %s: %v", req.Key, err))
			}
		}
		if !negate {
			missing := bleve.NewBooleanQuery()
			missing.AddMust(bleve.NewMatchAllQuery())
			missing.AddMustNot(exists)
			return bleve.NewDisjunctionQuery(regex, missing), nil
		}

		boolQuery := bleve.NewBooleanQuery()
		boolQuery.AddMust(exists)
		boolQuery.AddMustNot(regex)
		return boolQuery, nil
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

// Missing-value and flattened-label semantics

func flattenedLabelRegexSemantics(field string, matcher regexMatcher, pattern *regexp.Regexp) (valueMatchesEmpty bool, exists query.Query, ok bool, err error) {
	if field != resource.SEARCH_FIELD_PREFIX+resource.SEARCH_FIELD_LABELS {
		return false, nil, false, nil
	}

	// This structural prefix is used only to recognize a flattened key=value
	// expression. It is intentionally compiled without matcher modes and is not
	// used to prune the dictionary.
	structural, err := regexp.Compile("^(?:" + matcher.expression.String() + ")$")
	if err != nil {
		return false, nil, true, err
	}
	prefix, _ := structural.LiteralPrefix()
	separator := strings.IndexByte(prefix, '=')
	if separator <= 0 {
		return false, nil, false, nil
	}

	labelPrefix := prefix[:separator+1]
	existsMatcher := regexMatcher{
		expression: &syntax.Regexp{
			Op: syntax.OpConcat,
			Sub: []*syntax.Regexp{
				{Op: syntax.OpLiteral, Rune: []rune(labelPrefix)},
				{Op: syntax.OpStar, Sub: []*syntax.Regexp{{Op: syntax.OpAnyChar}}},
			},
		},
		caseInsensitive: matcher.caseInsensitive,
		dotMatchesNL:    true,
	}
	existsQuery, err := newBoundedRegexQueryFromMatcher(field, existsMatcher)
	if err != nil {
		return false, nil, true, err
	}
	return pattern.MatchString(labelPrefix), existsQuery, true, nil
}

// Portable regex normalization

// regexMatcher is the backend-neutral representation of one whole-value
// matcher. The expression is normalized by regexp/syntax; the mode booleans
// describe behavior that an alternate adapter may need to express separately.
type regexMatcher struct {
	expression      *syntax.Regexp
	caseInsensitive bool
	dotMatchesNL    bool
}

// normalizeRegex parses the RE2-compatible input, removes redundant top-level
// whole-term anchors, and lifts uniform case and dot-newline modes out of the
// AST. Lifting modes gives backend adapters a syntax-independent representation.
// Mixed modes are rejected because applying one global mode would change the
// language. Lazy quantifiers are made greedy because match preference does not
// affect whole-term boolean matching.
func normalizeRegex(expression string) (regexMatcher, error) {
	// syntax.Perl enables Go/RE2's Perl-style classes, escapes, and inline modes.
	// It does not enable unsupported PCRE features such as look-around or
	// backreferences. DotNL is intentionally omitted; callers request it with (?s).
	parsed, err := syntax.Parse(expression, syntax.Perl)
	if err != nil {
		return regexMatcher{}, fmt.Errorf("invalid regular expression: %w", err)
	}
	// Remove only top-level text anchors, which are redundant because every term
	// is matched in full. Line or nested anchors remain and are rejected below.
	parsed = trimWholeTermAnchors(parsed)

	caseInsensitive, dotMatchesNL, err := normalizePortableRegex(parsed)
	if err != nil {
		return regexMatcher{}, err
	}

	matcher := regexMatcher{
		expression:      parsed,
		caseInsensitive: caseInsensitive,
		dotMatchesNL:    dotMatchesNL,
	}
	return matcher, nil
}

// trimWholeTermAnchors removes only top-level text anchors, which are redundant
// because every term is matched in full. Line or nested anchors remain and are
// rejected by normalizeRegexNode.
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

type regexMode struct {
	seen  bool
	value bool
}

func normalizePortableRegex(expression *syntax.Regexp) (caseInsensitive, dotMatchesNL bool, err error) {
	var caseMode, dotMode regexMode
	if err := normalizeRegexNode(expression, &caseMode, &dotMode); err != nil {
		return false, false, err
	}
	return caseMode.value, dotMode.value, nil
}

func normalizeRegexNode(expression *syntax.Regexp, caseMode, dotMode *regexMode) error {
	switch expression.Op {
	case syntax.OpNoMatch:
		return errors.New("regular expression uses unsupported syntax")
	case syntax.OpBeginLine, syntax.OpEndLine, syntax.OpBeginText, syntax.OpEndText,
		syntax.OpWordBoundary, syntax.OpNoWordBoundary:
		return errors.New("regular expression uses unsupported zero-width assertions")
	case syntax.OpCapture:
		if expression.Name != "" {
			return errors.New("regular expression uses unsupported named capture")
		}
	case syntax.OpLiteral, syntax.OpCharClass:
		if regexAtomHasCaseVariants(expression) {
			if err := setRegexMode(caseMode, expression.Flags&syntax.FoldCase != 0, "case"); err != nil {
				return err
			}
		}
	case syntax.OpAnyChar:
		if err := setRegexMode(dotMode, true, "dot-newline"); err != nil {
			return err
		}
	case syntax.OpAnyCharNotNL:
		if err := setRegexMode(dotMode, false, "dot-newline"); err != nil {
			return err
		}
	case syntax.OpEmptyMatch, syntax.OpStar, syntax.OpPlus, syntax.OpQuest,
		syntax.OpRepeat, syntax.OpConcat, syntax.OpAlternate:
		// These operations are supported; their children are checked below.
	default:
		return fmt.Errorf("regular expression uses unsupported syntax operation %s", expression.Op)
	}

	// The AST walk records each node's case and dot-newline behavior in caseMode
	// and dotMode; clear the per-node flags before String serializes the AST so
	// compileRegexMatcher can apply one uniform mode around the whole matcher.
	// Non-greedy matching is also irrelevant for whole-term boolean matching.
	expression.Flags &^= syntax.FoldCase | syntax.NonGreedy
	for _, child := range expression.Sub {
		if err := normalizeRegexNode(child, caseMode, dotMode); err != nil {
			return err
		}
	}
	return nil
}

func regexAtomHasCaseVariants(expression *syntax.Regexp) bool {
	switch expression.Op {
	case syntax.OpLiteral:
		for _, r := range expression.Rune {
			if unicode.SimpleFold(r) != r {
				return true
			}
		}
		return false
	case syntax.OpCharClass:
		return regexCharClassHasCaseVariants(expression.Rune)
	default:
		return false
	}
}

func regexCharClassHasCaseVariants(runes []rune) bool {
	for i := 0; i+1 < len(runes); i += 2 {
		classStart := uint32(runes[i])
		classEnd := uint32(runes[i+1])
		for _, caseRange := range unicode.CaseRanges {
			if caseRange.Lo <= classEnd && classStart <= caseRange.Hi {
				return true
			}
		}
	}
	return false
}

func setRegexMode(mode *regexMode, value bool, name string) error {
	if mode.seen && mode.value != value {
		return fmt.Errorf("regular expression uses mixed %s behavior", name)
	}
	mode.seen = true
	mode.value = value
	return nil
}

func compileRegexMatcher(matcher regexMatcher) (*regexp.Regexp, error) {
	pattern := matcher.expression.String()
	flags := ""
	if matcher.caseInsensitive {
		flags += "i"
	}
	if matcher.dotMatchesNL {
		flags += "s"
	}
	if flags != "" {
		pattern = "(?" + flags + ":" + pattern + ")"
	}
	compiled, err := regexp.Compile("^(?:" + pattern + ")$")
	if err != nil {
		return nil, fmt.Errorf("invalid regular expression: %w", err)
	}
	return compiled, nil
}

// Bounded Bleve execution

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

func newBoundedRegexQueryFromMatcher(field string, matcher regexMatcher) (*boundedRegexQuery, error) {
	compiled, err := compileRegexMatcher(matcher)
	if err != nil {
		return nil, err
	}
	// LiteralPrefix is only safe for case-sensitive expressions. A prefix from a
	// case-insensitive expression would omit differently-cased dictionary terms.
	prefix, complete := compiled.LiteralPrefix()
	if matcher.caseInsensitive {
		prefix = ""
		complete = false
	}

	return &boundedRegexQuery{
		field:         field,
		pattern:       compiled,
		literalPrefix: prefix,
		complete:      complete,
	}, nil
}

// Searcher implements query.Query. It expands only the dictionary terms under
// the literal prefix and refuses a query before constructing a disjunction that
// would exceed the fixed expansion budget.
func (q *boundedRegexQuery) Searcher(ctx context.Context, reader index.IndexReader, _ mapping.IndexMapping, options blevesearch.SearcherOptions) (blevesearch.Searcher, error) {
	if q.complete && q.literalPrefix != "" {
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
	var dict index.FieldDict
	if q.literalPrefix == "" {
		dict, err = reader.FieldDict(q.field)
	} else {
		dict, err = reader.FieldDictPrefix(q.field, []byte(q.literalPrefix))
	}
	if err != nil {
		return nil, err
	}
	defer func() {
		bytesRead := dict.BytesRead()
		// Bleve's IO callback contributes to SearchResult.Cost, while
		// RecordSearchCost feeds unified search's incremental QueryCost accounting.
		// Dictionary reads must be reported through both paths.
		if callback, ok := ctx.Value(blevesearch.SearchIOStatsCallbackKey).(blevesearch.SearchIOStatsCallbackFunc); ok {
			callback(bytesRead)
		}
		blevesearch.RecordSearchCost(ctx, blevesearch.AddM, bytesRead)
		if closeErr := dict.Close(); err == nil && closeErr != nil {
			err = closeErr
		}
	}()

	terms = make([]string, 0, 16)
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
		if q.pattern.MatchString(entry.Term) {
			terms = append(terms, entry.Term)
			if len(terms) > maxRegexExpandedTerms {
				return nil, &regexLimitError{field: q.field, kind: regexExpansionLimit}
			}
		}
		if inspected > maxRegexDictionaryTerms {
			return nil, &regexLimitError{field: q.field, kind: regexDictionaryLimit}
		}
	}
	return terms, nil
}

// Runtime error propagation

type regexLimitKind uint8

const (
	regexExpansionLimit regexLimitKind = iota
	regexDictionaryLimit
)

type regexLimitError struct {
	field string
	kind  regexLimitKind
}

func (e *regexLimitError) Error() string {
	if e.kind == regexDictionaryLimit {
		return fmt.Sprintf("regular expression on field %q exceeds the %d-term dictionary scan limit", e.field, maxRegexDictionaryTerms)
	}
	return fmt.Sprintf("regular expression on field %q exceeds the %d-term expansion limit", e.field, maxRegexExpandedTerms)
}

func (e *regexLimitError) Status() metav1.Status {
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
	var limitErr *regexLimitError
	for _, err := range result.Status.Errors {
		if errors.As(err, &limitErr) {
			return err
		}
	}
	return nil
}

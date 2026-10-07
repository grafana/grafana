package search

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/mapping"
	blevesearch "github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/query"
	"github.com/blevesearch/bleve/v2/search/searcher"
	index "github.com/blevesearch/bleve_index_api"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/regex"
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

	filter, err := parseRegexFilter(req.Key, req.Values[0], kf.name == resource.SEARCH_FIELD_PREFIX+resource.SEARCH_FIELD_LABELS)
	if err != nil {
		return nil, resource.NewBadRequestError(err.Error())
	}
	regexQuery, err := newBoundedRegexQuery(kf.name, filter)
	if err != nil {
		return nil, resource.NewBadRequestError(fmt.Sprintf("invalid regex for field %s: %v", req.Key, err))
	}

	if filter.MatchMissing {
		exists, err := newBoundedRegexQuery(kf.name, filter.Existence())
		if err != nil {
			return nil, resource.NewBadRequestError(fmt.Sprintf("invalid regex for field %s: %v", req.Key, err))
		}
		if !negate {
			missing := bleve.NewBooleanQuery()
			missing.AddMust(bleve.NewMatchAllQuery())
			missing.AddMustNot(exists)
			return bleve.NewDisjunctionQuery(regexQuery, missing), nil
		}

		boolQuery := bleve.NewBooleanQuery()
		boolQuery.AddMust(exists)
		boolQuery.AddMustNot(regexQuery)
		return boolQuery, nil
	}

	if !negate {
		return regexQuery, nil
	}

	boolQuery := bleve.NewBooleanQuery()
	boolQuery.AddMustNot(regexQuery)
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

// Label and value semantics

// regexFilter combines a value regex with an optional literal label prefix.
// For "severity=crit.*", LabelPrefix is "severity=" and ValueMatcher is "crit.*".
// MatchMissing includes absent fields or labels by evaluating their value as empty.
type regexFilter struct {
	ValueMatcher regex.Matcher
	LabelPrefix  string
	MatchMissing bool
}

func parseRegexFilter(field, expression string, flattenedLabel bool) (regexFilter, error) {
	var prefix string
	var err error
	if flattenedLabel {
		prefix, expression, err = splitLabel(expression)
		if err != nil {
			return regexFilter{}, err
		}
	}
	matcher, err := regex.Parse(expression)
	if err != nil {
		return regexFilter{}, fmt.Errorf("invalid regex for field %s: %w", field, err)
	}
	// An absent label is evaluated as an empty value, not an empty encoded term.
	valuePattern, err := compileRegex(matcher, "")
	if err != nil {
		return regexFilter{}, fmt.Errorf("invalid regex for field %s: %w", field, err)
	}
	return regexFilter{ValueMatcher: matcher, LabelPrefix: prefix, MatchMissing: valuePattern.MatchString("")}, nil
}

// Existence matches any value for the same field or literal label key.
func (f regexFilter) Existence() regexFilter {
	return regexFilter{ValueMatcher: regex.MatchAll(), LabelPrefix: f.LabelPrefix, MatchMissing: true}
}

// Compile returns a whole-term regex and a safe scan prefix; complete marks an exact term.
func (f regexFilter) Compile() (pattern *regexp.Regexp, prefix string, complete bool, err error) {
	pattern, err = compileRegex(f.ValueMatcher, f.LabelPrefix)
	if err != nil {
		return nil, "", false, err
	}
	prefix, complete = pattern.LiteralPrefix()
	// Only the literal label prefix is safe for case-insensitive values.
	if f.ValueMatcher.CaseInsensitive {
		prefix, complete = f.LabelPrefix, false
	}
	return pattern, prefix, complete, nil
}

// Keys containing "=" remain ambiguous in the existing flattened encoding.
func splitLabel(expression string) (prefix, value string, err error) {
	key, value, found := strings.Cut(expression, "=")
	if !found || key == "" {
		return "", "", errors.New("flattened label regex requires a literal key=value expression")
	}
	return key + "=", value, nil
}

// Quote the label key and group the value so alternation cannot escape its prefix.
func compileRegex(m regex.Matcher, prefix string) (*regexp.Regexp, error) {
	pattern := m.Expression.String()
	if m.CaseInsensitive {
		pattern = "(?i:" + pattern + ")"
	}
	return regexp.Compile("^" + regexp.QuoteMeta(prefix) + "(?:" + pattern + ")$")
}

// Bounded Bleve execution

// boundedRegexQuery enforces scan and expansion limits during dictionary access;
// Bleve's native regexp query does not expose those limits.
type boundedRegexQuery struct {
	field         string
	pattern       *regexp.Regexp
	literalPrefix string
	complete      bool
}

func newBoundedRegexQuery(field string, filter regexFilter) (*boundedRegexQuery, error) {
	compiled, prefix, complete, err := filter.Compile()
	if err != nil {
		return nil, err
	}

	return &boundedRegexQuery{
		field:         field,
		pattern:       compiled,
		literalPrefix: prefix,
		complete:      complete,
	}, nil
}

// Searcher uses a term lookup for nonempty literals and bounded expansion otherwise.
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
	// clause limit as a second, backend-specific limit.
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
		// Report reads to both SearchResult.Cost and incremental QueryCost accounting.
		if callback, ok := ctx.Value(blevesearch.SearchIOStatsCallbackKey).(blevesearch.SearchIOStatsCallbackFunc); ok {
			callback(bytesRead)
		}
		blevesearch.RecordSearchCost(ctx, blevesearch.AddM, bytesRead)
		if closeErr := dict.Close(); err == nil && closeErr != nil {
			err = closeErr
		}
	}()

	terms = make([]string, 0, 16)
	budget := regexExpansionBudget{Field: q.field}
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

		matched := q.pattern.MatchString(entry.Term)
		if matched {
			terms = append(terms, entry.Term)
		}
		if err := budget.Observe(matched); err != nil {
			return nil, err
		}
	}
	return terms, nil
}

const (
	maxRegexDictionaryTerms = 10_000
	maxRegexExpandedTerms   = 10_000
)

// regexExpansionBudget bounds one dictionary enumeration. Value and existence queries
// each get their own budget, as do shards and authorization windows.
type regexExpansionBudget struct {
	Field     string
	inspected int
	expanded  int
}

// Observe charges a dictionary term and, when matched, its expansion. Expansion
// errors take precedence when the same term exceeds both limits.
func (b *regexExpansionBudget) Observe(matched bool) error {
	b.inspected++
	if matched {
		b.expanded++
		if b.expanded > maxRegexExpandedTerms {
			return &regexLimitError{Field: b.Field, Kind: regexExpansionLimit}
		}
	}
	if b.inspected > maxRegexDictionaryTerms {
		return &regexLimitError{Field: b.Field, Kind: regexDictionaryLimit}
	}
	return nil
}

// Runtime error propagation

func regexSearchError(result *bleve.SearchResult, err error) error {
	var limitErr *regexLimitError
	if errors.As(err, &limitErr) {
		return apierrors.NewBadRequest(limitErr.Error())
	}
	if err != nil || result == nil || result.Status == nil {
		return err
	}
	for _, err := range result.Status.Errors {
		if errors.As(err, &limitErr) {
			return apierrors.NewBadRequest(limitErr.Error())
		}
	}
	return nil
}

type regexLimitKind uint8

const (
	regexExpansionLimit regexLimitKind = iota
	regexDictionaryLimit
)

type regexLimitError struct {
	Field string
	Kind  regexLimitKind
}

func (e *regexLimitError) Error() string {
	if e.Kind == regexDictionaryLimit {
		return fmt.Sprintf("regular expression on field %q exceeds the %d-term dictionary scan limit", e.Field, maxRegexDictionaryTerms)
	}
	return fmt.Sprintf("regular expression on field %q exceeds the %d-term expansion limit", e.Field, maxRegexExpandedTerms)
}

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

	filter, err := regex.ParseFilter(req.Key, req.Values[0], kf.name == resource.SEARCH_FIELD_PREFIX+resource.SEARCH_FIELD_LABELS)
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

func newBoundedRegexQuery(field string, filter regex.Filter) (*boundedRegexQuery, error) {
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
	budget := regex.ExpansionBudget{Field: q.field}
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

// Runtime error propagation

func regexSearchError(result *bleve.SearchResult, err error) error {
	var limitErr *regex.LimitError
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

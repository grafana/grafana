package searchV2

import (
	"fmt"

	"github.com/blugelabs/bluge"
	"github.com/blugelabs/bluge/search"
	"github.com/blugelabs/bluge/search/searcher"
	"github.com/blugelabs/bluge/search/similarity"
)

type PermissionFilter struct {
	field string
	who   string
	what  string
}

var (
	_ bluge.Query = (*PermissionFilter)(nil)
)

// who and what are part of the query request
// TODO: this shoudl take whatever structure we can easily check
func newPermissionFilter(who string, what string) *PermissionFilter {
	return &PermissionFilter{
		who:  who,
		what: what,
	}
}

// Location returns the location being queried
func (q *PermissionFilter) Who() string {
	return q.who
}

func (q *PermissionFilter) SetField(f string) *PermissionFilter {
	q.field = f
	return q
}

func (q *PermissionFilter) Field() string {
	return q.field
}

func (q *PermissionFilter) Searcher(i search.Reader, options search.SearcherOptions) (search.Searcher, error) {
	field := q.field
	if q.field == "" {
		field = options.DefaultSearchField
	}

	fmt.Printf("open reader: %s\n", field)
	dvReader, err := i.DocumentValueReader([]string{field})
	if err != nil {
		return nil, err
	}

	s, err := searcher.NewMatchAllSearcher(i, 1, similarity.ConstantScorer(1), options)
	return searcher.NewFilteringSearcher(s, func(d *search.DocumentMatch) bool {
		var rule string
		err := dvReader.VisitDocumentValues(d.Number, func(field string, term []byte) {
			rule = string(term)
		})
		if err != nil {
			return false
		}
		fmt.Printf("TODO check permissions: [%d] %s|%s // %s\n", d.Number, q.who, q.what, rule)
		return true
	}), err
}

func (q *PermissionFilter) Validate() error {
	if q.field == "" {
		return fmt.Errorf("missing field")
	}
	if q.who == "" {
		return fmt.Errorf("missing who")
	}
	return nil
}

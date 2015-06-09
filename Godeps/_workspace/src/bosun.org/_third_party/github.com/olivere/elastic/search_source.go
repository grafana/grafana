// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
)

// SearchSource enables users to build the search source.
// It resembles the SearchSourceBuilder in Elasticsearch.
type SearchSource struct {
	query                    Query
	postFilter               Filter
	from                     int
	size                     int
	explain                  *bool
	version                  *bool
	sorts                    []SortInfo
	sorters                  []Sorter
	trackScores              bool
	minScore                 *float64
	timeout                  string
	fieldNames               []string
	fieldDataFields          []string
	scriptFields             []*ScriptField
	partialFields            []*PartialField
	fetchSourceContext       *FetchSourceContext
	facets                   map[string]Facet
	aggregations             map[string]Aggregation
	highlight                *Highlight
	globalSuggestText        string
	suggesters               []Suggester
	rescores                 []*Rescore
	defaultRescoreWindowSize *int
	indexBoosts              map[string]float64
	stats                    []string
}

func NewSearchSource() *SearchSource {
	return &SearchSource{
		from:            -1,
		size:            -1,
		trackScores:     false,
		sorts:           make([]SortInfo, 0),
		sorters:         make([]Sorter, 0),
		fieldDataFields: make([]string, 0),
		scriptFields:    make([]*ScriptField, 0),
		partialFields:   make([]*PartialField, 0),
		facets:          make(map[string]Facet),
		aggregations:    make(map[string]Aggregation),
		rescores:        make([]*Rescore, 0),
		indexBoosts:     make(map[string]float64),
		stats:           make([]string, 0),
	}
}

// Query sets the query to use with this search source.
func (s *SearchSource) Query(query Query) *SearchSource {
	s.query = query
	return s
}

// PostFilter is executed as the last filter. It only affects the
// search hits but not facets.
func (s *SearchSource) PostFilter(postFilter Filter) *SearchSource {
	s.postFilter = postFilter
	return s
}

func (s *SearchSource) From(from int) *SearchSource {
	s.from = from
	return s
}

func (s *SearchSource) Size(size int) *SearchSource {
	s.size = size
	return s
}

func (s *SearchSource) MinScore(minScore float64) *SearchSource {
	s.minScore = &minScore
	return s
}

func (s *SearchSource) Explain(explain bool) *SearchSource {
	s.explain = &explain
	return s
}

func (s *SearchSource) Version(version bool) *SearchSource {
	s.version = &version
	return s
}

func (s *SearchSource) Timeout(timeout string) *SearchSource {
	s.timeout = timeout
	return s
}

func (s *SearchSource) TimeoutInMillis(timeoutInMillis int) *SearchSource {
	s.timeout = fmt.Sprintf("%dms", timeoutInMillis)
	return s
}

func (s *SearchSource) Sort(field string, ascending bool) *SearchSource {
	s.sorts = append(s.sorts, SortInfo{Field: field, Ascending: ascending})
	return s
}

func (s *SearchSource) SortWithInfo(info SortInfo) *SearchSource {
	s.sorts = append(s.sorts, info)
	return s
}

func (s *SearchSource) SortBy(sorter ...Sorter) *SearchSource {
	s.sorters = append(s.sorters, sorter...)
	return s
}

func (s *SearchSource) TrackScores(trackScores bool) *SearchSource {
	s.trackScores = trackScores
	return s
}

func (s *SearchSource) Facet(name string, facet Facet) *SearchSource {
	s.facets[name] = facet
	return s
}

func (s *SearchSource) Aggregation(name string, aggregation Aggregation) *SearchSource {
	s.aggregations[name] = aggregation
	return s
}

func (s *SearchSource) DefaultRescoreWindowSize(defaultRescoreWindowSize int) *SearchSource {
	s.defaultRescoreWindowSize = &defaultRescoreWindowSize
	return s
}

func (s *SearchSource) Highlight(highlight *Highlight) *SearchSource {
	s.highlight = highlight
	return s
}

func (s *SearchSource) Highlighter() *Highlight {
	if s.highlight == nil {
		s.highlight = NewHighlight()
	}
	return s.highlight
}

func (s *SearchSource) GlobalSuggestText(text string) *SearchSource {
	s.globalSuggestText = text
	return s
}

func (s *SearchSource) Suggester(suggester Suggester) *SearchSource {
	s.suggesters = append(s.suggesters, suggester)
	return s
}

func (s *SearchSource) AddRescore(rescore *Rescore) *SearchSource {
	s.rescores = append(s.rescores, rescore)
	return s
}

func (s *SearchSource) ClearRescores() *SearchSource {
	s.rescores = make([]*Rescore, 0)
	return s
}

func (s *SearchSource) FetchSource(fetchSource bool) *SearchSource {
	if s.fetchSourceContext == nil {
		s.fetchSourceContext = NewFetchSourceContext(fetchSource)
	} else {
		s.fetchSourceContext.SetFetchSource(fetchSource)
	}
	return s
}

func (s *SearchSource) FetchSourceContext(fetchSourceContext *FetchSourceContext) *SearchSource {
	s.fetchSourceContext = fetchSourceContext
	return s
}

func (s *SearchSource) Fields(fieldNames ...string) *SearchSource {
	if s.fieldNames == nil {
		s.fieldNames = make([]string, 0)
	}
	s.fieldNames = append(s.fieldNames, fieldNames...)
	return s
}

func (s *SearchSource) Field(fieldName string) *SearchSource {
	if s.fieldNames == nil {
		s.fieldNames = make([]string, 0)
	}
	s.fieldNames = append(s.fieldNames, fieldName)
	return s
}

func (s *SearchSource) NoFields() *SearchSource {
	s.fieldNames = make([]string, 0)
	return s
}

func (s *SearchSource) FieldDataFields(fieldDataFields ...string) *SearchSource {
	s.fieldDataFields = append(s.fieldDataFields, fieldDataFields...)
	return s
}

func (s *SearchSource) FieldDataField(fieldDataField string) *SearchSource {
	s.fieldDataFields = append(s.fieldDataFields, fieldDataField)
	return s
}

func (s *SearchSource) ScriptFields(scriptFields ...*ScriptField) *SearchSource {
	s.scriptFields = append(s.scriptFields, scriptFields...)
	return s
}

func (s *SearchSource) ScriptField(scriptField *ScriptField) *SearchSource {
	s.scriptFields = append(s.scriptFields, scriptField)
	return s
}

func (s *SearchSource) PartialFields(partialFields ...*PartialField) *SearchSource {
	s.partialFields = append(s.partialFields, partialFields...)
	return s
}

func (s *SearchSource) PartialField(partialField *PartialField) *SearchSource {
	s.partialFields = append(s.partialFields, partialField)
	return s
}

func (s *SearchSource) IndexBoost(index string, boost float64) *SearchSource {
	s.indexBoosts[index] = boost
	return s
}

func (s *SearchSource) Stats(statsGroup ...string) *SearchSource {
	s.stats = append(s.stats, statsGroup...)
	return s
}

func (s *SearchSource) Source() interface{} {
	source := make(map[string]interface{})

	if s.from != -1 {
		source["from"] = s.from
	}
	if s.size != -1 {
		source["size"] = s.size
	}
	if s.timeout != "" {
		source["timeout"] = s.timeout
	}
	if s.query != nil {
		source["query"] = s.query.Source()
	}
	if s.postFilter != nil {
		source["post_filter"] = s.postFilter.Source()
	}
	if s.minScore != nil {
		source["min_score"] = *s.minScore
	}
	if s.version != nil {
		source["version"] = *s.version
	}
	if s.explain != nil {
		source["explain"] = *s.explain
	}
	if s.fetchSourceContext != nil {
		source["_source"] = s.fetchSourceContext.Source()
	}

	if s.fieldNames != nil {
		switch len(s.fieldNames) {
		case 1:
			source["fields"] = s.fieldNames[0]
		default:
			source["fields"] = s.fieldNames
		}
	}

	if len(s.fieldDataFields) > 0 {
		source["fielddata_fields"] = s.fieldDataFields
	}

	if len(s.partialFields) > 0 {
		pfmap := make(map[string]interface{})
		for _, partialField := range s.partialFields {
			pfmap[partialField.Name] = partialField.Source()
		}
		source["partial_fields"] = pfmap
	}

	if len(s.scriptFields) > 0 {
		sfmap := make(map[string]interface{})
		for _, scriptField := range s.scriptFields {
			sfmap[scriptField.FieldName] = scriptField.Source()
		}
		source["script_fields"] = sfmap
	}

	if len(s.sorters) > 0 {
		sortarr := make([]interface{}, 0)
		for _, sorter := range s.sorters {
			sortarr = append(sortarr, sorter.Source())
		}
		source["sort"] = sortarr
	} else if len(s.sorts) > 0 {
		sortarr := make([]interface{}, 0)
		for _, sort := range s.sorts {
			sortarr = append(sortarr, sort.Source())
		}
		source["sort"] = sortarr
	}

	if s.trackScores {
		source["track_scores"] = s.trackScores
	}

	if len(s.indexBoosts) > 0 {
		source["indices_boost"] = s.indexBoosts
	}

	if len(s.facets) > 0 {
		facetsMap := make(map[string]interface{})
		for field, facet := range s.facets {
			facetsMap[field] = facet.Source()
		}
		source["facets"] = facetsMap
	}

	if len(s.aggregations) > 0 {
		aggsMap := make(map[string]interface{})
		for name, aggregate := range s.aggregations {
			aggsMap[name] = aggregate.Source()
		}
		source["aggregations"] = aggsMap
	}

	if s.highlight != nil {
		source["highlight"] = s.highlight.Source()
	}

	if len(s.suggesters) > 0 {
		suggesters := make(map[string]interface{})
		for _, s := range s.suggesters {
			suggesters[s.Name()] = s.Source(false)
		}
		if s.globalSuggestText != "" {
			suggesters["text"] = s.globalSuggestText
		}
		source["suggest"] = suggesters
	}

	if len(s.rescores) > 0 {
		// Strip empty rescores from request
		rescores := make([]*Rescore, 0)
		for _, r := range s.rescores {
			if !r.IsEmpty() {
				rescores = append(rescores, r)
			}
		}

		if len(rescores) == 1 {
			rescores[0].defaultRescoreWindowSize = s.defaultRescoreWindowSize
			source["rescore"] = rescores[0].Source()
		} else {
			slice := make([]interface{}, 0)
			for _, r := range rescores {
				r.defaultRescoreWindowSize = s.defaultRescoreWindowSize
				slice = append(slice, r.Source())
			}
			source["rescore"] = slice
		}
	}

	if len(s.stats) > 0 {
		source["stats"] = s.stats
	}

	return source
}

// -- Script Field --

type ScriptField struct {
	FieldName string

	script string
	lang   string
	params map[string]interface{}
}

func NewScriptField(fieldName, script, lang string, params map[string]interface{}) *ScriptField {
	return &ScriptField{fieldName, script, lang, params}
}

func (f *ScriptField) Source() interface{} {
	source := make(map[string]interface{})
	source["script"] = f.script
	if f.lang != "" {
		source["lang"] = f.lang
	}
	if f.params != nil && len(f.params) > 0 {
		source["params"] = f.params
	}
	return source
}

// -- Partial Field --

type PartialField struct {
	Name     string
	includes []string
	excludes []string
}

func NewPartialField(name string, includes, excludes []string) *PartialField {
	return &PartialField{name, includes, excludes}
}

func (f *PartialField) Source() interface{} {
	source := make(map[string]interface{})

	if f.includes != nil {
		switch len(f.includes) {
		case 0:
		case 1:
			source["include"] = f.includes[0]
		default:
			source["include"] = f.includes
		}
	}

	if f.excludes != nil {
		switch len(f.excludes) {
		case 0:
		case 1:
			source["exclude"] = f.excludes[0]
		default:
			source["exclude"] = f.excludes
		}
	}

	return source
}

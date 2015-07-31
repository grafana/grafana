// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// InnerHit implements a simple join for parent/child, nested, and even
// top-level documents in Elasticsearch.
// It is an experimental feature for Elasticsearch versions 1.5 (or greater).
// See http://www.elastic.co/guide/en/elasticsearch/reference/1.5/search-request-inner-hits.html
// for documentation.
//
// See the tests for SearchSource, HasChildFilter, HasChildQuery,
// HasParentFilter, HasParentQuery, NestedFilter, and NestedQuery
// for usage examples.
type InnerHit struct {
	source *SearchSource
	path   string
	typ    string

	name string
}

// NewInnerHit creates a new InnerHit.
func NewInnerHit() *InnerHit {
	return &InnerHit{source: NewSearchSource()}
}

func (hit *InnerHit) Path(path string) *InnerHit {
	hit.path = path
	return hit
}

func (hit *InnerHit) Type(typ string) *InnerHit {
	hit.typ = typ
	return hit
}

func (hit *InnerHit) Query(query Query) *InnerHit {
	hit.source.Query(query)
	return hit
}

func (hit *InnerHit) From(from int) *InnerHit {
	hit.source.From(from)
	return hit
}

func (hit *InnerHit) Size(size int) *InnerHit {
	hit.source.Size(size)
	return hit
}

func (hit *InnerHit) TrackScores(trackScores bool) *InnerHit {
	hit.source.TrackScores(trackScores)
	return hit
}

func (hit *InnerHit) Explain(explain bool) *InnerHit {
	hit.source.Explain(explain)
	return hit
}

func (hit *InnerHit) Version(version bool) *InnerHit {
	hit.source.Version(version)
	return hit
}

func (hit *InnerHit) Field(fieldName string) *InnerHit {
	hit.source.Field(fieldName)
	return hit
}

func (hit *InnerHit) Fields(fieldNames ...string) *InnerHit {
	hit.source.Fields(fieldNames...)
	return hit
}

func (hit *InnerHit) NoFields() *InnerHit {
	hit.source.NoFields()
	return hit
}

func (hit *InnerHit) FetchSource(fetchSource bool) *InnerHit {
	hit.source.FetchSource(fetchSource)
	return hit
}

func (hit *InnerHit) FetchSourceContext(fetchSourceContext *FetchSourceContext) *InnerHit {
	hit.source.FetchSourceContext(fetchSourceContext)
	return hit
}

func (hit *InnerHit) FieldDataFields(fieldDataFields ...string) *InnerHit {
	hit.source.FieldDataFields(fieldDataFields...)
	return hit
}

func (hit *InnerHit) FieldDataField(fieldDataField string) *InnerHit {
	hit.source.FieldDataField(fieldDataField)
	return hit
}

func (hit *InnerHit) ScriptFields(scriptFields ...*ScriptField) *InnerHit {
	hit.source.ScriptFields(scriptFields...)
	return hit
}

func (hit *InnerHit) ScriptField(scriptField *ScriptField) *InnerHit {
	hit.source.ScriptField(scriptField)
	return hit
}

func (hit *InnerHit) Sort(field string, ascending bool) *InnerHit {
	hit.source.Sort(field, ascending)
	return hit
}

func (hit *InnerHit) SortWithInfo(info SortInfo) *InnerHit {
	hit.source.SortWithInfo(info)
	return hit
}

func (hit *InnerHit) SortBy(sorter ...Sorter) *InnerHit {
	hit.source.SortBy(sorter...)
	return hit
}

func (hit *InnerHit) Highlight(highlight *Highlight) *InnerHit {
	hit.source.Highlight(highlight)
	return hit
}

func (hit *InnerHit) Highlighter() *Highlight {
	return hit.source.Highlighter()
}

func (hit *InnerHit) Name(name string) *InnerHit {
	hit.name = name
	return hit
}

func (hit *InnerHit) Source() interface{} {
	source, ok := hit.source.Source().(map[string]interface{})
	if !ok {
		return nil
	}

	// Notice that hit.typ and hit.path are not exported here.
	// They are only used with SearchSource and serialized there.

	if hit.name != "" {
		source["name"] = hit.name
	}
	return source
}

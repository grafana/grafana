// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// The terms_stats facet combines both the terms and statistical allowing
// to compute stats computed on a field, per term value driven
// by another field.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-facets-terms-stats-facet.html
type TermsStatsFacet struct {
	facetFilter    Filter
	global         *bool
	nested         string
	mode           string
	keyField       string
	valueField     string
	size           int
	shardSize      int
	comparatorType string
	script         string
	lang           string
	params         map[string]interface{}
}

func NewTermsStatsFacet() TermsStatsFacet {
	return TermsStatsFacet{
		size:      -1,
		shardSize: -1,
		params:    make(map[string]interface{}),
	}
}

func (f TermsStatsFacet) FacetFilter(filter Facet) TermsStatsFacet {
	f.facetFilter = filter
	return f
}

func (f TermsStatsFacet) Global(global bool) TermsStatsFacet {
	f.global = &global
	return f
}

func (f TermsStatsFacet) Nested(nested string) TermsStatsFacet {
	f.nested = nested
	return f
}

func (f TermsStatsFacet) Mode(mode string) TermsStatsFacet {
	f.mode = mode
	return f
}

func (f TermsStatsFacet) KeyField(keyField string) TermsStatsFacet {
	f.keyField = keyField
	return f
}

func (f TermsStatsFacet) ValueField(valueField string) TermsStatsFacet {
	f.valueField = valueField
	return f
}

func (f TermsStatsFacet) Order(comparatorType string) TermsStatsFacet {
	f.comparatorType = comparatorType
	return f
}

func (f TermsStatsFacet) Size(size int) TermsStatsFacet {
	f.size = size
	return f
}

func (f TermsStatsFacet) ShardSize(shardSize int) TermsStatsFacet {
	f.shardSize = shardSize
	return f
}

func (f TermsStatsFacet) AllTerms() TermsStatsFacet {
	f.size = 0
	return f
}

func (f TermsStatsFacet) ValueScript(script string) TermsStatsFacet {
	f.script = script
	return f
}

func (f TermsStatsFacet) Param(name string, value interface{}) TermsStatsFacet {
	f.params[name] = value
	return f
}

func (f TermsStatsFacet) addFilterFacetAndGlobal(source map[string]interface{}) {
	if f.facetFilter != nil {
		source["facet_filter"] = f.facetFilter.Source()
	}
	if f.nested != "" {
		source["nested"] = f.nested
	}
	if f.global != nil {
		source["global"] = *f.global
	}
	if f.mode != "" {
		source["mode"] = f.mode
	}
}

func (f TermsStatsFacet) Source() interface{} {
	source := make(map[string]interface{})
	f.addFilterFacetAndGlobal(source)
	opts := make(map[string]interface{})
	source["terms_stats"] = opts

	opts["key_field"] = f.keyField
	if f.valueField != "" {
		opts["value_field"] = f.valueField
	}

	if f.script != "" {
		opts["value_script"] = f.script
		if f.lang != "" {
			opts["lang"] = f.lang
		}
		if len(f.params) > 0 {
			opts["params"] = f.params
		}
	}

	if f.comparatorType != "" {
		opts["order"] = f.comparatorType
	}

	if f.size != -1 {
		opts["size"] = f.size
	}
	if f.shardSize > f.size {
		opts["shard_size"] = f.shardSize
	}

	return source
}

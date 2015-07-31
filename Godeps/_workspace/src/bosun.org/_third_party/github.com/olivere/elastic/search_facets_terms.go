// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Allow to specify field facets that return the N most frequent terms.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-facets-terms-facet.html
type TermsFacet struct {
	facetFilter Filter
	global      *bool
	nested      string
	mode        string

	fieldName      string
	fields         []string
	size           int
	shardSize      *int
	allTerms       *bool
	exclude        []string
	regex          string
	regexFlags     string
	comparatorType string
	script         string
	lang           string
	params         map[string]interface{}
	executionHint  string
	index          string
}

func NewTermsFacet() TermsFacet {
	f := TermsFacet{
		size:    10,
		fields:  make([]string, 0),
		exclude: make([]string, 0),
		params:  make(map[string]interface{}),
	}
	return f
}

func (f TermsFacet) FacetFilter(filter Facet) TermsFacet {
	f.facetFilter = filter
	return f
}

func (f TermsFacet) Global(global bool) TermsFacet {
	f.global = &global
	return f
}

func (f TermsFacet) Nested(nested string) TermsFacet {
	f.nested = nested
	return f
}

func (f TermsFacet) Mode(mode string) TermsFacet {
	f.mode = mode
	return f
}

func (f TermsFacet) Field(fieldName string) TermsFacet {
	f.fieldName = fieldName
	return f
}

func (f TermsFacet) Fields(fields ...string) TermsFacet {
	f.fields = append(f.fields, fields...)
	return f
}

func (f TermsFacet) ScriptField(scriptField string) TermsFacet {
	f.script = scriptField
	return f
}

func (f TermsFacet) Exclude(exclude ...string) TermsFacet {
	f.exclude = append(f.exclude, exclude...)
	return f
}

func (f TermsFacet) Size(size int) TermsFacet {
	f.size = size
	return f
}

func (f TermsFacet) ShardSize(shardSize int) TermsFacet {
	f.shardSize = &shardSize
	return f
}

func (f TermsFacet) Regex(regex string) TermsFacet {
	f.regex = regex
	return f
}

func (f TermsFacet) RegexFlags(regexFlags string) TermsFacet {
	f.regexFlags = regexFlags
	return f
}

func (f TermsFacet) Order(order string) TermsFacet {
	f.comparatorType = order
	return f
}

func (f TermsFacet) Comparator(comparatorType string) TermsFacet {
	f.comparatorType = comparatorType
	return f
}

func (f TermsFacet) Script(script string) TermsFacet {
	f.script = script
	return f
}

func (f TermsFacet) Lang(lang string) TermsFacet {
	f.lang = lang
	return f
}

func (f TermsFacet) ExecutionHint(hint string) TermsFacet {
	f.executionHint = hint
	return f
}

func (f TermsFacet) Param(name string, value interface{}) TermsFacet {
	f.params[name] = value
	return f
}

func (f TermsFacet) AllTerms(allTerms bool) TermsFacet {
	f.allTerms = &allTerms
	return f
}

func (f TermsFacet) Index(index string) TermsFacet {
	f.index = index
	return f
}

func (f TermsFacet) addFilterFacetAndGlobal(source map[string]interface{}) {
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

func (f TermsFacet) Source() interface{} {
	source := make(map[string]interface{})
	f.addFilterFacetAndGlobal(source)
	opts := make(map[string]interface{})
	source["terms"] = opts

	if len(f.fields) > 0 {
		if len(f.fields) == 1 {
			opts["field"] = f.fields[0]
		} else {
			opts["fields"] = f.fields
		}
	} else {
		opts["field"] = f.fieldName
	}
	opts["size"] = f.size
	if f.shardSize != nil && *f.shardSize > f.size {
		opts["shard_size"] = *f.shardSize
	}
	if len(f.exclude) > 0 {
		opts["exclude"] = f.exclude
	}
	if f.regex != "" {
		opts["regex"] = f.regex
		if f.regexFlags != "" {
			opts["regex_flags"] = f.regexFlags
		}
	}
	if f.comparatorType != "" {
		opts["order"] = f.comparatorType
	}
	if f.allTerms != nil {
		opts["all_terms"] = *f.allTerms
	}
	if f.script != "" {
		opts["script"] = f.script
		if f.lang != "" {
			opts["lang"] = f.lang
		}
		if len(f.params) > 0 {
			opts["params"] = f.params
		}
	}
	if f.executionHint != "" {
		opts["execution_hint"] = f.executionHint
	}
	return source
}

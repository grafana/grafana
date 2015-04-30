// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Highlight allows highlighting search results on one or more fields.
// For details, see:
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-highlighting.html
type Highlight struct {
	fields                []*HighlighterField
	tagsSchema            *string
	highlightFilter       *bool
	fragmentSize          *int
	numOfFragments        *int
	preTags               []string
	postTags              []string
	order                 *string
	encoder               *string
	requireFieldMatch     *bool
	boundaryMaxScan       *int
	boundaryChars         []rune
	highlighterType       *string
	fragmenter            *string
	highlightQuery        Query
	noMatchSize           *int
	phraseLimit           *int
	options               map[string]interface{}
	forceSource           *bool
	useExplicitFieldOrder bool
}

func NewHighlight() *Highlight {
	hl := &Highlight{
		fields:        make([]*HighlighterField, 0),
		preTags:       make([]string, 0),
		postTags:      make([]string, 0),
		boundaryChars: make([]rune, 0),
		options:       make(map[string]interface{}),
	}
	return hl
}

func (hl *Highlight) Fields(fields ...*HighlighterField) *Highlight {
	hl.fields = append(hl.fields, fields...)
	return hl
}

func (hl *Highlight) Field(name string) *Highlight {
	field := NewHighlighterField(name)
	hl.fields = append(hl.fields, field)
	return hl
}

func (hl *Highlight) TagsSchema(schemaName string) *Highlight {
	hl.tagsSchema = &schemaName
	return hl
}

func (hl *Highlight) HighlightFilter(highlightFilter bool) *Highlight {
	hl.highlightFilter = &highlightFilter
	return hl
}

func (hl *Highlight) FragmentSize(fragmentSize int) *Highlight {
	hl.fragmentSize = &fragmentSize
	return hl
}

func (hl *Highlight) NumOfFragments(numOfFragments int) *Highlight {
	hl.numOfFragments = &numOfFragments
	return hl
}

func (hl *Highlight) Encoder(encoder string) *Highlight {
	hl.encoder = &encoder
	return hl
}

func (hl *Highlight) PreTags(preTags ...string) *Highlight {
	hl.preTags = make([]string, 0)
	hl.preTags = append(hl.preTags, preTags...)
	return hl
}

func (hl *Highlight) PostTags(postTags ...string) *Highlight {
	hl.postTags = make([]string, 0)
	hl.postTags = append(hl.postTags, postTags...)
	return hl
}

func (hl *Highlight) Order(order string) *Highlight {
	hl.order = &order
	return hl
}

func (hl *Highlight) RequireFieldMatch(requireFieldMatch bool) *Highlight {
	hl.requireFieldMatch = &requireFieldMatch
	return hl
}

func (hl *Highlight) BoundaryMaxScan(boundaryMaxScan int) *Highlight {
	hl.boundaryMaxScan = &boundaryMaxScan
	return hl
}

func (hl *Highlight) BoundaryChars(boundaryChars ...rune) *Highlight {
	hl.boundaryChars = make([]rune, 0)
	hl.boundaryChars = append(hl.boundaryChars, boundaryChars...)
	return hl
}

func (hl *Highlight) HighlighterType(highlighterType string) *Highlight {
	hl.highlighterType = &highlighterType
	return hl
}

func (hl *Highlight) Fragmenter(fragmenter string) *Highlight {
	hl.fragmenter = &fragmenter
	return hl
}

func (hl *Highlight) HighlighQuery(highlightQuery Query) *Highlight {
	hl.highlightQuery = highlightQuery
	return hl
}

func (hl *Highlight) NoMatchSize(noMatchSize int) *Highlight {
	hl.noMatchSize = &noMatchSize
	return hl
}

func (hl *Highlight) Options(options map[string]interface{}) *Highlight {
	hl.options = options
	return hl
}

func (hl *Highlight) ForceSource(forceSource bool) *Highlight {
	hl.forceSource = &forceSource
	return hl
}

func (hl *Highlight) UseExplicitFieldOrder(useExplicitFieldOrder bool) *Highlight {
	hl.useExplicitFieldOrder = useExplicitFieldOrder
	return hl
}

// Creates the query source for the bool query.
func (hl *Highlight) Source() interface{} {
	// Returns the map inside of "highlight":
	// "highlight":{
	//   ... this ...
	// }
	source := make(map[string]interface{})
	if hl.tagsSchema != nil {
		source["tags_schema"] = *hl.tagsSchema
	}
	if hl.preTags != nil && len(hl.preTags) > 0 {
		source["pre_tags"] = hl.preTags
	}
	if hl.postTags != nil && len(hl.postTags) > 0 {
		source["post_tags"] = hl.postTags
	}
	if hl.order != nil {
		source["order"] = *hl.order
	}
	if hl.highlightFilter != nil {
		source["highlight_filter"] = *hl.highlightFilter
	}
	if hl.fragmentSize != nil {
		source["fragment_size"] = *hl.fragmentSize
	}
	if hl.numOfFragments != nil {
		source["number_of_fragments"] = *hl.numOfFragments
	}
	if hl.encoder != nil {
		source["encoder"] = *hl.encoder
	}
	if hl.requireFieldMatch != nil {
		source["require_field_match"] = *hl.requireFieldMatch
	}
	if hl.boundaryMaxScan != nil {
		source["boundary_max_scan"] = *hl.boundaryMaxScan
	}
	if hl.boundaryChars != nil && len(hl.boundaryChars) > 0 {
		source["boundary_chars"] = hl.boundaryChars
	}
	if hl.highlighterType != nil {
		source["type"] = *hl.highlighterType
	}
	if hl.fragmenter != nil {
		source["fragmenter"] = *hl.fragmenter
	}
	if hl.highlightQuery != nil {
		source["highlight_query"] = hl.highlightQuery.Source()
	}
	if hl.noMatchSize != nil {
		source["no_match_size"] = *hl.noMatchSize
	}
	if hl.phraseLimit != nil {
		source["phrase_limit"] = *hl.phraseLimit
	}
	if hl.options != nil && len(hl.options) > 0 {
		source["options"] = hl.options
	}
	if hl.forceSource != nil {
		source["force_source"] = *hl.forceSource
	}

	if hl.fields != nil && len(hl.fields) > 0 {
		if hl.useExplicitFieldOrder {
			// Use a slice for the fields
			fields := make([]map[string]interface{}, 0)
			for _, field := range hl.fields {
				fmap := make(map[string]interface{})
				fmap[field.Name] = field.Source()
				fields = append(fields, fmap)
			}
			source["fields"] = fields
		} else {
			// Use a map for the fields
			fields := make(map[string]interface{}, 0)
			for _, field := range hl.fields {
				fields[field.Name] = field.Source()
			}
			source["fields"] = fields
		}
	}

	return source

	/*
		highlightS := make(map[string]interface{})

		if hl.tagsSchema != "" {
			highlightS["tags_schema"] = hl.tagsSchema
		}
		if len(hl.preTags) > 0 {
			highlightS["pre_tags"] = hl.preTags
		}
		if len(hl.postTags) > 0 {
			highlightS["post_tags"] = hl.postTags
		}
		if hl.order != "" {
			highlightS["order"] = hl.order
		}
		if hl.encoder != "" {
			highlightS["encoder"] = hl.encoder
		}
		if hl.requireFieldMatch != nil {
			highlightS["require_field_match"] = *hl.requireFieldMatch
		}
		if hl.highlighterType != "" {
			highlightS["type"] = hl.highlighterType
		}
		if hl.fragmenter != "" {
			highlightS["fragmenter"] = hl.fragmenter
		}
		if hl.highlightQuery != nil {
			highlightS["highlight_query"] = hl.highlightQuery.Source()
		}
		if hl.noMatchSize != nil {
			highlightS["no_match_size"] = *hl.noMatchSize
		}
		if len(hl.options) > 0 {
			highlightS["options"] = hl.options
		}
		if hl.forceSource != nil {
			highlightS["force_source"] = *hl.forceSource
		}
		if len(hl.fields) > 0 {
			fieldsS := make(map[string]interface{})
			for _, field := range hl.fields {
				fieldsS[field.Name] = field.Source()
			}
			highlightS["fields"] = fieldsS
		}

		return highlightS
	*/
}

// HighlighterField specifies a highlighted field.
type HighlighterField struct {
	Name string

	preTags           []string
	postTags          []string
	fragmentSize      int
	fragmentOffset    int
	numOfFragments    int
	highlightFilter   *bool
	order             *string
	requireFieldMatch *bool
	boundaryMaxScan   int
	boundaryChars     []rune
	highlighterType   *string
	fragmenter        *string
	highlightQuery    Query
	noMatchSize       *int
	matchedFields     []string
	phraseLimit       *int
	options           map[string]interface{}
	forceSource       *bool

	/*
		Name              string
		preTags           []string
		postTags          []string
		fragmentSize      int
		numOfFragments    int
		fragmentOffset    int
		highlightFilter   *bool
		order             string
		requireFieldMatch *bool
		boundaryMaxScan   int
		boundaryChars     []rune
		highlighterType   string
		fragmenter        string
		highlightQuery    Query
		noMatchSize       *int
		matchedFields     []string
		options           map[string]interface{}
		forceSource       *bool
	*/
}

func NewHighlighterField(name string) *HighlighterField {
	return &HighlighterField{
		Name:            name,
		preTags:         make([]string, 0),
		postTags:        make([]string, 0),
		fragmentSize:    -1,
		fragmentOffset:  -1,
		numOfFragments:  -1,
		boundaryMaxScan: -1,
		boundaryChars:   make([]rune, 0),
		matchedFields:   make([]string, 0),
		options:         make(map[string]interface{}),
	}
}

func (f *HighlighterField) PreTags(preTags ...string) *HighlighterField {
	f.preTags = make([]string, 0)
	f.preTags = append(f.preTags, preTags...)
	return f
}

func (f *HighlighterField) PostTags(postTags ...string) *HighlighterField {
	f.postTags = make([]string, 0)
	f.postTags = append(f.postTags, postTags...)
	return f
}

func (f *HighlighterField) FragmentSize(fragmentSize int) *HighlighterField {
	f.fragmentSize = fragmentSize
	return f
}

func (f *HighlighterField) FragmentOffset(fragmentOffset int) *HighlighterField {
	f.fragmentOffset = fragmentOffset
	return f
}

func (f *HighlighterField) NumOfFragments(numOfFragments int) *HighlighterField {
	f.numOfFragments = numOfFragments
	return f
}

func (f *HighlighterField) HighlightFilter(highlightFilter bool) *HighlighterField {
	f.highlightFilter = &highlightFilter
	return f
}

func (f *HighlighterField) Order(order string) *HighlighterField {
	f.order = &order
	return f
}

func (f *HighlighterField) RequireFieldMatch(requireFieldMatch bool) *HighlighterField {
	f.requireFieldMatch = &requireFieldMatch
	return f
}

func (f *HighlighterField) BoundaryMaxScan(boundaryMaxScan int) *HighlighterField {
	f.boundaryMaxScan = boundaryMaxScan
	return f
}

func (f *HighlighterField) BoundaryChars(boundaryChars ...rune) *HighlighterField {
	f.boundaryChars = make([]rune, 0)
	f.boundaryChars = append(f.boundaryChars, boundaryChars...)
	return f
}

func (f *HighlighterField) HighlighterType(highlighterType string) *HighlighterField {
	f.highlighterType = &highlighterType
	return f
}

func (f *HighlighterField) Fragmenter(fragmenter string) *HighlighterField {
	f.fragmenter = &fragmenter
	return f
}

func (f *HighlighterField) HighlightQuery(highlightQuery Query) *HighlighterField {
	f.highlightQuery = highlightQuery
	return f
}

func (f *HighlighterField) NoMatchSize(noMatchSize int) *HighlighterField {
	f.noMatchSize = &noMatchSize
	return f
}

func (f *HighlighterField) Options(options map[string]interface{}) *HighlighterField {
	f.options = options
	return f
}

func (f *HighlighterField) MatchedFields(matchedFields ...string) *HighlighterField {
	f.matchedFields = make([]string, 0)
	f.matchedFields = append(f.matchedFields, matchedFields...)
	return f
}

func (f *HighlighterField) PhraseLimit(phraseLimit int) *HighlighterField {
	f.phraseLimit = &phraseLimit
	return f
}

func (f *HighlighterField) ForceSource(forceSource bool) *HighlighterField {
	f.forceSource = &forceSource
	return f
}

func (f *HighlighterField) Source() interface{} {
	source := make(map[string]interface{})

	if f.preTags != nil && len(f.preTags) > 0 {
		source["pre_tags"] = f.preTags
	}
	if f.postTags != nil && len(f.postTags) > 0 {
		source["post_tags"] = f.postTags
	}
	if f.fragmentSize != -1 {
		source["fragment_size"] = f.fragmentSize
	}
	if f.numOfFragments != -1 {
		source["number_of_fragments"] = f.numOfFragments
	}
	if f.fragmentOffset != -1 {
		source["fragment_offset"] = f.fragmentOffset
	}
	if f.highlightFilter != nil {
		source["highlight_filter"] = *f.highlightFilter
	}
	if f.order != nil {
		source["order"] = *f.order
	}
	if f.requireFieldMatch != nil {
		source["require_field_match"] = *f.requireFieldMatch
	}
	if f.boundaryMaxScan != -1 {
		source["boundary_max_scan"] = f.boundaryMaxScan
	}
	if f.boundaryChars != nil && len(f.boundaryChars) > 0 {
		source["boundary_chars"] = f.boundaryChars
	}
	if f.highlighterType != nil {
		source["type"] = *f.highlighterType
	}
	if f.fragmenter != nil {
		source["fragmenter"] = *f.fragmenter
	}
	if f.highlightQuery != nil {
		source["highlight_query"] = f.highlightQuery.Source()
	}
	if f.noMatchSize != nil {
		source["no_match_size"] = *f.noMatchSize
	}
	if f.matchedFields != nil && len(f.matchedFields) > 0 {
		source["matched_fields"] = f.matchedFields
	}
	if f.phraseLimit != nil {
		source["phrase_limit"] = *f.phraseLimit
	}
	if f.options != nil && len(f.options) > 0 {
		source["options"] = f.options
	}
	if f.forceSource != nil {
		source["force_source"] = *f.forceSource
	}

	return source
}

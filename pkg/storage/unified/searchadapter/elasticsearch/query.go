package elasticsearch

import (
	"encoding/json"
	"fmt"
	"slices"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/selection"

	foldermodel "github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

type elasticsearchObject = map[string]any

const elasticsearchDocumentIDField = "doc_id"

// Elasticsearch doc values lose array order. A first-source-value copy lets
// the adapter sort consistently without reading _source per hit. Bleve's first
// visited term is not necessarily the first source value.
const elasticsearchArraySortPrefix = "_sort."

type elasticsearchQuery struct {
	query   elasticsearchObject
	order   []Sort
	fields  []string
	cursor  []string
	reverse bool
}

// The builder uses Grafana's field declarations, not a customer's index schema.
// It prepares post-rank searches; regex and folder-tree filters are not supported yet.
// Index creation and backend selection are deliberately separate from translation.
type elasticsearchQueryBuilder struct {
	schema           search.AdapterSchema
	selectableFields []string
}

func newElasticsearchQueryBuilder(provider resource.SearchFieldsProvider, key resource.NamespacedResource, selectableFields []string) (*elasticsearchQueryBuilder, error) {
	fields, err := search.NewAdapterSchema(provider, key, selectableFields)
	if err != nil {
		return nil, err
	}
	return &elasticsearchQueryBuilder{
		schema:           fields,
		selectableFields: slices.Clone(selectableFields),
	}, nil
}

func (b *elasticsearchQueryBuilder) prepare(req *resourcepb.ResourceSearchRequest, expirationThreshold int64) (elasticsearchQuery, *resourcepb.ErrorResult) {
	if err := search.ValidateAdapterQuery(req); err != nil {
		return elasticsearchQuery{}, err
	}
	for name, facet := range req.Facet {
		if b.schema.Facet(facet.GetField()) == "" {
			return elasticsearchQuery{}, resource.NewBadRequestError(fmt.Sprintf("field %q does not support faceting", facet.GetField()))
		}
		if facet.Limit < 0 {
			return elasticsearchQuery{}, resource.NewBadRequestError(fmt.Sprintf("facet %q has a negative limit", name))
		}
	}

	filters, err := b.filters(req.GetOptions())
	if err != nil {
		return elasticsearchQuery{}, err
	}
	text := req.Query
	if words := strings.Fields(text); len(words) > 0 && !strings.Contains(text, "*") &&
		!slices.ContainsFunc(words, func(word string) bool { return len(word) >= search.NGRAM_MIN_TOKEN }) {
		text = strings.Join(words, " ") + "*"
	}
	q := elasticsearchQuery{fields: b.storedFields(req)}
	boolQuery := elasticsearchObject{}
	if len(text) > 1 {
		boolQuery["must"] = b.textQuery(text, req.QueryFields)
		if !strings.Contains(text, "*") && !slices.Contains(q.fields, resource.SEARCH_FIELD_SCORE) {
			q.fields = append(q.fields, resource.SEARCH_FIELD_SCORE)
		}
	}
	if len(filters) > 0 {
		boolQuery["filter"] = filters
	}
	deleted := elasticsearchObject{"term": elasticsearchObject{resource.SEARCH_FIELD_IS_DELETED: true}}
	if req.IsDeleted {
		filters = append(filters, deleted)
		boolQuery["filter"] = filters
		exclusions := []elasticsearchObject{{"term": elasticsearchObject{resource.SEARCH_FIELD_IS_PROVISIONED: true}}}
		if expirationThreshold > 0 {
			exclusions = append(exclusions, elasticsearchObject{"range": elasticsearchObject{
				resource.SEARCH_FIELD_DELETION_TIME: elasticsearchObject{"lt": expirationThreshold},
			}})
		}
		boolQuery["must_not"] = exclusions
	} else {
		boolQuery["must_not"] = deleted
	}
	q.query = elasticsearchObject{"bool": boolQuery}

	hasName := false
	for _, sort := range req.SortBy {
		if !b.schema.Sortable(sort.GetField()) {
			return elasticsearchQuery{}, resource.NewBadRequestError(fmt.Sprintf("field %q does not support sorting", sort.GetField()))
		}
		field := b.schema.Resolve(sort.Field)
		if kf, ok := b.schema.Keyword(field); ok {
			field = kf.Name
		}
		if def, _ := b.schema.Result(sort.Field); def.Array {
			field = elasticsearchArraySortPrefix + field
		}
		hasName = hasName || field == resource.SEARCH_FIELD_NAME
		q.order = append(q.order, Sort{Field: field, Desc: sort.Desc})
	}
	if len(q.order) == 0 {
		if text != "" && text != "*" {
			q.order = append(q.order, Sort{Field: resource.SEARCH_FIELD_SCORE, Desc: true})
		} else {
			q.order = append(q.order, Sort{Field: resource.SEARCH_FIELD_TITLE_PHRASE})
		}
	}
	if !hasName {
		q.order = append(q.order, Sort{Field: resource.SEARCH_FIELD_NAME})
	}
	q.order = append(q.order, Sort{Field: elasticsearchDocumentIDField})
	if err := prepareCursor(&q, req); err != nil {
		return elasticsearchQuery{}, err
	}
	return q, nil
}

func prepareCursor(q *elasticsearchQuery, req *resourcepb.ResourceSearchRequest) *resourcepb.ErrorResult {
	if len(req.SearchAfter) > 0 && len(req.SearchBefore) > 0 {
		return resource.NewBadRequestError("search cannot specify both search_after and search_before")
	}
	q.cursor = slices.Clone(req.SearchAfter)
	if len(req.SearchBefore) > 0 {
		q.cursor, q.reverse = slices.Clone(req.SearchBefore), true
	}
	if req.IsDeleted && len(req.SortBy) == 1 && req.SortBy[0].GetField() == resource.SEARCH_FIELD_DELETED_RV && !req.SortBy[0].GetDesc() &&
		len(req.SearchAfter) == 2 && req.SearchAfter[1] == "" && len(req.SearchBefore) == 0 {
		// Trash listing starts at a resource-version bound, not a returned cursor.
		rv, err := strconv.ParseInt(req.SearchAfter[0], 10, 64)
		if err != nil || rv < 0 {
			return resource.NewBadRequestError("invalid trash resource-version boundary")
		}
		q.cursor = []string{strconv.Quote(fmt.Sprintf("%019d", rv)), `""`, `""`}
	}
	if len(q.cursor) > 0 {
		if len(q.cursor) != len(q.order) {
			return resource.NewBadRequestError("search cursor does not match the current sort order; start a new search")
		}
		for _, value := range q.cursor {
			var scalar any
			if json.Unmarshal([]byte(value), &scalar) != nil {
				return resource.NewBadRequestError("invalid search cursor; start a new search")
			}
			switch scalar.(type) {
			case nil, string, float64:
			default:
				return resource.NewBadRequestError("invalid search cursor; start a new search")
			}
		}
	}
	return nil
}

func (b *elasticsearchQueryBuilder) storedFields(req *resourcepb.ResourceSearchRequest) []string {
	requested := slices.Clone(req.Fields)
	if len(requested) == 0 && req.Limit > 0 || slices.Contains(requested, resource.SEARCH_FIELD_ALL_FIELDS) {
		for _, def := range b.schema.DefaultFields() {
			requested = append(requested, def.Name)
		}
	}
	var fields []string
	for _, name := range requested {
		switch name {
		case resource.SEARCH_FIELD_LEGACY_ID:
			fields = append(fields, labelFieldPrefix+name)
		case resource.SEARCH_FIELD_SOURCE_PATH, resource.SEARCH_FIELD_SOURCE_CHECKSUM, resource.SEARCH_FIELD_SOURCE_TIME:
			fields = append(fields, name)
		default:
			def, _ := b.schema.Result(name)
			// _source also holds filter-only values that Bleve never stores.
			if def.HasCapability(resource.SearchCapabilityRetrieve) || def.HasCapability(resource.SearchCapabilityFacet) || strings.HasPrefix(name, labelFieldPrefix) {
				fields = append(fields, b.schema.Resolve(name))
			}
		}
	}
	fields = append(fields, resource.SEARCH_FIELD_RV_STRING)
	fields = append(fields, authzLoadFields(req.IsDeleted)...)
	return fields
}

func (b *elasticsearchQueryBuilder) filters(options *resourcepb.ListOptions) ([]elasticsearchObject, *resourcepb.ErrorResult) {
	var result []elasticsearchObject
	var unmapped []string
	for _, req := range options.GetFields() {
		if name, ok := strings.CutPrefix(req.Key, resource.SEARCH_SELECTABLE_FIELDS_PREFIX); ok && !slices.Contains(b.selectableFields, name) {
			unmapped = append(unmapped, req.Key)
		}
	}
	if len(unmapped) > 0 {
		return nil, resource.NewSelectableFieldNotIndexedError(unmapped)
	}
	appendFilter := func(key string, requirement *resourcepb.Requirement) *resourcepb.ErrorResult {
		req := &resourcepb.Requirement{Key: key, Operator: requirement.Operator, Values: requirement.Values}
		if req.Key == resource.SEARCH_FIELD_FOLDER && (req.Operator == string(selection.Equals) || req.Operator == string(selection.In)) {
			var values []string
			for _, value := range req.Values {
				if foldermodel.IsRootFolderUID(value) {
					values = append(values, "", foldermodel.GeneralFolderUID)
				} else {
					values = append(values, value)
				}
			}
			if len(values) != len(req.Values) {
				req.Operator, req.Values = string(selection.In), values
			}
		}
		q, err := b.requirement(req)
		if err == nil {
			result = append(result, q)
		}
		return err
	}
	for _, req := range options.GetLabels() {
		if err := appendFilter(labelFieldPrefix+req.Key, req); err != nil {
			return nil, err
		}
	}
	for _, req := range options.GetFields() {
		if req.Key == resource.SEARCH_FIELD_FOLDER_TREE {
			return nil, resource.NewBadRequestError("Elasticsearch folder-tree filtering is not supported yet")
		}
		if err := appendFilter(b.schema.Resolve(req.Key), req); err != nil {
			return nil, err
		}
	}
	return result, nil
}

func (b *elasticsearchQueryBuilder) requirement(req *resourcepb.Requirement) (elasticsearchObject, *resourcepb.ErrorResult) {
	if nb, ok := b.schema.NumberOrBool(req.Key); ok {
		return b.numberOrBoolRequirement(nb, req)
	}
	op := selection.Operator(req.Operator)
	if op == resource.OperatorRegex || op == resource.OperatorNotRegex {
		// Lucene regexes do not have the API's validated whole-value semantics.
		return nil, resource.NewBadRequestError("Elasticsearch regex filtering is not supported yet")
	}
	kf, keyword := b.schema.Keyword(req.Key)
	exact := keyword && kf.Filterable || strings.HasPrefix(req.Key, resource.SEARCH_SELECTABLE_FIELDS_PREFIX)
	exact = exact && req.Key != resource.SEARCH_FIELD_TITLE
	var queries []elasticsearchObject
	for _, value := range req.Values {
		if op == selection.DoubleEquals || op == selection.Equals && exact || op == selection.In && (exact || req.Key == resource.SEARCH_FIELD_TITLE) || op == selection.NotIn && req.Key == resource.SEARCH_FIELD_TITLE {
			key := req.Key
			if keyword {
				key = kf.Name
				if kf.Lowered {
					value = strings.ToLower(value)
				}
			}
			queries = append(queries, elasticsearchObject{"term": elasticsearchObject{key: strings.TrimSuffix(value, " ")}})
		} else {
			queries = append(queries, elasticsearchFieldFilter(req.Key, filterValue(req.Key, value)))
		}
	}
	switch op {
	case selection.DoubleEquals:
		if len(queries) == 1 {
			return queries[0], nil
		}
	case selection.Equals:
		return elasticsearchCombine("must", queries), nil
	case selection.In:
		return elasticsearchCombine("should", queries), nil
	case selection.NotIn:
		if len(queries) == 0 {
			return elasticsearchCombine("must", nil), nil
		}
		return elasticsearchObject{"bool": elasticsearchObject{"must_not": queries}}, nil
	default:
	}
	return nil, unsupportedRequirementError(req)
}

func (b *elasticsearchQueryBuilder) numberOrBoolRequirement(nb search.NumberOrBoolField, req *resourcepb.Requirement) (elasticsearchObject, *resourcepb.ErrorResult) {
	if !nb.Filterable {
		return nil, resource.NewBadRequestError(fmt.Sprintf("field %s does not support filtering", req.Key))
	}
	op := selection.Operator(req.Operator)
	var comparison string
	switch op {
	case selection.Equals, selection.DoubleEquals, selection.In, selection.NotIn:
		if op == selection.DoubleEquals && len(req.Values) != 1 {
			return nil, unsupportedRequirementError(req)
		}
		if len(req.Values) == 0 {
			return nil, resource.NewBadRequestError(fmt.Sprintf("filter on field %s has no values", req.Key))
		}
	case selection.GreaterThan, selection.LessThan, resource.OperatorGreaterThanOrEqual, resource.OperatorLessThanOrEqual:
		if nb.Type == resource.SearchFieldTypeBoolean {
			return nil, resource.NewBadRequestError(fmt.Sprintf("field %s is a boolean and cannot be compared with %s", req.Key, req.Operator))
		}
		if len(req.Values) != 1 {
			return nil, resource.NewBadRequestError(fmt.Sprintf("operator %s on field %s takes exactly one value", req.Operator, req.Key))
		}
		comparison = map[selection.Operator]string{selection.GreaterThan: "gt", selection.LessThan: "lt", resource.OperatorGreaterThanOrEqual: "gte", resource.OperatorLessThanOrEqual: "lte"}[op]
	default:
		return nil, unsupportedRequirementError(req)
	}
	var queries []elasticsearchObject
	for _, value := range req.Values {
		var scalar any
		switch nb.Type {
		case resource.SearchFieldTypeBoolean:
			v, ok := search.ParseBooleanFilterValue(value)
			if !ok {
				return nil, resource.NewBadRequestError(fmt.Sprintf("invalid boolean value for field %s: %q", req.Key, value))
			}
			scalar = v
		case resource.SearchFieldTypeDouble:
			number, err := search.ParseDoubleFilterValue(req.Key, value)
			if err != nil {
				return nil, err
			}
			scalar = number
		default:
			number, err := strconv.ParseInt(value, 10, 64)
			if err != nil {
				return nil, resource.NewBadRequestError(fmt.Sprintf("invalid integer value for field %s: %q", req.Key, value))
			}
			scalar = number
		}
		if comparison != "" {
			return elasticsearchObject{"range": elasticsearchObject{nb.Name: elasticsearchObject{comparison: scalar}}}, nil
		}
		queries = append(queries, elasticsearchObject{"term": elasticsearchObject{nb.Name: scalar}})
	}
	switch op {
	case selection.NotIn:
		return elasticsearchObject{"bool": elasticsearchObject{"must_not": queries}}, nil
	case selection.Equals, selection.DoubleEquals:
		return elasticsearchCombine("must", queries), nil
	default:
		return elasticsearchCombine("should", queries), nil
	}
}

func (b *elasticsearchQueryBuilder) textQuery(text string, requested []*resourcepb.ResourceSearchRequest_QueryField) elasticsearchObject {
	if strings.Contains(text, "*") {
		var queries []elasticsearchObject
		if len(requested) == 0 {
			return elasticsearchWildcard(resource.SEARCH_FIELD_TITLE, strings.ToLower(text))
		}
		for _, field := range requested {
			name := b.schema.Resolve(field.Name)
			if def, ok := b.schema.Result(name); ok && def.Type != resource.SearchFieldTypeString {
				queries = append(queries, elasticsearchObject{"match_none": elasticsearchObject{}})
				continue
			}
			pattern := text
			if name == resource.SEARCH_FIELD_TITLE {
				pattern = strings.ToLower(pattern)
			}
			queries = append(queries, elasticsearchWildcard(name, pattern))
		}
		return elasticsearchCombine("should", queries)
	}
	var queries []elasticsearchObject
	for _, field := range b.schema.QueryFields(requested) {
		if def, ok := b.schema.Result(field.Name); ok && def.Type != resource.SearchFieldTypeString {
			// Native match queries would coerce text into numeric or boolean values.
			queries = append(queries, elasticsearchObject{"match_none": elasticsearchObject{}})
			continue
		}
		exact, lowered := b.schema.TextTerm(field.Name)
		if strings.HasPrefix(field.Name, referenceFieldPrefix) || strings.HasPrefix(field.Name, labelFieldPrefix) {
			exact = true
		}
		value, queryType := text, "match"
		options := elasticsearchObject{"boost": field.Boost}
		if exact {
			if lowered {
				value = strings.ToLower(value)
			}
			queryType = "term"
			options["value"] = value
		} else {
			options["query"], options["operator"] = search.RemoveSmallTerms(value), "and"
		}
		queries = append(queries, elasticsearchObject{queryType: elasticsearchObject{field.Name: options}})
	}
	return elasticsearchCombine("should", queries)
}

func elasticsearchCombine(operator string, queries []elasticsearchObject) elasticsearchObject {
	if len(queries) == 0 {
		return elasticsearchObject{"match_all": elasticsearchObject{}}
	}
	if len(queries) == 1 {
		return queries[0]
	}
	clauses := elasticsearchObject{operator: queries}
	if operator == "should" {
		clauses["minimum_should_match"] = 1
	}
	return elasticsearchObject{"bool": clauses}
}

func elasticsearchMatch(field, value string) elasticsearchObject {
	return elasticsearchObject{"match": elasticsearchObject{field: value}}
}

func elasticsearchWildcard(field, value string) elasticsearchObject {
	wildcard := func(field string) elasticsearchObject {
		return elasticsearchObject{"wildcard": elasticsearchObject{field: elasticsearchObject{"value": value}}}
	}
	if field == resource.SEARCH_FIELD_TITLE {
		return elasticsearchCombine("should", []elasticsearchObject{wildcard(field), wildcard(resource.SEARCH_FIELD_TITLE_PHRASE)})
	}
	return wildcard(field)
}

func elasticsearchFieldFilter(field, value string) elasticsearchObject {
	if field != resource.SEARCH_FIELD_TITLE {
		switch {
		case value == "*":
			return elasticsearchCombine("must", nil)
		case strings.Contains(value, "*"):
			return elasticsearchWildcard(field, value)
		default:
			return elasticsearchMatch(field, value)
		}
	}
	tokenQuery := elasticsearchMatch(field, value)
	switch {
	case value == "*":
		tokenQuery = elasticsearchCombine("must", nil)
	case strings.Contains(value, "*"):
		tokenQuery = elasticsearchObject{"wildcard": elasticsearchObject{field: elasticsearchObject{"value": value}}}
	default:
		if delimiter, ok := search.FirstTermSeparator(value); ok {
			var tokens []elasticsearchObject
			for _, token := range strings.Split(value, delimiter) {
				if token == "" {
					continue
				}
				if _, separator := search.FirstTermSeparator(token); separator {
					tokens = append(tokens, elasticsearchObject{"term": elasticsearchObject{field: token}})
				} else {
					tokens = append(tokens, elasticsearchMatch(field, token))
				}
			}
			tokenQuery = elasticsearchCombine("must", tokens)
		}
	}
	queries := []elasticsearchObject{
		{"term": elasticsearchObject{resource.SEARCH_FIELD_TITLE_PHRASE: strings.TrimSuffix(strings.ToLower(value), " ")}},
		tokenQuery,
	}
	if !strings.ContainsAny(value, whitespaceCharacters) {
		queries = append(queries, elasticsearchObject{"match": elasticsearchObject{resource.SEARCH_FIELD_TITLE_NGRAM: elasticsearchObject{
			"query": search.RemoveSmallTerms(search.SplitTermCharacters(value)), "operator": "and",
		}}})
	}
	return elasticsearchCombine("should", queries)
}

const labelFieldPrefix = resource.SEARCH_FIELD_LABELS + "."
const referenceFieldPrefix = "reference."
const whitespaceCharacters = " \t\r\n"

func unsupportedRequirementError(req *resourcepb.Requirement) *resourcepb.ErrorResult {
	return resource.NewBadRequestError(fmt.Sprintf("unsupported query operation (%s %s %v)", req.Key, req.Operator, req.Values))
}
func filterValue(key, v string) string {
	if strings.HasSuffix(key, "phrase") {
		return strings.ToLower(v)
	}
	return v
}
func authzLoadFields(trash bool) []string {
	fields := []string{resource.SEARCH_FIELD_FOLDER}
	if trash {
		fields = append(fields, resource.SEARCH_FIELD_DELETED_BY)
	}
	return fields
}

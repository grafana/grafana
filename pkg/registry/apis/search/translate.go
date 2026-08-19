// Package search translates the search.grafana.app envelope request bodies
// (SearchQuery, TrashQuery) into the backend ResourceSearchRequest, validating
// them against the v1 subset and the searchable fields declared for the kind.
package search

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"slices"
	"sort"
	"strconv"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	metav1validation "k8s.io/apimachinery/pkg/apis/meta/v1/validation"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apimachinery/pkg/util/validation/field"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	// DefaultLimit and MaxLimit bound the page size (SearchQuery.Limit).
	DefaultLimit = 100
	MaxLimit     = 500

	// DefaultFacetLimit and MaxFacetLimit bound the terms returned per facet.
	DefaultFacetLimit = 50
	MaxFacetLimit     = 1000
)

// Trash-specific field names. title and folder reuse the standard field names.
const (
	trashFieldTitle        = resource.SEARCH_FIELD_TITLE
	trashFieldFolder       = resource.SEARCH_FIELD_FOLDER
	trashFieldDeletedBy    = "deleted_by"
	trashFieldDeletionTime = "deletion_time"
	trashFieldDeletedRV    = "deleted_rv"
)

// defaultTextFields is used when a text leaf omits fields. Once the
// searchTextFields manifest addition lands this becomes per-kind; today every
// kind defaults to title.
var defaultTextFields = []string{resource.SEARCH_FIELD_TITLE}

// TranslateSearchQuery validates q against the fields declared for
// (gvr) and, on success, returns the backend request scoped to namespace.
// On failure it returns a field.ErrorList suitable for a 400 BadRequest.
func TranslateSearchQuery(q *searchv0.SearchQuery, gvr schema.GroupVersionResource, namespace string, provider resource.SearchFieldsProvider) (*resourcepb.ResourceSearchRequest, field.ErrorList) {
	errs := validateEnvelope(q.TypeMeta, searchv0.KindSearchQuery)
	fs := newFieldSet(gvr, provider)

	leaves, whereErrs := validateWhere(q.Where, fs, field.NewPath("where"))
	errs = append(errs, whereErrs...)
	errs = append(errs, validateLabelSelector(q.LabelSelector, field.NewPath("labelSelector"))...)
	errs = append(errs, validateSort(q.Sort, fs, field.NewPath("sort"))...)
	errs = append(errs, validateReturnFields(q.Fields, fs, field.NewPath("fields"))...)
	errs = append(errs, validateFacets(q.Facets, fs, field.NewPath("facets"))...)
	if q.Limit < 0 {
		errs = append(errs, field.Invalid(field.NewPath("limit"), q.Limit, "must not be negative"))
	}
	if q.FacetLimit < 0 {
		errs = append(errs, field.Invalid(field.NewPath("facetLimit"), q.FacetLimit, "must not be negative"))
	}
	searchAfter, cerr := decodeContinue(q.Continue)
	if cerr != nil {
		errs = append(errs, field.Invalid(field.NewPath("continue"), "<opaque>", "invalid continuation token"))
	}
	if len(errs) > 0 {
		return nil, errs
	}

	req := newRequest(gvr, namespace)
	applyLeaves(req, leaves)
	applyLabelSelector(req, q.LabelSelector)
	applySort(req, q.Sort, hasTextLeaf(leaves), &resourcepb.ResourceSearchRequest_Sort{Field: resource.SEARCH_FIELD_NAME})
	req.Fields = defaultReturnFields(q.Fields)
	applyFacets(req, q.Facets, resolveFacetLimit(q.FacetLimit))
	req.Limit = resolveLimit(q.Limit)
	req.SearchAfter = searchAfter
	return req, nil
}

// TranslateTrashQuery validates a TrashQuery against the fixed uniform trash
// field set and returns the backend request. labelSelector and facets are
// rejected; deleted_rv is always returned.
//
// This targets the intended contract; trash indexing/search is a backend
// prerequisite that /trash depends on.
func TranslateTrashQuery(q *searchv0.TrashQuery, gvr schema.GroupVersionResource, namespace string) (*resourcepb.ResourceSearchRequest, field.ErrorList) {
	errs := validateEnvelope(q.TypeMeta, searchv0.KindTrashQuery)

	fs := trashFieldSet()
	leaves, whereErrs := validateWhere(q.Where, fs, field.NewPath("where"))
	errs = append(errs, whereErrs...)
	errs = append(errs, validateSort(q.Sort, fs, field.NewPath("sort"))...)
	errs = append(errs, validateReturnFields(q.Fields, fs, field.NewPath("fields"))...)
	if q.Limit < 0 {
		errs = append(errs, field.Invalid(field.NewPath("limit"), q.Limit, "must not be negative"))
	}
	searchAfter, cerr := decodeContinue(q.Continue)
	if cerr != nil {
		errs = append(errs, field.Invalid(field.NewPath("continue"), "<opaque>", "invalid continuation token"))
	}
	if len(errs) > 0 {
		return nil, errs
	}

	req := newRequest(gvr, namespace)
	req.IsDeleted = true
	applyLeaves(req, leaves)
	// Trash's default order is deletion_time desc (search uses name asc); when a
	// text query is present both fall back to relevance instead.
	applySort(req, q.Sort, hasTextLeaf(leaves), &resourcepb.ResourceSearchRequest_Sort{Field: trashFieldDeletionTime, Desc: true})
	req.Fields = trashReturnFields(q.Fields)
	req.Limit = resolveLimit(q.Limit)
	req.SearchAfter = searchAfter
	return req, nil
}

// fieldSet is the set of fields referenceable in a request, keyed by public
// name, with the capabilities each field supports.
type fieldSet struct {
	byName map[string]resource.SearchFieldDefinition
}

func newFieldSet(gvr schema.GroupVersionResource, provider resource.SearchFieldsProvider) *fieldSet {
	m := map[string]resource.SearchFieldDefinition{}
	for _, d := range resource.StandardSearchFieldDefinitions() {
		m[d.Name] = d
	}
	if provider != nil {
		for _, d := range provider.Fields(gvr) {
			m[d.Name] = d
		}
	}
	return &fieldSet{byName: m}
}

// trashFieldSet is the fixed uniform field set for /trash, expressed as a
// fieldSet so the shared validators enforce the trash rules. Capabilities
// mirror the design: text on title; filter on folder/deleted_by; sort on
// title/folder/deleted_by/deletion_time; all retrievable.
func trashFieldSet() *fieldSet {
	def := func(name string, caps ...resource.SearchCapability) resource.SearchFieldDefinition {
		return resource.SearchFieldDefinition{Name: name, Type: resource.SearchFieldTypeString, Capabilities: caps}
	}
	// The two numeric fields are typed from the backend declarations, so both sides
	// agree a timestamp is a number and it sorts in time order.
	trash := map[string]resource.SearchFieldDefinition{}
	for _, d := range resource.TrashSearchFieldDefinitions() {
		trash[d.Name] = d
	}
	return &fieldSet{byName: map[string]resource.SearchFieldDefinition{
		trashFieldTitle:        def(trashFieldTitle, resource.SearchCapabilityText, resource.SearchCapabilitySort, resource.SearchCapabilityRetrieve),
		trashFieldFolder:       def(trashFieldFolder, resource.SearchCapabilityFilter, resource.SearchCapabilitySort, resource.SearchCapabilityRetrieve),
		trashFieldDeletedBy:    trash[trashFieldDeletedBy],
		trashFieldDeletionTime: trash[trashFieldDeletionTime],
		trashFieldDeletedRV:    trash[trashFieldDeletedRV],
	}}
}

func validateEnvelope(tm metav1.TypeMeta, wantKind string) field.ErrorList {
	errs := field.ErrorList{}
	if tm.APIVersion != searchv0.APIVERSION {
		errs = append(errs, field.NotSupported(field.NewPath("apiVersion"), tm.APIVersion, []string{searchv0.APIVERSION}))
	}
	if tm.Kind != wantKind {
		errs = append(errs, field.NotSupported(field.NewPath("kind"), tm.Kind, []string{wantKind}))
	}
	return errs
}

// validateWhere enforces the v1 subset (top-level single leaf, or a single and
// of leaves) and returns the flattened list of leaf nodes for translation.
func validateWhere(where *searchv0.WhereNode, fs *fieldSet, p *field.Path) ([]searchv0.WhereNode, field.ErrorList) {
	if where == nil {
		return nil, nil // match all
	}
	key, kerr := singleKey(where, p)
	if kerr != nil {
		return nil, field.ErrorList{kerr}
	}

	switch key {
	case "and":
		andPath := p.Child("and")
		if len(where.And) == 0 {
			return nil, field.ErrorList{field.Invalid(andPath, "[]", "and must contain at least one node")}
		}
		errs := field.ErrorList{}
		leaves := make([]searchv0.WhereNode, 0, len(where.And))
		sawText := false
		for i := range where.And {
			child := where.And[i]
			cp := andPath.Index(i)
			ck, cerr := singleKey(&child, cp)
			if cerr != nil {
				errs = append(errs, cerr)
				continue
			}
			if ck != "text" && ck != "filter" && ck != "range" {
				errs = append(errs, field.Invalid(cp, ck, "only text, filter and range leaves are allowed inside and in v1"))
				continue
			}
			// A second text leaf would overwrite the backend Query, so v1 rejects it.
			if ck == "text" {
				if sawText {
					errs = append(errs, field.Forbidden(cp.Child("text"), "at most one text leaf is allowed in v1"))
					continue
				}
				sawText = true
			}
			errs = append(errs, validateLeaf(&child, ck, fs, cp)...)
			leaves = append(leaves, child)
		}
		return leaves, errs
	case "text", "filter", "range":
		return []searchv0.WhereNode{*where}, validateLeaf(where, key, fs, p)
	default:
		// or, not, exists: modelled for the future, rejected in v1.
		return nil, field.ErrorList{field.Invalid(p, key, fmt.Sprintf("%q is not supported in v1", key))}
	}
}

// singleKey returns which single node type is set, or an error when zero or
// more than one is set.
func singleKey(n *searchv0.WhereNode, p *field.Path) (string, *field.Error) {
	set := make([]string, 0, 1)
	if n.And != nil {
		set = append(set, "and")
	}
	if n.Or != nil {
		set = append(set, "or")
	}
	if n.Not != nil {
		set = append(set, "not")
	}
	if n.Text != nil {
		set = append(set, "text")
	}
	if n.Filter != nil {
		set = append(set, "filter")
	}
	if n.Range != nil {
		set = append(set, "range")
	}
	if n.Exists != nil {
		set = append(set, "exists")
	}
	switch len(set) {
	case 1:
		return set[0], nil
	case 0:
		return "", field.Invalid(p, "{}", "node must set exactly one of: and, or, not, text, filter, range")
	default:
		return "", field.Invalid(p, strings.Join(set, ", "), "node must set exactly one key")
	}
}

func validateLeaf(n *searchv0.WhereNode, key string, fs *fieldSet, p *field.Path) field.ErrorList {
	errs := field.ErrorList{}
	switch key {
	case "text":
		tp := p.Child("text")
		t := n.Text
		if strings.TrimSpace(t.Value) == "" {
			errs = append(errs, field.Required(tp.Child("value"), "text value is required"))
		}
		if t.Boost != nil {
			errs = append(errs, field.Forbidden(tp.Child("boost"), "boost is not supported in v1"))
		}
		seen := make(map[string]bool, len(t.Fields))
		for i, f := range t.Fields {
			fp := tp.Child("fields").Index(i)
			// A repeated field would add its scored clause twice, an implicit boost
			// that v1 does not allow.
			if seen[f] {
				errs = append(errs, field.Duplicate(fp, f))
				continue
			}
			seen[f] = true
			errs = append(errs, checkCapability(fs, f, resource.SearchCapabilityText, fp)...)
		}
	case "filter":
		fp := p.Child("filter")
		f := n.Filter
		if f.Field == "" {
			errs = append(errs, field.Required(fp.Child("field"), "filter field is required"))
		} else {
			capErrs := checkCapability(fs, f.Field, resource.SearchCapabilityFilter, fp.Child("field"))
			errs = append(errs, capErrs...)
			if len(capErrs) == 0 {
				def := fs.byName[f.Field]
				if !filterableFieldType(def.Type) {
					errs = append(errs, field.Invalid(fp.Child("field"), f.Field, "v1 filters support string, numeric and boolean fields only"))
				}
				// Caught here so the caller gets a field path, instead of a 400 from the
				// search server.
				for i, v := range f.Values {
					if err := checkFilterValue(def.Type, v); err != nil {
						errs = append(errs, field.Invalid(fp.Child("values").Index(i), v, err.Error()))
					}
				}
			}
		}
		if f.Operator != "In" && f.Operator != "NotIn" {
			errs = append(errs, field.NotSupported(fp.Child("operator"), f.Operator, []string{"In", "NotIn"}))
		}
		if len(f.Values) == 0 {
			errs = append(errs, field.Required(fp.Child("values"), "at least one value is required"))
		}
		for i, v := range f.Values {
			// v1 rejects '*' because the backend still treats it as a wildcard in
			// field filters, so a literal '*' in a value would be misinterpreted.
			// Once exact-match filtering lands this restriction can be lifted.
			if strings.Contains(v, "*") {
				errs = append(errs, field.Invalid(fp.Child("values").Index(i), v, "wildcard values are not allowed"))
			}
		}
	case "range":
		errs = append(errs, validateRangeLeaf(n.Range, fs, p.Child("range"))...)
	}
	return errs
}

func validateRangeLeaf(r *searchv0.RangePredicate, fs *fieldSet, p *field.Path) field.ErrorList {
	errs := field.ErrorList{}
	bounds := rangeBounds(r)
	if r.Field == "" {
		errs = append(errs, field.Required(p.Child("field"), "range field is required"))
	} else {
		capErrs := checkCapability(fs, r.Field, resource.SearchCapabilityFilter, p.Child("field"))
		errs = append(errs, capErrs...)
		if len(capErrs) == 0 {
			def := fs.byName[r.Field]
			// Only numbers have the order a range asks about. A boolean carries the
			// filter capability too, which is why this is checked separately.
			if !numericFieldType(def.Type) {
				errs = append(errs, field.Invalid(p.Child("field"), r.Field, "range supports numeric fields only"))
			} else if def.Type == resource.SearchFieldTypeInt64 {
				for _, b := range bounds {
					if err := checkIntegerBound(b.value); err != nil {
						errs = append(errs, field.Invalid(p.Child(b.jsonField), b.value, err.Error()))
					}
				}
			}
		}
	}
	if len(bounds) == 0 {
		errs = append(errs, field.Required(p, "at least one of gt, gte, lt, lte is required"))
	}
	// Two bounds on the same side are either redundant or contradictory, and which
	// one wins would not be obvious.
	if r.GT != nil && r.GTE != nil {
		errs = append(errs, field.Invalid(p, "gt, gte", "gt and gte cannot be combined"))
	}
	if r.LT != nil && r.LTE != nil {
		errs = append(errs, field.Invalid(p, "lt, lte", "lt and lte cannot be combined"))
	}
	return errs
}

// rangeBound carries both the name the request used and the operator the backend
// wants, so neither has to be derived from the other.
type rangeBound struct {
	jsonField string
	operator  string
	value     float64
}

// Fixed order, so both the errors and the translated request come out the same
// way every time.
func rangeBounds(r *searchv0.RangePredicate) []rangeBound {
	var out []rangeBound
	for _, b := range []struct {
		jsonField string
		operator  string
		value     *float64
	}{
		{"gt", string(selection.GreaterThan), r.GT},
		{"gte", string(resource.OperatorGreaterThanOrEqual), r.GTE},
		{"lt", string(selection.LessThan), r.LT},
		{"lte", string(resource.OperatorLessThanOrEqual), r.LTE},
	} {
		if b.value != nil {
			out = append(out, rangeBound{jsonField: b.jsonField, operator: b.operator, value: *b.value})
		}
	}
	return out
}

// date is absent because the backend has not settled on a value format for it.
func filterableFieldType(t resource.SearchFieldType) bool {
	return t == resource.SearchFieldTypeString || t == resource.SearchFieldTypeBoolean || numericFieldType(t)
}

func numericFieldType(t resource.SearchFieldType) bool {
	return t == resource.SearchFieldTypeInt64 || t == resource.SearchFieldTypeDouble
}

// Values travel as strings whatever the field's type, so this is the only place
// the two meet.
func checkFilterValue(t resource.SearchFieldType, value string) error {
	switch t {
	case resource.SearchFieldTypeBoolean:
		// Only the two canonical spellings, matching the backend.
		if value != "true" && value != "false" {
			return errors.New(`must be "true" or "false"`)
		}
	case resource.SearchFieldTypeInt64:
		if _, err := strconv.ParseInt(value, 10, 64); err != nil {
			return errors.New("must be an integer")
		}
	case resource.SearchFieldTypeDouble:
		f, err := strconv.ParseFloat(value, 64)
		if err != nil || math.IsNaN(f) || math.IsInf(f, 0) {
			return errors.New("must be a finite number")
		}
	default:
		// A string holds any value. The types with no filter support at all are
		// refused by filterableFieldType before this runs.
	}
	return nil
}

// Bounds arrive as float64, so the limits are too. Both are powers of two and
// exact, unlike math.MaxInt64, which rounds up to 2^63 and would let it through.
const (
	int64LowerBound float64 = -1 << 63 // inclusive, and a valid int64
	int64UpperBound float64 = 1 << 63  // exclusive: one past the largest int64
)

// The schema types every bound as a number, so an integer field has to refuse the
// fractional ones itself.
func checkIntegerBound(bound float64) error {
	if bound != math.Trunc(bound) {
		return errors.New("must be a whole number on an integer field")
	}
	if bound < int64LowerBound || bound >= int64UpperBound {
		return errors.New("is out of range for an integer field")
	}
	return nil
}
func validateSort(sorts []searchv0.SortField, fs *fieldSet, p *field.Path) field.ErrorList {
	errs := field.ErrorList{}
	for i, s := range sorts {
		sp := p.Index(i)
		if s.Direction != "" && s.Direction != "asc" && s.Direction != "desc" {
			errs = append(errs, field.NotSupported(sp.Child("direction"), s.Direction, []string{"asc", "desc"}))
		}
		fp := sp.Child("field")
		capErrs := checkCapability(fs, s.Field, resource.SearchCapabilitySort, fp)
		errs = append(errs, capErrs...)
		// Sorting a list of values has no defined meaning, so only scalars are
		// sortable. Numbers are included because trash orders by a timestamp.
		if len(capErrs) == 0 {
			if def := fs.byName[s.Field]; def.Array || !sortableFieldType(def.Type) {
				errs = append(errs, field.Invalid(fp, s.Field, "v1 supports sorting on scalar string and numeric fields only"))
			}
		}
	}
	return errs
}

// sortableFieldType reports whether values of this type have a defined order.
func sortableFieldType(t resource.SearchFieldType) bool {
	switch t {
	case resource.SearchFieldTypeString, resource.SearchFieldTypeInt64, resource.SearchFieldTypeDouble:
		return true
	case resource.SearchFieldTypeBoolean, resource.SearchFieldTypeDate, resource.SearchFieldTypeUnknown:
		// A boolean has nothing useful to order by, and no field declares a date
		// today, so nothing maps one to sort on.
		return false
	default:
		return false
	}
}

func validateReturnFields(fields []string, fs *fieldSet, p *field.Path) field.ErrorList {
	errs := make(field.ErrorList, 0, len(fields))
	for i, f := range fields {
		errs = append(errs, checkCapability(fs, f, resource.SearchCapabilityRetrieve, p.Index(i))...)
	}
	return errs
}

func validateFacets(facets []string, fs *fieldSet, p *field.Path) field.ErrorList {
	errs := make(field.ErrorList, 0, len(facets))
	for i, f := range facets {
		errs = append(errs, checkCapability(fs, f, resource.SearchCapabilityFacet, p.Index(i))...)
	}
	return errs
}

func validateLabelSelector(sel *metav1.LabelSelector, p *field.Path) field.ErrorList {
	if sel == nil {
		return nil
	}
	// Standard k8s validation covers key/value syntax (including rejecting '*',
	// which is not a valid label value) and the rule that In/NotIn carry values
	// (an empty In would otherwise become a match-all filter in the backend).
	errs := metav1validation.ValidateLabelSelector(sel, metav1validation.LabelSelectorValidationOptions{}, p)
	// v1 further restricts operators to In/NotIn.
	for i, r := range sel.MatchExpressions {
		if r.Operator != metav1.LabelSelectorOpIn && r.Operator != metav1.LabelSelectorOpNotIn {
			ep := p.Child("matchExpressions").Index(i)
			errs = append(errs, field.NotSupported(ep.Child("operator"), string(r.Operator), []string{"In", "NotIn"}))
		}
	}
	return errs
}

func checkCapability(fs *fieldSet, name string, cap resource.SearchCapability, p *field.Path) field.ErrorList {
	def, ok := fs.byName[name]
	if !ok {
		return field.ErrorList{field.Invalid(p, name, "unknown field")}
	}
	if !def.HasCapability(cap) {
		return field.ErrorList{field.Invalid(p, name, fmt.Sprintf("field does not support %s", cap))}
	}
	return nil
}

// --- translation helpers (run only after validation passes) ---

func newRequest(gvr schema.GroupVersionResource, namespace string) *resourcepb.ResourceSearchRequest {
	return &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:     gvr.Group,
				Resource:  gvr.Resource,
				Namespace: namespace,
			},
		},
	}
}

func hasTextLeaf(leaves []searchv0.WhereNode) bool {
	for _, n := range leaves {
		if n.Text != nil {
			return true
		}
	}
	return false
}

// applyLeaves lowers the validated leaves onto the backend request.
//
// Public field names are emitted as-is to stay decoupled from bleve's physical
// naming. Resolving public->physical names for filter and query fields is a
// backend prerequisite; this includes routing exact filters on text-capable
// fields (e.g. title) to their keyword variant so In/NotIn stay exact. Pure
// keyword fields (folder, tags, name, ...) already work unprefixed.
func applyLeaves(req *resourcepb.ResourceSearchRequest, leaves []searchv0.WhereNode) {
	for i := range leaves {
		n := leaves[i]
		switch {
		case n.Text != nil:
			applyText(req, n.Text)
		case n.Filter != nil:
			req.Options.Fields = append(req.Options.Fields, filterRequirement(n.Filter))
		case n.Range != nil:
			req.Options.Fields = append(req.Options.Fields, rangeRequirements(n.Range)...)
		}
	}
}

func applyText(req *resourcepb.ResourceSearchRequest, t *searchv0.TextPredicate) {
	req.Query = t.Value
	fields := t.Fields
	if len(fields) == 0 {
		fields = defaultTextFields
	}
	for _, f := range fields {
		req.QueryFields = append(req.QueryFields, &resourcepb.ResourceSearchRequest_QueryField{
			Name: f,
			Type: resourcepb.QueryFieldType_TEXT,
			// The backend applies boost unconditionally, so a zero value would
			// zero-score every hit. v1 has no per-leaf boost, so use a neutral 1.
			Boost: 1,
		})
	}
}

func filterRequirement(f *searchv0.FilterPredicate) *resourcepb.Requirement {
	op := "in"
	if f.Operator == "NotIn" {
		op = "notin"
	}
	return &resourcepb.Requirement{Key: f.Field, Operator: op, Values: f.Values}
}

// Each bound becomes its own requirement, which the backend ANDs together like
// any other pair of field filters.
func rangeRequirements(r *searchv0.RangePredicate) []*resourcepb.Requirement {
	bounds := rangeBounds(r)
	out := make([]*resourcepb.Requirement, 0, len(bounds))
	for _, b := range bounds {
		out = append(out, &resourcepb.Requirement{
			Key:      r.Field,
			Operator: b.operator,
			Values:   []string{formatBound(b.value)},
		})
	}
	return out
}

// FormatFloat's shortest form is not the value it was given: the lowest int64
// comes out as -9223372036854776000, which the backend cannot parse. A whole
// bound is written exactly instead.
func formatBound(bound float64) string {
	if bound == math.Trunc(bound) && bound >= int64LowerBound && bound < int64UpperBound {
		return strconv.FormatInt(int64(bound), 10)
	}
	return strconv.FormatFloat(bound, 'f', -1, 64)
}

// applyLabelSelector lowers the selector onto Options.Labels. The backend now
// indexes label values whole, so In/NotIn match exactly and case-sensitively.
// An index built before that change still holds analyzed values and keeps
// overmatching (env=foo matches env=foo-bar) until it is rebuilt, and this
// endpoint does not re-apply the selector to full resources, so its answers are
// only as exact as the index it read.
func applyLabelSelector(req *resourcepb.ResourceSearchRequest, sel *metav1.LabelSelector) {
	if sel == nil {
		return
	}
	// Sort matchLabels keys so the generated request is deterministic.
	keys := make([]string, 0, len(sel.MatchLabels))
	for k := range sel.MatchLabels {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		req.Options.Labels = append(req.Options.Labels, &resourcepb.Requirement{
			Key: k, Operator: "in", Values: []string{sel.MatchLabels[k]},
		})
	}
	for _, r := range sel.MatchExpressions {
		op := "in"
		if r.Operator == metav1.LabelSelectorOpNotIn {
			op = "notin"
		}
		req.Options.Labels = append(req.Options.Labels, &resourcepb.Requirement{
			Key: r.Key, Operator: op, Values: r.Values,
		})
	}
}

// applySort maps the requested sort into the backend request. When no sort is
// given: with a text query, results order by relevance (empty SortBy); without
// one, by defaultSort.
func applySort(req *resourcepb.ResourceSearchRequest, sorts []searchv0.SortField, hasText bool, defaultSort *resourcepb.ResourceSearchRequest_Sort) {
	if len(sorts) == 0 {
		if !hasText {
			req.SortBy = []*resourcepb.ResourceSearchRequest_Sort{defaultSort}
		}
		return
	}
	for _, s := range sorts {
		req.SortBy = append(req.SortBy, &resourcepb.ResourceSearchRequest_Sort{
			Field: s.Field,
			Desc:  s.Direction == "desc",
		})
	}
}

func defaultReturnFields(fields []string) []string {
	if len(fields) == 0 {
		return []string{resource.SEARCH_FIELD_TITLE, resource.SEARCH_FIELD_FOLDER}
	}
	return fields
}

func trashReturnFields(fields []string) []string {
	if len(fields) == 0 {
		fields = []string{trashFieldTitle, trashFieldFolder, trashFieldDeletedBy, trashFieldDeletionTime}
	}
	// deleted_rv is mandatory in the response; it drives restore.
	if !slices.Contains(fields, trashFieldDeletedRV) {
		fields = append(fields, trashFieldDeletedRV)
	}
	return fields
}

// applyFacets attaches the requested facets to the backend request. Computing
// counts over a bounded permission-scoped sample is a backend prerequisite;
// today the backend counts over the full match set.
func applyFacets(req *resourcepb.ResourceSearchRequest, facets []string, limit int64) {
	if len(facets) == 0 {
		return
	}
	req.Facet = make(map[string]*resourcepb.ResourceSearchRequest_Facet, len(facets))
	for _, f := range facets {
		req.Facet[f] = &resourcepb.ResourceSearchRequest_Facet{Field: f, Limit: limit}
	}
}

func resolveLimit(l int64) int64 {
	switch {
	case l <= 0:
		return DefaultLimit
	case l > MaxLimit:
		return MaxLimit
	default:
		return l
	}
}

func resolveFacetLimit(l int64) int64 {
	switch {
	case l <= 0:
		return DefaultFacetLimit
	case l > MaxFacetLimit:
		return MaxFacetLimit
	default:
		return l
	}
}

// The continue token is an opaque, URL-safe encoding of the backend's
// SearchAfter sort values. Clients must not inspect or construct it.

func encodeContinue(searchAfter []string) string {
	if len(searchAfter) == 0 {
		return ""
	}
	b, err := json.Marshal(searchAfter)
	if err != nil {
		return ""
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

func decodeContinue(token string) ([]string, error) {
	if token == "" {
		return nil, nil
	}
	b, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return nil, err
	}
	var searchAfter []string
	if err := json.Unmarshal(b, &searchAfter); err != nil {
		return nil, err
	}
	// encodeContinue never emits an empty cursor, so a non-empty token decoding
	// to one (JSON null or []) is forged or corrupt.
	if len(searchAfter) == 0 {
		return nil, errors.New("empty continuation cursor")
	}
	return searchAfter, nil
}

package search

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	metav1validation "k8s.io/apimachinery/pkg/apis/meta/v1/validation"
	"k8s.io/apimachinery/pkg/util/validation/field"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var datasourceUIDPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

// Validation of a rule SearchQuery. It follows the generic search API's
// validation (pkg/registry/apis/search/translate.go) so a query the generic
// endpoint would reject is rejected here too, with the same field paths and the
// same 422, and then adds the restrictions that only the legacy backend needs.
//
// Every extra restriction here exists because one handler serves both the legacy
// ngalert store and unified storage, and the client cannot see which. Anything
// the legacy backend cannot faithfully apply is rejected rather than honoured on
// unified and silently dropped on legacy, which would be a 200 with wrong
// results.

// legacyFilterableFields are the fields the legacy backend's filter pass can
// apply (see extractFilters). A field a kind declares filterable but which is
// missing here is rejected. Lifting one out requires adding its matcher to
// extractFilters and the legacy client first.
//
// title, interval, for and keepFiringFor are declared filterable but absent:
// the legacy store has no exact-match matcher for them. title is still
// searchable as free text through a text leaf.
var legacyFilterableFields = map[string]struct{}{
	fieldName:                {},
	fieldFolder:              {},
	fieldType:                {},
	fieldPaused:              {},
	fieldLabels:              {},
	fieldDatasourceUIDs:      {},
	fieldDashboardUID:        {},
	fieldPanelID:             {},
	fieldReceiver:            {},
	fieldNotificationType:    {},
	fieldRoutingTree:         {},
	fieldMetric:              {},
	fieldTargetDatasourceUID: {},
}

// legacyTextFields are the fields a text leaf may name. The legacy store's only
// free-text capability is a word search over the title (SearchTitle), so naming
// any other text-capable field would search the title instead.
var legacyTextFields = map[string]struct{}{
	fieldTitle: {},
}

// legacySortFields are the fields sort may name. The legacy store orders by
// title only, so sorting on any other field would silently return title order.
var legacySortFields = map[string]struct{}{
	fieldTitle: {},
}

// scalarFilterFields are filterable fields the legacy backend applies as a
// single value (see extractFilters). A filter on one of these must carry exactly
// one value, else the extra values would be silently dropped.
var scalarFilterFields = map[string]struct{}{
	fieldPaused:              {},
	fieldType:                {},
	fieldDashboardUID:        {},
	fieldPanelID:             {},
	fieldReceiver:            {},
	fieldNotificationType:    {},
	fieldRoutingTree:         {},
	fieldMetric:              {},
	fieldTargetDatasourceUID: {},
	fieldLabels:              {},
}

// selectableLabelKeys are the resource metadata label keys a labelSelector may
// target. Legacy rules carry no arbitrary metadata labels (their k8s metadata is
// synthesized when converting from the ngalert store), so only the controlled
// keys the legacy backend can filter are accepted. Selecting on any other key is
// rejected rather than matching nothing on legacy while working on unified.
var selectableLabelKeys = map[string]struct{}{
	model.GroupLabelKey: {},
}

// validateQuery checks q against the fields declared for k and the restrictions
// above. It returns the flattened where leaves so the caller does not walk the
// tree twice.
func validateQuery(q *searchv0.SearchQuery, k kind) ([]searchv0.WhereNode, field.ErrorList) {
	errs := validateEnvelope(q.TypeMeta)

	leaves, whereErrs := validateWhere(q.Where, k, field.NewPath("where"))
	errs = append(errs, whereErrs...)
	errs = append(errs, validateLabelSelector(q.LabelSelector, field.NewPath("labelSelector"))...)
	errs = append(errs, validateSort(q.Sort, k, field.NewPath("sort"))...)
	errs = append(errs, validateReturnFields(q.Fields, k, field.NewPath("fields"))...)
	errs = append(errs, validateFacets(q.Facets, k, field.NewPath("facets"))...)
	if q.Limit < 0 {
		errs = append(errs, field.Invalid(field.NewPath("limit"), q.Limit, "must not be negative"))
	}
	if q.FacetLimit < 0 {
		errs = append(errs, field.Invalid(field.NewPath("facetLimit"), q.FacetLimit, "must not be negative"))
	}
	if _, err := decodeCursor(q.Continue); err != nil {
		errs = append(errs, field.Invalid(field.NewPath("continue"), "<opaque>", "invalid continuation token"))
	}
	return leaves, errs
}

// validateEnvelope checks the request carries the search.grafana.app envelope.
// The routes live in the alerting group but speak the generic contract, so the
// apiVersion names that group and not this one.
func validateEnvelope(tm metav1.TypeMeta) field.ErrorList {
	var errs field.ErrorList
	if tm.APIVersion != searchv0.APIVERSION {
		errs = append(errs, field.NotSupported(field.NewPath("apiVersion"), tm.APIVersion, []string{searchv0.APIVERSION}))
	}
	if tm.Kind != searchv0.KindSearchQuery {
		errs = append(errs, field.NotSupported(field.NewPath("kind"), tm.Kind, []string{searchv0.KindSearchQuery}))
	}
	return errs
}

// validateWhere enforces the accepted subset -- a single top-level leaf, or one
// and over leaves -- and returns the flattened leaves for translation.
func validateWhere(where *searchv0.WhereNode, k kind, p *field.Path) ([]searchv0.WhereNode, field.ErrorList) {
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
		var errs field.ErrorList
		leaves := make([]searchv0.WhereNode, 0, len(where.And))
		sawText := false
		// A field filtered twice is rejected: unified ANDs the requirements while
		// legacy keeps one, so the two backends would disagree. Labels are the
		// exception; each labels leaf carries its own matcher and they conjoin on
		// both backends.
		seenFilterFields := map[string]bool{}
		for i := range where.And {
			child := where.And[i]
			cp := andPath.Index(i)
			ck, cerr := singleKey(&child, cp)
			if cerr != nil {
				errs = append(errs, cerr)
				continue
			}
			if ck != "text" && ck != "filter" {
				errs = append(errs, field.Invalid(cp, ck, "only text and filter leaves are allowed inside and"))
				continue
			}
			// A second text leaf would overwrite the backend query, so it is rejected
			// rather than silently dropped.
			if ck == "text" {
				if sawText {
					errs = append(errs, field.Forbidden(cp.Child("text"), "at most one text leaf is allowed"))
					continue
				}
				sawText = true
			}
			if ck == "filter" && child.Filter.Field != fieldLabels {
				if seenFilterFields[child.Filter.Field] {
					errs = append(errs, field.Duplicate(cp.Child("filter").Child("field"), child.Filter.Field))
					continue
				}
				seenFilterFields[child.Filter.Field] = true
			}
			errs = append(errs, validateLeaf(&child, ck, k, cp)...)
			leaves = append(leaves, child)
		}
		return leaves, errs
	case "text", "filter":
		return []searchv0.WhereNode{*where}, validateLeaf(where, key, k, p)
	default:
		// or, not, range, exists: modelled for the future, rejected today.
		return nil, field.ErrorList{field.Invalid(p, key, fmt.Sprintf("%q is not supported", key))}
	}
}

// singleKey returns which single node type is set, or an error when none or more
// than one is.
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
		// An empty node matters as much as an over-set one: it would flatten to no
		// constraint at all and quietly return every rule.
		return "", field.Invalid(p, "{}", "node must set exactly one of: and, or, not, text, filter")
	default:
		return "", field.Invalid(p, strings.Join(set, ", "), "node must set exactly one key")
	}
}

func validateLeaf(n *searchv0.WhereNode, key string, k kind, p *field.Path) field.ErrorList {
	switch key {
	case "text":
		return validateTextLeaf(n.Text, k, p.Child("text"))
	case "filter":
		return validateFilterLeaf(n.Filter, k, p.Child("filter"))
	}
	return nil
}

func validateTextLeaf(t *searchv0.TextPredicate, k kind, p *field.Path) field.ErrorList {
	var errs field.ErrorList
	if strings.TrimSpace(t.Value) == "" {
		errs = append(errs, field.Required(p.Child("value"), "text value is required"))
	}
	if strings.ContainsAny(t.Value, "*%") {
		errs = append(errs, field.Invalid(p.Child("value"), t.Value, "wildcard values are not allowed"))
	}
	if t.Boost != nil {
		errs = append(errs, field.Forbidden(p.Child("boost"), "boost is not supported"))
	}
	seen := map[string]bool{}
	for i, name := range t.Fields {
		fp := p.Child("fields").Index(i)
		// A repeated field would add its scored clause twice, an implicit boost.
		if seen[name] {
			errs = append(errs, field.Duplicate(fp, name))
			continue
		}
		seen[name] = true
		if capErrs := checkCapability(k, name, resource.SearchCapabilityText, fp); len(capErrs) > 0 {
			errs = append(errs, capErrs...)
			continue
		}
		if _, ok := legacyTextFields[name]; !ok {
			errs = append(errs, field.Invalid(fp, name, "text search on this field is not supported"))
		}
	}
	return errs
}

func validateFilterLeaf(f *searchv0.FilterPredicate, k kind, p *field.Path) field.ErrorList {
	var errs field.ErrorList

	if f.Field == "" {
		errs = append(errs, field.Required(p.Child("field"), "filter field is required"))
	} else {
		errs = append(errs, validateFilterField(f.Field, k, p.Child("field"))...)
	}
	if f.Operator != filterOperatorIn && f.Operator != filterOperatorNotIn {
		errs = append(errs, field.NotSupported(p.Child("operator"), f.Operator, []string{filterOperatorIn, filterOperatorNotIn}))
	}
	if len(f.Values) == 0 {
		errs = append(errs, field.Required(p.Child("values"), "at least one value is required"))
	}
	for i, v := range f.Values {
		// The backend still reads '*' as a wildcard in field filters, so a literal
		// '*' in a value would be misinterpreted.
		if strings.Contains(v, "*") {
			errs = append(errs, field.Invalid(p.Child("values").Index(i), v, "wildcard values are not allowed"))
		}
		// An empty value is the worst kind of divergence: the legacy backend reads
		// it as "no filter" and returns every rule of the kind (see stringFilter and
		// includeFilter), while unified matches the empty term and returns none.
		if v == "" {
			errs = append(errs, field.Required(p.Child("values").Index(i), "filter values must not be empty"))
		}
	}
	// Everything below reads a value or pairs field with operator, so it only
	// makes sense once both are present and well-formed.
	if len(errs) > 0 {
		return errs
	}

	if _, scalar := scalarFilterFields[f.Field]; scalar && len(f.Values) != 1 {
		errs = append(errs, field.Invalid(p.Child("values"), f.Values, fmt.Sprintf("filter on %q accepts exactly one value", f.Field)))
		return errs
	}
	// Only the labels field round-trips negation to the legacy backend
	// (requirementToLabelMatcher reads the operator). Every other field's legacy
	// matcher ignores the operator and would apply NotIn as an inclusive match,
	// returning the opposite of what was asked for.
	if f.Operator == filterOperatorNotIn && f.Field != fieldLabels {
		errs = append(errs, field.Invalid(p.Child("operator"), f.Operator, fmt.Sprintf("the NotIn operator is not supported on %q", f.Field)))
		return errs
	}

	switch f.Field {
	case fieldType:
		if _, ok := validRuleTypes[f.Values[0]]; !ok {
			errs = append(errs, field.NotSupported(p.Child("values").Index(0), f.Values[0], ruleTypeNames()))
		}
	case fieldPaused:
		value, err := strconv.ParseBool(f.Values[0])
		if err != nil {
			errs = append(errs, field.Invalid(p.Child("values").Index(0), f.Values[0], "must be a boolean"))
		} else {
			f.Values[0] = strconv.FormatBool(value)
		}
	case fieldNotificationType:
		// The legacy store turns an unrecognised value into a query error, which
		// would surface as a 500 for what is really bad input.
		if _, ok := validNotificationTypes[f.Values[0]]; !ok {
			errs = append(errs, field.NotSupported(p.Child("values").Index(0), f.Values[0], notificationTypeNames()))
		}
	case fieldPanelID:
		id, err := strconv.ParseInt(f.Values[0], 10, 64)
		if err != nil {
			errs = append(errs, field.Invalid(p.Child("values").Index(0), f.Values[0], "must be an integer"))
			break
		}
		// The legacy store treats a zero panel ID as "no panel filter" and returns
		// every rule of the kind, where unified matches the rules whose panel ID
		// really is 0.
		if id == 0 {
			errs = append(errs, field.Invalid(p.Child("values").Index(0), f.Values[0], "filtering on panel ID 0 is not supported"))
		} else {
			f.Values[0] = strconv.FormatInt(id, 10)
		}
	case fieldLabels:
		// The In/NotIn operator already carries negation, so a "!"-prefixed value
		// or a "!=" matcher would make the requested operation ambiguous.
		if v := f.Values[0]; strings.HasPrefix(v, "!") || strings.Contains(v, "!=") {
			errs = append(errs, field.Invalid(p.Child("values").Index(0), v, "must not be negated; use the NotIn operator instead"))
		}
	case fieldDatasourceUIDs:
		for i, v := range f.Values {
			if !datasourceUIDPattern.MatchString(v) {
				errs = append(errs, field.Invalid(p.Child("values").Index(i), v, "must be a valid datasource UID"))
				continue
			}
			if expr.NodeTypeFromDatasourceUID(v) != expr.TypeDatasourceNode {
				errs = append(errs, field.Invalid(p.Child("values").Index(i), v, "this UID names a server-side expression node, which is never indexed"))
			}
		}
	}
	return errs
}

// validateFilterField reports whether the field can be filtered on at all: it
// must be declared filterable by the kind, and the legacy backend must have a
// matcher for it.
func validateFilterField(name string, k kind, p *field.Path) field.ErrorList {
	if errs := checkCapability(k, name, resource.SearchCapabilityFilter, p); len(errs) > 0 {
		return errs
	}
	if _, ok := legacyFilterableFields[name]; !ok {
		return field.ErrorList{field.Invalid(p, name, "filtering on this field is not supported")}
	}
	return nil
}

func validateSort(sorts []searchv0.SortField, k kind, p *field.Path) field.ErrorList {
	var errs field.ErrorList
	seen := make(map[string]struct{}, len(sorts))
	for i, s := range sorts {
		sp := p.Index(i)
		if s.Direction != "" && s.Direction != sortAscending && s.Direction != sortDescending {
			errs = append(errs, field.NotSupported(sp.Child("direction"), s.Direction, []string{sortAscending, sortDescending}))
		}
		fp := sp.Child("field")
		if _, ok := seen[s.Field]; ok {
			errs = append(errs, field.Duplicate(fp, s.Field))
			continue
		}
		seen[s.Field] = struct{}{}
		if capErrs := checkCapability(k, s.Field, resource.SearchCapabilitySort, fp); len(capErrs) > 0 {
			errs = append(errs, capErrs...)
			continue
		}
		if _, ok := legacySortFields[s.Field]; !ok {
			errs = append(errs, field.Invalid(fp, s.Field, "sorting on this field is not supported"))
		}
	}
	return errs
}

// validateReturnFields checks the projection. A field must be retrievable on the
// kind and carried by the result table both backends emit, else it would be
// silently absent from every hit.
func validateReturnFields(fields []string, k kind, p *field.Path) field.ErrorList {
	var errs field.ErrorList
	for i, name := range fields {
		fp := p.Index(i)
		if capErrs := checkCapability(k, name, resource.SearchCapabilityRetrieve, fp); len(capErrs) > 0 {
			errs = append(errs, capErrs...)
			continue
		}
		if _, ok := results.index[name]; !ok {
			errs = append(errs, field.Invalid(fp, name, "returning this field is not supported"))
		}
	}
	return errs
}

// validateFacets checks the requested facets. No rule field declares the facet
// capability today, so every facet is rejected; the check is written against the
// capability rather than hardcoded so declaring one is all it takes to serve it.
func validateFacets(facets []string, k kind, p *field.Path) field.ErrorList {
	errs := make(field.ErrorList, 0, len(facets))
	for i, name := range facets {
		errs = append(errs, checkCapability(k, name, resource.SearchCapabilityFacet, p.Index(i))...)
	}
	return errs
}

// validateLabelSelector checks the metadata label selector. This is the
// conventional meaning of labelSelector -- it selects on the resource's
// metadata.labels, mirroring the generic translation -- not on the rules' own
// alerting labels, which are filtered through a where filter leaf on the indexed
// "labels" field.
func validateLabelSelector(sel *metav1.LabelSelector, p *field.Path) field.ErrorList {
	if sel == nil {
		return nil
	}
	// Standard k8s validation covers key/value syntax (including rejecting '*',
	// which is not a valid label value) and the rule that In/NotIn carry values:
	// an empty In would otherwise reach the backend as a match-all filter.
	errs := metav1validation.ValidateLabelSelector(sel, metav1validation.LabelSelectorValidationOptions{}, p)

	// One requirement per key, for the same reason a where filter leaf may not
	// repeat a field: Kubernetes semantics conjoin two requirements on one key,
	// unified does too, and the legacy backend unions them into a single IN clause
	// (see extractFilters, which appends into one group filter). Two backends, two
	// answers.
	seen := map[string]bool{}
	claim := func(key string, p *field.Path) field.ErrorList {
		if seen[key] {
			return field.ErrorList{field.Duplicate(p, key)}
		}
		seen[key] = true
		return nil
	}

	// matchLabels is a map, so its keys are already unique among themselves, but
	// sorted here so a clash with matchExpressions is reported deterministically.
	for _, key := range sortedStrings(sel.MatchLabels) {
		kp := p.Child("matchLabels").Key(key)
		errs = append(errs, claim(key, kp)...)
		errs = append(errs, checkSelectableKey(key, kp)...)
	}
	for i, r := range sel.MatchExpressions {
		ep := p.Child("matchExpressions").Index(i)
		// Existence operators have no requirement representation and the legacy
		// backend cannot express them.
		if r.Operator != metav1.LabelSelectorOpIn && r.Operator != metav1.LabelSelectorOpNotIn {
			errs = append(errs, field.NotSupported(ep.Child("operator"), string(r.Operator),
				[]string{string(metav1.LabelSelectorOpIn), string(metav1.LabelSelectorOpNotIn)}))
		}
		errs = append(errs, claim(r.Key, ep.Child("key"))...)
		errs = append(errs, checkSelectableKey(r.Key, ep.Child("key"))...)
	}
	return errs
}

func sortedStrings(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// checkSelectableKey keeps selection to the controlled metadata labels the legacy
// backend can filter.
//
// The unified backend indexes label values whole, so matching is exact on any
// index built since. An index built before that still overmatches values sharing
// a word until it is rebuilt, which is one reason selection stays this narrow:
// the allowed keys carry generated values that do not collide in practice.
func checkSelectableKey(key string, p *field.Path) field.ErrorList {
	if _, ok := selectableLabelKeys[key]; ok {
		return nil
	}
	return field.ErrorList{field.Invalid(p, key, "this label key is not selectable")}
}

// checkCapability reports whether the kind declares the field with c, using the
// generic search API's wording so the two endpoints reject a field the same way.
func checkCapability(k kind, name string, c resource.SearchCapability, p *field.Path) field.ErrorList {
	if !k.fields.known(name) {
		return field.ErrorList{field.Invalid(p, name, "unknown field")}
	}
	if !k.fields.has(name, c) {
		return field.ErrorList{field.Invalid(p, name, fmt.Sprintf("field does not support %s", c))}
	}
	return nil
}

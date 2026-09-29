package search

import (
	"slices"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apimachinery/pkg/util/validation/field"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	defaultHybridLimit = 50
	maxHybridLimit     = 200
)

// TranslateHybridSearchQuery validates the public envelope and scopes the RPC to
// the mounted resource and the request's namespace. Embedding declarations do not
// grant filtering capabilities: both search legs must support every filter.
func TranslateHybridSearchQuery(q *searchv0.HybridSearchQuery, gvr schema.GroupVersionResource, namespace string) (*resourcepb.HybridSearchRequest, field.ErrorList) {
	errs := validateEnvelope(q.TypeMeta, searchv0.KindHybridSearchQuery)
	if strings.TrimSpace(q.Query) == "" {
		errs = append(errs, field.Required(field.NewPath("query"), "must not be empty or whitespace"))
	}
	if len(q.Query) > 1000 {
		errs = append(errs, field.Invalid(field.NewPath("query"), q.Query, "must not exceed 1000 bytes"))
	}
	if len(q.SemanticQuery) > 1000 {
		errs = append(errs, field.Invalid(field.NewPath("semanticQuery"), q.SemanticQuery, "must not exceed 1000 bytes"))
	}
	if q.SemanticQuery != "" && strings.TrimSpace(q.SemanticQuery) == "" {
		errs = append(errs, field.Invalid(field.NewPath("semanticQuery"), q.SemanticQuery, "must not be whitespace"))
	}
	if q.Limit < 0 {
		errs = append(errs, field.Invalid(field.NewPath("limit"), q.Limit, "must not be negative"))
	}
	if q.MinRelevance != "" {
		levels := []string{"lowest", "low", "medium", "high", "highest"}
		if !slices.Contains(levels, q.MinRelevance) {
			errs = append(errs, field.NotSupported(field.NewPath("minRelevance"), q.MinRelevance, levels))
		}
		if q.SkipRerank {
			errs = append(errs, field.Invalid(field.NewPath("minRelevance"), q.MinRelevance, "cannot be combined with skipRerank"))
		}
	}
	errs = append(errs, validateHybridFilters(q.Filters, gvr)...)
	if len(errs) > 0 {
		return nil, errs
	}

	limit := q.Limit
	if limit == 0 {
		limit = defaultHybridLimit
	}
	req := &resourcepb.HybridSearchRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: namespace,
			Group:     gvr.Group,
			Resource:  gvr.Resource,
		},
		Query:         q.Query,
		SemanticQuery: q.SemanticQuery,
		Limit:         min(limit, maxHybridLimit),
		MinRelevance:  q.MinRelevance,
		SkipRerank:    q.SkipRerank,
		Filters:       make([]*resourcepb.Requirement, 0, len(q.Filters)),
	}
	for _, f := range q.Filters {
		req.Filters = append(req.Filters, &resourcepb.Requirement{
			Key: f.Field, Operator: string(selection.In), Values: f.Values,
		})
	}
	return req, nil
}

func validateHybridFilters(filters []searchv0.HybridSearchFilter, gvr schema.GroupVersionResource) field.ErrorList {
	allowed := []string{"uid", "folder"}
	if gvr.Group == "dashboard.grafana.app" && gvr.Resource == "dashboards" {
		allowed = append(allowed, "datasource_uid", "language")
	}
	seen := make(map[string]bool, len(filters))
	totalValues := 0
	var errs field.ErrorList
	for i, f := range filters {
		path := field.NewPath("filters").Index(i)
		if !slices.Contains(allowed, f.Field) {
			errs = append(errs, field.NotSupported(path.Child("field"), f.Field, allowed))
		}
		if seen[f.Field] {
			errs = append(errs, field.Duplicate(path.Child("field"), f.Field))
		}
		seen[f.Field] = true
		if len(f.Values) == 0 {
			errs = append(errs, field.Required(path.Child("values"), "must contain at least one value"))
		}
		totalValues += len(f.Values)
		for j, v := range f.Values {
			// Filters must stay exact: the lexical backend can interpret '*' as a wildcard.
			if strings.Contains(v, "*") {
				errs = append(errs, field.Invalid(path.Child("values").Index(j), v, "wildcard values are not allowed"))
			}
		}
		if f.Field == "language" {
			languages := []string{"promql", "logql", "traceql", "sql"}
			for j, v := range f.Values {
				if !slices.Contains(languages, v) {
					errs = append(errs, field.NotSupported(path.Child("values").Index(j), v, languages))
				}
			}
		}
	}
	if totalValues > 1000 {
		errs = append(errs, field.Invalid(field.NewPath("filters"), totalValues, "must not exceed 1000 values in total"))
	}
	return errs
}

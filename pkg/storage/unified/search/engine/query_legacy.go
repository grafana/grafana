package engine

import (
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// FromResourceSearchRequest converts the legacy public gRPC search request into
// the engine-agnostic SearchRequest. Authz is not embedded; callers pass an
// in-process ItemChecker to SearchEngine.Search instead.
func FromResourceSearchRequest(req *resourcepb.ResourceSearchRequest) (*resourcepb.SearchRequest, error) {
	if req == nil || req.Options == nil || req.Options.Key == nil {
		return nil, fmt.Errorf("search key is required")
	}
	out := &resourcepb.SearchRequest{
		Index: &resourcepb.ResourceIndexKey{
			Namespace: req.Options.Key.Namespace,
			Group:     req.Options.Key.Group,
			Resource:  req.Options.Key.Resource,
		},
		Limit:        req.Limit,
		Offset:       req.Offset,
		Fields:       append([]string(nil), req.Fields...),
		Explain:      req.Explain,
		IsDeleted:    req.IsDeleted,
		SearchAfter:  append([]string(nil), req.SearchAfter...),
		IncludeTotal: true,
		Query:        &resourcepb.Query{},
	}
	for _, f := range req.Federated {
		if f == nil {
			continue
		}
		out.Federated = append(out.Federated, &resourcepb.ResourceIndexKey{
			Namespace: f.Namespace,
			Group:     f.Group,
			Resource:  f.Resource,
		})
	}
	for _, label := range req.Options.Labels {
		if label == nil {
			continue
		}
		op, err := selectionToFilterOp(label.Operator)
		if err != nil {
			return nil, err
		}
		out.Query.Labels = append(out.Query.Labels, &resourcepb.LabelRequirement{
			Key:    label.Key,
			Op:     op,
			Values: label.Values,
		})
	}
	for _, field := range req.Options.Fields {
		if field == nil {
			continue
		}
		op, err := selectionToFilterOp(field.Operator)
		if err != nil {
			return nil, err
		}
		out.Query.Filters = append(out.Query.Filters, &resourcepb.FilterPredicate{
			Field:  publicFieldName(field.Key),
			Op:     op,
			Values: field.Values,
		})
	}
	if req.Query != "" {
		text := &resourcepb.TextPredicate{Value: req.Query}
		if len(req.QueryFields) > 0 {
			for _, qf := range req.QueryFields {
				if qf == nil {
					continue
				}
				text.Fields = append(text.Fields, publicFieldName(qf.Name))
			}
		}
		out.Query.Text = []*resourcepb.TextPredicate{text}
	}
	for _, s := range req.SortBy {
		if s == nil {
			continue
		}
		out.Sort = append(out.Sort, &resourcepb.Sort{
			Field: publicFieldName(s.Field),
			Desc:  s.Desc,
		})
	}
	for name, facet := range req.Facet {
		if facet == nil {
			continue
		}
		field := facet.Field
		if field == "" {
			field = name
		}
		out.Facets = append(out.Facets, &resourcepb.FacetRequest{
			Field: publicFieldName(field),
			Limit: facet.Limit,
		})
	}
	if out.Query != nil && len(out.Query.Text) == 0 && len(out.Query.Filters) == 0 && len(out.Query.Labels) == 0 {
		out.Query = nil
	}
	return out, nil
}

// ToResourceSearchResponse converts an engine SearchResponse back to the legacy
// ResourceSearchResponse consumed by existing gRPC clients.
func ToResourceSearchResponse(req *resourcepb.ResourceSearchRequest, rsp *resourcepb.SearchResponse) (*resourcepb.ResourceSearchResponse, error) {
	if rsp == nil {
		return nil, fmt.Errorf("nil response")
	}
	out := &resourcepb.ResourceSearchResponse{
		Error:           rsp.Error,
		TotalHits:       rsp.TotalHits,
		MaxScore:        rsp.MaxScore,
		ResourceVersion: rsp.ResourceVersion,
		Facet:           make(map[string]*resourcepb.ResourceSearchResponse_Facet),
	}
	if req != nil && req.Options != nil {
		out.Key = req.Options.Key
	}
	columns := legacyResultColumns(req, rsp)
	out.Results = &resourcepb.ResourceTable{Columns: columns}
	for _, hit := range rsp.Hits {
		if hit == nil {
			continue
		}
		row := &resourcepb.ResourceTableRow{
			Key:        hit.Key,
			Cells:      make([][]byte, len(columns)),
			SortFields: append([]string(nil), hit.SortValues...),
		}
		values := map[string]string{}
		for _, fv := range hit.Fields {
			if fv == nil {
				continue
			}
			values[fv.Name] = fieldValueToString(fv)
		}
		for i, col := range columns {
			switch col.Name {
			case resource.SEARCH_FIELD_SCORE:
				row.Cells[i] = []byte(fmt.Sprintf("%g", hit.Score))
			default:
				name := strings.TrimPrefix(col.Name, resource.SEARCH_FIELD_PREFIX)
				row.Cells[i] = []byte(values[name])
			}
		}
		out.Results.Rows = append(out.Results.Rows, row)
	}
	for _, facet := range rsp.Facets {
		if facet == nil {
			continue
		}
		fr := &resourcepb.ResourceSearchResponse_Facet{
			Field:   facet.Field,
			Total:   facet.Total,
			Missing: facet.Missing,
		}
		for _, term := range facet.Terms {
			if term == nil {
				continue
			}
			fr.Terms = append(fr.Terms, &resourcepb.ResourceSearchResponse_TermFacet{
				Term:  term.Term,
				Count: term.Count,
			})
		}
		out.Facet[facet.Field] = fr
	}
	return out, nil
}

func legacyResultColumns(req *resourcepb.ResourceSearchRequest, rsp *resourcepb.SearchResponse) []*resourcepb.ResourceTableColumnDefinition {
	names := []string{resource.SEARCH_FIELD_NAME, resource.SEARCH_FIELD_TITLE, resource.SEARCH_FIELD_FOLDER}
	if req != nil && len(req.Fields) > 0 {
		names = append([]string{resource.SEARCH_FIELD_NAME}, req.Fields...)
	} else if len(rsp.Hits) > 0 && len(rsp.Hits[0].Fields) > 0 {
		for _, fv := range rsp.Hits[0].Fields {
			if fv != nil {
				names = append(names, resource.SEARCH_FIELD_PREFIX+fv.Name)
			}
		}
	}
	if req != nil && req.Query != "" {
		names = append(names, resource.SEARCH_FIELD_SCORE)
	}
	cols := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(names))
	seen := map[string]struct{}{}
	for _, name := range names {
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		cols = append(cols, &resourcepb.ResourceTableColumnDefinition{
			Name: name,
			Type: resourcepb.ResourceTableColumnDefinition_STRING,
		})
	}
	return cols
}

func publicFieldName(name string) string {
	name = strings.TrimPrefix(name, resource.SEARCH_SELECTABLE_FIELDS_PREFIX)
	return strings.TrimPrefix(name, resource.SEARCH_FIELD_PREFIX)
}

func fieldValueToString(fv *resourcepb.FieldValue) string {
	if fv == nil || len(fv.Values) == 0 {
		return ""
	}
	if len(fv.Values) == 1 {
		return fv.Values[0].GetStringValue()
	}
	parts := make([]string, 0, len(fv.Values))
	for _, v := range fv.Values {
		parts = append(parts, v.GetStringValue())
	}
	return strings.Join(parts, ",")
}

func selectionToFilterOp(op string) (resourcepb.FilterOp, error) {
	switch selection.Operator(op) {
	case selection.In, selection.Equals, selection.DoubleEquals:
		return resourcepb.FilterOp_FILTER_OP_IN, nil
	case selection.NotIn, selection.NotEquals:
		return resourcepb.FilterOp_FILTER_OP_NOT_IN, nil
	default:
		return resourcepb.FilterOp_FILTER_OP_UNSPECIFIED, fmt.Errorf("unsupported operator %q", op)
	}
}

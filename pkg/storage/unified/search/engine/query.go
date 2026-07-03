package engine

import (
	"fmt"
	"strings"

	"google.golang.org/protobuf/types/known/structpb"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// ToResourceSearchRequest translates an engine SearchRequest into the legacy
// ResourceSearchRequest consumed by the bleve index today.
func ToResourceSearchRequest(req *resourcepb.SearchRequest) (*resourcepb.ResourceSearchRequest, error) {
	if req == nil || req.Index == nil {
		return nil, fmt.Errorf("search index key is required")
	}
	out := &resourcepb.ResourceSearchRequest{
		Limit:       req.Limit,
		Offset:      req.Offset,
		Fields:      append([]string(nil), req.Fields...),
		Explain:     req.Explain,
		IsDeleted:   req.IsDeleted,
		SearchAfter: append([]string(nil), req.SearchAfter...),
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: req.Index.Namespace,
				Group:     req.Index.Group,
				Resource:  req.Index.Resource,
			},
		},
	}
	for _, f := range req.Federated {
		if f == nil {
			continue
		}
		out.Federated = append(out.Federated, &resourcepb.ResourceKey{
			Namespace: f.Namespace,
			Group:     f.Group,
			Resource:  f.Resource,
		})
	}
	if req.Query != nil {
		if err := applyQuery(out, req.Query); err != nil {
			return nil, err
		}
	}
	if err := applyAuthzFilter(out, req.Authz); err != nil {
		return nil, err
	}
	for _, s := range req.Sort {
		if s == nil {
			continue
		}
		out.SortBy = append(out.SortBy, &resourcepb.ResourceSearchRequest_Sort{
			Field: ResolveFieldName(s.Field),
			Desc:  s.Desc,
		})
	}
	if len(req.Facets) > 0 {
		out.Facet = make(map[string]*resourcepb.ResourceSearchRequest_Facet, len(req.Facets))
		for _, f := range req.Facets {
			if f == nil {
				continue
			}
			out.Facet[f.Field] = &resourcepb.ResourceSearchRequest_Facet{
				Field: ResolveFieldName(f.Field),
				Limit: f.Limit,
			}
		}
	}
	return out, nil
}

func applyQuery(out *resourcepb.ResourceSearchRequest, q *resourcepb.Query) error {
	if q == nil {
		return nil
	}
	for _, label := range q.Labels {
		if label == nil {
			continue
		}
		op, err := filterOpToSelection(label.Op)
		if err != nil {
			return err
		}
		out.Options.Labels = append(out.Options.Labels, &resourcepb.Requirement{
			Key:      label.Key,
			Operator: string(op),
			Values:   label.Values,
		})
	}
	for _, filter := range q.Filters {
		if filter == nil {
			continue
		}
		op, err := filterOpToSelection(filter.Op)
		if err != nil {
			return err
		}
		out.Options.Fields = append(out.Options.Fields, &resourcepb.Requirement{
			Key:      ResolveFieldName(filter.Field),
			Operator: string(op),
			Values:   filter.Values,
		})
	}
	if len(q.Text) > 0 {
		text := q.Text[0]
		if text == nil {
			return nil
		}
		out.Query = text.Value
		for _, field := range text.Fields {
			out.QueryFields = append(out.QueryFields, &resourcepb.ResourceSearchRequest_QueryField{
				Name: ResolveFieldName(field),
				Type: resourcepb.QueryFieldType_TEXT,
			})
		}
	}
	return nil
}

func applyAuthzFilter(out *resourcepb.ResourceSearchRequest, authz *resourcepb.AuthzFilter) error {
	if authz == nil || authz.All {
		return nil
	}
	if len(authz.Folders) > 0 {
		out.Options.Fields = append(out.Options.Fields, &resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_FOLDER,
			Operator: string(selection.In),
			Values:   authz.Folders,
		})
	}
	if len(authz.Names) > 0 {
		out.Options.Fields = append(out.Options.Fields, &resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_NAME,
			Operator: string(selection.In),
			Values:   authz.Names,
		})
	}
	return nil
}

func filterOpToSelection(op resourcepb.FilterOp) (selection.Operator, error) {
	switch op {
	case resourcepb.FilterOp_FILTER_OP_IN, resourcepb.FilterOp_FILTER_OP_UNSPECIFIED:
		return selection.In, nil
	case resourcepb.FilterOp_FILTER_OP_NOT_IN:
		return selection.NotIn, nil
	default:
		return "", fmt.Errorf("unsupported filter op %v", op)
	}
}

// FromResourceSearchResponse converts a legacy table response to engine hits.
func FromResourceSearchResponse(rsp *resourcepb.ResourceSearchResponse) (*resourcepb.SearchResponse, error) {
	if rsp == nil {
		return nil, fmt.Errorf("nil response")
	}
	out := &resourcepb.SearchResponse{
		Error:           rsp.Error,
		TotalHits:       rsp.TotalHits,
		MaxScore:        rsp.MaxScore,
		ResourceVersion: rsp.ResourceVersion,
	}
	if rsp.Results != nil {
		for _, row := range rsp.Results.Rows {
			hit, err := tableRowToHit(rsp.Results.Columns, row)
			if err != nil {
				return nil, err
			}
			out.Hits = append(out.Hits, hit)
		}
	}
	for field, facet := range rsp.Facet {
		if facet == nil {
			continue
		}
		fr := &resourcepb.FacetResult{
			Field:   field,
			Total:   facet.Total,
			Missing: facet.Missing,
		}
		for _, term := range facet.Terms {
			if term == nil {
				continue
			}
			fr.Terms = append(fr.Terms, &resourcepb.TermCount{
				Term:  term.Term,
				Count: term.Count,
			})
		}
		out.Facets = append(out.Facets, fr)
	}
	return out, nil
}

func tableRowToHit(columns []*resourcepb.ResourceTableColumnDefinition, row *resourcepb.ResourceTableRow) (*resourcepb.Hit, error) {
	if row == nil {
		return nil, fmt.Errorf("nil row")
	}
	hit := &resourcepb.Hit{
		Key:        row.Key,
		SortValues: append([]string(nil), row.SortFields...),
	}
	for i, col := range columns {
		if col == nil || i >= len(row.Cells) {
			continue
		}
		if col.Name == resource.SEARCH_FIELD_SCORE {
			continue
		}
		name := strings.TrimPrefix(col.Name, resource.SEARCH_FIELD_PREFIX)
		hit.Fields = append(hit.Fields, &resourcepb.FieldValue{
			Name:   name,
			Values: []*structpb.Value{structpb.NewStringValue(string(row.Cells[i]))},
		})
	}
	return hit, nil
}

package search

import (
	"context"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var _ Backend = (*unifiedClient)(nil)

type unifiedClient struct {
	client resourcepb.ResourceIndexClient
}

func NewUnifiedClient(client resourcepb.ResourceIndexClient) *unifiedClient {
	return &unifiedClient{client: client}
}

func buildUnifiedRequest(query *Query) *resourcepb.ResourceSearchRequest {
	req := &resourcepb.ResourceSearchRequest{
		Options:      &resourcepb.ListOptions{Key: resourceKey(query.Namespace, query.Resource)},
		Limit:        query.Limit,
		Offset:       query.Offset,
		Fields:       query.Fields,
		Query:        query.Text,
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
	}
	for _, f := range query.Filters {
		req.Options.Fields = append(req.Options.Fields, &resourcepb.Requirement{Key: f.Field, Operator: strings.ToLower(f.Operator), Values: f.Values})
	}
	for _, r := range query.Regexes {
		op := resource.OperatorRegex
		if r.Negate {
			op = resource.OperatorNotRegex
		}
		req.Options.Fields = append(req.Options.Fields, &resourcepb.Requirement{Key: r.Field, Operator: string(op), Values: []string{r.Pattern}})
	}
	for _, f := range query.GroupFilters {
		req.Options.Labels = append(req.Options.Labels, &resourcepb.Requirement{Key: f.Key, Operator: strings.ToLower(string(f.Operator)), Values: f.Values})
	}
	for _, s := range query.Sort {
		req.SortBy = append(req.SortBy, &resourcepb.ResourceSearchRequest_Sort{Field: s.Field, Desc: s.Direction == sortDescending})
	}
	return req
}

func (c *unifiedClient) Search(ctx context.Context, query *Query) (*Result, error) {
	resp, err := c.client.Search(ctx, buildUnifiedRequest(query))
	if err := resource.StatusErrorFromResponse(resp.GetError(), err); err != nil {
		return nil, err
	}
	if resp != nil && resp.GetResultFormat() != resourcepb.ResourceSearchRequest_FIELD_VALUES {
		return nil, fmt.Errorf("unsupported search result format %d", resp.GetResultFormat())
	}
	wanted := requestedFields(query.Fields)
	hits := make([]Hit, 0, len(resp.GetRows()))
	for i, row := range resp.GetRows() {
		if row == nil || row.GetKey() == nil {
			return nil, fmt.Errorf("field-value search result row %d has no resource key", i)
		}
		values, err := resource.DecodeSearchValues(resp.GetFields(), row)
		if err != nil {
			return nil, fmt.Errorf("decoding field-value search result row %d: %w", i, err)
		}
		for name := range values {
			if !wanted[name] {
				delete(values, name)
			}
		}
		hits = append(hits, Hit{Name: row.Key.Name, Values: values})
	}
	return &Result{Hits: hits, TotalHits: resp.GetTotalHits(), TotalHitsExact: resp.GetTotalHitsExact()}, nil
}

func resourceKey(namespace string, gr schema.GroupResource) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{Namespace: namespace, Group: gr.Group, Resource: gr.Resource}
}

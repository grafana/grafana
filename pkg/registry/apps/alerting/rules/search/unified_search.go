package search

import (
	"context"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var _ Backend = (*unifiedClient)(nil)

type unifiedClient struct {
	client resourcepb.ResourceIndexClient
	logger log.Logger
}

func NewUnifiedClient(client resourcepb.ResourceIndexClient) *unifiedClient {
	return &unifiedClient{client: client, logger: log.New("alerting.rules.search")}
}

func buildUnifiedRequest(query *Query) *resourcepb.ResourceSearchRequest {
	req := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{Key: resourceKey(query.Namespace, query.Primary)},
		Limit:   query.Limit,
		Offset:  query.Offset,
		// Explicit fields preserve free-text results from older search servers.
		Fields: query.Fields,
		Query:  query.Text,
	}
	if query.PerKind {
		req.ResultFormat = resourcepb.ResourceSearchRequest_FIELD_VALUES
	}
	for _, gr := range query.Federated {
		req.Federated = append(req.Federated, resourceKey(query.Namespace, gr))
	}
	for _, f := range query.Filters {
		req.Options.Fields = append(req.Options.Fields, &resourcepb.Requirement{Key: f.Field, Operator: strings.ToLower(f.Operator), Values: f.Values})
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
	if err := resource.ErrorFromResponse(resp.GetError(), err); err != nil {
		return nil, err
	}
	hits, err := c.decodeHits(ctx, query, resp)
	if err != nil {
		return nil, err
	}
	return &Result{Hits: hits, TotalHits: resp.GetTotalHits(), TotalHitsExact: resp.GetTotalHitsExact()}, nil
}

func (c *unifiedClient) decodeHits(ctx context.Context, query *Query, resp *resourcepb.ResourceSearchResponse) ([]Hit, error) {
	wanted := requestedFields(query.Fields)
	if query.PerKind {
		switch resp.GetResultFormat() {
		case resourcepb.ResourceSearchRequest_UNSPECIFIED, resourcepb.ResourceSearchRequest_RESOURCE_TABLE:
		case resourcepb.ResourceSearchRequest_FIELD_VALUES:
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
			return hits, nil
		default:
			return nil, fmt.Errorf("unsupported search result format %d", resp.GetResultFormat())
		}
	}

	table := resp.GetResults()
	cols := table.GetColumns()
	hits := make([]Hit, 0, len(table.GetRows()))
	for _, row := range table.GetRows() {
		if query.PerKind && len(row.GetCells()) != len(cols) {
			return nil, fmt.Errorf("row has %d cells but the table declares %d columns", len(row.GetCells()), len(cols))
		}
		values := map[string]any{}
		for i, col := range cols {
			if query.PerKind && !wanted[col.GetName()] {
				continue
			}
			if i >= len(row.GetCells()) || (!query.PerKind && len(row.Cells[i]) == 0) {
				continue
			}
			value, err := resource.DecodeCell(col, i, row.Cells[i])
			if err != nil {
				// A bad column should omit one field, not fail the entire search.
				c.logger.FromContext(ctx).Warn("failed to decode rule search result column", "namespace", query.Namespace,
					"group", query.Primary.Group, "resource", query.Primary.Resource, "column", col.GetName(), "rule", row.GetKey().GetName(), "error", err)
				continue
			}
			if value != nil {
				values[col.GetName()] = value
			}
		}
		hits = append(hits, Hit{Name: row.GetKey().GetName(), Values: values})
	}
	return hits, nil
}

func resourceKey(namespace string, gr schema.GroupResource) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{Namespace: namespace, Group: gr.Group, Resource: gr.Resource}
}

package team

import (
	"context"
	"strings"

	"k8s.io/apimachinery/pkg/selection"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	teamsearch "github.com/grafana/grafana/pkg/services/team/search"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

var _ SearchBackend = (*unifiedSearchClient)(nil)

type unifiedSearchClient struct {
	client resourcepb.ResourceIndexClient
}

func NewUnifiedSearchClient(client resourcepb.ResourceIndexClient) *unifiedSearchClient {
	return &unifiedSearchClient{client: client}
}

func (c *unifiedSearchClient) Search(ctx context.Context, query SearchQuery) (*iamv0.GetSearchTeamsResponse, error) {
	gr := iamv0.TeamResourceInfo.GroupResource()
	req := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Namespace: query.Namespace},
		},
		Query:        query.Query,
		Limit:        query.Limit,
		Page:         query.Page,
		Offset:       query.Offset,
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Fields:       []string{resource.SEARCH_FIELD_TITLE, builders.TEAM_SEARCH_EMAIL, builders.TEAM_SEARCH_PROVISIONED, builders.TEAM_SEARCH_EXTERNAL_UID, teamsearch.LegacyIDField},
	}
	if query.Member != "" {
		req.Options.Fields = append(req.Options.Fields, &resourcepb.Requirement{
			Key: builders.TEAM_SEARCH_MEMBERS, Operator: string(selection.Equals), Values: []string{query.Member},
		})
	}
	if query.Title != "" {
		req.Options.Fields = append(req.Options.Fields, &resourcepb.Requirement{
			Key: resource.SEARCH_FIELD_TITLE, Operator: string(selection.DoubleEquals), Values: []string{query.Title},
		})
	}
	if len(query.UIDs) > 0 {
		req.Options.Fields = append(req.Options.Fields, &resourcepb.Requirement{
			Key: resource.SEARCH_FIELD_NAME, Operator: string(selection.In), Values: query.UIDs,
		})
	}
	if len(query.TeamIDs) > 0 {
		req.Options.Labels = append(req.Options.Labels, &resourcepb.Requirement{
			Key: resource.SEARCH_FIELD_LEGACY_ID, Operator: string(selection.In), Values: query.TeamIDs,
		})
	}
	for _, field := range query.Sort {
		req.SortBy = append(req.SortBy, &resourcepb.ResourceSearchRequest_Sort{
			Field: strings.TrimPrefix(field, "-"), Desc: strings.HasPrefix(field, "-"),
		})
	}

	resp, err := c.client.Search(ctx, req)
	if err := resource.StatusErrorFromResponse(resp.GetError(), err); err != nil {
		return nil, err
	}
	result, err := teamsearch.ParseResults(resp, query.Offset)
	if err != nil {
		return nil, err
	}
	// An inexact total is the pre-authorization match count, which would reveal how many
	// teams the member belongs to, including teams the caller cannot read.
	if query.Member != "" && resp != nil && !resp.TotalHitsExact {
		total, err := c.authorizedTotal(ctx, req)
		if err != nil {
			return nil, err
		}
		result.TotalHits = max(total, result.Offset+int64(len(result.Hits)))
	}
	return &result, nil
}

// authorizedTotal counts only matches the caller can read. If the count is still inexact,
// it returns zero so the caller falls back to the hits it has seen.
func (c *unifiedSearchClient) authorizedTotal(ctx context.Context, req *resourcepb.ResourceSearchRequest) (int64, error) {
	countReq := &resourcepb.ResourceSearchRequest{Options: req.Options, Query: req.Query, ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES}
	resp, err := c.client.Search(ctx, countReq)
	if err := resource.StatusErrorFromResponse(resp.GetError(), err); err != nil {
		return 0, err
	}
	if !resp.GetTotalHitsExact() {
		return 0, nil
	}
	return resp.GetTotalHits(), nil
}

package legacysearcher

import (
	"context"
	"fmt"
	"strings"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"google.golang.org/grpc"
)

type DashboardSearchClient struct {
	resource.ResourceIndexClient
	dashboardStore dashboards.Store
}

func NewDashboardSearchClient(dashboardStore dashboards.Store) *DashboardSearchClient {
	return &DashboardSearchClient{dashboardStore: dashboardStore}
}

func (c *DashboardSearchClient) Search(ctx context.Context, req *resource.ResourceSearchRequest, opts ...grpc.CallOption) (*resource.ResourceSearchResponse, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	if req.Query == "*" {
		req.Query = ""
	}

	// TODO add missing support for the following query params:
	// - tag
	// - starred (won't support)
	// - page (check)
	// - type
	// - sort
	// - deleted
	// - permission
	// - dashboardIds
	// - dashboardUIDs
	// - folderIds
	// - folderUIDs
	// - sort (default by title)
	query := &dashboards.FindPersistedDashboardsQuery{
		Title: req.Query,
		Limit: req.Limit,
		// FolderUIDs:   req.FolderUIDs,
		Type:         searchstore.TypeDashboard,
		SignedInUser: user,
	}

	// TODO need to test this
	// emptyResponse, err := a.dashService.GetSharedDashboardUIDsQuery(ctx, query)

	// if err != nil {
	// 	return nil, err
	// } else if emptyResponse {
	// 	return nil, nil
	// }

	res, err := c.dashboardStore.FindDashboards(ctx, query)
	if err != nil {
		return nil, err
	}

	// TODO sort if query.Sort == "" see sortedHits in services/search/service.go

	searchFields := resource.StandardSearchFields()
	list := &resource.ResourceSearchResponse{
		Results: &resource.ResourceTable{
			Columns: []*resource.ResourceTableColumnDefinition{
				searchFields.Field(resource.SEARCH_FIELD_TITLE),
				searchFields.Field(resource.SEARCH_FIELD_FOLDER),
				// searchFields.Field(resource.SEARCH_FIELD_TAGS),
			},
		},
	}

	for _, dashboard := range res {
		list.Results.Rows = append(list.Results.Rows, &resource.ResourceTableRow{
			Key: &resource.ResourceKey{
				Namespace: "default",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Name:      dashboard.UID,
			},
			Cells: [][]byte{[]byte(dashboard.Title), []byte(dashboard.FolderUID)}, // TODO add tag
		})
	}

	return list, nil
}

func (c *DashboardSearchClient) GetStats(ctx context.Context, req *resource.ResourceStatsRequest, opts ...grpc.CallOption) (*resource.ResourceStatsResponse, error) {
	info, err := claims.ParseNamespace(req.Namespace)
	if err != nil {
		return nil, fmt.Errorf("unable to read namespace")
	}
	if info.OrgID == 0 {
		return nil, fmt.Errorf("invalid OrgID found in namespace")
	}

	if len(req.Kinds) != 1 {
		return nil, fmt.Errorf("only can query for dashboard kind in legacy fallback")
	}

	parts := strings.SplitN(req.Kinds[0], "/", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid kind")
	}

	count, err := c.dashboardStore.CountInOrg(ctx, info.OrgID)
	if err != nil {
		return nil, err
	}

	return &resource.ResourceStatsResponse{
		Stats: []*resource.ResourceStatsResponse_Stats{
			{
				Group:    parts[0],
				Resource: parts[1],
				Count:    count,
			},
		},
	}, nil
}

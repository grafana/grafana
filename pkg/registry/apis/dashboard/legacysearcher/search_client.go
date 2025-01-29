package legacysearcher

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/search"
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
	// - folderIds (won't support, must use folderUIDs)
	// - permission
	query := &dashboards.FindPersistedDashboardsQuery{
		Title: req.Query,
		Limit: req.Limit,
		Page:  req.Page,
		// FolderUIDs:   req.FolderUIDs,
		SignedInUser: user,
		IsDeleted:    req.IsDeleted,
	}

	var queryType string
	if req.Options.Key.Resource == "dashboards" {
		queryType = "dash-db"
	} else if req.Options.Key.Resource == "folders" {
		queryType = "dash-folder"
	} else {
		return nil, fmt.Errorf("bad type request")
	}

	if len(req.Federated) > 1 {
		return nil, fmt.Errorf("bad type request")
	}

	for _, fed := range req.Federated {
		if (fed.Resource == "dashboards" && queryType == "dash-folder") || (fed.Resource == "folders" && queryType == "dash-db") {
			queryType = "" // makes the legacy store search across both
		}
	}

	if queryType != "" {
		query.Type = queryType
	}

	// technically, there exists the ability to register multiple ways of sorting using the legacy database
	// see RegisterSortOption in pkg/services/search/sorting.go
	// however, it doesn't look like we are taking advantage of that. And since by default the legacy
	// sql will sort by title ascending, we only really need to handle the "alpha-desc" case
	if req.SortBy != nil {
		for _, sort := range req.SortBy {
			if sort.Field == "title" && sort.Desc == true {
				query.Sort = search.SortAlphaDesc
			}
		}
	}
	// handle deprecated dashboardIds query param
	for _, field := range req.Options.Labels {
		if field.Key == utils.LabelKeyDeprecatedInternalID {
			values := field.GetValues()
			dashboardIds := make([]int64, len(values))
			for i, id := range values {
				if n, err := strconv.ParseInt(id, 10, 64); err == nil {
					dashboardIds[i] = n
				}
			}

			query.DashboardIds = dashboardIds
		}
	}

	for _, field := range req.Options.Fields {
		switch field.Key {
		case resource.SEARCH_FIELD_TAGS:
			query.Tags = field.GetValues()
		case resource.SEARCH_FIELD_NAME:
			query.DashboardUIDs = field.GetValues()
			query.DashboardIds = nil
		case resource.SEARCH_FIELD_FOLDER:
			vals := field.GetValues()
			folders := make([]string, len(vals))

			for i, val := range vals {
				if val == "" {
					folders[i] = "general"
				} else {
					folders[i] = val
				}
			}

			query.FolderUIDs = folders
		}
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

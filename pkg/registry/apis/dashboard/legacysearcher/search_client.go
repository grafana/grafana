package legacysearcher

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/dashboard"
	folderv0alpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/selection"
)

type DashboardSearchClient struct {
	resource.ResourceIndexClient
	dashboardStore dashboards.Store
}

func NewDashboardSearchClient(dashboardStore dashboards.Store) *DashboardSearchClient {
	return &DashboardSearchClient{dashboardStore: dashboardStore}
}

// nolint:gocyclo
func (c *DashboardSearchClient) Search(ctx context.Context, req *resource.ResourceSearchRequest, opts ...grpc.CallOption) (*resource.ResourceSearchResponse, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	// the "*"s will be added in the k8s handler in dashboard_service.go in order to make search work
	// in modes 3+. These "*"s will break the legacy sql query so we need to remove them here
	if strings.Contains(req.Query, "*") {
		req.Query = strings.ReplaceAll(req.Query, "*", "")
	}

	query := &dashboards.FindPersistedDashboardsQuery{
		Title:        req.Query,
		Limit:        req.Limit,
		Page:         req.Page,
		SignedInUser: user,
		IsDeleted:    req.IsDeleted,
	}

	if req.Permission == int64(dashboardaccess.PERMISSION_EDIT) {
		query.Permission = dashboardaccess.PERMISSION_EDIT
	}

	var queryType string
	if req.Options.Key.Resource == dashboard.DASHBOARD_RESOURCE {
		queryType = searchstore.TypeDashboard
	} else if req.Options.Key.Resource == folderv0alpha1.RESOURCE {
		queryType = searchstore.TypeFolder
	} else {
		return nil, fmt.Errorf("bad type request")
	}

	if len(req.Federated) > 1 {
		return nil, fmt.Errorf("bad type request")
	}

	if len(req.Federated) == 1 &&
		((req.Federated[0].Resource == dashboard.DASHBOARD_RESOURCE && queryType == searchstore.TypeFolder) ||
			(req.Federated[0].Resource == folderv0alpha1.RESOURCE && queryType == searchstore.TypeDashboard)) {
		queryType = "" // makes the legacy store search across both
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
			if sort.Field == "title" && sort.Desc {
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
		vals := field.GetValues()

		switch field.Key {
		case resource.SEARCH_FIELD_TAGS:
			query.Tags = field.GetValues()
		case resource.SEARCH_FIELD_NAME:
			query.DashboardUIDs = field.GetValues()
			query.DashboardIds = nil
		case resource.SEARCH_FIELD_FOLDER:
			folders := make([]string, len(vals))

			for i, val := range vals {
				if val == "" {
					folders[i] = "general"
				} else {
					folders[i] = val
				}
			}

			query.FolderUIDs = folders
		case resource.SEARCH_FIELD_REPOSITORY_PATH:
			// only one value is supported in legacy search
			if len(vals) != 1 {
				return nil, fmt.Errorf("only one repo path query is supported")
			}
			query.ProvisionedPath = vals[0]
		case resource.SEARCH_FIELD_REPOSITORY_NAME:
			if field.Operator == string(selection.NotIn) {
				for _, val := range vals {
					name, _ := dashboard.GetProvisionedFileNameFromMeta(val)
					query.ProvisionedReposNotIn = append(query.ProvisionedReposNotIn, name)
				}
				continue
			}

			// only one value is supported in legacy search
			if len(vals) != 1 {
				return nil, fmt.Errorf("only one repo name is supported")
			}

			query.ProvisionedRepo, _ = dashboard.GetProvisionedFileNameFromMeta(vals[0])
		}
	}

	searchFields := resource.StandardSearchFields()
	list := &resource.ResourceSearchResponse{
		Results: &resource.ResourceTable{
			Columns: []*resource.ResourceTableColumnDefinition{
				searchFields.Field(resource.SEARCH_FIELD_TITLE),
				searchFields.Field(resource.SEARCH_FIELD_FOLDER),
				searchFields.Field(resource.SEARCH_FIELD_TAGS),
			},
		},
	}

	// if we are querying for provisioning information, we need to use a different
	// legacy sql query, since legacy search does not support this
	if query.ProvisionedRepo != "" || len(query.ProvisionedReposNotIn) > 0 {
		var dashes []*dashboards.Dashboard
		if query.ProvisionedRepo == dashboard.PluginIDRepoName {
			dashes, err = c.dashboardStore.GetDashboardsByPluginID(ctx, &dashboards.GetDashboardsByPluginIDQuery{
				PluginID: query.ProvisionedPath,
				OrgID:    user.GetOrgID(),
			})
		} else if query.ProvisionedRepo != "" {
			dashes, err = c.dashboardStore.GetProvisionedDashboardsByName(ctx, query.ProvisionedRepo)
		} else if len(query.ProvisionedReposNotIn) > 0 {
			dashes, err = c.dashboardStore.GetOrphanedProvisionedDashboards(ctx, query.ProvisionedReposNotIn)
		}
		if err != nil {
			return nil, err
		}

		for _, dashboard := range dashes {
			list.Results.Rows = append(list.Results.Rows, &resource.ResourceTableRow{
				Key: getResourceKey(&dashboards.DashboardSearchProjection{
					UID: dashboard.UID,
				}, req.Options.Key.Namespace),
				Cells: [][]byte{[]byte(dashboard.Title), []byte(dashboard.FolderUID), []byte{}},
			})
		}

		return list, nil
	}

	res, err := c.dashboardStore.FindDashboards(ctx, query)
	if err != nil {
		return nil, err
	}

	hits := formatQueryResult(res)

	for _, dashboard := range hits {
		tags, err := json.Marshal(dashboard.Tags)
		if err != nil {
			return nil, err
		}

		list.Results.Rows = append(list.Results.Rows, &resource.ResourceTableRow{
			Key:   getResourceKey(dashboard, req.Options.Key.Namespace),
			Cells: [][]byte{[]byte(dashboard.Title), []byte(dashboard.FolderUID), tags},
		})
	}

	return list, nil
}

func getResourceKey(item *dashboards.DashboardSearchProjection, namespace string) *resource.ResourceKey {
	if item.IsFolder {
		return &resource.ResourceKey{
			Namespace: namespace,
			Group:     folderv0alpha1.GROUP,
			Resource:  folderv0alpha1.RESOURCE,
			Name:      item.UID,
		}
	}

	return &resource.ResourceKey{
		Namespace: namespace,
		Group:     dashboard.GROUP,
		Resource:  dashboard.DASHBOARD_RESOURCE,
		Name:      item.UID,
	}
}

func formatQueryResult(res []dashboards.DashboardSearchProjection) []*dashboards.DashboardSearchProjection {
	hitList := make([]*dashboards.DashboardSearchProjection, 0)
	hits := make(map[string]*dashboards.DashboardSearchProjection)

	for _, item := range res {
		key := fmt.Sprintf("%s-%d", item.UID, item.OrgID)
		hit, exists := hits[key]
		if !exists {
			hit = &dashboards.DashboardSearchProjection{
				UID:       item.UID,
				Title:     item.Title,
				FolderUID: item.FolderUID,
				Tags:      []string{},
				IsFolder:  item.IsFolder,
			}
			hitList = append(hitList, hit)
			hits[key] = hit
		}

		if len(item.Term) > 0 {
			hit.Tags = append(hit.Tags, item.Term)
		}
	}

	return hitList
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

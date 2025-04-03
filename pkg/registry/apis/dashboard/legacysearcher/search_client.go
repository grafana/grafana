package legacysearcher

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/selection"

	claims "github.com/grafana/authlib/types"
	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	folderv0alpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	unisearch "github.com/grafana/grafana/pkg/storage/unified/search"
)

type DashboardSearchClient struct {
	resource.ResourceIndexClient
	dashboardStore dashboards.Store
	sorter         sort.Service
}

func NewDashboardSearchClient(dashboardStore dashboards.Store, sorter sort.Service) *DashboardSearchClient {
	return &DashboardSearchClient{dashboardStore: dashboardStore, sorter: sorter}
}

var sortByMapping = map[string]string{
	unisearch.DASHBOARD_VIEWS_LAST_30_DAYS:  "viewed-recently",
	unisearch.DASHBOARD_VIEWS_TOTAL:         "viewed",
	unisearch.DASHBOARD_ERRORS_LAST_30_DAYS: "errors-recently",
	unisearch.DASHBOARD_ERRORS_TOTAL:        "errors",
	"title":                                 "alpha",
}

func ParseSortName(sortName string) (string, bool, error) {
	if sortName == "" {
		return "", false, nil
	}

	isDesc := strings.HasSuffix(sortName, "-desc")
	isAsc := strings.HasSuffix(sortName, "-asc")
	// default to desc if no suffix is provided
	if !isDesc && !isAsc {
		isDesc = true
	}

	prefix := strings.TrimSuffix(strings.TrimSuffix(sortName, "-desc"), "-asc")
	for key, mappedPrefix := range sortByMapping {
		if prefix == mappedPrefix {
			return key, isDesc, nil
		}
	}

	return "", false, fmt.Errorf("no matching sort field found for: %s", sortName)
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

	sortByField := ""
	if len(req.SortBy) != 0 {
		if len(req.SortBy) > 1 {
			return nil, fmt.Errorf("only one sort field is supported")
		}
		sort := req.SortBy[0]
		sortByField = strings.TrimPrefix(sort.Field, resource.SEARCH_FIELD_PREFIX)
		sorterName := sortByMapping[sortByField]

		if sort.Desc {
			sorterName += "-desc"
		} else {
			sorterName += "-asc"
		}

		if sorter, ok := c.sorter.GetSortOption(sorterName); ok {
			query.Sort = sorter
		}
	}

	// the title search will not return any sortMeta (an int64), like
	// most sorting will. Without this, the title will be set to sortMeta (0)
	if sortByField == resource.SEARCH_FIELD_TITLE {
		sortByField = ""
	}

	// if searching for tags, get those instead of the dashboards or folders
	for facet := range req.Facet {
		if facet == resource.SEARCH_FIELD_TAGS {
			tags, err := c.dashboardStore.GetDashboardTags(ctx, &dashboards.GetDashboardTagsQuery{
				OrgID: user.GetOrgID(),
			})
			if err != nil {
				return nil, err
			}
			list := &resource.ResourceSearchResponse{
				Results: &resource.ResourceTable{},
				Facet: map[string]*resource.ResourceSearchResponse_Facet{
					"tags": {
						Terms: []*resource.ResourceSearchResponse_TermFacet{},
					},
				},
			}

			for _, tag := range tags {
				list.Facet["tags"].Terms = append(list.Facet["tags"].Terms, &resource.ResourceSearchResponse_TermFacet{
					Term:  tag.Term,
					Count: int64(tag.Count),
				})
			}

			return list, nil
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
		case resource.SEARCH_FIELD_SOURCE_PATH:
			// only one value is supported in legacy search
			if len(vals) != 1 {
				return nil, fmt.Errorf("only one repo path query is supported")
			}
			query.SourcePath = vals[0]

		case resource.SEARCH_FIELD_MANAGER_KIND:
			if len(vals) != 1 {
				return nil, fmt.Errorf("only one manager kind supported")
			}
			query.ManagedBy = utils.ManagerKind(vals[0])

		case resource.SEARCH_FIELD_MANAGER_ID:
			if field.Operator == string(selection.NotIn) {
				query.ManagerIdentityNotIn = vals
				continue
			}

			// only one value is supported in legacy search
			if len(vals) != 1 {
				return nil, fmt.Errorf("only one repo name is supported")
			}
			query.ManagerIdentity = vals[0]
		}
	}
	searchFields := resource.StandardSearchFields()
	columns := []*resource.ResourceTableColumnDefinition{
		searchFields.Field(resource.SEARCH_FIELD_TITLE),
		searchFields.Field(resource.SEARCH_FIELD_FOLDER),
		searchFields.Field(resource.SEARCH_FIELD_TAGS),
		searchFields.Field(resource.SEARCH_FIELD_LEGACY_ID),
	}

	if sortByField != "" {
		columns = append(columns, &resource.ResourceTableColumnDefinition{
			Name: sortByField,
			Type: resource.ResourceTableColumnDefinition_INT64,
		})
	}

	list := &resource.ResourceSearchResponse{
		Results: &resource.ResourceTable{
			Columns: columns,
		},
	}

	// if we are querying for provisioning information, we need to use a different
	// legacy sql query, since legacy search does not support this
	if query.ManagerIdentity != "" || len(query.ManagerIdentityNotIn) > 0 {
		if query.ManagedBy == utils.ManagerKindUnknown {
			return nil, fmt.Errorf("query by manager identity also requires manager.kind parameter")
		}

		var dashes []*dashboards.Dashboard
		if query.ManagedBy == utils.ManagerKindPlugin {
			dashes, err = c.dashboardStore.GetDashboardsByPluginID(ctx, &dashboards.GetDashboardsByPluginIDQuery{
				PluginID: query.ManagerIdentity,
				OrgID:    user.GetOrgID(),
			})
		} else if query.ManagerIdentity != "" {
			dashes, err = c.dashboardStore.GetProvisionedDashboardsByName(ctx, query.ManagerIdentity, user.GetOrgID())
		} else if len(query.ManagerIdentityNotIn) > 0 {
			dashes, err = c.dashboardStore.GetOrphanedProvisionedDashboards(ctx, query.ManagerIdentityNotIn, user.GetOrgID())
		}
		if err != nil {
			return nil, err
		}

		for _, dashboard := range dashes {
			cells := [][]byte{
				[]byte(dashboard.Title),
				[]byte(dashboard.FolderUID),
				[]byte("[]"), // no tags retrieved for provisioned dashboards
				[]byte(strconv.FormatInt(dashboard.ID, 10)),
			}

			if sortByField != "" {
				cells = append(cells, []byte("0"))
			}

			list.Results.Rows = append(list.Results.Rows, &resource.ResourceTableRow{
				Key: getResourceKey(&dashboards.DashboardSearchProjection{
					UID: dashboard.UID,
				}, req.Options.Key.Namespace),
				Cells: cells,
			})
		}

		list.TotalHits = int64(len(list.Results.Rows))

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

		cells := [][]byte{
			[]byte(dashboard.Title),
			[]byte(dashboard.FolderUID),
			tags,
			[]byte(strconv.FormatInt(dashboard.ID, 10)),
		}

		if sortByField != "" {
			cells = append(cells, []byte(strconv.FormatInt(dashboard.SortMeta, 10)))
		}

		list.Results.Rows = append(list.Results.Rows, &resource.ResourceTableRow{
			Key:   getResourceKey(dashboard, req.Options.Key.Namespace),
			Cells: cells,
		})
	}

	list.TotalHits = int64(len(list.Results.Rows))

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
				ID:        item.ID,
				UID:       item.UID,
				Title:     item.Title,
				FolderUID: item.FolderUID,
				Tags:      []string{},
				IsFolder:  item.IsFolder,
				SortMeta:  item.SortMeta,
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

	var count int64
	switch parts[0] {
	case dashboard.GROUP:
		count, err = c.dashboardStore.CountInOrg(ctx, info.OrgID, false)
	case folderv0alpha1.GROUP:
		count, err = c.dashboardStore.CountInOrg(ctx, info.OrgID, true)
	default:
		return nil, fmt.Errorf("invalid group")
	}
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

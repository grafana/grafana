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

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	unisearch "github.com/grafana/grafana/pkg/storage/unified/search"
)

type DashboardSearchClient struct {
	resourcepb.ResourceIndexClient
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
func (c *DashboardSearchClient) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
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
	switch req.Options.Key.Resource {
	case dashboard.DASHBOARD_RESOURCE:
		queryType = searchstore.TypeDashboard
	case folders.RESOURCE:
		queryType = searchstore.TypeFolder
	default:
		return nil, fmt.Errorf("bad type request")
	}

	if len(req.Federated) > 1 {
		return nil, fmt.Errorf("bad type request")
	}

	if len(req.Federated) == 1 &&
		((req.Federated[0].Resource == dashboard.DASHBOARD_RESOURCE && queryType == searchstore.TypeFolder) ||
			(req.Federated[0].Resource == folders.RESOURCE && queryType == searchstore.TypeDashboard)) {
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
			list := &resourcepb.ResourceSearchResponse{
				Results: &resourcepb.ResourceTable{},
				Facet: map[string]*resourcepb.ResourceSearchResponse_Facet{
					"tags": {
						Terms: []*resourcepb.ResourceSearchResponse_TermFacet{},
					},
				},
			}

			for _, tag := range tags {
				list.Facet["tags"].Terms = append(list.Facet["tags"].Terms, &resourcepb.ResourceSearchResponse_TermFacet{
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
		case unisearch.DASHBOARD_LIBRARY_PANEL_REFERENCE:
			if len(vals) != 1 {
				return nil, fmt.Errorf("only one library panel uid is supported")
			}

			return c.getLibraryPanelConnections(ctx, user, vals[0], req.Options.Key.Namespace)
		case resource.SEARCH_FIELD_TITLE_PHRASE:
			if len(vals) != 1 {
				return nil, fmt.Errorf("only one title supported")
			}

			query.Title = vals[0]
			query.TitleExactMatch = true
		}
	}

	columns := c.getColumns(sortByField, query)
	list := &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: columns,
		},
	}

	// if we are querying for provisioning information, we need to use a different
	// legacy sql query, since legacy search does not support this
	if query.ManagerIdentity != "" || len(query.ManagerIdentityNotIn) > 0 || query.ManagedBy != "" {
		if query.ManagedBy == utils.ManagerKindUnknown {
			return nil, fmt.Errorf("query by manager identity also requires manager.kind parameter")
		}

		// for plugin and orphaned dashboards, we will only return the manager kind alongside the regular search response
		if query.ManagedBy == utils.ManagerKindPlugin || len(query.ManagerIdentityNotIn) > 0 {
			var dashes []*dashboards.Dashboard
			if query.ManagedBy == utils.ManagerKindPlugin {
				dashes, err = c.dashboardStore.GetDashboardsByPluginID(ctx, &dashboards.GetDashboardsByPluginIDQuery{
					PluginID: query.ManagerIdentity,
					OrgID:    user.GetOrgID(),
				})
			} else {
				dashes, err = c.dashboardStore.GetOrphanedProvisionedDashboards(ctx, query.ManagerIdentityNotIn, user.GetOrgID())
			}
			if err != nil {
				return nil, err
			}

			for _, dashboard := range dashes {
				list.Results.Rows = append(list.Results.Rows, &resourcepb.ResourceTableRow{
					Key: getResourceKey(&dashboards.DashboardSearchProjection{
						UID: dashboard.UID,
					}, req.Options.Key.Namespace),
					Cells: c.createProvisioningCells(dashboard, query),
				})
			}

			list.TotalHits = int64(len(list.Results.Rows))
			return list, nil
		}

		// for classic FP, we will return the regular search response alongside all the data in the dashboard_provisioning table
		provisioningData := []*dashboards.DashboardProvisioningSearchResults{}
		if query.ManagerIdentity == "" {
			var data *dashboards.DashboardProvisioningSearchResults
			if len(query.DashboardIds) > 0 {
				data, err = c.dashboardStore.GetProvisionedDataByDashboardID(ctx, query.DashboardIds[0])
			} else if len(query.DashboardUIDs) > 0 {
				data, err = c.dashboardStore.GetProvisionedDataByDashboardUID(ctx, user.GetOrgID(), query.DashboardUIDs[0])
			}
			if err != nil {
				return nil, err
			}
			if data != nil {
				provisioningData = append(provisioningData, data)
			}
		} else {
			provisioningData, err = c.dashboardStore.GetProvisionedDashboardsByName(ctx, query.ManagerIdentity, user.GetOrgID())
			if err != nil {
				return nil, err
			}
		}

		for _, dashboard := range provisioningData {
			list.Results.Rows = append(list.Results.Rows, &resourcepb.ResourceTableRow{
				Key: getResourceKey(&dashboards.DashboardSearchProjection{
					UID: dashboard.Dashboard.UID,
				}, req.Options.Key.Namespace),
				Cells: c.createDetailedProvisioningCells(dashboard, query),
			})
		}

		list.TotalHits = int64(len(list.Results.Rows))
		return list, nil
	}

	res, err := c.dashboardStore.FindDashboards(ctx, query)
	if err != nil {
		return nil, err
	}

	for _, dashboard := range res {
		cells, err := c.createBaseCells(dashboard, sortByField)
		if err != nil {
			return nil, err
		}

		list.Results.Rows = append(list.Results.Rows, &resourcepb.ResourceTableRow{
			Key:   getResourceKey(&dashboard, req.Options.Key.Namespace),
			Cells: cells,
		})
	}

	list.TotalHits = int64(len(list.Results.Rows))

	return list, nil
}

func getResourceKey(item *dashboards.DashboardSearchProjection, namespace string) *resourcepb.ResourceKey {
	if item.IsFolder {
		return &resourcepb.ResourceKey{
			Namespace: namespace,
			Group:     folders.GROUP,
			Resource:  folders.RESOURCE,
			Name:      item.UID,
		}
	}

	return &resourcepb.ResourceKey{
		Namespace: namespace,
		Group:     dashboard.GROUP,
		Resource:  dashboard.DASHBOARD_RESOURCE,
		Name:      item.UID,
	}
}

// retrieves all the dashboards that are connected to the given library panel
func (c *DashboardSearchClient) getLibraryPanelConnections(ctx context.Context, user identity.Requester, libraryElementUID, namespace string) (*resourcepb.ResourceSearchResponse, error) {
	connections, err := c.dashboardStore.GetDashboardsByLibraryPanelUID(ctx, libraryElementUID, user.GetOrgID())
	if err != nil {
		return nil, err
	}

	columns := c.getColumns("", &dashboards.FindPersistedDashboardsQuery{})
	list := &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: columns,
		},
	}

	for _, dashboard := range connections {
		cells := c.createCommonCells("", dashboard.FolderUID, dashboard.ID, nil) // nolint:staticcheck
		list.Results.Rows = append(list.Results.Rows, &resourcepb.ResourceTableRow{
			Key: getResourceKey(&dashboards.DashboardSearchProjection{
				UID: dashboard.UID,
			}, namespace),
			Cells: cells,
		})
	}

	list.TotalHits = int64(len(list.Results.Rows))
	return list, nil
}

func (c *DashboardSearchClient) GetStats(ctx context.Context, req *resourcepb.ResourceStatsRequest, _ ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
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
	case folders.GROUP:
		count, err = c.dashboardStore.CountInOrg(ctx, info.OrgID, true)
	default:
		return nil, fmt.Errorf("invalid group")
	}
	if err != nil {
		return nil, err
	}

	return &resourcepb.ResourceStatsResponse{
		Stats: []*resourcepb.ResourceStatsResponse_Stats{
			{
				Group:    parts[0],
				Resource: parts[1],
				Count:    count,
			},
		},
	}, nil
}

func (c *DashboardSearchClient) getColumns(sortByField string, query *dashboards.FindPersistedDashboardsQuery) []*resourcepb.ResourceTableColumnDefinition {
	searchFields := resource.StandardSearchFields()
	columns := []*resourcepb.ResourceTableColumnDefinition{
		searchFields.Field(resource.SEARCH_FIELD_TITLE),
		searchFields.Field(resource.SEARCH_FIELD_FOLDER),
		searchFields.Field(resource.SEARCH_FIELD_TAGS),
		searchFields.Field(resource.SEARCH_FIELD_LEGACY_ID),
	}

	if query.ManagerIdentity != "" || len(query.ManagerIdentityNotIn) > 0 || query.ManagedBy != "" {
		columns = append(columns, &resourcepb.ResourceTableColumnDefinition{
			Name: resource.SEARCH_FIELD_MANAGER_KIND,
			Type: resourcepb.ResourceTableColumnDefinition_STRING,
		})

		if query.ManagedBy != utils.ManagerKindPlugin && len(query.ManagerIdentityNotIn) == 0 {
			columns = append(columns, []*resourcepb.ResourceTableColumnDefinition{
				{
					Name: resource.SEARCH_FIELD_MANAGER_ID,
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_SOURCE_PATH,
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_SOURCE_CHECKSUM,
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
				{
					Name: resource.SEARCH_FIELD_SOURCE_TIME,
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				},
			}...)
		}

		return columns
	}

	// cannot sort when querying provisioned dashboards
	if sortByField != "" {
		columns = append(columns, &resourcepb.ResourceTableColumnDefinition{
			Name: sortByField,
			Type: resourcepb.ResourceTableColumnDefinition_INT64,
		})
	}

	return columns
}

func (c *DashboardSearchClient) createCommonCells(title, folderUID string, id int64, tags []byte) [][]byte {
	return [][]byte{
		[]byte(title),
		[]byte(folderUID),
		tags,
		[]byte(strconv.FormatInt(id, 10)),
	}
}

func (c *DashboardSearchClient) createBaseCells(dashboard dashboards.DashboardSearchProjection, sortByField string) ([][]byte, error) {
	tags, err := json.Marshal(dashboard.Tags)
	if err != nil {
		return nil, err
	}

	cells := c.createCommonCells(dashboard.Title, dashboard.FolderUID, dashboard.ID, tags)

	if sortByField != "" {
		cells = append(cells, []byte(strconv.FormatInt(dashboard.SortMeta, 10)))
	}

	return cells, nil
}

func (c *DashboardSearchClient) createProvisioningCells(dashboard *dashboards.Dashboard, query *dashboards.FindPersistedDashboardsQuery) [][]byte {
	cells := c.createCommonCells(dashboard.Title, dashboard.FolderUID, dashboard.ID, []byte("[]"))
	return append(cells, []byte(query.ManagedBy))
}

func (c *DashboardSearchClient) createDetailedProvisioningCells(dashboard *dashboards.DashboardProvisioningSearchResults, query *dashboards.FindPersistedDashboardsQuery) [][]byte {
	cells := c.createCommonCells(dashboard.Dashboard.Title, dashboard.Dashboard.FolderUID, dashboard.Dashboard.ID, []byte("[]"))
	return append(cells,
		[]byte(query.ManagedBy),
		[]byte(dashboard.Provisioner),
		[]byte(dashboard.ExternalID),
		[]byte(dashboard.CheckSum),
		[]byte(strconv.FormatInt(dashboard.ProvisionUpdate, 10)),
	)
}

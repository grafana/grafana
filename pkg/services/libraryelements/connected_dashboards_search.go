package libraryelements

import (
	"context"

	"k8s.io/apimachinery/pkg/selection"

	dashboardv0alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardsearch "github.com/grafana/grafana/pkg/services/dashboards/service/search"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

// searchDashboardsLimit bounds the connected-dashboards search, mirroring
// dashboards.DashboardServiceImpl.GetDashboardsByLibraryPanelUID's own limit.
const searchDashboardsLimit = 100000

// SearchConnectedDashboardsFinder implements ConnectedDashboardsFinder via a direct unified storage
// search, for deployments without a local dashboards.DashboardService (e.g. a folder apiserver
// running standalone). Dashboards are migrated to unified storage even where alert rules and
// library panels are not, so this query needs no legacy database routing of its own.
type SearchConnectedDashboardsFinder struct {
	Searcher   resourcepb.ResourceIndexClient
	Namespacer request.NamespaceMapper
}

// GetDashboardsByLibraryPanelUID mirrors
// dashboards.DashboardServiceImpl.GetDashboardsByLibraryPanelUID's search request, querying the
// search index directly instead of through a local DashboardService.
func (f *SearchConnectedDashboardsFinder) GetDashboardsByLibraryPanelUID(ctx context.Context, libraryPanelUID string, orgID int64) ([]*dashboards.DashboardRef, error) {
	gvr := dashboardv0alpha1.DashboardResourceInfo.GroupVersionResource()
	req := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: f.Namespacer(orgID),
				Group:     gvr.Group,
				Resource:  gvr.Resource,
			},
			Fields: []*resourcepb.Requirement{
				{
					Key:      builders.DASHBOARD_LIBRARY_PANEL_REFERENCE,
					Operator: string(selection.Equals),
					Values:   []string{libraryPanelUID},
				},
			},
		},
		Limit: searchDashboardsLimit,
		Fields: []string{
			resource.SEARCH_FIELD_FOLDER,
			resource.SEARCH_FIELD_LEGACY_ID,
			// Per-label fields are requestable; this one is needed to derive the numeric legacy ID.
			resource.SEARCH_FIELD_LABELS + "." + resource.SEARCH_FIELD_LEGACY_ID,
		},
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
	}

	results, err := dashboardsearch.SearchAll(ctx, orgID, req, func(ctx context.Context, _ int64, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
		return f.Searcher.Search(ctx, req)
	})
	if err != nil {
		return nil, err
	}

	refs := make([]*dashboards.DashboardRef, 0, len(results.Hits))
	for _, row := range results.Hits {
		refs = append(refs, &dashboards.DashboardRef{
			UID:       row.Name,
			FolderUID: folder.ToLegacyFolderUID(row.Folder),
			ID:        row.Field.GetNestedInt64(resource.SEARCH_FIELD_LEGACY_ID), //nolint:staticcheck
		})
	}
	return refs, nil
}

var _ ConnectedDashboardsFinder = (*SearchConnectedDashboardsFinder)(nil)

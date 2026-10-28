package dashboardsearch

import (
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

// LibraryPanelDashboardsRequest builds the search request for dashboards referencing the given
// library panel. Callers still need to set request.Options.Key (namespace/group/resource)
// themselves: how to resolve it differs between callers, e.g. from an orgID-based lookup versus
// an explicit namespace carried on ctx.
func LibraryPanelDashboardsRequest(libraryPanelUID string, limit int64) *resourcepb.ResourceSearchRequest {
	return &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Fields: []*resourcepb.Requirement{
				{
					Key:      builders.DASHBOARD_LIBRARY_PANEL_REFERENCE,
					Operator: string(selection.Equals),
					Values:   []string{libraryPanelUID},
				},
			},
		},
		Limit: limit,
		Fields: []string{
			resource.SEARCH_FIELD_FOLDER,
			resource.SEARCH_FIELD_LEGACY_ID,
			// Per-label fields are requestable; this one is needed to derive the numeric legacy ID.
			resource.SEARCH_FIELD_LABELS + "." + resource.SEARCH_FIELD_LEGACY_ID,
		},
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
	}
}

// DashboardRefsFromResults converts the hits of a LibraryPanelDashboardsRequest search into
// DashboardRefs.
func DashboardRefsFromResults(results v0alpha1.SearchResults) []*dashboards.DashboardRef {
	refs := make([]*dashboards.DashboardRef, 0, len(results.Hits))
	for _, row := range results.Hits {
		refs = append(refs, &dashboards.DashboardRef{
			UID:       row.Name,
			FolderUID: folder.ToLegacyFolderUID(row.Folder),
			ID:        row.Field.GetNestedInt64(resource.SEARCH_FIELD_LEGACY_ID), //nolint:staticcheck
		})
	}
	return refs
}

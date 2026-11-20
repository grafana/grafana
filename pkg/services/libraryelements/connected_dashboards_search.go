package libraryelements

import (
	"context"
	"fmt"

	apirequest "k8s.io/apiserver/pkg/endpoints/request"

	dashboardv0alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardsearch "github.com/grafana/grafana/pkg/services/dashboards/service/search"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// searchDashboardsLimit mirrors DashboardServiceImpl.GetDashboardsByLibraryPanelUID's own limit.
const searchDashboardsLimit = 100000

// SearchConnectedDashboardsFinder implements ConnectedDashboardsFinder via a direct unified
// storage search, for a standalone folder apiserver with no local dashboards.DashboardService.
type SearchConnectedDashboardsFinder struct {
	Searcher resourcepb.ResourceIndexClient
}

// GetDashboardsByLibraryPanelUID mirrors DashboardServiceImpl's search, but scopes it to ctx's
// namespace rather than orgID -- every tenant's namespace can parse to the same OrgID here.
func (f *SearchConnectedDashboardsFinder) GetDashboardsByLibraryPanelUID(ctx context.Context, libraryPanelUID string, orgID int64) ([]*dashboards.DashboardRef, error) {
	ns, ok := apirequest.NamespaceFrom(ctx)
	if !ok || ns == "" {
		// NamespaceFrom reports ok=true even for an explicitly-empty namespace, which would
		// otherwise search unscoped across every tenant.
		return nil, fmt.Errorf("expecting namespace in context")
	}

	gvr := dashboardv0alpha1.DashboardResourceInfo.GroupVersionResource()
	req := dashboardsearch.LibraryPanelDashboardsRequest(libraryPanelUID, searchDashboardsLimit)
	req.Options.Key = &resourcepb.ResourceKey{
		Namespace: ns,
		Group:     gvr.Group,
		Resource:  gvr.Resource,
	}

	results, err := dashboardsearch.SearchAll(ctx, orgID, req, func(ctx context.Context, _ int64, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
		return f.Searcher.Search(ctx, req)
	})
	if err != nil {
		return nil, err
	}

	return dashboardsearch.DashboardRefsFromResults(results), nil
}

var _ ConnectedDashboardsFinder = (*SearchConnectedDashboardsFinder)(nil)

package thumbs

import (
	"context"
	_ "embed"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/searchV2"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

var (
	//go:embed testdata/search_response_frame.json
	exampleListFrameJSON string
	exampleListFrame     = &data.Frame{}
	_                    = exampleListFrame.UnmarshalJSON([]byte(exampleListFrameJSON))

	orgId                   = int64(1)
	permissionsWithScopeAll = map[string][]string{
		datasources.ActionIDRead:           {datasources.ScopeAll},
		datasources.ActionDelete:           {datasources.ScopeAll},
		ac.ActionDatasourcesExplore:        {datasources.ScopeAll},
		datasources.ActionQuery:            {datasources.ScopeAll},
		datasources.ActionRead:             {datasources.ScopeAll},
		datasources.ActionWrite:            {datasources.ScopeAll},
		datasources.ActionPermissionsRead:  {datasources.ScopeAll},
		datasources.ActionPermissionsWrite: {datasources.ScopeAll},

		dashboards.ActionFoldersCreate:           {dashboards.ScopeFoldersAll},
		dashboards.ActionFoldersRead:             {dashboards.ScopeFoldersAll},
		dashboards.ActionFoldersWrite:            {dashboards.ScopeFoldersAll},
		dashboards.ActionFoldersDelete:           {dashboards.ScopeFoldersAll},
		dashboards.ActionFoldersPermissionsRead:  {dashboards.ScopeFoldersAll},
		dashboards.ActionFoldersPermissionsWrite: {dashboards.ScopeFoldersAll},

		dashboards.ActionDashboardsCreate:           {dashboards.ScopeDashboardsAll},
		dashboards.ActionDashboardsRead:             {dashboards.ScopeDashboardsAll},
		dashboards.ActionDashboardsWrite:            {dashboards.ScopeDashboardsAll},
		dashboards.ActionDashboardsDelete:           {dashboards.ScopeDashboardsAll},
		dashboards.ActionDashboardsPermissionsRead:  {dashboards.ScopeDashboardsAll},
		dashboards.ActionDashboardsPermissionsWrite: {dashboards.ScopeDashboardsAll},
	}
	permissionsWithUidScopes = map[string][]string{
		datasources.ActionIDRead:    {},
		datasources.ActionDelete:    {},
		ac.ActionDatasourcesExplore: {},
		datasources.ActionQuery:     {},
		datasources.ActionRead: {
			datasources.ScopeProvider.GetResourceScopeUID("datasource-2"),
			datasources.ScopeProvider.GetResourceScopeUID("datasource-3"),
		},
		datasources.ActionWrite:            {},
		datasources.ActionPermissionsRead:  {},
		datasources.ActionPermissionsWrite: {},

		dashboards.ActionFoldersCreate: {},
		dashboards.ActionFoldersRead: {
			dashboards.ScopeFoldersProvider.GetResourceScopeUID("ujaM1h6nz"),
		},
		dashboards.ActionFoldersWrite:            {},
		dashboards.ActionFoldersDelete:           {},
		dashboards.ActionFoldersPermissionsRead:  {},
		dashboards.ActionFoldersPermissionsWrite: {},

		dashboards.ActionDashboardsCreate: {},
		dashboards.ActionDashboardsRead:   {},
		dashboards.ActionDashboardsWrite: {
			dashboards.ScopeDashboardsProvider.GetResourceScopeUID("7MeksYbmk"),
		},
		dashboards.ActionDashboardsDelete:           {},
		dashboards.ActionDashboardsPermissionsRead:  {},
		dashboards.ActionDashboardsPermissionsWrite: {},
	}
)

func TestShouldParseUidFromSearchResponseFrame(t *testing.T) {
	searchService := &searchV2.MockSearchService{}
	dsLookup := &dsUidsLookup{
		searchService: searchService,
		crawlerAuth:   &crawlerAuth{},
		features:      featuremgmt.WithFeatures(featuremgmt.FlagPanelTitleSearch),
	}

	dashboardUid := "abc"
	searchService.On("IsDisabled").Return(false)
	searchService.On("DoDashboardQuery", mock.Anything, mock.Anything, mock.Anything, searchV2.DashboardQuery{
		UIDs: []string{dashboardUid},
	}).Return(&backend.DataResponse{
		Frames: []*data.Frame{exampleListFrame},
	})

	uids, err := dsLookup.getDatasourceUidsForDashboard(context.Background(), dashboardUid, 1)
	require.NoError(t, err)
	require.Equal(t, []string{"datasource-2", "datasource-3", "datasource-4"}, uids)
}

func TestShouldReturnNullIfSearchServiceIsDisabled(t *testing.T) {
	searchService := &searchV2.MockSearchService{}
	dsLookup := &dsUidsLookup{
		searchService: searchService,
		crawlerAuth:   &crawlerAuth{},
		features:      featuremgmt.WithFeatures(featuremgmt.FlagPanelTitleSearch),
	}

	dashboardUid := "abc"
	searchService.On("IsDisabled").Return(true)
	uids, err := dsLookup.getDatasourceUidsForDashboard(context.Background(), dashboardUid, 1)
	require.NoError(t, err)
	require.Nil(t, uids)
}

package searchV2

import (
	"context"
	_ "embed"
	"fmt"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	//go:embed testdata/search_response_frame.json
	exampleListFrameJSON string

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

func service(t *testing.T) *StandardSearchService {
	service, ok := ProvideService(&setting.Cfg{Search: setting.SearchSettings{}},
		nil, nil, accesscontrolmock.New(), tracing.InitializeTracerForTest(), featuremgmt.WithFeatures(),
		nil, nil, nil).(*StandardSearchService)
	require.True(t, ok)
	return service
}

func TestAllowedActionsForPermissionsWithScopeAll(t *testing.T) {
	tests := []struct {
		name        string
		permissions map[string][]string
	}{
		{
			name:        "scope_all",
			permissions: permissionsWithScopeAll,
		},
		{
			name:        "scope_uids",
			permissions: permissionsWithUidScopes,
		},
	}

	for _, tt := range tests {
		frame := &data.Frame{}
		err := frame.UnmarshalJSON([]byte(exampleListFrameJSON))
		require.NoError(t, err)

		err = service(t).addAllowedActionsField(context.Background(), orgId, &user.SignedInUser{
			Permissions: map[int64]map[string][]string{
				orgId: tt.permissions,
			},
		}, &backend.DataResponse{
			Frames: []*data.Frame{frame},
		})
		require.NoError(t, err)

		experimental.CheckGoldenJSONFrame(t, "testdata", fmt.Sprintf("allowed_actions_%s.golden", tt.name), frame, true)
	}
}

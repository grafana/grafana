package api

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestHTTPServer_Search(t *testing.T) {
	type testCase struct {
		desc             string
		includeMetadata  bool
		permissions      []accesscontrol.Permission
		expectedMetadata map[int64]map[string]struct{}
	}

	type withMeta struct {
		model.Hit
		AccessControl accesscontrol.Metadata `json:"accessControl,omitempty"`
	}

	tests := []testCase{
		{
			desc:            "should attach metadata to response",
			includeMetadata: true,
			expectedMetadata: map[int64]map[string]struct{}{
				1: {dashboards.ActionFoldersRead: {}},
				2: {dashboards.ActionFoldersRead: {}, dashboards.ActionFoldersWrite: {}, dashboards.ActionDashboardsWrite: {}},
				3: {dashboards.ActionDashboardsRead: {}, dashboards.ActionDashboardsWrite: {}},
			},
			permissions: []accesscontrol.Permission{
				{Action: "folders:read", Scope: "folders:*"},
				{Action: "folders:write", Scope: "folders:uid:folder2"},
				{Action: "dashboards:read", Scope: "dashboards:*"},
				{Action: "dashboards:write", Scope: "folders:uid:folder2"},
			},
		},
		{
			desc:             "not attach metadata",
			includeMetadata:  false,
			expectedMetadata: map[int64]map[string]struct{}{},
			permissions: []accesscontrol.Permission{
				{Action: "folders:read", Scope: "folders:*"},
				{Action: "folders:write", Scope: "folders:uid:folder2"},
				{Action: "dashboards:read", Scope: "dashboards:*"},
				{Action: "dashboards:write", Scope: "folders:uid:folder2"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.SearchService = &mockSearchService{ExpectedResult: model.HitList{
					{ID: 1, UID: "folder1", Title: "folder1", Type: model.DashHitFolder},
					{ID: 2, UID: "folder2", Title: "folder2", Type: model.DashHitFolder},
					{ID: 3, UID: "dash3", Title: "dash3", FolderUID: "folder2", Type: model.DashHitDB},
				}}
			})

			url := "/api/search"
			if tt.includeMetadata {
				url += "?accesscontrol=true"
			}

			res, err := server.Send(
				webtest.RequestWithSignedInUser(
					server.NewGetRequest(url), userWithPermissions(1, tt.permissions),
				),
			)
			require.NoError(t, err)

			var result []withMeta
			require.NoError(t, json.NewDecoder(res.Body).Decode(&result))

			for _, r := range result {
				if !tt.includeMetadata {
					assert.Nil(t, r.AccessControl)
					continue
				}

				assert.Len(t, r.AccessControl, len(tt.expectedMetadata[r.ID]))
				for action := range r.AccessControl {
					_, ok := tt.expectedMetadata[r.ID][action]
					assert.True(t, ok)
				}
			}

			require.NoError(t, res.Body.Close())
		})
	}
}

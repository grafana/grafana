package api

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestHTTPServer_Search(t *testing.T) {
	sc := setupHTTPServer(t, true)
	sc.initCtx.IsSignedIn = true
	sc.initCtx.SignedInUser = &user.SignedInUser{}

	sc.hs.SearchService = &mockSearchService{
		ExpectedResult: models.HitList{
			{ID: 1, UID: "folder1", Title: "folder1", Type: models.DashHitFolder},
			{ID: 2, UID: "folder2", Title: "folder2", Type: models.DashHitFolder},
			{ID: 3, UID: "dash3", Title: "dash3", FolderUID: "folder2", Type: models.DashHitDB},
		},
	}

	sc.acmock.GetUserPermissionsFunc = func(ctx context.Context, user *user.SignedInUser, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
		return []accesscontrol.Permission{
			{Action: "folders:read", Scope: "folders:*"},
			{Action: "folders:write", Scope: "folders:uid:folder2"},
			{Action: "dashboards:read", Scope: "dashboards:*"},
			{Action: "dashboards:write", Scope: "folders:uid:folder2"},
		}, nil
	}

	type withMeta struct {
		models.Hit
		AccessControl accesscontrol.Metadata `json:"accessControl,omitempty"`
	}

	t.Run("should attach access control metadata to response", func(t *testing.T) {
		recorder := callAPI(sc.server, http.MethodGet, "/api/search?accesscontrol=true", nil, t)
		assert.Equal(t, http.StatusOK, recorder.Code)
		var result []withMeta
		require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &result))

		for _, r := range result {
			if r.ID == 1 {
				assert.Len(t, r.AccessControl, 1)
				assert.True(t, r.AccessControl[dashboards.ActionFoldersRead])
			} else if r.ID == 2 {
				assert.Len(t, r.AccessControl, 3)
				assert.True(t, r.AccessControl[dashboards.ActionFoldersRead])
				assert.True(t, r.AccessControl[dashboards.ActionFoldersWrite])
				assert.True(t, r.AccessControl[dashboards.ActionDashboardsWrite])
			} else if r.ID == 3 {
				assert.Len(t, r.AccessControl, 2)
				assert.True(t, r.AccessControl[dashboards.ActionDashboardsRead])
				assert.True(t, r.AccessControl[dashboards.ActionDashboardsWrite])
			}
		}
	})

	t.Run("should not attach access control metadata to response", func(t *testing.T) {
		recorder := callAPI(sc.server, http.MethodGet, "/api/search", nil, t)
		assert.Equal(t, http.StatusOK, recorder.Code)
		var result []withMeta
		require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &result))

		for _, r := range result {
			assert.Len(t, r.AccessControl, 0)
		}
	})
}

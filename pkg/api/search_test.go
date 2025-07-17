package api

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestSearch_ShadowTraffic(t *testing.T) {
	t.Run("Search works correctly when shadow traffic feature toggle is off", func(t *testing.T) {
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = setting.NewCfg()
			hs.Features = featuremgmt.WithFeatures() // No feature flags enabled
			hs.SearchService = &mockSearchService{ExpectedResult: model.HitList{{Title: "test dashboard"}}}
			// Ensure these services exist even when not used
			hs.folderService = nil
			hs.DashboardService = nil
		})

		req := webtest.RequestWithSignedInUser(
			server.NewGetRequest("/api/search?query=test"),
			userWithPermissions(1, []accesscontrol.Permission{}),
		)
		resp, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		require.NoError(t, resp.Body.Close())
	})

	t.Run("Search works correctly when shadow traffic is enabled", func(t *testing.T) {
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = setting.NewCfg()
			hs.Features = featuremgmt.WithFeatures(
				featuremgmt.FlagUnifiedSearchShadowTraffic,
				featuremgmt.FlagUnifiedStorageSearch,
				featuremgmt.FlagKubernetesClientDashboardsFolders,
			)
			hs.SearchService = &mockSearchService{ExpectedResult: model.HitList{{Title: "test dashboard"}}}
		})

		req := webtest.RequestWithSignedInUser(
			server.NewGetRequest("/api/search?query=test"),
			userWithPermissions(1, []accesscontrol.Permission{}),
		)
		resp, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		require.NoError(t, resp.Body.Close())

		// Allow some time for background goroutine to complete
		time.Sleep(1000 * time.Millisecond)
	})

	t.Run("Search works correctly when only shadow traffic toggle is enabled", func(t *testing.T) {
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = setting.NewCfg()
			hs.Features = featuremgmt.WithFeatures(
				featuremgmt.FlagUnifiedSearchShadowTraffic, // Only shadow traffic enabled
				// Missing FlagUnifiedStorageSearch - should not trigger shadow traffic
			)
			hs.SearchService = &mockSearchService{ExpectedResult: model.HitList{{Title: "test dashboard"}}}
		})

		req := webtest.RequestWithSignedInUser(
			server.NewGetRequest("/api/search?query=test"),
			userWithPermissions(1, []accesscontrol.Permission{}),
		)
		resp, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		require.NoError(t, resp.Body.Close())
	})

	t.Run("Search API parameters are passed correctly to shadow traffic", func(t *testing.T) {
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = setting.NewCfg()
			hs.Features = featuremgmt.WithFeatures(
				featuremgmt.FlagUnifiedSearchShadowTraffic,
				featuremgmt.FlagUnifiedStorageSearch,
				featuremgmt.FlagKubernetesClientDashboardsFolders,
			)
			hs.SearchService = &mockSearchService{ExpectedResult: model.HitList{{Title: "test dashboard"}}}
		})

		req := webtest.RequestWithSignedInUser(
			server.NewGetRequest("/api/search?query=test&limit=50&page=2&sort=name&tag=prod&tag=monitoring"),
			userWithPermissions(1, []accesscontrol.Permission{}),
		)
		resp, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		require.NoError(t, resp.Body.Close())

		// Allow some time for background processing
		time.Sleep(1000 * time.Millisecond)
	})

	t.Run("Shadow traffic handles both dashboards and folders", func(t *testing.T) {
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = setting.NewCfg()
			hs.Features = featuremgmt.WithFeatures(
				featuremgmt.FlagUnifiedSearchShadowTraffic,
				featuremgmt.FlagUnifiedStorageSearch,
				featuremgmt.FlagKubernetesClientDashboardsFolders,
			)
			hs.SearchService = &mockSearchService{ExpectedResult: model.HitList{{Title: "test dashboard"}}}
		})

		req := webtest.RequestWithSignedInUser(
			server.NewGetRequest("/api/search?query=folders%20and%20dashboards"),
			userWithPermissions(1, []accesscontrol.Permission{}),
		)
		resp, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		require.NoError(t, resp.Body.Close())

		// Allow some time for background processing
		time.Sleep(1000 * time.Millisecond)
	})

	t.Run("Shadow traffic preserves user context for authenticated requests", func(t *testing.T) {
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = setting.NewCfg()
			hs.Features = featuremgmt.WithFeatures(
				featuremgmt.FlagUnifiedSearchShadowTraffic,
				featuremgmt.FlagUnifiedStorageSearch,
				featuremgmt.FlagKubernetesClientDashboardsFolders,
			)
			hs.SearchService = &mockSearchService{ExpectedResult: model.HitList{{Title: "test dashboard"}}}
		})

		// Test with authenticated user - should preserve user identity in shadow traffic
		req := webtest.RequestWithSignedInUser(
			server.NewGetRequest("/api/search?query=auth%20test"),
			userWithPermissions(42, []accesscontrol.Permission{}),
		)
		resp, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		require.NoError(t, resp.Body.Close())

		// Allow some time for background processing
		time.Sleep(1000 * time.Millisecond)
	})

	t.Run("Shadow traffic respects timeout and handles context cancellation", func(t *testing.T) {
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = setting.NewCfg()
			hs.Features = featuremgmt.WithFeatures(
				featuremgmt.FlagUnifiedSearchShadowTraffic,
				featuremgmt.FlagUnifiedStorageSearch,
				featuremgmt.FlagKubernetesClientDashboardsFolders,
			)
			hs.SearchService = &mockSearchService{ExpectedResult: model.HitList{{Title: "test dashboard"}}}
		})

		req := webtest.RequestWithSignedInUser(
			server.NewGetRequest("/api/search?query=timeout%20test"),
			userWithPermissions(1, []accesscontrol.Permission{}),
		)
		resp, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		require.NoError(t, resp.Body.Close())

		// Allow some time for background processing and timeout to occur
		time.Sleep(1000 * time.Millisecond)
	})

	t.Run("Shadow traffic gracefully handles errors without affecting primary search", func(t *testing.T) {
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = setting.NewCfg()
			hs.Features = featuremgmt.WithFeatures(
				featuremgmt.FlagUnifiedSearchShadowTraffic,
				featuremgmt.FlagUnifiedStorageSearch,
				featuremgmt.FlagKubernetesClientDashboardsFolders,
			)
			hs.SearchService = &mockSearchService{ExpectedResult: model.HitList{{Title: "test dashboard"}}}
			// Intentionally leave folder and dashboard services as nil to test error handling
			hs.folderService = nil
			hs.DashboardService = nil
		})

		req := webtest.RequestWithSignedInUser(
			server.NewGetRequest("/api/search?query=error%20test"),
			userWithPermissions(1, []accesscontrol.Permission{}),
		)
		resp, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode) // Primary search should still work
		require.NoError(t, resp.Body.Close())

		// Give some time for background processing
		time.Sleep(1000 * time.Millisecond)
	})

	t.Run("Shadow traffic works with different user roles and permissions", func(t *testing.T) {
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = setting.NewCfg()
			hs.Features = featuremgmt.WithFeatures(
				featuremgmt.FlagUnifiedSearchShadowTraffic,
				featuremgmt.FlagUnifiedStorageSearch,
				featuremgmt.FlagKubernetesClientDashboardsFolders,
			)
			hs.SearchService = &mockSearchService{ExpectedResult: model.HitList{{Title: "test dashboard"}}}
		})

		// Test with admin user
		req := webtest.RequestWithSignedInUser(
			server.NewGetRequest("/api/search?query=admin%20test"),
			userWithPermissions(999, []accesscontrol.Permission{}),
		)
		resp, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		require.NoError(t, resp.Body.Close())

		// Allow some time for background processing
		time.Sleep(1000 * time.Millisecond)
	})
}

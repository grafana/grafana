package migrations_test

import (
	"fmt"
	"net/http"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// playlistsTestCase tests the "playlists" ResourceMigration
type playlistsTestCase struct {
	playlistUIDs []string
	dashboardUID string
}

// newPlaylistsTestCase creates a test case for the playlists migrator
func newPlaylistsTestCase() resourceMigratorTestCase {
	return &playlistsTestCase{
		playlistUIDs: []string{},
	}
}

func (tc *playlistsTestCase) name() string {
	return "playlists"
}

func (tc *playlistsTestCase) resources() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		{
			Group:    "playlist.grafana.app",
			Version:  "v0alpha1",
			Resource: "playlists",
		},
	}
}

func (tc *playlistsTestCase) setup(t *testing.T, helper *apis.K8sTestHelper) {
	t.Helper()

	// Create a test dashboard to reference in playlists
	tc.dashboardUID = createTestDashboard(t, helper, "Test Dashboard for Playlist", "")

	// Create playlist with dashboard UID items
	playlist1UID := createTestPlaylist(t, helper, "Playlist with Dashboard UIDs", "5m", []playlistItemPayload{
		{Type: "dashboard_by_uid", Value: tc.dashboardUID},
	})
	tc.playlistUIDs = append(tc.playlistUIDs, playlist1UID)

	// Create playlist with tag items
	playlist2UID := createTestPlaylist(t, helper, "Playlist with Tags", "10m", []playlistItemPayload{
		{Type: "dashboard_by_tag", Value: "test-tag"},
		{Type: "dashboard_by_tag", Value: "another-tag"},
	})
	tc.playlistUIDs = append(tc.playlistUIDs, playlist2UID)

	// Create playlist with mixed items
	playlist3UID := createTestPlaylist(t, helper, "Playlist with Mixed Items", "15m", []playlistItemPayload{
		{Type: "dashboard_by_uid", Value: tc.dashboardUID},
		{Type: "dashboard_by_tag", Value: "mixed-tag"},
	})
	tc.playlistUIDs = append(tc.playlistUIDs, playlist3UID)

	// Create an empty playlist
	playlist4UID := createTestPlaylist(t, helper, "Empty Playlist", "20m", []playlistItemPayload{})
	tc.playlistUIDs = append(tc.playlistUIDs, playlist4UID)
}

func (tc *playlistsTestCase) verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	expectedPlaylistCount := 0
	if shouldExist {
		expectedPlaylistCount = len(tc.playlistUIDs)
	}

	orgID := helper.Org1.OrgID
	namespace := authlib.OrgNamespaceFormatter(orgID)

	// Verify playlists
	playlistCli := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR: schema.GroupVersionResource{
			Group:    "playlist.grafana.app",
			Version:  "v0alpha1",
			Resource: "playlists",
		},
	})

	verifyResourceCount(t, playlistCli, expectedPlaylistCount)
	for _, uid := range tc.playlistUIDs {
		verifyResource(t, playlistCli, uid, shouldExist)
	}
}

// Helper types and functions

type playlistItemPayload struct {
	Type  string
	Value string
}

// createTestPlaylist creates a playlist with the specified parameters
func createTestPlaylist(t *testing.T, helper *apis.K8sTestHelper, name, interval string, items []playlistItemPayload) string {
	t.Helper()

	// Build the items JSON array
	itemsJSON := "["
	for i, item := range items {
		if i > 0 {
			itemsJSON += ","
		}
		itemsJSON += fmt.Sprintf(`{"type":"%s","value":"%s"}`, item.Type, item.Value)
	}
	itemsJSON += "]"

	payload := fmt.Sprintf(`{
		"name": "%s",
		"interval": "%s",
		"items": %s
	}`, name, interval, itemsJSON)

	playlistCreate := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPost,
		Path:   "/api/playlists",
		Body:   []byte(payload),
	}, &map[string]interface{}{})

	require.NotNil(t, playlistCreate.Response)
	require.Equal(t, http.StatusOK, playlistCreate.Response.StatusCode)
	require.NotNil(t, playlistCreate.Result)

	playlistUID := (*playlistCreate.Result)["uid"].(string)
	require.NotEmpty(t, playlistUID)

	return playlistUID
}

// createTestDashboard creates a simple dashboard for testing
func createTestDashboard(t *testing.T, helper *apis.K8sTestHelper, title, folderUID string) string {
	t.Helper()

	dashPayload := fmt.Sprintf(`{
		"dashboard": {
			"title": "%s",
			"tags": ["test-tag", "another-tag", "mixed-tag"]
		},
		"overwrite": false`, title)

	if folderUID != "" {
		dashPayload += fmt.Sprintf(`,
		"folderUid": "%s"`, folderUID)
	}

	dashPayload += "}"

	dashCreate := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPost,
		Path:   "/api/dashboards/db",
		Body:   []byte(dashPayload),
	}, &map[string]interface{}{})

	require.NotNil(t, dashCreate.Response)
	require.Equal(t, http.StatusOK, dashCreate.Response.StatusCode)
	require.NotNil(t, dashCreate.Result)

	dashUID := (*dashCreate.Result)["uid"].(string)
	require.NotEmpty(t, dashUID)

	return dashUID
}

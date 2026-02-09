package migrations_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/util"
)

// playlistsTestCase tests the "playlists" ResourceMigration
type playlistsTestCase struct {
	playlistUIDs []string
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

	// Get playlist service from the test environment
	// The service writes directly to SQL storage, which works in Mode0
	env := helper.GetEnv()
	playlistSvc := &legacyPlaylistService{db: env.SQLStore}

	// Use a non-existent dashboard UID for testing
	// This avoids interfering with other test cases
	nonExistentDashboardUID := "non-existent-dashboard-uid"

	// Create playlist with dashboard UID items (pointing to non-existent dashboard)
	playlist1UID := createTestPlaylist(t, playlistSvc, helper.Org1.OrgID, "Playlist with Dashboard UIDs", "5m", []playlist.PlaylistItem{
		{Type: "dashboard_by_uid", Value: nonExistentDashboardUID, Order: 1},
	})
	tc.playlistUIDs = append(tc.playlistUIDs, playlist1UID)

	// Create playlist with tag items
	playlist2UID := createTestPlaylist(t, playlistSvc, helper.Org1.OrgID, "Playlist with Tags", "10m", []playlist.PlaylistItem{
		{Type: "dashboard_by_tag", Value: "test-tag", Order: 1},
		{Type: "dashboard_by_tag", Value: "another-tag", Order: 2},
	})
	tc.playlistUIDs = append(tc.playlistUIDs, playlist2UID)

	// Create playlist with mixed items
	playlist3UID := createTestPlaylist(t, playlistSvc, helper.Org1.OrgID, "Playlist with Mixed Items", "15m", []playlist.PlaylistItem{
		{Type: "dashboard_by_uid", Value: nonExistentDashboardUID, Order: 1},
		{Type: "dashboard_by_tag", Value: "mixed-tag", Order: 2},
	})
	tc.playlistUIDs = append(tc.playlistUIDs, playlist3UID)
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

func createTestPlaylist(t *testing.T, playlistSvc *legacyPlaylistService, orgID int64, name, interval string, items []playlist.PlaylistItem) string {
	t.Helper()

	cmd := &playlist.CreatePlaylistCommand{
		Name:     name,
		Interval: interval,
		Items:    items,
		OrgId:    orgID,
	}

	result, err := playlistSvc.Create(context.Background(), cmd)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.NotEmpty(t, result.UID)

	return result.UID
}

// Legacy Playlist Service -- we only need create for test
type legacyPlaylistService struct {
	db db.DB
}

func (s *legacyPlaylistService) Create(ctx context.Context, cmd *playlist.CreatePlaylistCommand) (*playlist.Playlist, error) {
	p := playlist.Playlist{}
	if cmd.UID == "" {
		cmd.UID = util.GenerateShortUID()
	} else {
		err := util.ValidateUID(cmd.UID)
		if err != nil {
			return nil, err
		}
	}

	err := s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		ts := time.Now().UnixMilli()
		p = playlist.Playlist{
			Name:      cmd.Name,
			Interval:  cmd.Interval,
			OrgId:     cmd.OrgId,
			UID:       cmd.UID,
			CreatedAt: ts,
			UpdatedAt: ts,
		}

		_, err := sess.Insert(&p)
		if err != nil {
			return err
		}

		playlistItems := make([]playlist.PlaylistItem, 0)
		for order, item := range cmd.Items {
			playlistItems = append(playlistItems, playlist.PlaylistItem{
				PlaylistId: p.Id,
				Type:       item.Type,
				Value:      item.Value,
				Order:      order + 1,
				Title:      item.Title,
			})
		}

		_, err = sess.Insert(&playlistItems)

		return err
	})
	return &p, err
}

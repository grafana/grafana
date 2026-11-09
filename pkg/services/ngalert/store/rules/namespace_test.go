package rules

import (
	"context"
	"errors"
	"strings"
	"testing"
	"uuid"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegration_GetUserVisibleNamespaces(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	cfg := setting.NewCfg()
	folderService := foldertest.NewFakeService()
	b := &fakeBus{}
	logger := log.New("test-dbstore")
	store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)

	admin := &user.SignedInUser{
		UserID:         1,
		OrgID:          1,
		OrgRole:        org.RoleAdmin,
		IsGrafanaAdmin: true,
	}

	folders := []*folder.Folder{
		{UID: uuid.NewV4().String(), Title: "folder1", ParentUID: "", OrgID: 1},
		{UID: uuid.NewV4().String(), Title: "folder2", ParentUID: "", OrgID: 1},
		{UID: uuid.NewV4().String(), Title: "nested/folder", ParentUID: "", OrgID: 1},
	}

	for _, f := range folders {
		folderService.AddFolder(f)
	}

	t.Run("returns all folders", func(t *testing.T) {
		namespaces, err := store.GetUserVisibleNamespaces(context.Background(), 1, admin)
		require.NoError(t, err)
		require.Len(t, namespaces, len(folders))
	})

	t.Run("returns empty list for a non existing org", func(t *testing.T) {
		emptyOrgID := int64(999)
		namespaces, err := store.GetUserVisibleNamespaces(context.Background(), emptyOrgID, admin)
		require.NoError(t, err)
		require.Empty(t, namespaces)
	})
}

func TestGetNamespaceByUID(t *testing.T) {
	store := RuleStore{FolderService: foldertest.NewFakeService()}

	for _, uid := range []string{folder.LegacyRootFolderUID, folder.GeneralFolderUID} { //nolint:staticcheck
		t.Run("rejects root folder UID "+uid, func(t *testing.T) {
			_, err := store.GetNamespaceByUID(context.Background(), uid, 1, nil)
			require.ErrorIs(t, err, folder.ErrInvalidUID)
		})
	}
}

func TestGetNamespaceByTitle(t *testing.T) {
	folderService := foldertest.NewFakeService()
	folderService.ExpectedError = dashboards.ErrFolderNotFound
	store := RuleStore{
		FolderService: folderService,
	}
	_, err := store.GetNamespaceByTitle(context.Background(), "Test Folder", 1, nil, folder.LegacyRootFolderUID) //nolint:staticcheck
	require.Error(t, err)
	require.ErrorIs(t, err, dashboards.ErrFolderNotFound)

	// note: most tests are in /pkg/tests/api/alerting/api_namespace_test.go
}

func TestGetOrCreateNamespaceByTitle(t *testing.T) {
	store := RuleStore{}
	_, created, err := store.GetOrCreateNamespaceByTitle(context.Background(), "", 1, nil, folder.LegacyRootFolderUID) //nolint:staticcheck
	require.False(t, created)
	require.Error(t, err)
	require.Contains(t, err.Error(), "title is empty")

	// note: most tests are in /pkg/tests/api/alerting/api_namespace_test.go
}

// statefulFolderService keeps created folders so a test can create, look up and
// race on a folder UID; foldertest.FakeService.Create does not persist anything.
type statefulFolderService struct {
	*foldertest.FakeService
	folders   map[string]*folder.Folder
	created   []string
	getErr    error
	createErr error
	// onCreate runs before Create stores anything, to simulate another writer.
	onCreate func(s *statefulFolderService)
}

func newStatefulFolderService() *statefulFolderService {
	return &statefulFolderService{FakeService: foldertest.NewFakeService(), folders: map[string]*folder.Folder{}}
}

func (s *statefulFolderService) GetFolders(_ context.Context, q folder.GetFoldersQuery) ([]*folder.Folder, error) {
	if s.getErr != nil {
		return nil, s.getErr
	}
	var out []*folder.Folder
	for _, uid := range q.UIDs {
		if f, ok := s.folders[uid]; ok {
			out = append(out, f)
		}
	}
	return out, nil
}

func (s *statefulFolderService) Create(_ context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	if s.onCreate != nil {
		s.onCreate(s)
	}
	if s.createErr != nil {
		return nil, s.createErr
	}
	if _, ok := s.folders[cmd.UID]; ok {
		return nil, folder.ErrConflict.Errorf("folder already exists")
	}
	f := &folder.Folder{UID: cmd.UID, Title: cmd.Title, ParentUID: cmd.ParentUID, OrgID: cmd.OrgID}
	s.folders[cmd.UID] = f
	s.created = append(s.created, cmd.UID)
	return f, nil
}

func TestGetOrCreateNamespaceByUID(t *testing.T) {
	ctx := context.Background()
	admin := &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: org.RoleAdmin}

	t.Run("rejects empty uid and title", func(t *testing.T) {
		store := RuleStore{FolderService: newStatefulFolderService()}
		_, _, err := store.GetOrCreateNamespaceByUID(ctx, "", "title", 1, admin, "")
		require.ErrorContains(t, err, "uid is empty")
		_, _, err = store.GetOrCreateNamespaceByUID(ctx, "uid", "", 1, admin, "")
		require.ErrorContains(t, err, "title is empty")
	})

	t.Run("creates the folder with the given uid when it does not exist", func(t *testing.T) {
		svc := newStatefulFolderService()
		store := RuleStore{FolderService: svc}
		f, created, err := store.GetOrCreateNamespaceByUID(ctx, "root-uid", "Root", 1, admin, "")
		require.NoError(t, err)
		require.True(t, created)
		require.Equal(t, "root-uid", f.UID)
		require.Equal(t, "Root", f.Title)
		require.Equal(t, []string{"root-uid"}, svc.created)
	})

	t.Run("returns an existing folder untouched even when its title differs", func(t *testing.T) {
		svc := newStatefulFolderService()
		svc.folders["root-uid"] = &folder.Folder{UID: "root-uid", Title: "Renamed by a user", OrgID: 1}
		store := RuleStore{FolderService: svc}
		f, created, err := store.GetOrCreateNamespaceByUID(ctx, "root-uid", "Root", 1, admin, "")
		require.NoError(t, err)
		require.False(t, created)
		require.Equal(t, "Renamed by a user", f.Title)
		require.Empty(t, svc.created)
	})

	t.Run("a lookup error other than not found fails without creating", func(t *testing.T) {
		svc := newStatefulFolderService()
		svc.getErr = errors.New("database is down")
		store := RuleStore{FolderService: svc}
		_, created, err := store.GetOrCreateNamespaceByUID(ctx, "root-uid", "Root", 1, admin, "")
		require.ErrorIs(t, err, svc.getErr)
		require.False(t, created)
		require.Empty(t, svc.created)
		require.Empty(t, svc.folders)
	})

	t.Run("a concurrent create of the same uid resolves to the existing folder", func(t *testing.T) {
		svc := newStatefulFolderService()
		svc.createErr = folder.ErrConflict.Errorf("folder already exists")
		svc.onCreate = func(s *statefulFolderService) {
			s.folders["root-uid"] = &folder.Folder{UID: "root-uid", Title: "Root", OrgID: 1}
		}
		store := RuleStore{FolderService: svc}
		f, created, err := store.GetOrCreateNamespaceByUID(ctx, "root-uid", "Root", 1, admin, "")
		require.NoError(t, err)
		require.False(t, created)
		require.Equal(t, "root-uid", f.UID)
	})

	t.Run("a failed create that left no folder returns both errors", func(t *testing.T) {
		svc := newStatefulFolderService()
		svc.createErr = errors.New("storage unavailable")
		store := RuleStore{FolderService: svc}
		_, created, err := store.GetOrCreateNamespaceByUID(ctx, "root-uid", "Root", 1, admin, "")
		require.ErrorIs(t, err, svc.createErr)
		require.ErrorIs(t, err, folder.ErrAccessDenied)
		require.False(t, created)
	})
}

func TestAlertingFolderUID(t *testing.T) {
	got, err := AlertingFolderUID("Title", "parent", 1)
	require.NoError(t, err)
	want, err := generateAlertingFolderUID("Title", "parent", 1)
	require.NoError(t, err)
	require.Equal(t, want, got, "the exported helper returns the UID GetOrCreateNamespaceByTitle assigns")
}

func TestGenerateAlertingFolderUID(t *testing.T) {
	const orgID int64 = 1

	t.Run("should generate deterministic UIDs for same inputs", func(t *testing.T) {
		title := "Test Folder"
		parentUID := "parent123"

		uid1, err := generateAlertingFolderUID(title, parentUID, orgID)
		require.NoError(t, err)
		require.True(t, util.IsValidShortUID(uid1), "Generated UID should be valid")

		uid2, err := generateAlertingFolderUID(title, parentUID, orgID)
		require.NoError(t, err)
		require.True(t, util.IsValidShortUID(uid2), "Generated UID should be valid")

		require.Equal(t, uid1, uid2, "UIDs should be identical for same inputs")
		require.True(t, strings.HasPrefix(uid1, "alerting-"), "UID should have alerting prefix")
	})

	t.Run("should generate different UIDs for different inputs", func(t *testing.T) {
		uid1, err := generateAlertingFolderUID("Folder1", "parent1", orgID)
		require.NoError(t, err)
		require.True(t, util.IsValidShortUID(uid1), "Generated UID should be valid")

		uid2, err := generateAlertingFolderUID("Folder2", "parent1", orgID)
		require.NoError(t, err)
		require.True(t, util.IsValidShortUID(uid2), "Generated UID should be valid")

		uid3, err := generateAlertingFolderUID("Folder1", "parent2", orgID)
		require.NoError(t, err)
		require.True(t, util.IsValidShortUID(uid3), "Generated UID should be valid")

		require.NotEqual(t, uid1, uid2, "UIDs should differ for different titles")
		require.NotEqual(t, uid1, uid3, "UIDs should differ for different parent UIDs")
	})

	t.Run("should handle special characters in folder titles", func(t *testing.T) {
		specialTitles := []string{
			"folder/with/slashes",
			"folder with spaces",
			"folder-with-dashes",
			"folder_with_underscores",
			"folder.with.dots",
			"!@#$%^&*()",
		}

		for _, title := range specialTitles {
			t.Run(title, func(t *testing.T) {
				uid, err := generateAlertingFolderUID(title, "parent123", orgID)
				require.NoError(t, err)
				require.True(t, util.IsValidShortUID(uid), "Generated UID should be valid")
			})
		}
	})
}

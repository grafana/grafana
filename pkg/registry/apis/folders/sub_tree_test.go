package folders

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

func TestFolderTopologyCacheScopesExpiresAndCoalescesLoads(t *testing.T) {
	now := time.Unix(100, 0)
	cache := newFolderTopologyCache(5 * time.Second)
	cache.now = func() time.Time { return now }

	var loads atomic.Int32
	started := make(chan struct{})
	release := make(chan struct{})
	loader := func(context.Context) ([]foldersv1.FolderInfo, error) {
		if loads.Add(1) == 1 {
			close(started)
			<-release
		}
		return []foldersv1.FolderInfo{{Name: "leaf", Title: "Leaf", Parent: "parent", Access: "must-not-be-cached"}}, nil
	}

	var wg sync.WaitGroup
	results := make([][]foldersv1.FolderInfo, 2)
	for i := range results {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			var err error
			results[i], err = cache.get(context.Background(), folderTopologyCacheKey{orgID: 1, namespace: "default"}, loader)
			require.NoError(t, err)
		}(i)
	}
	<-started
	close(release)
	wg.Wait()
	require.Equal(t, int32(1), loads.Load(), "concurrent callers should share one topology load")
	require.Equal(t, "", results[0][0].Access, "the cache must retain authorization-neutral fields only")

	results[0][0].Title = "mutated"
	got, err := cache.get(context.Background(), folderTopologyCacheKey{orgID: 1, namespace: "default"}, loader)
	require.NoError(t, err)
	require.Equal(t, "Leaf", got[0].Title, "callers must not mutate cached topology")
	require.Equal(t, int32(1), loads.Load())

	_, err = cache.get(context.Background(), folderTopologyCacheKey{orgID: 2, namespace: "default"}, loader)
	require.NoError(t, err)
	require.Equal(t, int32(2), loads.Load(), "organizations must not share topology entries")
	_, err = cache.get(context.Background(), folderTopologyCacheKey{orgID: 1, namespace: "other"}, loader)
	require.NoError(t, err)
	require.Equal(t, int32(3), loads.Load(), "namespaces must not share topology entries")

	now = now.Add(6 * time.Second)
	_, err = cache.get(context.Background(), folderTopologyCacheKey{orgID: 1, namespace: "default"}, loader)
	require.NoError(t, err)
	require.Equal(t, int32(4), loads.Load(), "entries must expire after five seconds")
}

func TestBuildFolderTreeProjectsOnlyRequiredAncestors(t *testing.T) {
	all := map[string]foldersv1.FolderInfo{
		"restricted":   {Name: "restricted", Title: "restricted"},
		"department-a": {Name: "department-a", Title: "department-a", Parent: "restricted"},
		"department-b": {Name: "department-b", Title: "department-b", Parent: "restricted"},
		"team-a":       {Name: "team-a", Title: "team-a", Parent: "department-a"},
		"team-b":       {Name: "team-b", Title: "team-b", Parent: "department-a"},
	}
	lookedUp := []string{}

	got, err := buildFolderTree(
		[]foldersv1.FolderInfo{{Name: "team-a", Title: "team-a", Parent: "department-a"}},
		10,
		func(uid string) (*foldersv1.FolderInfo, error) {
			lookedUp = append(lookedUp, uid)
			item, ok := all[uid]
			if !ok {
				return nil, errors.New("not found")
			}
			return &item, nil
		},
	)

	require.NoError(t, err)
	require.Equal(t, []string{"department-a", "restricted"}, lookedUp)
	require.Equal(t, []foldersv1.FolderInfo{
		{Name: "restricted", Title: "restricted", Access: folderTreeAccessAncestor},
		{Name: "department-a", Title: "department-a", Parent: "restricted", Access: folderTreeAccessAncestor},
		{Name: "team-a", Title: "team-a", Parent: "department-a", Access: folderTreeAccessFull},
	}, got)
}

func TestBuildFolderTreeDeduplicatesSharedAncestorsAndPreservesFullAccess(t *testing.T) {
	all := map[string]foldersv1.FolderInfo{
		"restricted":   {Name: "restricted", Title: "restricted"},
		"department-a": {Name: "department-a", Title: "department-a", Parent: "restricted"},
	}

	got, err := buildFolderTree([]foldersv1.FolderInfo{
		{Name: "team-b", Title: "Team B", Parent: "department-a"},
		{Name: "department-a", Title: "Department A", Parent: "restricted"},
		{Name: "team-a", Title: "Team A", Parent: "department-a"},
	}, 10, func(uid string) (*foldersv1.FolderInfo, error) {
		item := all[uid]
		return &item, nil
	})

	require.NoError(t, err)
	require.Equal(t, []foldersv1.FolderInfo{
		{Name: "restricted", Title: "restricted", Access: folderTreeAccessAncestor},
		{Name: "department-a", Title: "Department A", Parent: "restricted", Access: folderTreeAccessFull},
		{Name: "team-a", Title: "Team A", Parent: "department-a", Access: folderTreeAccessFull},
		{Name: "team-b", Title: "Team B", Parent: "department-a", Access: folderTreeAccessFull},
	}, got)
}

func TestBuildFolderTreeDropsSensitiveAncestorMetadata(t *testing.T) {
	got, err := buildFolderTree(
		[]foldersv1.FolderInfo{{Name: "leaf", Title: "leaf", Parent: "parent", Description: "leaf secret", Detached: true}},
		10,
		func(string) (*foldersv1.FolderInfo, error) {
			return &foldersv1.FolderInfo{
				Name: "parent", Title: "parent", Description: "sensitive", Detached: true,
			}, nil
		},
	)

	require.NoError(t, err)
	require.Equal(t, []foldersv1.FolderInfo{
		{Name: "parent", Title: "parent", Access: folderTreeAccessAncestor},
		{Name: "leaf", Title: "leaf", Parent: "parent", Access: folderTreeAccessFull},
	}, got)
}

func TestBuildFolderTreeHandlesDeletedParentWithoutInventingPath(t *testing.T) {
	got, err := buildFolderTree(
		[]foldersv1.FolderInfo{{Name: "leaf", Title: "leaf", Parent: "deleted"}},
		10,
		func(string) (*foldersv1.FolderInfo, error) {
			return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, "deleted")
		},
	)

	require.NoError(t, err)
	require.Equal(t, []foldersv1.FolderInfo{{Name: "leaf", Title: "leaf", Access: folderTreeAccessFull}}, got)
}

func TestBuildFolderTreeRejectsCyclesAndExcessiveDepth(t *testing.T) {
	t.Run("cycle", func(t *testing.T) {
		_, err := buildFolderTree(
			[]foldersv1.FolderInfo{{Name: "leaf", Title: "leaf", Parent: "parent"}},
			10,
			func(string) (*foldersv1.FolderInfo, error) {
				return &foldersv1.FolderInfo{Name: "parent", Title: "parent", Parent: "leaf"}, nil
			},
		)
		require.ErrorContains(t, err, "cyclic folder references")
	})

	t.Run("depth", func(t *testing.T) {
		_, err := buildFolderTree(
			[]foldersv1.FolderInfo{{Name: "leaf", Title: "leaf", Parent: "p1"}},
			1,
			func(string) (*foldersv1.FolderInfo, error) {
				return &foldersv1.FolderInfo{Name: "p1", Title: "p1", Parent: "p2"}, nil
			},
		)
		require.ErrorContains(t, err, "maximum nested folder depth")
	})
}

func TestTreePermission(t *testing.T) {
	require.Equal(t, int64(1), treePermission("view"))
	require.Equal(t, int64(2), treePermission("EDIT"))
	require.Equal(t, int64(4), treePermission("admin"))
	require.Equal(t, int64(1), treePermission("invalid"))
}

func TestBuildLegacyFolderNavigationPlacesOrphansUnderSharedWithMe(t *testing.T) {
	got := buildLegacyFolderNavigation([]foldersv1.FolderInfo{
		{Name: "team-a", Title: "Team A", Parent: "department-a"},
	})

	require.Equal(t, []foldersv1.FolderNavigationItem{
		{UID: "sharedwithme", Title: "Shared with me", Kind: folderTreeKindVirtual, Access: folderTreeAccessNavigation},
		{UID: "team-a", Title: "Team A", Kind: folderTreeKindFolder, NavigationParentUID: "sharedwithme", Access: folderTreeAccessFull},
	}, got)
}

func TestBuildHierarchyFolderNavigationAddsOnlyRequiredAncestors(t *testing.T) {
	all := map[string]foldersv1.FolderInfo{
		"restricted":   {Name: "restricted", Title: "restricted"},
		"department-a": {Name: "department-a", Title: "department-a", Parent: "restricted"},
		"department-b": {Name: "department-b", Title: "department-b", Parent: "restricted"},
		"team-a":       {Name: "team-a", Title: "team-a", Parent: "department-a"},
		"team-b":       {Name: "team-b", Title: "team-b", Parent: "department-a"},
	}

	got, err := buildHierarchyFolderNavigation(
		[]foldersv1.FolderInfo{all["team-a"]},
		all,
		10,
	)

	require.NoError(t, err)
	require.Equal(t, []foldersv1.FolderNavigationItem{
		{UID: "sharedwithme", Title: "Shared with me", Kind: folderTreeKindVirtual, Access: folderTreeAccessNavigation},
		{UID: "restricted", Title: "restricted", Kind: folderTreeKindFolder, Access: folderTreeAccessAncestor},
		{UID: "department-a", Title: "department-a", Kind: folderTreeKindFolder, NavigationParentUID: "restricted", Access: folderTreeAccessAncestor},
		{UID: "team-a", Title: "team-a", Kind: folderTreeKindFolder, NavigationParentUID: "department-a", Access: folderTreeAccessFull},
	}, got)
}

func TestParseFolderNavigationPurpose(t *testing.T) {
	for _, value := range []string{"", "browse", "dashboard-create", "folder-edit", "folder-admin"} {
		purpose, err := parseFolderNavigationPurpose(value)
		require.NoError(t, err)
		if value == "" {
			require.Equal(t, folderNavigationPurposeBrowse, purpose)
		} else {
			require.Equal(t, folderNavigationPurpose(value), purpose)
		}
	}

	_, err := parseFolderNavigationPurpose("dashboards:delete")
	require.ErrorContains(t, err, "unknown folder navigation purpose")
}

func TestApplyFolderNavigationSelectabilityOnlyMarksAuthorizedFullFolders(t *testing.T) {
	items := []foldersv1.FolderNavigationItem{
		{UID: "sharedwithme", Kind: folderTreeKindVirtual, Access: folderTreeAccessNavigation},
		{UID: "ancestor", Kind: folderTreeKindFolder, Access: folderTreeAccessAncestor},
		{UID: "allowed", Kind: folderTreeKindFolder, Access: folderTreeAccessFull},
		{UID: "denied", Kind: folderTreeKindFolder, Access: folderTreeAccessFull},
	}

	applyFolderNavigationSelectability(items, map[string]bool{"allowed": true, "ancestor": true})

	require.False(t, items[0].Selectable)
	require.False(t, items[1].Selectable)
	require.True(t, items[2].Selectable)
	require.False(t, items[3].Selectable)
}

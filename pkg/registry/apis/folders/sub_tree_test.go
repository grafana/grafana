package folders

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

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

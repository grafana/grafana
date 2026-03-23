package sync

import (
	"testing"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/stretchr/testify/require"
)

func TestFolderMetadataDiffSplit(t *testing.T) {
	diff := []repository.VersionedFileChange{
		{Action: repository.FileActionUpdated, Path: "parent/_folder.json", Ref: "new-ref"},
		{Action: repository.FileActionUpdated, Path: "parent/child/_folder.json", Ref: "new-ref"},
		{Action: repository.FileActionUpdated, Path: "parent/dashboard.json", Ref: "new-ref"},
		{
			Action:       repository.FileActionRenamed,
			Path:         "parent/renamed.json",
			PreviousPath: "parent/original.json",
			PreviousRef:  "old-ref",
			Ref:          "new-ref",
		},
	}

	split := splitMetadataChanges(diff)

	require.True(t, split.HasMetadataChanges())
	require.Equal(t, []repository.VersionedFileChange{
		{Action: repository.FileActionUpdated, Path: "parent/dashboard.json", Ref: "new-ref"},
		{
			Action:       repository.FileActionRenamed,
			Path:         "parent/renamed.json",
			PreviousPath: "parent/original.json",
			PreviousRef:  "old-ref",
			Ref:          "new-ref",
		},
	}, split.otherChanges)
	require.Equal(t, []repository.VersionedFileChange{
		{Action: repository.FileActionUpdated, Path: "parent/child/_folder.json", Ref: "new-ref"},
		{Action: repository.FileActionUpdated, Path: "parent/_folder.json", Ref: "new-ref"},
	}, split.metadataChanges)

	require.True(t, split.HadChangeOriginallyAt("parent/dashboard.json"))
	require.True(t, split.HadChangeOriginallyAt("parent/renamed.json"))
	require.True(t, split.HadChangeOriginallyAt("parent/original.json"))
	require.False(t, split.HadChangeOriginallyAt("parent/_folder.json"))

	require.True(t, split.HasMetadataFolderAt("parent/"))
	require.True(t, split.HasMetadataFolderAt("parent/child/"))
	require.False(t, split.HasMetadataFolderAt("other/"))
}

func TestFolderMetadataDiffSplit_RenamedFolderMetadataIsSplit(t *testing.T) {
	diff := []repository.VersionedFileChange{
		{
			Action:       repository.FileActionRenamed,
			Path:         "new-parent/_folder.json",
			PreviousPath: "old-parent/_folder.json",
			PreviousRef:  "old-ref",
			Ref:          "new-ref",
		},
		{Action: repository.FileActionUpdated, Path: "other/dashboard.json", Ref: "new-ref"},
	}

	split := splitMetadataChanges(diff)

	require.True(t, split.HasMetadataChanges())
	require.Equal(t, []repository.VersionedFileChange{
		{Action: repository.FileActionUpdated, Path: "other/dashboard.json", Ref: "new-ref"},
	}, split.otherChanges)
	require.Equal(t, []repository.VersionedFileChange{
		{
			Action:       repository.FileActionRenamed,
			Path:         "new-parent/_folder.json",
			PreviousPath: "old-parent/_folder.json",
			PreviousRef:  "old-ref",
			Ref:          "new-ref",
		},
	}, split.metadataChanges)
	require.True(t, split.HasMetadataFolderAt("new-parent/"))
	require.True(t, split.HasMetadataFolderAt("old-parent/"), "old folder path should be registered for renamed metadata")
	require.False(t, split.HadChangeOriginallyAt("new-parent/_folder.json"))
}

func TestFolderMetadataDiffSplit_RenamedFromNonMetadataDoesNotRegisterOldPath(t *testing.T) {
	diff := []repository.VersionedFileChange{
		{
			Action:       repository.FileActionRenamed,
			Path:         "new-team/_folder.json",
			PreviousPath: "old-team/config.json",
			PreviousRef:  "old-ref",
			Ref:          "new-ref",
		},
	}

	split := splitMetadataChanges(diff)

	require.True(t, split.HasMetadataChanges(), "rename to _folder.json is still a metadata change")
	require.True(t, split.HasMetadataFolderAt("new-team/"), "new path should be registered")
	require.False(t, split.HasMetadataFolderAt("old-team/"), "non-metadata PreviousPath folder must not be registered")
}

func TestFolderMetadataDiffSplitWithoutMetadataChanges(t *testing.T) {
	split := splitMetadataChanges([]repository.VersionedFileChange{
		{Action: repository.FileActionUpdated, Path: "alpha/dashboard.json", Ref: "new-ref"},
	})

	require.False(t, split.HasMetadataChanges())
	require.Equal(t, []repository.VersionedFileChange{
		{Action: repository.FileActionUpdated, Path: "alpha/dashboard.json", Ref: "new-ref"},
	}, split.otherChanges)
	require.Empty(t, split.metadataChanges)
	require.True(t, split.HadChangeOriginallyAt("alpha/dashboard.json"))
	require.False(t, split.HasMetadataFolderAt("alpha/"))
}

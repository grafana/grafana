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

	split := newFolderMetadataDiffSplit(diff)

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
	}, split.OtherChanges())
	require.Equal(t, []repository.VersionedFileChange{
		{Action: repository.FileActionUpdated, Path: "parent/child/_folder.json", Ref: "new-ref"},
		{Action: repository.FileActionUpdated, Path: "parent/_folder.json", Ref: "new-ref"},
	}, split.MetadataChanges())

	require.True(t, split.HasRealChangeAt("parent/dashboard.json"))
	require.True(t, split.HasRealChangeAt("parent/renamed.json"))
	require.True(t, split.HasRealChangeAt("parent/original.json"))
	require.False(t, split.HasRealChangeAt("parent/_folder.json"))

	require.True(t, split.HasMetadataFolderAt("parent/"))
	require.True(t, split.HasMetadataFolderAt("parent/child/"))
	require.False(t, split.HasMetadataFolderAt("other/"))
}

func TestFolderMetadataDiffSplitReturnsClones(t *testing.T) {
	split := newFolderMetadataDiffSplit([]repository.VersionedFileChange{
		{Action: repository.FileActionUpdated, Path: "alpha/_folder.json", Ref: "new-ref"},
		{Action: repository.FileActionUpdated, Path: "alpha/dashboard.json", Ref: "new-ref"},
	})

	other := split.OtherChanges()
	other[0].Path = "mutated.json"
	require.Equal(t, "alpha/dashboard.json", split.OtherChanges()[0].Path)

	metadata := split.MetadataChanges()
	metadata[0].Path = "mutated/_folder.json"
	require.Equal(t, "alpha/_folder.json", split.MetadataChanges()[0].Path)
}

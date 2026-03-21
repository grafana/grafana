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

func TestFolderMetadataDiffSplitReturnsClones(t *testing.T) {
	split := splitMetadataChanges([]repository.VersionedFileChange{
		{Action: repository.FileActionUpdated, Path: "alpha/_folder.json", Ref: "new-ref"},
		{Action: repository.FileActionUpdated, Path: "alpha/dashboard.json", Ref: "new-ref"},
	})

	other := split.otherChanges
	other[0].Path = "mutated.json"
	require.Equal(t, "alpha/dashboard.json", split.otherChanges[0].Path)

	metadata := split.metadataChanges
	metadata[0].Path = "mutated/_folder.json"
	require.Equal(t, "alpha/_folder.json", split.metadataChanges[0].Path)
}

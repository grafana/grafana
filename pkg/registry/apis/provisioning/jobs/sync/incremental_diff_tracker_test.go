package sync

import (
	"testing"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/stretchr/testify/require"
)

func TestIncrementalDiffTrackerHasGeneratedPath(t *testing.T) {
	tracker := newRebuiltIncrementalDiffTracker(nil)

	require.False(t, tracker.HasGeneratedPath("alpha/"))

	tracker.Append(repository.VersionedFileChange{
		Action: repository.FileActionUpdated,
		Path:   "alpha/",
		Ref:    "new-ref",
	})

	require.True(t, tracker.HasGeneratedPath("alpha/"))
}

func TestIncrementalDiffTrackerAppend(t *testing.T) {
	tracker := newRebuiltIncrementalDiffTracker([]repository.VersionedFileChange{
		{Action: repository.FileActionUpdated, Path: "kept.json", Ref: "new-ref"},
	})

	tracker.Append(repository.VersionedFileChange{
		Action: repository.FileActionUpdated,
		Path:   "alpha/",
		Ref:    "new-ref",
	})

	require.Equal(t, []repository.VersionedFileChange{
		{Action: repository.FileActionUpdated, Path: "kept.json", Ref: "new-ref"},
		{Action: repository.FileActionUpdated, Path: "alpha/", Ref: "new-ref"},
	}, tracker.IncrementalDiff())
}

func TestIncrementalDiffTrackerAppendReplaced(t *testing.T) {
	tracker := newRebuiltIncrementalDiffTracker(nil)

	tracker.AppendReplaced(replacedFolder{
		Path:   "alpha/",
		OldUID: "old-alpha-uid",
	})

	require.Equal(t, []replacedFolder{{
		Path:   "alpha/",
		OldUID: "old-alpha-uid",
	}}, tracker.ReplacedFolders())
}

func TestIncrementalDiffTrackerGetIncrementalDiff(t *testing.T) {
	initial := []repository.VersionedFileChange{
		{Action: repository.FileActionUpdated, Path: "kept.json", Ref: "new-ref"},
	}

	tracker := newRebuiltIncrementalDiffTracker(initial)

	require.Equal(t, initial, tracker.IncrementalDiff())
}

func TestIncrementalDiffTrackerGetReplacedFolders(t *testing.T) {
	tracker := newRebuiltIncrementalDiffTracker(nil)

	require.Empty(t, tracker.ReplacedFolders())
}

func TestIncrementalDiffTrackerActiveUIDFiltersReplaced(t *testing.T) {
	tracker := newRebuiltIncrementalDiffTracker(nil)

	tracker.AppendReplaced(replacedFolder{Path: "src/", OldUID: "uid-moved"})
	tracker.AppendReplaced(replacedFolder{Path: "dst/", OldUID: "uid-gone"})
	tracker.TrackRelocation("new-dst/", "uid-moved")

	replaced := tracker.ReplacedFolders()
	require.Equal(t, []replacedFolder{{Path: "dst/", OldUID: "uid-gone"}}, replaced,
		"UID actively written to another path must not be scheduled for deletion")
}

func TestIncrementalDiffTrackerRelocations(t *testing.T) {
	tracker := newRebuiltIncrementalDiffTracker(nil)

	tracker.TrackRelocation("dst-a/", "uid-a")
	tracker.TrackRelocation("dst-b/", "uid-b")
	tracker.TrackRelocation("dst-a/", "uid-c")

	relocations := tracker.Relocations()
	require.Equal(t, map[string][]string{
		"dst-a/": {"uid-a", "uid-c"},
		"dst-b/": {"uid-b"},
	}, relocations, "relocations maps target paths to UIDs moving there")
}

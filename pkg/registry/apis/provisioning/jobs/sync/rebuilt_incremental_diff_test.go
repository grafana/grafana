package sync

import (
	"testing"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/stretchr/testify/require"
)

func TestRebuiltIncrementalDiff(t *testing.T) {
	result := newRebuiltIncrementalDiff([]repository.VersionedFileChange{
		{Action: repository.FileActionUpdated, Path: "kept.json", Ref: "new-ref"},
	})

	require.False(t, result.HasGeneratedPath("alpha/"))

	result.Append(repository.VersionedFileChange{
		Action: repository.FileActionUpdated,
		Path:   "alpha/",
		Ref:    "new-ref",
	})
	result.AppendReplaced(replacedFolder{
		Path:   "alpha/",
		OldUID: "old-alpha-uid",
	})

	require.True(t, result.HasGeneratedPath("alpha/"))
	require.Equal(t, []repository.VersionedFileChange{
		{Action: repository.FileActionUpdated, Path: "kept.json", Ref: "new-ref"},
		{Action: repository.FileActionUpdated, Path: "alpha/", Ref: "new-ref"},
	}, result.filteredDiff)
	require.Equal(t, []replacedFolder{{
		Path:   "alpha/",
		OldUID: "old-alpha-uid",
	}}, result.replaced)
}

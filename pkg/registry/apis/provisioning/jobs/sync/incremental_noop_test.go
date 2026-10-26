package sync

import (
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestIncrementalSync_NoopFolderMetadata(t *testing.T) {
	readErr := errors.New("repository unavailable")
	for _, tt := range []struct {
		name        string
		emptyDiff   bool
		hasMetadata bool
		treeErr     error
	}{
		{name: "same ref with keep-only folder"},
		{name: "same ref with metadata does not read manifests", hasMetadata: true},
		{name: "empty diff does not read tree or manifests", emptyDiff: true},
		{name: "same ref reports tree read failure", treeErr: readErr},
	} {
		t.Run(tt.name, func(t *testing.T) {
			repo := newCompositeRepoWithConfig(t)
			repoResources := resources.NewMockRepositoryResources(t)
			progress := jobs.NewMockJobProgressRecorder(t)
			quotaTracker := newPermissiveMockQuotaTracker(t)
			previousRef, currentRef := "current-ref", "current-ref"
			message := "same commit as last time"
			if tt.emptyDiff {
				previousRef = "previous-ref"
				message = "no changes detected between commits"
				repo.MockVersioned.EXPECT().CompareFiles(mock.Anything, previousRef, currentRef).
					Return([]repository.VersionedFileChange{}, nil).Once()
			} else {
				tree := []repository.FileTreeEntry{
					{Path: "team", Blob: false},
					{Path: "team/.keep", Blob: true},
				}
				if tt.hasMetadata {
					tree = append(tree, repository.FileTreeEntry{Path: "team/_folder.json", Blob: true})
				}
				repo.MockReader.EXPECT().ReadTree(mock.Anything, currentRef).Return(tree, tt.treeErr).Once()
				if !tt.hasMetadata && tt.treeErr == nil {
					progress.EXPECT().Record(mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
						return result.Path() == "team/" && result.Action() == repository.FileActionIgnored &&
							errors.Is(result.Warning(), resources.ErrMissingFolderMetadata)
					})).Once()
				}
			}
			if tt.treeErr == nil {
				progress.EXPECT().SetFinalMessage(mock.Anything, message).Once()
			}

			err := IncrementalSync(t.Context(), repo, previousRef, currentRef, repoResources, progress,
				tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), quotaTracker, false)
			if tt.treeErr != nil {
				require.ErrorIs(t, err, readErr)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

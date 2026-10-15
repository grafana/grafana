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
	for _, refs := range []struct {
		name, previous, current, message string
	}{
		{"same ref", "current-ref", "current-ref", "same commit as last time"},
		{"empty diff", "previous-ref", "current-ref", "no changes detected between commits"},
	} {
		t.Run(refs.name, func(t *testing.T) {
			for _, tt := range []struct {
				name     string
				metadata []byte
				warning  error
				treeErr  error
				readErr  error
			}{
				{name: "missing metadata", warning: resources.ErrMissingFolderMetadata},
				{name: "malformed JSON", metadata: []byte(`{`), warning: resources.ErrInvalidFolderMetadata},
				{name: "missing UID", metadata: []byte(`{"metadata":{}}`), warning: resources.ErrInvalidFolderMetadata},
				{name: "valid metadata", metadata: []byte(`{"metadata":{"name":"stable-uid"}}`)},
				{name: "tree read failure", treeErr: readErr},
				{name: "metadata read failure", metadata: []byte(`{}`), readErr: readErr},
			} {
				t.Run(tt.name, func(t *testing.T) {
					repo := newCompositeRepoWithConfig(t)
					repoResources := resources.NewMockRepositoryResources(t)
					progress := jobs.NewMockJobProgressRecorder(t)
					quotaTracker := newPermissiveMockQuotaTracker(t)
					if refs.previous != refs.current {
						repo.MockVersioned.EXPECT().CompareFiles(mock.Anything, refs.previous, refs.current).
							Return([]repository.VersionedFileChange{}, nil).Once()
					}
					tree := []repository.FileTreeEntry{
						{Path: "team", Blob: false},
						{Path: "team/dashboard.json", Blob: true},
						{Path: "_folder.json", Blob: true},
						{Path: ".hidden/_folder.json", Blob: true},
					}
					if tt.metadata != nil {
						tree = append(tree, repository.FileTreeEntry{Path: "team/_folder.json", Blob: true})
						repo.MockReader.EXPECT().Read(mock.Anything, "team/_folder.json", refs.current).
							Return(&repository.FileInfo{Data: tt.metadata}, tt.readErr).Once()
					}
					repo.MockReader.EXPECT().ReadTree(mock.Anything, refs.current).Return(tree, tt.treeErr).Once()
					if tt.warning != nil {
						progress.EXPECT().Record(mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
							return result.Path() == "team/" && result.Action() == repository.FileActionIgnored &&
								errors.Is(result.Warning(), tt.warning)
						})).Once()
					}
					if tt.treeErr == nil && tt.readErr == nil {
						progress.EXPECT().SetFinalMessage(mock.Anything, refs.message).Once()
					}

					err := IncrementalSync(t.Context(), repo, refs.previous, refs.current, repoResources, progress,
						tracing.NewNoopTracerService(), jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), quotaTracker, false)
					if tt.treeErr != nil || tt.readErr != nil {
						require.ErrorIs(t, err, readErr)
					} else {
						require.NoError(t, err)
					}
				})
			}
		})
	}
}

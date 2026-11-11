package sync

import (
	"context"
	"fmt"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// The bootstrap repository is registered in every org over one directory, so in an instance
// with N orgs each file belongs to some other org in N-1 of them. Skipping those is the
// normal case: the job must come back clean, or every org but one reports a sync problem it
// cannot act on.
func TestSync_ForeignNamespaceFileLeavesTheJobClean(t *testing.T) {
	for _, syncType := range []string{"full", "incremental"} {
		t.Run(syncType, func(t *testing.T) {
			progress := jobs.NewJobProgressRecorder(
				func(context.Context, provisioning.JobStatus) error { return nil },
				nil,
				provisioning.JobActionPull,
			)
			quotaTracker := quotas.NewInMemoryQuotaTracker(0, 10)
			repoResources := foreignNamespaceResources(t)

			err := runForeignNamespaceSync(t, syncType, repoResources, progress, quotaTracker)
			require.NoError(t, err)

			status := progress.Complete(t.Context(), nil)
			assert.Equal(t, provisioning.JobStateSuccess, status.State)
			assert.Empty(t, status.Errors)
			assert.Empty(t, status.Warnings)

			// A skipped file never resolved a kind, so it is summarised under its own empty
			// group rather than beside the dashboard it would have been.
			var created, noop, errored int64
			for _, summary := range status.Summary {
				created += summary.Create
				noop += summary.Noop
				errored += summary.Error
			}
			assert.Equal(t, int64(1), created, "the org's own file is provisioned")
			assert.Equal(t, int64(1), noop, "the other org's file is counted as a no-op")
			assert.Equal(t, int64(0), errored)
		})
	}
}

// A skipped file wrote nothing, so the quota slot it reserved goes back to the next file
// rather than counting against the org it does not belong to.
func TestSync_ForeignNamespaceFileDoesNotConsumeQuota(t *testing.T) {
	for _, syncType := range []string{"full", "incremental"} {
		t.Run(syncType, func(t *testing.T) {
			progress := jobs.NewMockJobProgressRecorder(t)
			progress.On("SetTotal", mock.Anything, 2).Return()
			progress.On("Record", mock.Anything, mock.Anything).Return()
			progress.On("TooManyErrors").Return(nil)
			progress.On("HasDirPathFailedCreation", mock.Anything).Return(false).Maybe()
			progress.On("SetMessage", mock.Anything, mock.Anything).Return().Maybe()
			// Room for exactly the two files, so a slot the skipped one keeps is a slot the
			// next create cannot have.
			quotaTracker := quotas.NewInMemoryQuotaTracker(0, 2)

			err := runForeignNamespaceSync(t, syncType, foreignNamespaceResources(t), progress, quotaTracker)
			require.NoError(t, err)

			assert.True(t, quotaTracker.TryAcquire(), "the skipped file must release its slot")
		})
	}
}

// foreignNamespaceResources expects a write for each file: one rejected as another namespace's,
// one provisioned normally.
func foreignNamespaceResources(t *testing.T) *resources.MockRepositoryResources {
	t.Helper()
	repoResources := resources.NewMockRepositoryResources(t)
	gvk := schema.GroupVersionKind{Group: "dashboard.grafana.app", Kind: "Dashboard"}
	repoResources.On("WriteResourceFromFile", mock.Anything, "other-org.json", mock.Anything).
		Return("", schema.GroupVersionKind{}, 0, resources.NewResourceValidationError(
			fmt.Errorf("%w: org-2", resources.ErrForeignNamespace))).Once()
	repoResources.On("WriteResourceFromFile", mock.Anything, "mine.json", mock.Anything).
		Return("mine", gvk, 0, nil).Once()
	return repoResources
}

func runForeignNamespaceSync(t *testing.T, syncType string, repoResources *resources.MockRepositoryResources, progress jobs.JobProgressRecorder, quotaTracker quotas.QuotaTracker) error {
	t.Helper()
	tracer := tracing.NewNoopTracerService()
	metrics := jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry())
	paths := []string{"other-org.json", "mine.json"}

	if syncType == "full" {
		repo := repository.NewMockRepository(t)
		repo.On("Config").Return(&provisioning.Repository{})
		changes := make([]ResourceFileChange, len(paths))
		for i, path := range paths {
			changes[i] = ResourceFileChange{Path: path, Action: repository.FileActionCreated}
		}
		compare := NewMockCompareFn(t)
		compare.On("Execute", mock.Anything, repo, repoResources, "new-ref", mock.Anything).
			Return(changes, nil, nil, nil)
		// One worker, so the two files are written in order and the quota assertion is not
		// racing the write it is about.
		return FullSync(t.Context(), repo, compare.Execute, resources.NewMockResourceClients(t),
			"new-ref", repoResources, progress, tracer, 1, metrics, quotaTracker, false, 0)
	}

	changes := make([]repository.VersionedFileChange, len(paths))
	for i, path := range paths {
		changes[i] = repository.VersionedFileChange{Path: path, Action: repository.FileActionCreated, Ref: "new-ref"}
	}
	repo := repository.NewMockVersioned(t)
	repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
	return IncrementalSync(t.Context(), withIncrementalSyncReader(t, repo, repoResources),
		"old-ref", "new-ref", repoResources, progress, tracer, metrics, quotaTracker, false)
}

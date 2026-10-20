package sync

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func testManagerKindConflictQuota(t *testing.T, syncType string) {
	t.Helper()
	conflict := utils.NewForbiddenManagerKindChangeError(
		utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "terraform-provider", AllowsEdits: true},
		utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "test-repo"},
	)
	for _, tt := range []struct {
		name         string
		action       repository.FileAction
		usage        int64
		writeErr     error
		allowsCreate bool
	}{
		{
			name: "rejected create releases quota", action: repository.FileActionCreated, usage: 9,
			writeErr: fmt.Errorf("updating dashboard: %w", conflict), allowsCreate: true,
		},
		{
			name: "legacy rejection releases quota", action: repository.FileActionCreated, usage: 9,
			writeErr: &apierrors.StatusError{ErrStatus: metav1.Status{
				Code: 403, Reason: metav1.StatusReasonForbidden,
				Message: "Cannot change resource manager kind; remove the existing manager first, then add the new one",
			}},
			allowsCreate: true,
		},
		{
			name: "rejected update does not release quota", action: repository.FileActionUpdated, usage: 10,
			writeErr: conflict,
		},
		{
			name: "server failure does not release quota", action: repository.FileActionCreated, usage: 9,
			writeErr: apierrors.NewInternalError(fmt.Errorf("server failure")),
		},
		{
			name: "successful create consumes quota", action: repository.FileActionCreated, usage: 9,
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			quotaTracker := quotas.NewInMemoryQuotaTracker(tt.usage, 10)
			repoResources := resources.NewMockRepositoryResources(t)
			progress := jobs.NewMockJobProgressRecorder(t)
			progress.On("TooManyErrors").Return(nil)
			var resultsMu sync.Mutex
			results := make(map[string]jobs.JobResourceResult)
			progress.On("Record", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
				resultsMu.Lock()
				defer resultsMu.Unlock()
				result := args.Get(1).(jobs.JobResourceResult)
				if _, exists := results[result.Path()]; exists {
					t.Errorf("duplicate result for %s", result.Path())
				}
				results[result.Path()] = result
			}).Return()

			gvk := schema.GroupVersionKind{Group: "dashboard.grafana.app", Kind: "Dashboard"}
			firstWrite := repoResources.On("WriteResourceFromFile", mock.Anything, "first.json", "new-ref").
				Return("first", gvk, 0, tt.writeErr).Once()
			if tt.allowsCreate {
				repoResources.On("WriteResourceFromFile", mock.Anything, "valid.json", "new-ref").
					Return("valid", gvk, 0, nil).Once()
			}
			syncQuota := quotaTracker
			if syncType == "full" {
				firstStarted := make(chan struct{})
				quotaBlocked := make(chan struct{})
				var blockedOnce sync.Once
				observedQuota := quotas.NewMockQuotaTracker(t)
				syncQuota = observedQuota
				observedQuota.On("TryAcquire").Return(func() bool {
					acquired := quotaTracker.TryAcquire()
					if !acquired {
						blockedOnce.Do(func() { close(quotaBlocked) })
					}
					return acquired
				})
				observedQuota.On("Release").Run(func(mock.Arguments) { quotaTracker.Release() }).Maybe()
				// Keep the first write in flight until another worker exhausts quota.
				firstWrite.Run(func(mock.Arguments) {
					close(firstStarted)
					select {
					case <-quotaBlocked:
					case <-ctx.Done():
						t.Error("second worker did not attempt to acquire quota")
					}
				})
				progress.On("HasDirPathFailedCreation", "first.json").Return(false)
				progress.On("HasDirPathFailedCreation", "valid.json").Run(func(mock.Arguments) {
					select {
					case <-firstStarted:
					case <-ctx.Done():
						t.Error("first write did not start")
					}
				}).Return(false)
			} else {
				progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)
			}
			err := runManagerKindSync(t, ctx, syncType, []repository.VersionedFileChange{
				{Path: "first.json", Action: tt.action, Ref: "new-ref"},
				{Path: "valid.json", Action: repository.FileActionCreated, Ref: "new-ref"},
			}, repoResources, progress, syncQuota)
			require.NoError(t, err)
			require.Len(t, results, 2)
			firstResult, validResult := results["first.json"], results["valid.json"]
			require.Equal(t, "first.json", firstResult.Path())
			require.Equal(t, tt.action, firstResult.Action())
			if utils.IsForbiddenManagerKindChangeError(tt.writeErr) {
				require.NoError(t, firstResult.Error())
				require.ErrorIs(t, firstResult.Warning(), tt.writeErr)
				require.Equal(t, provisioning.ReasonResourceInvalid, firstResult.WarningReason())
			} else {
				require.ErrorIs(t, firstResult.Error(), tt.writeErr)
				require.NoError(t, firstResult.Warning())
			}
			require.Equal(t, "valid.json", validResult.Path())
			require.NoError(t, validResult.Error())
			if tt.allowsCreate {
				require.Equal(t, repository.FileActionCreated, validResult.Action())
				require.NoError(t, validResult.Warning())
			} else {
				require.Equal(t, repository.FileActionIgnored, validResult.Action())
				var quotaErr *quotas.QuotaExceededError
				require.ErrorAs(t, validResult.Warning(), &quotaErr)
			}
			require.False(t, quotaTracker.TryAcquire(), "quota must still be enforced after the valid create")
		})
	}
}

func testQuotaBlockedCreateDoesNotAccessResource(t *testing.T, syncType string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	tracker := quotas.NewInMemoryQuotaTracker(9, 10)
	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("TooManyErrors").Return(nil)
	validWritten := make(chan struct{})
	progress.On("HasDirPathFailedCreation", "valid.json").Return(false)
	progress.On("HasDirPathFailedCreation", "second.json").Run(func(mock.Arguments) {
		select {
		case <-validWritten:
		case <-ctx.Done():
			t.Error("valid write did not consume the last quota slot")
		}
	}).Return(false)
	var resultsMu sync.Mutex
	results := make(map[string]jobs.JobResourceResult)
	progress.On("Record", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
		resultsMu.Lock()
		defer resultsMu.Unlock()
		result := args.Get(1).(jobs.JobResourceResult)
		results[result.Path()] = result
	}).Return().Times(2)
	repoResources := resources.NewMockRepositoryResources(t)
	gvk := schema.GroupVersionKind{Group: "dashboard.grafana.app", Kind: "Dashboard"}
	repoResources.On("WriteResourceFromFile", mock.Anything, "valid.json", "new-ref").Run(func(mock.Arguments) {
		close(validWritten)
	}).Return("valid", gvk, 0, nil).Once()
	err := runManagerKindSync(t, ctx, syncType, []repository.VersionedFileChange{
		{Path: "valid.json", Action: repository.FileActionCreated, Ref: "new-ref"},
		{Path: "second.json", Action: repository.FileActionCreated, Ref: "new-ref"},
	}, repoResources, progress, tracker)
	require.NoError(t, err)
	require.Len(t, results, 2)
	require.NoError(t, results["valid.json"].Error())
	require.NoError(t, results["valid.json"].Warning())
	require.Equal(t, repository.FileActionCreated, results["valid.json"].Action())
	result := results["second.json"]
	require.NoError(t, result.Error())
	require.Equal(t, repository.FileActionIgnored, result.Action())
	require.Equal(t, provisioning.ReasonQuotaExceeded, result.WarningReason())
	repoResources.AssertNotCalled(t, "WriteResourceFromFile", mock.Anything, "second.json", mock.Anything)
	require.False(t, tracker.TryAcquire(), "skipping a blocked file must not release another file's reservation")
}

func runManagerKindSync(t *testing.T, ctx context.Context, syncType string, changes []repository.VersionedFileChange, repoResources resources.RepositoryResources, progress *jobs.MockJobProgressRecorder, tracker quotas.QuotaTracker) error {
	t.Helper()
	progress.On("SetTotal", mock.Anything, len(changes)).Return()
	tracer := tracing.NewNoopTracerService()
	metrics := jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry())
	if syncType == "full" {
		repo := repository.NewMockRepository(t)
		repo.On("Config").Return(&provisioning.Repository{})
		fullChanges := make([]ResourceFileChange, len(changes))
		for i, change := range changes {
			fullChanges[i] = ResourceFileChange{Path: change.Path, Action: change.Action}
		}
		compare := NewMockCompareFn(t)
		compare.On("Execute", mock.Anything, repo, repoResources, "new-ref", false).Return(fullChanges, nil, nil, nil)
		return FullSync(ctx, repo, compare.Execute, resources.NewMockResourceClients(t), "new-ref", repoResources, progress, tracer, 10, metrics, tracker, false, 0)
	}
	repo := repository.NewMockVersioned(t)
	repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return(changes, nil)
	progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
	progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
	return IncrementalSync(ctx, repo, "old-ref", "new-ref", repoResources, progress, tracer, metrics, tracker, false)
}

package sync

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
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

func TestSync_ManagerKindConflictQuota(t *testing.T) {
	conflict := utils.NewResourceManagerKindConflictError(
		utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "terraform-provider", AllowsEdits: true},
		utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "test-repo"},
	)
	for _, syncType := range []string{"full", "incremental"} {
		t.Run(syncType, func(t *testing.T) {
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
					progress.On("SetTotal", mock.Anything, 2).Return()
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
					tracer := tracing.NewNoopTracerService()
					metrics := jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry())
					var err error
					if syncType == "full" {
						firstStarted := make(chan struct{})
						quotaBlocked := make(chan struct{})
						var blockedOnce sync.Once
						observedQuota := quotas.NewMockQuotaTracker(t)
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
						repo := repository.NewMockRepository(t)
						repo.On("Config").Return(&provisioning.Repository{})
						compare := NewMockCompareFn(t)
						compare.On("Execute", mock.Anything, repo, repoResources, "new-ref", false).
							Return([]ResourceFileChange{
								{Path: "first.json", Action: tt.action},
								{Path: "valid.json", Action: repository.FileActionCreated},
							}, nil, nil, nil)
						err = FullSync(ctx, repo, compare.Execute, resources.NewMockResourceClients(t), "new-ref", repoResources, progress, tracer, 10, metrics, observedQuota, false, 0)
					} else {
						progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)
						repo := repository.NewMockVersioned(t)
						repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return([]repository.VersionedFileChange{
							{Path: "first.json", Action: tt.action, Ref: "new-ref"},
							{Path: "valid.json", Action: repository.FileActionCreated, Ref: "new-ref"},
						}, nil)
						progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
						progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
						err = IncrementalSync(ctx, repo, "old-ref", "new-ref", repoResources, progress, tracer, metrics, quotaTracker, false)
					}
					require.NoError(t, err)
					require.Len(t, results, 2)
					firstResult, validResult := results["first.json"], results["valid.json"]
					require.Equal(t, "first.json", firstResult.Path())
					require.Equal(t, tt.action, firstResult.Action())
					if utils.IsResourceManagerKindConflictError(tt.writeErr) {
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
		})
	}
}

func TestFullSync_DeferredCreates(t *testing.T) {
	conflict := utils.NewResourceManagerKindConflictError(
		utils.ManagerProperties{Kind: utils.ManagerKindTerraform},
		utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "test-repo"},
	)
	for _, tt := range []struct {
		name    string
		stopErr error
	}{
		{name: "deferred conflict frees quota for the next create"},
		{name: "cancellation stops deferred creates", stopErr: context.Canceled},
		{name: "too many errors stops deferred creates", stopErr: fmt.Errorf("too many resource errors")},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			firstStarted := make(chan struct{})
			allBlocked := make(chan struct{})
			var blockedCount atomic.Int32
			var stopped atomic.Bool
			tracker := quotas.NewInMemoryQuotaTracker(9, 10)
			observedQuota := quotas.NewMockQuotaTracker(t)
			observedQuota.On("TryAcquire").Return(func() bool {
				acquired := tracker.TryAcquire()
				if !acquired && blockedCount.Add(1) == 2 {
					close(allBlocked)
				}
				return acquired
			})
			observedQuota.On("Release").Run(func(mock.Arguments) { tracker.Release() })
			progress := jobs.NewMockJobProgressRecorder(t)
			progress.On("TooManyErrors").Return(func() error {
				if stopped.Load() {
					return tt.stopErr
				}
				return nil
			})
			progress.On("HasDirPathFailedCreation", "first.json").Return(false)
			for _, path := range []string{"second.json", "valid.json"} {
				progress.On("HasDirPathFailedCreation", path).Run(func(mock.Arguments) {
					select {
					case <-firstStarted:
					case <-ctx.Done():
						t.Error("first write did not start")
					}
				}).Return(false)
			}
			var resultsMu sync.Mutex
			var results []jobs.JobResourceResult
			progress.On("Record", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
				resultsMu.Lock()
				defer resultsMu.Unlock()
				results = append(results, args.Get(1).(jobs.JobResourceResult))
			}).Return()
			repoResources := resources.NewMockRepositoryResources(t)
			gvk := schema.GroupVersionKind{Group: "dashboard.grafana.app", Kind: "Dashboard"}
			repoResources.On("WriteResourceFromFile", mock.Anything, "first.json", "ref").Run(func(mock.Arguments) {
				close(firstStarted)
				select {
				case <-allBlocked:
				case <-ctx.Done():
					t.Error("concurrent creates did not exhaust quota")
				}
				if errors.Is(tt.stopErr, context.Canceled) {
					cancel()
				} else if tt.stopErr != nil {
					stopped.Store(true)
				}
			}).Return("first", gvk, 0, conflict).Once()
			if tt.stopErr == nil {
				repoResources.On("WriteResourceFromFile", mock.Anything, "second.json", "ref").Return("second", gvk, 0, conflict).Once()
				repoResources.On("WriteResourceFromFile", mock.Anything, "valid.json", "ref").Return("valid", gvk, 0, nil).Once()
			}
			err := applyResourcesInParallel(ctx, []ResourceFileChange{
				{Path: "first.json", Action: repository.FileActionCreated},
				{Path: "second.json", Action: repository.FileActionCreated},
				{Path: "valid.json", Action: repository.FileActionCreated},
			}, resources.NewMockResourceClients(t), "ref", repoResources, progress, tracing.NewNoopTracerService(), 10, observedQuota, false, 0)
			require.ErrorIs(t, err, tt.stopErr)
			if tt.stopErr != nil {
				require.Len(t, results, 1)
				require.True(t, tracker.TryAcquire(), "stopped creates must not reserve quota")
				return
			}
			require.Len(t, results, 3)
			for i, path := range []string{"first.json", "second.json", "valid.json"} {
				require.Equal(t, path, results[i].Path())
				require.NoError(t, results[i].Error())
				if path == "valid.json" {
					require.NoError(t, results[i].Warning())
				} else {
					require.ErrorIs(t, results[i].Warning(), conflict)
				}
			}
			require.False(t, tracker.TryAcquire())
		})
	}
}

package sync

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestFullSync_QuotaChecksUseWorkerLimit(t *testing.T) {
	const files, limit, workers = 128, 8, 4
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	repo := repository.NewMockRepository(t)
	repo.On("Config").Return(&provisioning.Repository{})
	changes := make([]ResourceFileChange, files)
	for i := range changes {
		changes[i] = ResourceFileChange{Path: fmt.Sprintf("dashboard-%d.json", i), Action: repository.FileActionCreated}
	}
	repoResources := resources.NewMockRepositoryResources(t)
	compare := NewMockCompareFn(t)
	compare.On("Execute", mock.Anything, repo, repoResources, "ref", false).Return(changes, nil, nil, nil)
	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetTotal", mock.Anything, files).Return()
	progress.On("TooManyErrors").Return(nil)
	progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)
	gvk := schema.GroupVersionKind{Group: "dashboard.grafana.app", Kind: "Dashboard"}
	repoResources.On("WriteResourceFromFile", mock.Anything, mock.Anything, "ref").Return("dashboard", gvk, 0, nil).Times(limit)
	started := make(chan struct{}, files-limit)
	release := make(chan struct{})
	var mu sync.Mutex
	active, peak := 0, 0
	results := make(map[string]jobs.JobResourceResult)
	progress.On("Record", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
		mu.Lock()
		defer mu.Unlock()
		result := args.Get(1).(jobs.JobResourceResult)
		results[result.Path()] = result
	}).Return().Times(files)
	repoResources.On("CheckResourceManagerKind", mock.Anything, mock.Anything, "ref").
		Return(func(checkCtx context.Context, path, ref string) (string, schema.GroupVersionKind, int, error) {
			mu.Lock()
			active++
			peak = max(peak, active)
			mu.Unlock()
			defer func() {
				mu.Lock()
				active--
				mu.Unlock()
			}()
			started <- struct{}{}
			select {
			case <-release:
				return path, gvk, 0, nil
			case <-checkCtx.Done():
				return path, gvk, 0, checkCtx.Err()
			}
		}).Times(files - limit)
	tracker := quotas.NewInMemoryQuotaTracker(0, limit)
	metrics := jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry())
	clients := resources.NewMockResourceClients(t)
	done := make(chan struct{})
	var syncErr error
	go func() {
		defer close(done)
		syncErr = FullSync(ctx, repo, compare.Execute, clients, "ref", repoResources, progress, tracing.NewNoopTracerService(), workers, metrics, tracker, false, time.Second)
	}()
	defer func() {
		cancel()
		<-done
	}()
	// Hold the first checks so the test observes the pool at full capacity.
	for range workers {
		select {
		case <-started:
		case <-ctx.Done():
			t.Fatal("manager checks did not run concurrently")
		}
	}
	close(release)
	<-done
	require.NoError(t, syncErr)
	require.Equal(t, workers, peak, "manager checks must use, and never exceed, the worker limit")
	require.Zero(t, active)
	require.Len(t, results, files)
	created, skipped := 0, 0
	for _, result := range results {
		require.NoError(t, result.Error())
		if result.Action() == repository.FileActionCreated {
			created++
			require.NoError(t, result.Warning())
		} else {
			skipped++
			require.Equal(t, repository.FileActionIgnored, result.Action())
			require.Equal(t, provisioning.ReasonQuotaExceeded, result.WarningReason())
		}
	}
	require.Equal(t, limit, created)
	require.Equal(t, files-limit, skipped)
	require.False(t, tracker.TryAcquire())
}

func TestFullSync_QuotaChecksStop(t *testing.T) {
	const workers = 2
	for _, tt := range []struct {
		name    string
		cancel  bool
		timeout bool
	}{
		{name: "job cancellation", cancel: true},
		{name: "error limit"},
		{name: "resource timeout", timeout: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			repoResources := resources.NewMockRepositoryResources(t)
			progress := jobs.NewMockJobProgressRecorder(t)
			progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)
			tooManyErrors := fmt.Errorf("too many resource errors")
			lookupErr := apierrors.NewInternalError(fmt.Errorf("lookup failed"))
			var stopped atomic.Bool
			progress.On("TooManyErrors").Return(func() error {
				if stopped.Load() {
					return tooManyErrors
				}
				return nil
			})
			var mu sync.Mutex
			var results []jobs.JobResourceResult
			progress.On("Record", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
				mu.Lock()
				defer mu.Unlock()
				results = append(results, args.Get(1).(jobs.JobResourceResult))
				if !tt.cancel {
					stopped.Store(true)
				}
			}).Return().Times(workers)
			started := make(chan struct{}, workers)
			release := make(chan struct{})
			repoResources.On("CheckResourceManagerKind", mock.Anything, mock.Anything, "ref").
				Return(func(checkCtx context.Context, path, ref string) (string, schema.GroupVersionKind, int, error) {
					started <- struct{}{}
					select {
					case <-release:
						return path, schema.GroupVersionKind{}, 0, lookupErr
					case <-checkCtx.Done():
						return path, schema.GroupVersionKind{}, 0, checkCtx.Err()
					}
				}).Times(workers)
			changes := make([]ResourceFileChange, workers+3)
			for i := range changes {
				changes[i] = ResourceFileChange{Path: fmt.Sprintf("dashboard-%d.json", i), Action: repository.FileActionCreated}
			}
			clients := resources.NewMockResourceClients(t)
			done := make(chan struct{})
			var syncErr error
			go func() {
				defer close(done)
				syncErr = applyResourcesInParallel(ctx, changes, clients, "ref", repoResources, progress, tracing.NewNoopTracerService(), workers, quotas.NewInMemoryQuotaTracker(1, 1), false, time.Second)
			}()
			defer func() {
				cancel()
				<-done
			}()
			for range workers {
				select {
				case <-started:
				case <-ctx.Done():
					t.Fatal("manager checks did not fill the worker pool")
				}
			}
			switch {
			case tt.cancel:
				cancel()
			case !tt.timeout:
				close(release)
			}
			<-done
			if tt.cancel {
				require.ErrorIs(t, syncErr, context.Canceled)
			} else {
				require.ErrorIs(t, syncErr, tooManyErrors)
				require.NoError(t, ctx.Err(), "resource checks must stop before the job deadline")
			}
			require.Len(t, results, workers)
			for _, result := range results {
				require.NoError(t, result.Warning())
				switch {
				case tt.cancel:
					require.ErrorIs(t, result.Error(), context.Canceled)
				case tt.timeout:
					require.ErrorIs(t, result.Error(), context.DeadlineExceeded)
				default:
					require.ErrorIs(t, result.Error(), lookupErr)
				}
			}
		})
	}
}

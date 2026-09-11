package sync

import (
	"context"
	"fmt"
	"testing"

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
					quotaTracker := quotas.NewInMemoryQuotaTracker(tt.usage, 10)
					repoResources := resources.NewMockRepositoryResources(t)
					progress := jobs.NewMockJobProgressRecorder(t)
					progress.On("SetTotal", mock.Anything, 2).Return()
					progress.On("TooManyErrors").Return(nil)
					progress.On("HasDirPathFailedCreation", mock.Anything).Return(false)
					var results []jobs.JobResourceResult
					progress.On("Record", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
						results = append(results, args.Get(1).(jobs.JobResourceResult))
					}).Return()

					gvk := schema.GroupVersionKind{Group: "dashboard.grafana.app", Kind: "Dashboard"}
					repoResources.On("WriteResourceFromFile", mock.Anything, "first.json", "new-ref").
						Return("first", gvk, 0, tt.writeErr).Once()
					if tt.allowsCreate {
						repoResources.On("WriteResourceFromFile", mock.Anything, "valid.json", "new-ref").
							Return("valid", gvk, 0, nil).Once()
					}
					tracer := tracing.NewNoopTracerService()
					metrics := jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry())
					var err error
					if syncType == "full" {
						repo := repository.NewMockRepository(t)
						repo.On("Config").Return(&provisioning.Repository{})
						compare := NewMockCompareFn(t)
						compare.On("Execute", mock.Anything, repo, repoResources, "new-ref", false).
							Return([]ResourceFileChange{
								{Path: "first.json", Action: tt.action},
								{Path: "valid.json", Action: repository.FileActionCreated},
							}, nil, nil, nil)
						// One worker ensures the second create runs after the API rejection.
						err = FullSync(context.Background(), repo, compare.Execute, resources.NewMockResourceClients(t), "new-ref", repoResources, progress, tracer, 1, metrics, quotaTracker, false, 0)
					} else {
						repo := repository.NewMockVersioned(t)
						repo.On("CompareFiles", mock.Anything, "old-ref", "new-ref").Return([]repository.VersionedFileChange{
							{Path: "first.json", Action: tt.action, Ref: "new-ref"},
							{Path: "valid.json", Action: repository.FileActionCreated, Ref: "new-ref"},
						}, nil)
						progress.On("SetMessage", mock.Anything, "replicating versioned changes").Return()
						progress.On("SetMessage", mock.Anything, "versioned changes replicated").Return()
						err = IncrementalSync(context.Background(), repo, "old-ref", "new-ref", repoResources, progress, tracer, metrics, quotaTracker, false)
					}
					require.NoError(t, err)
					require.Len(t, results, 2)
					require.Equal(t, "first.json", results[0].Path())
					require.Equal(t, tt.action, results[0].Action())
					if utils.IsResourceManagerKindConflictError(tt.writeErr) {
						require.NoError(t, results[0].Error())
						require.ErrorIs(t, results[0].Warning(), tt.writeErr)
						require.Equal(t, provisioning.ReasonResourceInvalid, results[0].WarningReason())
					} else {
						require.ErrorIs(t, results[0].Error(), tt.writeErr)
						require.NoError(t, results[0].Warning())
					}
					require.Equal(t, "valid.json", results[1].Path())
					require.NoError(t, results[1].Error())
					if tt.allowsCreate {
						require.Equal(t, repository.FileActionCreated, results[1].Action())
						require.NoError(t, results[1].Warning())
					} else {
						require.Equal(t, repository.FileActionIgnored, results[1].Action())
						var quotaErr *quotas.QuotaExceededError
						require.ErrorAs(t, results[1].Warning(), &quotaErr)
					}
					require.False(t, quotaTracker.TryAcquire(), "quota must still be enforced after the valid create")
				})
			}
		})
	}
}

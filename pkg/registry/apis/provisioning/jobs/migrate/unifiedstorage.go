package migrate

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

//go:generate mockery --name WrapWithCloneFn --structname MockWrapWithCloneFn --inpackage --filename mock_wrap_with_clone_fn.go --with-expecter
type WrapWithCloneFn func(ctx context.Context, repo repository.Repository, cloneOptions repository.CloneOptions, pushOptions repository.PushOptions, fn func(repo repository.Repository, cloned bool) error) error

type UnifiedStorageMigrator struct {
	clients      resources.ClientFactory
	exportWorker jobs.Worker
	syncWorker   jobs.Worker
}

func NewUnifiedStorageMigrator(
	clients resources.ClientFactory,
	exportWorker jobs.Worker,
	syncWorker jobs.Worker,
) *UnifiedStorageMigrator {
	return &UnifiedStorageMigrator{
		clients:      clients,
		exportWorker: exportWorker,
		syncWorker:   syncWorker,
	}
}

func (m *UnifiedStorageMigrator) Migrate(ctx context.Context, repo repository.ReaderWriter, options provisioning.MigrateJobOptions, progress jobs.JobProgressRecorder) error {
	cfg := repo.Config()
	namespace := cfg.GetNamespace()

	progress.SetMessage(ctx, "exporting unified storage resources")
	clients, err := m.clients.Clients(ctx, namespace)
	if err != nil {
		return fmt.Errorf("get unified storage client: %w", err)
	}

	exportJob := provisioning.Job{
		Spec: provisioning.JobSpec{
			Push: &provisioning.ExportJobOptions{},
		},
	}
	if err := m.exportWorker.Process(ctx, repo, exportJob, progress); err != nil {
		return fmt.Errorf("export resources: %w", err)
	}

	// Reset the results after the export as pull will operate on the same resources
	progress.ResetResults()

	progress.SetMessage(ctx, "pulling resources")
	syncJob := provisioning.Job{
		Spec: provisioning.JobSpec{
			Pull: &provisioning.SyncJobOptions{
				Incremental: false,
			},
		},
	}

	if err := m.syncWorker.Process(ctx, repo, syncJob, progress); err != nil {
		return fmt.Errorf("pull resources: %w", err)
	}

	for _, kind := range resources.SupportedProvisioningResources {
		progress.SetMessage(ctx, fmt.Sprintf("removing unprovisioned %s", kind.Resource))
		client, _, err := clients.ForResource(kind)
		if err != nil {
			return err
		}
		if err = resources.ForEach(ctx, client, func(item *unstructured.Unstructured) error {
			result := jobs.JobResourceResult{
				Name:     item.GetName(),
				Resource: item.GetKind(),
				Group:    item.GroupVersionKind().Group,
				Action:   repository.FileActionDeleted,
			}

			if err := client.Delete(ctx, item.GetName(), metav1.DeleteOptions{}); err != nil {
				result.Error = fmt.Errorf("failed to delete folder: %w", err)
				progress.Record(ctx, result)
				return result.Error
			}

			progress.Record(ctx, result)
			return nil
		}); err != nil {
			return err
		}
	}
	return nil
}

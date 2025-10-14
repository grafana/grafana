package sync

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func FullSync(
	ctx context.Context,
	repo repository.Reader,
	compare CompareFn,
	clients resources.ResourceClients,
	currentRef string,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	tracer tracing.Tracer,
) error {
	cfg := repo.Config()

	ctx, span := tracer.Start(ctx, "provisioning.sync.full")
	defer span.End()

	ensureFolderCtx, ensureFolderSpan := tracer.Start(ctx, "provisioning.sync.full.ensure_folder_exists")
	// Ensure the configured folder exists and is managed by the repository
	rootFolder := resources.RootFolder(cfg)
	if rootFolder != "" {
		if err := repositoryResources.EnsureFolderExists(ensureFolderCtx, resources.Folder{
			ID:    rootFolder, // will not change if exists
			Title: cfg.Spec.Title,
			Path:  "", // at the root of the repository
		}, ""); err != nil {
			ensureFolderSpan.End()
			return tracing.Error(span, fmt.Errorf("create root folder: %w", err))
		}
	}
	ensureFolderSpan.End()

	compareCtx, compareSpan := tracer.Start(ctx, "provisioning.sync.full.compare")
	changes, err := compare(compareCtx, repo, repositoryResources, currentRef)
	if err != nil {
		compareSpan.End()
		return tracing.Error(span, fmt.Errorf("compare changes: %w", err))
	}
	compareSpan.End()

	if len(changes) == 0 {
		progress.SetFinalMessage(ctx, "no changes to sync")
		return nil
	}

	return applyChanges(ctx, changes, clients, repositoryResources, progress, tracer)
}

func applyChanges(ctx context.Context, changes []ResourceFileChange, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, tracer tracing.Tracer) error {
	progress.SetTotal(ctx, len(changes))

	_, applyChangesSpan := tracer.Start(ctx, "provisioning.sync.full.apply_changes",
		trace.WithAttributes(attribute.Int("changes_count", len(changes))),
	)
	defer applyChangesSpan.End()

	for _, change := range changes {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		if err := progress.TooManyErrors(); err != nil {
			return tracing.Error(applyChangesSpan, err)
		}

		if change.Action == repository.FileActionDeleted {
			deleteCtx, deleteSpan := tracer.Start(ctx, "provisioning.sync.full.apply_changes.delete")
			result := jobs.JobResourceResult{
				Path:   change.Path,
				Action: change.Action,
			}

			if change.Existing == nil || change.Existing.Name == "" {
				result.Error = fmt.Errorf("processing deletion for file %s: missing existing reference", change.Path)
				progress.Record(deleteCtx, result)
				deleteSpan.RecordError(result.Error)
				deleteSpan.End()
				continue
			}
			result.Name = change.Existing.Name
			result.Group = change.Existing.Group

			versionlessGVR := schema.GroupVersionResource{
				Group:    change.Existing.Group,
				Resource: change.Existing.Resource,
			}

			// TODO: should we use the clients or the resource manager instead?
			client, gvk, err := clients.ForResource(deleteCtx, versionlessGVR)
			if err != nil {
				result.Kind = versionlessGVR.Resource // could not find a kind
				result.Error = fmt.Errorf("get client for deleted object: %w", err)
				progress.Record(deleteCtx, result)
				continue
			}
			result.Kind = gvk.Kind

			if err := client.Delete(deleteCtx, change.Existing.Name, metav1.DeleteOptions{}); err != nil {
				result.Error = fmt.Errorf("deleting resource %s/%s %s: %w", change.Existing.Group, gvk.Kind, change.Existing.Name, err)
			}
			progress.Record(deleteCtx, result)
			deleteSpan.End()
			continue
		}

		// If folder ensure it exists
		if safepath.IsDir(change.Path) {
			ensureFolderCtx, ensureFolderSpan := tracer.Start(ctx, "provisioning.sync.full.apply_changes.ensure_folder_exists")
			result := jobs.JobResourceResult{
				Path:   change.Path,
				Action: change.Action,
				Group:  resources.FolderKind.Group,
				Kind:   resources.FolderKind.Kind,
			}

			folder, err := repositoryResources.EnsureFolderPathExist(ensureFolderCtx, change.Path)
			if err != nil {
				result.Error = fmt.Errorf("ensuring folder exists at path %s: %w", change.Path, err)
				ensureFolderSpan.RecordError(err)
				ensureFolderSpan.End()
				progress.Record(ctx, result)
				continue
			}

			result.Name = folder
			progress.Record(ensureFolderCtx, result)
			ensureFolderSpan.End()

			continue
		}

		writeCtx, writeSpan := tracer.Start(ctx, "provisioning.sync.full.apply_changes.write_resource_from_file")
		name, gvk, err := repositoryResources.WriteResourceFromFile(writeCtx, change.Path, "")
		result := jobs.JobResourceResult{
			Path:   change.Path,
			Action: change.Action,
			Name:   name,
			Group:  gvk.Group,
			Kind:   gvk.Kind,
		}

		if err != nil {
			writeSpan.RecordError(err)
			result.Error = fmt.Errorf("writing resource from file %s: %w", change.Path, err)
		}
		progress.Record(writeCtx, result)
		writeSpan.End()
	}

	return nil
}

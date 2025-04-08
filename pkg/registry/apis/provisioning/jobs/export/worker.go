package export

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type ExportWorker struct {
	clientFactory       resources.ClientFactory
	repositoryResources resources.RepositoryResourcesFactory
}

func NewExportWorker(
	clientFactory resources.ClientFactory,
	repositoryResources resources.RepositoryResourcesFactory,
) *ExportWorker {
	return &ExportWorker{
		clientFactory:       clientFactory,
		repositoryResources: repositoryResources,
	}
}

func (r *ExportWorker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionPush
}

// Process will start a job
func (r *ExportWorker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	options := job.Spec.Push
	if options == nil {
		return errors.New("missing export settings")
	}

	cfg := repo.Config()
	// Can write to external branch
	if err := repository.IsWriteAllowed(cfg, options.Branch); err != nil {
		return err
	}

	cloneOptions := repository.CloneOptions{
		Timeout:      10 * time.Minute,
		PushOnWrites: false,
		BeforeFn: func() error {
			progress.SetMessage(ctx, "clone target")
			return nil
		},
	}

	pushOptions := repository.PushOptions{
		Timeout:  10 * time.Minute,
		Progress: os.Stdout,
		BeforeFn: func() error {
			progress.SetMessage(ctx, "push changes")
			return nil
		},
	}

	fn := func(repo repository.Repository, cloned bool) error {
		if cloned {
			options.Branch = "" // :( the branch is now baked into the repo
		}

		// Load and write all folders
		// FIXME: we load the entire tree in memory
		progress.SetMessage(ctx, "read folder tree from API server")
		clients, err := r.clientFactory.Clients(ctx, cfg.Namespace)
		if err != nil {
			return fmt.Errorf("create clients: %w", err)
		}

		folderClient, err := clients.Folder()
		if err != nil {
			return fmt.Errorf("create folder client: %w", err)
		}

		rw, ok := repo.(repository.ReaderWriter)
		if !ok {
			return errors.New("export job submitted targeting repository that is not a ReaderWriter")
		}

		repositoryResources, err := r.repositoryResources.Client(ctx, rw)
		if err != nil {
			return fmt.Errorf("create repository resource client: %w", err)
		}

		if err := r.exportFolders(ctx, cfg.Name, folderClient, *options, repositoryResources, progress); err != nil {
			return err
		}

		if err := r.exportResources(ctx, clients, *options, repositoryResources, progress); err != nil {
			return err
		}

		return nil
	}

	return repository.WrapWithCloneAndPushIfPossible(ctx, repo, cloneOptions, pushOptions, fn)
}

func (r *ExportWorker) exportFolders(ctx context.Context, repoName string, folderClient dynamic.ResourceInterface, options provisioning.ExportJobOptions, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	// Load and write all folders
	// FIXME: we load the entire tree in memory
	progress.SetMessage(ctx, "read folder tree from API server")

	tree := resources.NewEmptyFolderTree()
	if err := resources.ForEach(ctx, folderClient, func(item *unstructured.Unstructured) error {
		if tree.Count() >= resources.MaxNumberOfFolders {
			return errors.New("too many folders")
		}

		return tree.AddUnstructured(item, repoName)
	}); err != nil {
		return fmt.Errorf("load folder tree: %w", err)
	}

	progress.SetMessage(ctx, "write folders to repository")
	err := repositoryResources.EnsureFolderTreeExists(ctx, options.Branch, options.Path, tree, func(folder resources.Folder, created bool, err error) error {
		result := jobs.JobResourceResult{
			Action:   repository.FileActionCreated,
			Name:     folder.ID,
			Resource: resources.FolderResource.Resource,
			Group:    resources.FolderResource.Group,
			Path:     folder.Path,
			Error:    err,
		}

		if !created {
			result.Action = repository.FileActionIgnored
		}

		progress.Record(ctx, result)
		if err := progress.TooManyErrors(); err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return fmt.Errorf("write folders to repository: %w", err)
	}

	return nil
}

func (r *ExportWorker) exportResources(ctx context.Context, clients resources.ResourceClients, options provisioning.ExportJobOptions, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	progress.SetMessage(ctx, "start resource export")
	for _, kind := range resources.SupportedProvisioningResources {
		// skip from folders as we do them first... so only dashboards
		if kind == resources.FolderResource {
			continue
		}

		progress.SetMessage(ctx, fmt.Sprintf("export %s", kind.Resource))
		client, _, err := clients.ForResource(kind)
		if err != nil {
			return err
		}

		if err := r.exportResource(ctx, client, options, repositoryResources, progress); err != nil {
			return fmt.Errorf("export %s: %w", kind.Resource, err)
		}
	}

	return nil
}

func (r *ExportWorker) exportResource(ctx context.Context, client dynamic.ResourceInterface, options provisioning.ExportJobOptions, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	return resources.ForEach(ctx, client, func(item *unstructured.Unstructured) error {
		gvk := item.GroupVersionKind()
		result := jobs.JobResourceResult{
			Name:     item.GetName(),
			Resource: gvk.Kind,
			Group:    gvk.Group,
			Action:   repository.FileActionCreated,
		}

		fileName, err := repositoryResources.CreateResourceFileFromObject(ctx, item, resources.WriteOptions{
			Path: options.Path,
			Ref:  options.Branch,
		})

		if errors.Is(err, resources.ErrAlreadyInRepository) {
			result.Action = repository.FileActionIgnored
		} else if err != nil {
			result.Action = repository.FileActionIgnored
			result.Error = err
		}
		result.Path = fileName
		progress.Record(ctx, result)

		if err := progress.TooManyErrors(); err != nil {
			return err
		}

		return nil
	})
}

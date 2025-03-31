package export

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	gogit "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/go-git"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"
)

type ExportWorker struct {
	// Tempdir for repo clones
	clonedir string

	// required to create clients
	clientFactory *resources.ClientFactory

	// Check where values are currently saved
	storageStatus dualwrite.Service

	// Decrypt secrets in config
	secrets secrets.Service

	parsers *resources.ParserFactory
}

func NewExportWorker(clientFactory *resources.ClientFactory,
	storageStatus dualwrite.Service,
	secrets secrets.Service,
	clonedir string,
	parsers *resources.ParserFactory,
) *ExportWorker {
	return &ExportWorker{
		clonedir,
		clientFactory,
		storageStatus,
		secrets,
		parsers,
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

	// Can write to external branch
	err := repository.IsWriteAllowed(repo.Config(), options.Branch)
	if err != nil {
		return err
	}

	// Use the existing clone if already checked out
	buffered, ok := repo.(*gogit.GoGitRepo)
	if !ok && repo.Config().Spec.GitHub != nil {
		progress.SetMessage(ctx, "clone target")
		buffered, err = gogit.Clone(ctx, repo.Config(), gogit.GoGitCloneOptions{
			Root:                   r.clonedir,
			SingleCommitBeforePush: true,
			// TODO: make this configurable
			Timeout: 10 * time.Minute,
		}, r.secrets, os.Stdout)
		if err != nil {
			return fmt.Errorf("unable to clone target: %w", err)
		}

		repo = buffered // send all writes to the buffered repo
		defer func() {
			if err := buffered.Remove(ctx); err != nil {
				logging.FromContext(ctx).Error("failed to remove cloned repository after export", "err", err)
			}
		}()

		options.Branch = "" // :( the branch is now baked into the repo
	}

	rw, ok := repo.(repository.ReaderWriter)
	if !ok {
		return errors.New("export job submitted targeting repository that is not a ReaderWriter")
	}

	clients, err := r.clientFactory.Clients(ctx, repo.Config().Namespace)
	if err != nil {
		return err
	}

	// Load and write all folders
	// FIXME: we load the entire tree in memory
	progress.SetMessage(ctx, "read folder tree from API server")
	client, err := clients.Folder()
	if err != nil {
		return fmt.Errorf("failed to get folder client: %w", err)
	}

	folders := resources.NewFolderManager(rw, client, resources.NewEmptyFolderTree())
	if err := folders.LoadFromServer(ctx); err != nil {
		return fmt.Errorf("failed to load folders from API server: %w", err)
	}

	progress.SetMessage(ctx, "write folders to repository")
	err = folders.EnsureTreeExists(ctx, options.Branch, options.Path, func(folder resources.Folder, created bool, err error) error {
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
		return nil
	})
	if err != nil {
		return fmt.Errorf("write folders to repository: %w", err)
	}

	progress.SetMessage(ctx, "start resource export")
	parser, err := r.parsers.GetParser(ctx, rw)
	if err != nil {
		return fmt.Errorf("failed to get parser: %w", err)
	}

	resourceManager := resources.NewResourcesManager(rw, folders, parser, clients, nil)
	for _, kind := range resources.SupportedResources {
		// skip from folders as we do them first
		if kind == resources.FolderResource {
			continue
		}

		progress.SetMessage(ctx, fmt.Sprintf("reading %s resource", kind.Resource))
		if err := clients.ForEachResource(ctx, kind, func(_ dynamic.ResourceInterface, item *unstructured.Unstructured) error {
			result := jobs.JobResourceResult{
				Name:     item.GetName(),
				Resource: kind.Resource,
				Group:    kind.Group,
				Action:   repository.FileActionCreated,
			}

			fileName, err := resourceManager.CreateResourceFileFromObject(ctx, item, resources.WriteOptions{
				Path:       options.Path,
				Ref:        options.Branch,
				Identifier: options.Identifier,
			})
			if errors.Is(err, resources.ErrAlreadyInRepository) {
				result.Action = repository.FileActionIgnored
			} else if err != nil {
				result.Error = fmt.Errorf("export resource: %w", err)
			}
			result.Path = fileName
			progress.Record(ctx, result)

			if err := progress.TooManyErrors(); err != nil {
				return err
			}
			return nil
		}); err != nil {
			return fmt.Errorf("error exporting %s %w", kind.Resource, err)
		}
	}

	if buffered != nil {
		progress.SetMessage(ctx, "push changes")
		if err := buffered.Push(ctx, gogit.GoGitPushOptions{
			// TODO: make this configurable
			Timeout: 10 * time.Minute,
		}, os.Stdout); err != nil {
			return fmt.Errorf("error pushing changes: %w", err)
		}
	}

	return nil
}

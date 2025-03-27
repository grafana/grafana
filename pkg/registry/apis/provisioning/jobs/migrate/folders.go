package migrate

import (
	"context"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/unified/parquet"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var _ resource.BulkResourceWriter = (*folderReader)(nil)

type folderReader struct {
	tree           *resources.FolderTree
	targetRepoName string
}

// Close implements resource.BulkResourceWrite.
func (f *folderReader) Close() error {
	return nil
}

// CloseWithResults implements resource.BulkResourceWrite.
func (f *folderReader) CloseWithResults() (*resource.BulkResponse, error) {
	return &resource.BulkResponse{}, nil
}

// Write implements resource.BulkResourceWrite.
func (f *folderReader) Write(ctx context.Context, key *resource.ResourceKey, value []byte) error {
	item := &unstructured.Unstructured{}
	err := item.UnmarshalJSON(value)
	if err != nil {
		return fmt.Errorf("unmarshal unstructured to JSON: %w", err)
	}

	return f.tree.AddUnstructured(item, f.targetRepoName)
}

func (j *migrationJob) migrateLegacyFolders(ctx context.Context) error {
	logger := j.logger
	j.progress.SetMessage(ctx, "reading folder tree")

	repoName := j.target.Config().Name

	j.progress.SetMessage(ctx, "migrate folder tree from legacy")
	reader := &folderReader{
		tree:           j.folderTree,
		targetRepoName: repoName,
	}
	_, err := j.legacy.Migrate(ctx, legacy.MigrateOptions{
		Namespace: j.namespace,
		Resources: []schema.GroupResource{{
			Group:    folders.GROUP,
			Resource: folders.RESOURCE,
		}},
		Store: parquet.NewBulkResourceWriterClient(reader),
	})
	if err != nil {
		return fmt.Errorf("unable to read folders from legacy storage %w", err)
	}

	// create folders first is required so that empty folders exist when finished
	j.progress.SetMessage(ctx, "write folders")

	err = j.folderTree.Walk(ctx, func(ctx context.Context, folder resources.Folder) error {
		p := folder.Path
		logger = logger.With("path", p)

		result := jobs.JobResourceResult{
			Name:     folder.ID,
			Resource: folders.RESOURCE,
			Group:    folders.GROUP,
			Path:     p,
		}

		_, err := j.target.Read(ctx, p, "")
		if err != nil && !(errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err)) {
			result.Error = fmt.Errorf("failed to check if folder exists before writing: %w", err)
			return result.Error
		} else if err == nil {
			logger.Info("folder already exists")
			result.Action = repository.FileActionIgnored
			j.progress.Record(ctx, result)
			return nil
		}

		result.Action = repository.FileActionCreated
		msg := fmt.Sprintf("export folder %s", p)
		// Create with an empty body will make a folder (or .keep file if unsupported)
		if err := j.target.Create(ctx, p, "", nil, msg); err != nil {
			result.Error = fmt.Errorf("failed to write folder in repo: %w", err)
			j.progress.Record(ctx, result)
			return result.Error
		}

		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to write folders: %w", err)
	}

	return nil
}

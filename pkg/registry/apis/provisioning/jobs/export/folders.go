package export

import (
	"context"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

var _ resource.BatchResourceWriter = (*folderReader)(nil)

type folderReader struct {
	tree           *resources.FolderTree
	targetRepoName string
}

// Close implements resource.BatchResourceWriter.
func (f *folderReader) Close() error {
	return nil
}

// CloseWithResults implements resource.BatchResourceWriter.
func (f *folderReader) CloseWithResults() (*resource.BatchResponse, error) {
	return &resource.BatchResponse{}, nil
}

// Write implements resource.BatchResourceWriter.
func (f *folderReader) Write(ctx context.Context, key *resource.ResourceKey, value []byte) error {
	item := &unstructured.Unstructured{}
	err := item.UnmarshalJSON(value)
	if err != nil {
		return fmt.Errorf("unmarshal unstructured to JSON: %w", err)
	}

	return f.tree.AddUnstructured(item, f.targetRepoName)
}

// FIXME: revise logging in this method
func (r *exportJob) loadFolders(ctx context.Context) error {
	logger := r.logger
	r.progress.SetMessage("reading folder tree")

	repoName := r.target.Config().Name

	if r.legacy != nil {
		r.progress.SetMessage("migrate folder tree from legacy")
		reader := &folderReader{
			tree:           r.folderTree,
			targetRepoName: repoName,
		}
		_, err := r.legacy.Migrate(ctx, legacy.MigrateOptions{
			Namespace: r.namespace,
			Resources: []schema.GroupResource{{
				Group:    folders.GROUP,
				Resource: folders.RESOURCE,
			}},
			Store: parquet.NewBatchResourceWriterClient(reader),
		})
		if err != nil {
			return fmt.Errorf("unable to read folders from legacy storage %w", err)
		}
	} else {
		// TODO: should this be logging or message or both?
		r.progress.SetMessage("read folder tree from unified storage")
		client := r.client.Resource(schema.GroupVersionResource{
			Group:    folders.GROUP,
			Version:  folders.VERSION,
			Resource: folders.RESOURCE,
		})

		rawList, err := client.List(ctx, metav1.ListOptions{Limit: 10000})
		if err != nil {
			return fmt.Errorf("failed to list folders: %w", err)
		}
		if rawList.GetContinue() != "" {
			return fmt.Errorf("unable to list all folders in one request: %s", rawList.GetContinue())
		}

		for _, item := range rawList.Items {
			err = r.folderTree.AddUnstructured(&item, repoName)
			if err != nil {
				r.progress.Record(ctx, jobs.JobResourceResult{
					Name:     item.GetName(),
					Resource: folders.RESOURCE,
					Group:    folders.GROUP,
					Error:    err,
				})
			}
		}
	}

	// create folders first is required so that empty folders exist when finished
	r.progress.SetMessage("write folders")

	err := r.folderTree.Walk(ctx, func(ctx context.Context, folder resources.Folder) error {
		p := folder.Path + "/"
		if r.prefix != "" {
			p = r.prefix + "/" + p
		}
		logger := logger.With("path", p)

		result := jobs.JobResourceResult{
			Name:     folder.ID,
			Resource: folders.RESOURCE,
			Group:    folders.GROUP,
			Path:     p,
		}

		_, err := r.target.Read(ctx, p, r.ref)
		if err != nil && !(errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err)) {
			result.Error = fmt.Errorf("failed to check if folder exists before writing: %w", err)
			return result.Error
		} else if err == nil {
			logger.Info("folder already exists")
			result.Action = repository.FileActionIgnored
			r.progress.Record(ctx, result)
			return nil
		}

		result.Action = repository.FileActionCreated
		msg := fmt.Sprintf("export folder %s", p)
		// Create with an empty body will make a folder (or .keep file if unsupported)
		if err := r.target.Create(ctx, p, r.ref, nil, msg); err != nil {
			result.Error = fmt.Errorf("failed to write folder in repo: %w", err)
			r.progress.Record(ctx, result)
			return result.Error
		}

		r.progress.Record(ctx, result)
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to write folders: %w", err)
	}

	return nil
}

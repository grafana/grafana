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
	progress       *jobs.JobProgressRecorder
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

func (r *exportJob) loadFolders(ctx context.Context) error {
	logger := r.logger
	r.progress.SetMessage("reading folder tree")

	repoName := r.target.Config().Name

	if r.legacy != nil {
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
				// summary.Errors = append(summary.Errors, err.Error())
			}
		}
	}

	// first create folders
	// NOTE: this is required so that empty folders exist when finished
	r.progress.SetMessage("writing folders")

	err := tree.Walk(ctx, func(ctx context.Context, folder resources.Folder) error {
		p := folder.Path + "/"
		if r.prefix != "" {
			p = r.prefix + "/" + p
		}
		logger := logger.With("path", p)

		_, err := r.target.Read(ctx, p, r.ref)
		if err != nil && !(errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err)) {
			logger.Error("failed to check if folder exists before writing", "error", err)
			return fmt.Errorf("failed to check if folder exists before writing: %w", err)
		} else if err == nil {
			logger.Info("folder already exists")
			// summary.Noop++
			return nil
		}

		// Create with an empty body will make a folder (or .keep file if unsupported)
		if err := r.target.Create(ctx, p, r.ref, nil, "export folder `"+p+"`"); err != nil {
			logger.Error("failed to write a folder in repository", "error", err)
			return fmt.Errorf("failed to write folder in repo: %w", err)
		}
		// summary.Create++
		logger.Debug("successfully exported folder")
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to write folders: %w", err)
	}

	return nil
}

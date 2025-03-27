package export

import (
	"context"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

func (r *exportJob) exportFoldersFromAPIServer(ctx context.Context) error {
	// FIXME: we load the entire tree in memory
	r.progress.SetMessage(ctx, "reading folder tree from unified storage")
	repoName := r.target.Config().Name
	err := r.client.ForEachFolder(ctx, func(client dynamic.ResourceInterface, item *unstructured.Unstructured) error {
		// TODO: should we stop execution if this fails?
		err := r.folderTree.AddUnstructured(item, repoName)
		if err != nil {
			r.progress.Record(ctx, jobs.JobResourceResult{
				Name:     item.GetName(),
				Resource: item.GroupVersionKind().Kind,
				Group:    item.GroupVersionKind().Group,
				Error:    err,
			})
		}

		return nil
	})
	if err != nil {
		return fmt.Errorf("read folders in memory to build tree: %w", err)
	}

	r.progress.SetMessage(ctx, "write folders to repository")
	err = r.folderTree.Walk(ctx, func(ctx context.Context, folder resources.Folder) error {
		p := folder.Path
		if r.path != "" {
			p = safepath.Join(r.path, p)
		}

		result := jobs.JobResourceResult{
			Name:     folder.ID,
			Resource: folders.RESOURCE,
			Group:    folders.GROUP,
			Path:     p,
		}

		// TODO: should this be part of the dual writer or use the folder manager?

		_, err := r.target.Read(ctx, p, r.ref)
		if err != nil && !(errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err)) {
			result.Error = fmt.Errorf("failed to check if folder exists before writing: %w", err)
			return result.Error
		} else if err == nil {
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

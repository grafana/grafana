package export

import (
	"context"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

// FIXME: revise logging in this method
func (r *exportJob) loadFolders(ctx context.Context) error {
	logger := r.logger
	r.progress.SetMessage(ctx, "reading folder tree")

	repoName := r.target.Config().Name

	// TODO: should this be logging or message or both?
	r.progress.SetMessage(ctx, "read folder tree from unified storage")
	client, err := r.client.Folder()
	if err != nil {
		return err
	}

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

	// create folders first is required so that empty folders exist when finished
	r.progress.SetMessage(ctx, "write folders")

	err = r.folderTree.Walk(ctx, func(ctx context.Context, folder resources.Folder) error {
		p := folder.Path
		if r.path != "" {
			p = safepath.Join(r.path, p)
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

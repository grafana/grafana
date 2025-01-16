package jobs

import (
	"context"
	"fmt"
	"os"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/legacyexport"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type ExportWorker struct {
	repo           repository.Repository
	replicator     *resources.Replicator
	legacyExporter legacyexport.LegacyExporter
}

func (w *ExportWorker) Process(ctx context.Context, job provisioning.Job) (*provisioning.JobStatus, error) {
	config := job.Spec.Export
	if config == nil {
		return nil, fmt.Errorf("missing export config")
	}

	if config.Folder != "" {
		return nil, fmt.Errorf("exporting a single folder is not yet supported")
	}

	if !config.History {
		// Uses k8s API against the configured folder
		// NOTE: uses the repository export folder, not the requested export folder
		err := w.replicator.Export(ctx)
		if err != nil {
			return nil, err
		}
		return &provisioning.JobStatus{
			State: provisioning.JobStateSuccess,
		}, nil
	}

	logger := logging.FromContext(ctx)

	if w.repo.Config().Spec.Type != provisioning.GitHubRepositoryType {
		return nil, fmt.Errorf("export with history only supported for github (right now)")
	}

	localrepo, err := w.newEmptyRepo()
	if err != nil {
		return nil, err
	}

	repo, err := w.legacyExporter.Export(ctx, localrepo, job.Namespace, *config)
	if err != nil {
		return nil, err
	}
	logger.Info("exported", "directory", localrepo, "git", repo)
	logger.Info("TODO! push the repository to the remote")
	return &provisioning.JobStatus{
		State:   provisioning.JobStateSuccess,
		Message: "Exported to: " + localrepo,
	}, nil
}

// This creates an empty repo
func (w *ExportWorker) newEmptyRepo() (string, error) {
	rootDir, err := os.MkdirTemp("grafana-provisioning", "export")
	if err != nil {
		return "", err
	}
	err = os.MkdirAll(rootDir, 0755)
	if err != nil {
		return "", err
	}

	r, err := git.PlainInit(rootDir, false)
	if err != nil {
		return "", err
	}

	// default to "main" branch
	h := plumbing.NewSymbolicReference(plumbing.HEAD, plumbing.ReferenceName("refs/heads/main"))
	err = r.Storer.SetReference(h)
	if err != nil {
		return "", err
	}
	return rootDir, nil
}

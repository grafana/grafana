package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana-app-sdk/logging"
	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// Export reads from grafana and writes to a a repository
type Exporter interface {
	Export(ctx context.Context,
		repo repository.Repository,
		options provisioning.ExportJobOptions,
		progress func(provisioning.JobStatus) error,
	) (*provisioning.JobStatus, error)
}

type exporter struct {
	client     *resources.DynamicClient // namespaced!
	dashboards dynamic.ResourceInterface
	folders    dynamic.ResourceInterface
	repository repository.Repository
}

func NewExporter(
	repo repository.Repository,
	dynamicClient *resources.DynamicClient,
) (Exporter, error) {
	if dynamicClient.GetNamespace() != repo.Config().Namespace {
		return nil, fmt.Errorf("bad setup, exporter needs a namespaced client matching the repository")
	}
	folders := dynamicClient.Resource(schema.GroupVersionResource{
		Group:    folders.GROUP,
		Version:  folders.VERSION,
		Resource: folders.RESOURCE,
	})

	dashboards := dynamicClient.Resource(schema.GroupVersionResource{
		Group:    "dashboard.grafana.app",
		Version:  "v1alpha1",
		Resource: "dashboards",
	})

	return &exporter{
		client:     dynamicClient,
		folders:    folders,
		dashboards: dashboards,
		repository: repo,
	}, nil
}

func (r *exporter) Export(ctx context.Context,
	repo repository.Repository,
	options provisioning.ExportJobOptions,
	progress func(provisioning.JobStatus) error,
) (*provisioning.JobStatus, error) {
	logger := logging.FromContext(ctx)
	status := provisioning.JobStatus{
		State:   provisioning.JobStateWorking,
		Message: "reading folder tree...",
	}
	err := progress(status)
	if err != nil {
		return nil, err
	}
	ref := options.Branch // only valid for git
	ns := r.repository.Config().GetNamespace()
	logger = logger.With("ref", ref, "namespace", ns)

	// TODO: handle pagination
	rawFolders, err := r.folders.List(ctx, metav1.ListOptions{Limit: 10000})
	if err != nil {
		return nil, fmt.Errorf("failed to list folders: %w", err)
	}
	if rawFolders.GetContinue() != "" {
		return nil, fmt.Errorf("unable to list all folders in one request: %s", rawFolders.GetContinue())
	}

	status.Message = fmt.Sprintf("exporting folders (%d)...", len(rawFolders.Items))
	err = progress(status)
	if err != nil {
		return nil, err
	}

	folderTree := resources.NewFolderTreeFromUnstructure(ctx, rawFolders.Items)
	if options.Folder != "" {
		return nil, fmt.Errorf("non-root folder not yet supported")
	}

	// first create folders
	summary := provisioning.JobResourceSummary{
		Group:    folders.GROUP,
		Resource: folders.RESOURCE,
	}
	err = folderTree.Walk(ctx, func(ctx context.Context, folder resources.Folder) error {
		p := folder.Path + "/"
		logger := logger.With("path", p)

		_, err = r.repository.Read(ctx, p, ref)
		if err != nil && !(errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err)) {
			logger.Error("failed to check if folder exists before writing", "error", err)
			summary.Error++
			return fmt.Errorf("failed to check if folder exists before writing: %w", err)
		} else if err == nil {
			logger.Info("folder already exists")
			summary.Noop++
			return nil
		}

		// Create with an empty body will make a folder (or .keep file if unsupported)
		if err := r.repository.Create(ctx, p, ref, nil, "export of folder `"+p+"` in namespace "+ns); err != nil {
			logger.Error("failed to write a folder in repository", "error", err)
			summary.Error++
			return fmt.Errorf("failed to write folder in repo: %w", err)
		}
		summary.Create++
		logger.Debug("successfully exported folder")
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to write folders: %w", err)
	}
	status.Summary = append(status.Summary, summary)
	status.Message = "writing dashboards..."

	err = progress(status)
	if err != nil {
		return nil, err
	}

	// TODO: handle pagination
	dashboardList, err := r.dashboards.List(ctx, metav1.ListOptions{Limit: 1000})
	if err != nil {
		return nil, fmt.Errorf("failed to list dashboards: %w", err)
	}

	commitMessage := fmt.Sprintf("grafana export to: %s", repo.Config().Name)
	summary = provisioning.JobResourceSummary{
		Group:    "dashboard.grafana.app",
		Resource: "dashboards",
	}
	for _, item := range dashboardList.Items {
		if ctx.Err() != nil {
			logger.Debug("cancelling replication process due to ctx error", "error", err)
			return nil, ctx.Err()
		}

		name := item.GetName()
		folder := item.GetAnnotations()[apiutils.AnnoKeyFolder]

		// Get the absolute path of the folder
		fid, ok := folderTree.DirPath(folder, "")
		if !ok {
			logger.Error("folder of item was not in tree of repository")
			return nil, fmt.Errorf("folder of item was not in tree of repository")
		}

		delete(item.Object, "metadata")
		if options.Identifier {
			item.SetName(name) // keep the identifier in the metadata
		}

		body, err := json.MarshalIndent(item.Object, "", "  ")
		if err != nil {
			return nil, fmt.Errorf("failed to marshal dashboard %s: %w", name, err)
		}
		fileName := path.Join(fid.Path, name+".json")

		// Write the file
		err = r.repository.Write(ctx, fileName, ref, body, commitMessage)
		if err != nil {
			summary.Error++
			logger.Error("failed to write a file in repository", "error", err)
			if len(summary.Errors) < 20 {
				summary.Errors = append(summary.Errors, fmt.Sprintf("error writing: %s", fileName))
			}
		} else {
			summary.Write++
		}
	}
	status.Summary = append(status.Summary, summary)
	status.State = provisioning.JobStateSuccess
	status.Message = ""
	return &status, nil
}

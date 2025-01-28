package jobs

import (
	"context"
	"errors"
	"fmt"
	"path"

	"gopkg.in/yaml.v3"
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

type Exporter interface {
	Export(ctx context.Context,
		repo repository.Repository,
		options provisioning.ExportOptions,
		progress func(provisioning.JobStatus) error,
	) (*provisioning.JobStatus, error)
}

type exporter struct {
	client     *resources.DynamicClient
	dashboards dynamic.ResourceInterface
	folders    dynamic.ResourceInterface
	repository repository.Repository
}

func NewExporter(
	repo repository.Repository,
	parser *resources.Parser,
) (Exporter, error) {
	dynamicClient := parser.Client()
	folders := dynamicClient.Resource(schema.GroupVersionResource{
		Group:    folders.GROUP,
		Version:  folders.VERSION,
		Resource: folders.RESOURCE,
	})

	dashboards := dynamicClient.Resource(schema.GroupVersionResource{
		Group:    "dashboard.grafana.app",
		Version:  "v2alpha1",
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
	options provisioning.ExportOptions,
	progress func(provisioning.JobStatus) error,
) (*provisioning.JobStatus, error) {
	logger := logging.FromContext(ctx)
	err := progress(provisioning.JobStatus{
		State:   provisioning.JobStateWorking,
		Message: "getting folder tree...",
	})
	if err != nil {
		return nil, err
	}
	var ref string
	if r.repository.Config().Spec.Type == provisioning.GitHubRepositoryType {
		ref = r.repository.Config().Spec.GitHub.Branch
	}
	ns := r.repository.Config().GetNamespace()
	logger = logger.With("ref", ref, "namespace", ns)

	err = progress(provisioning.JobStatus{
		State:   provisioning.JobStateWorking,
		Message: "exporting folders...",
	})
	if err != nil {
		return nil, err
	}

	// TODO: handle pagination
	rawFolders, err := r.folders.List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list folders: %w", err)
	}

	folderTree := resources.NewFolderTreeFromUnstructure(ctx, rawFolders)

	// TODO: short by depth
	for _, folder := range folderTree.AllFolders() {
		folderPath := folder.Path
		logger := logger.With("path", folderPath)
		_, err = r.repository.Read(ctx, folderPath, ref)

		if err != nil && !(errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err)) {
			logger.Error("failed to check if folder exists before writing", "error", err)
			return nil, fmt.Errorf("failed to check if folder exists before writing: %w", err)
		} else if err != nil { // ErrFileNotFound
			err = r.repository.Create(ctx, folderPath, ref, nil, "export of folder `"+folderPath+"` in namespace "+ns)
		} else {
			logger.Info("folder already exists")
		}

		if err != nil {
			logger.Error("failed to write a folder in repository", "error", err)
			return nil, fmt.Errorf("failed to write folder in repo: %w", err)
		}
		logger.Debug("successfully exported folder")
	}

	err = progress(provisioning.JobStatus{
		State:   provisioning.JobStateWorking,
		Message: "writing dashboards...",
	})
	if err != nil {
		return nil, err
	}
	// TODO: handle pagination
	dashboardList, err := r.dashboards.List(ctx, metav1.ListOptions{Limit: 1000})
	if err != nil {
		return nil, fmt.Errorf("failed to list dashboards: %w", err)
	}

	for _, item := range dashboardList.Items {
		if ctx.Err() != nil {
			logger.Debug("cancelling replication process due to ctx error", "error", err)
			return nil, ctx.Err()
		}

		name := item.GetName()
		logger := logger.With("item", name)
		ns := r.repository.Config().GetNamespace()
		if item.GetNamespace() != ns {
			logger.Debug("skipping dashboard item due to mismatching namespace", "got", ns)
			continue
		}

		folder := item.GetAnnotations()[apiutils.AnnoKeyFolder]
		logger = logger.With("folder", folder)

		fid, ok := folderTree.DirPath(folder, r.repository.Config().GetNamespace())
		if !ok {
			logger.Error("folder of item was not in tree of repository")
			return nil, fmt.Errorf("folder of item was not in tree of repository")
		}

		delete(item.Object, "metadata")
		marshalledBody, err := yaml.Marshal(item.Object)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal dashboard %s: %w", name, err)
		}
		fileName := path.Join(fid.Path, name+".yaml")
		logger = logger.With("file", fileName)

		_, err = r.repository.Read(ctx, fileName, ref)
		if err != nil && !(errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err)) {
			logger.Error("failed to check if file exists before writing", "error", err)
			return nil, fmt.Errorf("failed to check if file exists before writing: %w", err)
		} else if err != nil { // ErrFileNotFound
			err = r.repository.Create(ctx, fileName, ref, marshalledBody, "export of dashboard "+name+" in namespace "+ns)
		} else {
			err = r.repository.Update(ctx, fileName, ref, marshalledBody, "export of dashboard "+name+" in namespace "+ns)
		}
		if err != nil {
			logger.Error("failed to write a file in repository", "error", err)
			return nil, fmt.Errorf("failed to write file in repo: %w", err)
		}
		logger.Debug("successfully exported item")
	}

	return &provisioning.JobStatus{
		State: provisioning.JobStateSuccess,
	}, nil
}

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
	folders    dynamic.ResourceInterface
	repository repository.Repository
}

func NewExporter(
	repo repository.Repository,
	parser *resources.Parser,
) (Exporter, error) {
	dynamicClient := parser.Client()
	folders := dynamicClient.Resource(schema.GroupVersionResource{
		Group:    "folder.grafana.app",
		Version:  "v0alpha1",
		Resource: "folders",
	})
	return &exporter{
		client:     dynamicClient,
		folders:    folders,
		repository: repo,
	}, nil
}

func (r *exporter) Export(ctx context.Context,
	repo repository.Repository,
	options provisioning.ExportOptions,
	progress func(provisioning.JobStatus) error,
) (*provisioning.JobStatus, error) {
	logger := logging.FromContext(ctx)
	dashboardIface := r.client.Resource(schema.GroupVersionResource{
		Group:    "dashboard.grafana.app",
		Version:  "v2alpha1",
		Resource: "dashboards",
	})

	err := progress(provisioning.JobStatus{
		State:   provisioning.JobStateWorking,
		Message: "getting folder tree...",
	})
	if err != nil {
		return nil, err
	}

	folders, err := fetchRepoFolderTree(ctx, r.client)
	if err != nil {
		return nil, fmt.Errorf("failed to list folders: %w", err)
	}

	err = progress(provisioning.JobStatus{
		State:   provisioning.JobStateWorking,
		Message: "writing dashboards...",
	})
	if err != nil {
		return nil, err
	}
	// TODO: handle pagination
	dashboardList, err := dashboardIface.List(ctx, metav1.ListOptions{Limit: 1000})
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
		fid, ok := folders.DirPath(folder, r.repository.Config().Spec.Folder)
		if !ok {
			logger.Debug("folder of item was not in tree of repository")
			continue
		}

		delete(item.Object, "metadata")
		marshalledBody, err := yaml.Marshal(item.Object)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal dashboard %s: %w", name, err)
		}
		fileName := path.Join(fid.Path, name+".yaml")
		logger = logger.With("file", fileName)

		var ref string
		if r.repository.Config().Spec.Type == provisioning.GitHubRepositoryType {
			ref = r.repository.Config().Spec.GitHub.Branch
		}
		logger = logger.With("ref", ref)

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

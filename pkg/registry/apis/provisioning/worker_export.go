package provisioning

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"path"
	"path/filepath"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/auth"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"gopkg.in/yaml.v3"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/dynamic"
)

var _ jobs.Worker = (*exportWorker)(nil)

type exportWorker struct {
	getter         RepoGetter
	resourceClient *resources.ClientFactory
	identities     auth.BackgroundIdentityService
	logger         *slog.Logger
}

func (w *exportWorker) Supports(ctx context.Context, job *provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionExport
}

func (w *exportWorker) Process(ctx context.Context, job provisioning.Job) (*provisioning.JobStatus, error) {
	logger := w.logger.With("job", job.Name, "namespace", job.GetNamespace())

	id, err := w.identities.WorkerIdentity(ctx, job.Name)
	if err != nil {
		return nil, err
	}
	ctx = request.WithNamespace(identity.WithRequester(ctx, id), job.Namespace)

	repoName, ok := job.Labels["repository"]
	if !ok {
		logger.ErrorContext(ctx, "got a job without a repository label", "err", err)
		return nil, fmt.Errorf("no repository label in job")
	}
	logger = w.logger.With("repository", repoName)

	repo, err := w.getter.GetRepository(ctx, repoName)
	if err != nil {
		logger.DebugContext(ctx, "couldn't find the repository", "err", err)
		return nil, err
	}
	ns := repo.Config().GetNamespace()

	client, _, err := w.resourceClient.New(ns)
	if err != nil {
		logger.DebugContext(ctx, "failed to create a dynamic client", "err", err)
		return nil, fmt.Errorf("failed to create a dynamic client: %w", err)
	}

	dashboardIface := client.Resource(schema.GroupVersionResource{
		Group:    "dashboard.grafana.app",
		Version:  "v2alpha1",
		Resource: "dashboards",
	})
	folderIface := client.Resource(schema.GroupVersionResource{
		Group:    "folder.grafana.app",
		Version:  "v0alpha1",
		Resource: "folders",
	})

	// TODO: handle pagination
	folders, err := w.fetchRepoFolderTree(ctx, folderIface, repo.Config().Spec.Folder)
	if err != nil {
		logger.DebugContext(ctx, "failed to list folders", "err", err)
		return nil, fmt.Errorf("failed to list folders: %w", err)
	}

	// TODO: handle pagination
	dashboardList, err := dashboardIface.List(ctx, metav1.ListOptions{})
	if err != nil {
		logger.DebugContext(ctx, "failed to list dashboards", "err", err)
		return nil, fmt.Errorf("failed to list dashboards: %w", err)
	}

	for _, item := range dashboardList.Items {
		if ctx.Err() != nil {
			logger.DebugContext(ctx, "context was cancelled; returning early, despite having more items left")
			return nil, ctx.Err()
		}

		logger := logger.With("name", item.GetName(), "namespace", item.GetNamespace())
		logger.DebugContext(ctx, "got item in dashboard list")
		name := item.GetName()
		if namespace := item.GetNamespace(); namespace != ns {
			logger.DebugContext(ctx, "skipping dashboard in export due to mismatched namespace",
				"expected", ns)
			continue
		}

		folder := item.GetAnnotations()[apiutils.AnnoKeyFolder]
		if !folders.In(folder) {
			logger.DebugContext(ctx, "skipping dashboard in export due to folder being out-of-tree of repository")
			continue
		}

		delete(item.Object, "metadata")
		marshalledBody, baseFileName, err := w.marshalPreferredFormat(item.Object, name, repo)
		if err != nil {
			logger.ErrorContext(ctx, "failed to marshal dashboard into preferred format", "err", err)
			return nil, fmt.Errorf("failed to marshal dashboard %s: %w", name, err)
		}

		var ref string
		if repo.Config().Spec.Type == provisioning.GitHubRepositoryType {
			ref = repo.Config().Spec.GitHub.Branch
		}

		fileName := filepath.Join(folders.DirPath(folder), baseFileName)
		_, err = repo.Read(ctx, logger, fileName, ref)
		if err != nil && !(errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err)) {
			return nil, fmt.Errorf("failed to check if file exists before writing: %w", err)
		} else if err != nil { // ErrFileNotFound
			err = repo.Create(ctx, logger, fileName, ref, marshalledBody, "export of dashboard "+name+" in namespace "+ns)
		} else {
			err = repo.Update(ctx, logger, fileName, ref, marshalledBody, "export of dashboard "+name+" in namespace "+ns)
		}
		if err != nil {
			logger.ErrorContext(ctx, "failed to write dashboard model to repository", "err", err)
			return nil, fmt.Errorf("failed to write file in repo: %w", err)
		}
	}

	return &provisioning.JobStatus{
		State: provisioning.JobStateFinished,
	}, nil
}

type folderTree struct {
	tree       map[string]string
	repoFolder string
}

func (t *folderTree) In(folder string) bool {
	_, ok := t.tree[folder]
	return ok
}

// DirPath creates the path to the directory with slashes.
// The repository folder is not included in the path.
// If In(folder) is false, this will panic, because it would be undefined behaviour.
func (t *folderTree) DirPath(folder string) string {
	if folder == t.repoFolder {
		return ""
	}
	if !t.In(folder) {
		panic("undefined behaviour")
	}

	dirPath := folder
	parent := t.tree[folder]
	for parent != "" && parent != t.repoFolder {
		dirPath = path.Join(parent, dirPath)
		parent = t.tree[parent]
	}
	// Not using Clean here is intentional. We don't want `.` or similar.
	return dirPath
}

func (w *exportWorker) fetchRepoFolderTree(
	ctx context.Context,
	iface dynamic.ResourceInterface,
	repoFolder string,
) (*folderTree, error) {
	// TODO: handle pagination
	rawFolders, err := iface.List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	folders := make(map[string]string, len(rawFolders.Items))
	for _, rf := range rawFolders.Items {
		name := rf.GetName()
		// TODO: Can I use MetaAccessor here?
		parent := rf.GetAnnotations()[apiutils.AnnoKeyFolder]
		folders[name] = parent
	}

	// folders now includes a map[folder name]parent name
	// The top-most folder has a parent of "". Any folders below have parent refs.
	// We want to find only folders which are or start in repoFolder.
	for folder, parent := range folders {
		if folder == repoFolder {
			continue
		}

		hasRepoRoot := false
		for parent != "" {
			if parent == repoFolder {
				hasRepoRoot = true
				break
			}
			parent = folders[parent]
		}
		if !hasRepoRoot {
			delete(folders, folder)
		}
	}

	// folders now only includes the tree of the repoFolder.

	return &folderTree{
		tree:       folders,
		repoFolder: repoFolder,
	}, nil
}

func (*exportWorker) marshalPreferredFormat(obj any, name string, repo repository.Repository) (body []byte, fileName string, err error) {
	if repo.Config().Spec.PreferYAML {
		body, err = yaml.Marshal(obj)
		return body, name + ".yaml", err
	} else {
		body, err := json.MarshalIndent(obj, "", "    ")
		return body, name + ".json", err
	}
}

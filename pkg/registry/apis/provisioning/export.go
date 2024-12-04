package provisioning

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"path"
	"path/filepath"

	"gopkg.in/yaml.v3"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/client-go/dynamic"

	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type exportConnector struct {
	repoGetter Getter
	client     *resources.ClientFactory
	logger     *slog.Logger
}

func (*exportConnector) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() returns
	return &provisioning.ResourceWrapper{}
}

func (*exportConnector) Destroy() {}

func (*exportConnector) NamespaceScoped() bool {
	return true
}

func (*exportConnector) GetSingularName() string {
	return "Export"
}

func (*exportConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (c *exportConnector) ProducesObject(verb string) any {
	return c.New()
}

func (*exportConnector) ConnectMethods() []string {
	return []string{http.MethodPost}
}

func (*exportConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (c *exportConnector) Connect(
	ctx context.Context,
	name string,
	opts runtime.Object,
	responder rest.Responder,
) (http.Handler, error) {
	logger := c.logger.With("repository_name", name)
	repo, err := c.repoGetter.GetRepository(ctx, name)
	if err != nil {
		return nil, err
	}
	ns := repo.Config().GetNamespace()

	// TODO: We need some way to filter what we export.

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		client, _, err := c.client.New(ns)
		if err != nil {
			responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to create a dynamic client: %w", err)))
			return
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
		folders, err := c.fetchRepoFolderTree(ctx, folderIface, repo.Config().Spec.Folder)
		if err != nil {
			responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to list folders: %w", err)))
			return
		}

		// TODO: handle pagination
		dashboardList, err := dashboardIface.List(ctx, metav1.ListOptions{})
		if err != nil {
			responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to list dashboards: %w", err)))
			return
		}

		for _, item := range dashboardList.Items {
			if ctx.Err() != nil {
				// FIXME: use a proper error code when context is cancelled
				responder.Error(apierrors.NewInternalError(ctx.Err()))
				return
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
			marshalledBody, baseFileName, err := c.marshalPreferredFormat(item.Object, name, repo)
			if err != nil {
				logger.ErrorContext(ctx, "failed to marshal dashboard into preferred format", "err", err)
				responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to marshal dashboard %s: %w", name, err)))
				return
			}

			var ref string
			if repo.Config().Spec.Type == provisioning.GitHubRepositoryType {
				ref = repo.Config().Spec.GitHub.Branch
			}

			fileName := filepath.Join(folders.DirPath(folder), baseFileName)
			_, err = repo.Read(ctx, logger, fileName, ref)
			if err != nil && !(errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err)) {
				responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to check if file exists before writing: %w", err)))
				return
			} else if err != nil { // ErrFileNotFound
				err = repo.Create(ctx, logger, fileName, ref, marshalledBody, "export of dashboard "+name+" in namespace "+ns)
			} else {
				err = repo.Update(ctx, logger, fileName, ref, marshalledBody, "export of dashboard "+name+" in namespace "+ns)
			}
			if err != nil {
				logger.ErrorContext(ctx, "failed to write dashboard model to repository", "err", err)
				responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to write file in repo: %w", err)))
				return
			}
		}

		responder.Object(http.StatusOK, &provisioning.ResourceWrapper{})
	}), nil
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

func (c *exportConnector) fetchRepoFolderTree(
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

func (c *exportConnector) marshalPreferredFormat(obj any, name string, repo repository.Repository) (body []byte, fileName string, err error) {
	if repo.Config().Spec.PreferYAML {
		body, err = yaml.Marshal(obj)
		return body, name + ".yaml", err
	} else {
		body, err := json.MarshalIndent(obj, "", "    ")
		return body, name + ".json", err
	}
}

var (
	_ rest.Connecter            = (*exportConnector)(nil)
	_ rest.Storage              = (*exportConnector)(nil)
	_ rest.Scoper               = (*exportConnector)(nil)
	_ rest.SingularNameProvider = (*exportConnector)(nil)
	_ rest.StorageMetadata      = (*exportConnector)(nil)
)

package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"path/filepath"

	"gopkg.in/yaml.v3"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	apitypes "k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/client-go/dynamic"

	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type exportConnector struct {
	repoGetter RepoGetter
	client     *resourceClient
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
	return []string{http.MethodGet, http.MethodPost}
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
		client, err := c.client.Client(ns)
		if err != nil {
			responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to create a dynamic client: %w", err)))
			return
		}

		lookup := newKindsLookup(client)
		dashboardGVR, ok := lookup.Resource(schema.GroupVersionKind{
			Group:   "dashboard.grafana.app",
			Version: "v2alpha1",
			Kind:    "Dashboard",
		})
		if !ok {
			responder.Error(apierrors.NewInternalError(fmt.Errorf("no GVR was found for dashboards")))
			return
		}
		dashboardIface := client.Resource(dashboardGVR).Namespace(ns)

		folderGVR, ok := lookup.Resource(schema.GroupVersionKind{
			Group:   "folder.grafana.app",
			Version: "v0alpha1",
			Kind:    "Folder",
		})
		if !ok {
			responder.Error(apierrors.NewInternalError(fmt.Errorf("no GVR was found for folders")))
			return
		}
		folderIface := client.Resource(folderGVR).Namespace(ns)

		// TODO: handle pagination
		folders, err := c.fetchFolderInfo(ctx, folderIface)
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

			logger.InfoContext(ctx, "got item in dashboard list",
				"name", item.GetName(),
				"namespace", item.GetNamespace())
			name := item.GetName()
			if namespace := item.GetNamespace(); namespace != ns {
				logger.DebugContext(ctx, "skipping dashboard in export due to mismatched namespace",
					"name", name,
					"namespace", map[string]string{"expected": ns, "actual": namespace})
				continue
			}

			folder := folders[item.GetAnnotations()[apiutils.AnnoKeyFolder]]

			delete(item.Object, "metadata")
			marshalledBody, baseFileName, err := c.marshalPreferredFormat(item.Object, name, repo)
			if err != nil {
				logger.ErrorContext(ctx, "failed to marshal dashboard into preferred format",
					"err", err,
					"dashboard", name,
					"namespace", ns)
				responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to marshal dashboard %s: %w", name, err)))
				return
			}

			var ref string
			if repo.Config().Spec.Type == provisioning.GitHubRepositoryType {
				ref = repo.Config().Spec.GitHub.Branch
			}

			fileName := filepath.Join(folder.CreatePath(), baseFileName)
			// TODO: Upsert
			if err := repo.Create(ctx, logger, fileName, ref, marshalledBody, "export of dashboard "+name+" in namespace "+ns); err != nil {
				logger.ErrorContext(ctx, "failed to write dashboard model to repository",
					"err", err,
					"repository", repo.Config().GetName(),
					"dashboard", name,
					"namespace", ns)
				responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to write file in repo: %w", err)))
				return
			}
		}

		responder.Object(http.StatusOK, &provisioning.ResourceWrapper{})
	}), nil
}

type folderExport struct {
	Name string
	UID  apitypes.UID
	// Parent is a pointer to a parent folder. Nil if none.
	Parent *folderExport
}

func (e *folderExport) CreatePath() string {
	if e == nil {
		return ""
	}

	if e.Parent == nil {
		return e.Name
	} else {
		return filepath.Join(e.Parent.CreatePath(), e.Name)
	}
}

func (c *exportConnector) fetchFolderInfo(
	ctx context.Context,
	iface dynamic.ResourceInterface,
) (map[string]*folderExport, error) {
	folders := make(map[string]*folderExport)

	// TODO: handle pagination
	rawFolders, err := iface.List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	for _, rf := range rawFolders.Items {
		name := rf.GetName()
		uid := rf.GetUID()
		folders[name] = &folderExport{
			Name: name,
			UID:  uid,
		}
	}

	// Double iteration is not great but whatever... probably not too many folders anyhow...
	for _, folder := range folders {
		parents, err := iface.Get(ctx, folder.Name, metav1.GetOptions{}, "parents")
		if err != nil {
			return nil, err
		}

		// FIXME: use "items" here when we undo that hack
		uncastItems := parents.Object["infoItems"]
		if uncastItems == nil { // avoid interface conversion panic
			continue
		}
		items := uncastItems.([]any)
		if len(items) == 0 {
			continue
		}

		// the UID in the returned value is actually the metadata.name!
		parentUid := items[0].(map[string]interface{})["uid"].(string)
		folder.Parent = folders[parentUid]
	}

	return folders, nil
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

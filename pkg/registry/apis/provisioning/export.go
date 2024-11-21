package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
)

type exportConnector struct {
	repoGetter RepoGetter
	client     *resourceClient
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

		dashboardGVR, ok := c.client.GVR(ns, schema.GroupVersionKind{
			Group:   "dashboard.grafana.app",
			Version: "v2alpha1",
			Kind:    "Dashboard",
		})
		if !ok {
			responder.Error(apierrors.NewInternalError(fmt.Errorf("no GVR was found for dashboards")))
			return
		}
		dashboardIface := client.Resource(dashboardGVR).Namespace(ns)

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

			slog.InfoContext(ctx, "got item in dashboard list",
				"name", item.GetName(),
				"namespace", item.GetNamespace())
			name := item.GetName()
			if namespace := item.GetNamespace(); namespace != ns {
				slog.DebugContext(ctx, "skipping dashboard in export due to mismatched namespace",
					"name", name,
					"namespace", map[string]string{"expected": ns, "actual": namespace})
				continue
			}

			// TODO: Drop the metadata field before writing?
			// TODO: Do we want this to export YAML instead maybe?
			json, err := json.MarshalIndent(item.Object, "", "\t")
			if err != nil {
				slog.ErrorContext(ctx, "failed to marshal dashboard into JSON",
					"err", err,
					"dashboard", name,
					"namespace", ns)
				responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to marshal dashboard %s into json: %w", name, err)))
				return
			}

			// TODO: Create appropriate folder path
			fileName := name + ".json"
			// TODO: Upsert
			if err := repo.Create(ctx, fileName, json, "export of dashboard "+name+" in ns "+ns); err != nil {
				slog.ErrorContext(ctx, "failed to write dashboard JSON to repository",
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

var (
	_ rest.Connecter            = (*exportConnector)(nil)
	_ rest.Storage              = (*exportConnector)(nil)
	_ rest.Scoper               = (*exportConnector)(nil)
	_ rest.SingularNameProvider = (*exportConnector)(nil)
	_ rest.StorageMetadata      = (*exportConnector)(nil)
)

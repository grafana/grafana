package provisioning

import (
	"context"
	"log/slog"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

type listConnector struct {
	repoGetter RepoGetter
	logger     *slog.Logger
}

func (*listConnector) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() returns
	return &provisioning.ResourceWrapper{}
}

func (*listConnector) Destroy() {}

func (*listConnector) NamespaceScoped() bool {
	return true
}

func (*listConnector) GetSingularName() string {
	return "List"
}

func (*listConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (c *listConnector) ProducesObject(verb string) any {
	return c.New()
}

func (*listConnector) ConnectMethods() []string {
	return []string{http.MethodGet, http.MethodPost}
}

func (*listConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (c *listConnector) Connect(
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
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		ref := query.Get("ref")
		if ref != "" {
			logger = logger.With("ref", ref)
		}
		continueToken := query.Get("continueToken")
		if continueToken != "" {
			logger = logger.With("continueToken", continueToken)
		}

		rsp, err := repo.ReadTree(r.Context(), logger, ref)
		if err != nil {
			responder.Error(err)
			return
		}

		files := &provisioning.FileList{}
		for _, v := range rsp {
			if !v.Blob {
				continue // folder item
			}
			files.Items = append(files.Items, provisioning.FileItem{
				Path: v.Path,
				Size: v.Size,
				Hash: v.Hash,
			})
		}
		responder.Object(http.StatusOK, files)
	}), nil
}

var (
	_ rest.Connecter            = (*listConnector)(nil)
	_ rest.Storage              = (*listConnector)(nil)
	_ rest.Scoper               = (*listConnector)(nil)
	_ rest.SingularNameProvider = (*listConnector)(nil)
	_ rest.StorageMetadata      = (*listConnector)(nil)
)

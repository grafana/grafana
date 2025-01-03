package folderimpl

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

// interface to allow for testing
type folderK8sHandler interface {
	getClient(ctx context.Context, orgID int64) (dynamic.ResourceInterface, bool)
	getNamespace(orgID int64) string
}

var _ folderK8sHandler = (*foldk8sHandler)(nil)

type foldk8sHandler struct {
	cfg        *setting.Cfg
	namespacer request.NamespaceMapper
	gvr        schema.GroupVersionResource
}

// -----------------------------------------------------------------------------------------
// Folder k8s functions
// -----------------------------------------------------------------------------------------

func (fk8s *foldk8sHandler) getClient(ctx context.Context, orgID int64) (dynamic.ResourceInterface, bool) {
	cfg := &rest.Config{
		Host:    fk8s.cfg.AppURL,
		APIPath: "/apis",
		TLSClientConfig: rest.TLSClientConfig{
			Insecure: true, // Skip TLS verification
		},
		Username: fk8s.cfg.AdminUser,
		Password: fk8s.cfg.AdminPassword,
	}

	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, false
	}
	return dyn.Resource(fk8s.gvr).Namespace(fk8s.getNamespace(orgID)), true
}

func (fk8s *foldk8sHandler) getNamespace(orgID int64) string {
	return fk8s.namespacer(orgID)
}

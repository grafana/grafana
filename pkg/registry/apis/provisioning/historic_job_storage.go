package provisioning

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
)

type historicJobStorage struct {
	*genericregistry.Store
}

// NewHistoricJobStorage wraps the HistoricJob store so jobs written by the provisioning service keep their original author.
func NewHistoricJobStorage(store *genericregistry.Store) rest.Storage {
	return &historicJobStorage{Store: store}
}

func (s *historicJobStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	if auth, ok := authlib.AuthInfoFrom(ctx); ok && identity.IsProvisioningServiceIdentity(auth) {
		if meta, err := apiutils.MetaAccessor(obj); err == nil && meta.GetCreatedBy() != "" {
			ctx = identity.WithOriginalIdentityUID(ctx, meta.GetCreatedBy())
		}
	}
	return s.Store.Create(ctx, obj, createValidation, options)
}

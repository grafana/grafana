package globalrole

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

// GlobalRoleIdentityWrapper wraps a grafanarest.Storage and switches the caller
// identity to the app service identity for Get and List. Any other methods on
// the inner storage are invoked unchanged via the embedded interface.
//
// The swap is needed because regular users cannot authenticate in the "*"
// (cluster) namespace, but GlobalRoles are cluster-scoped. Authorization for
// reads is already enforced by GetAuthorizer() at the k8s authorization layer
// before storage is reached.
type GlobalRoleIdentityWrapper struct {
	grafanarest.Storage
}

func (w *GlobalRoleIdentityWrapper) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	srvCtx, _ := identity.WithServiceIdentity(ctx, 0)
	return w.Storage.Get(srvCtx, name, options)
}

func (w *GlobalRoleIdentityWrapper) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	srvCtx, _ := identity.WithServiceIdentity(ctx, 0)
	return w.Storage.List(srvCtx, options)
}

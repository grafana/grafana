package conversion

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// withNamespaceAndServiceIdentity merges namespace and requester identity into context.
//
// An identity is needed for datasource and library element lookups in ST instance DBs through cloudconfig client,
// when a lower version is converted to v2.
//
// A background service identity is used here because the user who is reading the specific dashboard
// may not have access to all the datasources in the dashboard, but the migration still needs to take place
// in order to be able to convert between k8s versions (so that we have a guaranteed structure to convert between)
//
// The identity is limited to the namespace so a token signed from it can only fetch results for that namespace.
func withNamespaceAndServiceIdentity(ctx context.Context, source interface{}) context.Context {
	obj, ok := source.(metav1.Object)
	if !ok || obj.GetNamespace() == "" {
		return ctx
	}

	namespace := obj.GetNamespace()
	ctx = request.WithNamespace(ctx, namespace)

	nsInfo, err := types.ParseNamespace(namespace)
	if err != nil {
		return ctx
	}

	ctx, _ = identity.WithServiceIdentity(ctx, nsInfo.OrgID, func(r *identity.StaticRequester) {
		r.Namespace = namespace
	})
	return ctx
}

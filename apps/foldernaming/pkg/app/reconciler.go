package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"

	"github.com/grafana/grafana/apps/policy/pkg/managed"

	foldernamingv0alpha1 "github.com/grafana/grafana/apps/foldernaming/pkg/apis/foldernaming/v0alpha1"
)

// Reconciler keeps a validation policy and binding for every FolderNamingPolicy. The convention is
// not copied anywhere: the binding uses its FolderNamingPolicy as the parameter object, so editing
// the pattern takes effect without a reconcile. The binding's action follows the enforcement.
type Reconciler struct {
	operator.TypedReconciler[*foldernamingv0alpha1.FolderNamingPolicy]
	clients managed.Clients
}

func NewReconciler(clients managed.Clients) *Reconciler {
	r := &Reconciler{clients: clients}
	r.ReconcileFunc = r.reconcile
	return r
}

func (r *Reconciler) reconcile(ctx context.Context, req operator.TypedReconcileRequest[*foldernamingv0alpha1.FolderNamingPolicy]) (operator.ReconcileResult, error) {
	obj := req.Object
	logger := logging.FromContext(ctx).With("namespace", obj.GetNamespace(), "folderNamingPolicy", obj.GetName(), "action", operator.ResourceActionFromReconcileAction(req.Action))

	if req.Action == operator.ReconcileActionDeleted {
		logger.Info("Removing folder naming enforcement")
		return operator.ReconcileResult{}, r.clients.Remove(ctx, obj.GetNamespace(), managedName(obj.GetName()))
	}
	logger.Debug("Ensuring folder naming enforcement")
	return operator.ReconcileResult{}, r.clients.Ensure(ctx, managed.Pair{
		Namespace: obj.GetNamespace(),
		Name:      managedName(obj.GetName()),
		Labels:    map[string]string{ManagedLabel: obj.GetName()},
		Policy:    policySpec(),
		Binding:   bindingSpec(obj),
	})
}

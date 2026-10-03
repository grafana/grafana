package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"

	"github.com/grafana/grafana/apps/policy/pkg/managed"

	rulepolicyv0alpha1 "github.com/grafana/grafana/apps/alerting/rulepolicy/pkg/apis/rulepolicy/v0alpha1"
)

// Reconciler keeps a validation policy and binding for every RulePolicy. The required and forbidden
// keys are not copied anywhere: the binding uses its RulePolicy as the parameter object, so editing
// them takes effect without a reconcile. The binding's action follows the RulePolicy's enforcement.
// Several RulePolicies in a namespace each get their own pair, so a rule must satisfy all of them.
type Reconciler struct {
	operator.TypedReconciler[*rulepolicyv0alpha1.RulePolicy]
	clients managed.Clients
}

func NewReconciler(clients managed.Clients) *Reconciler {
	r := &Reconciler{clients: clients}
	r.ReconcileFunc = r.reconcile
	return r
}

func (r *Reconciler) reconcile(ctx context.Context, req operator.TypedReconcileRequest[*rulepolicyv0alpha1.RulePolicy]) (operator.ReconcileResult, error) {
	obj := req.Object
	logger := logging.FromContext(ctx).With("namespace", obj.GetNamespace(), "rulePolicy", obj.GetName(), "action", operator.ResourceActionFromReconcileAction(req.Action))

	if req.Action == operator.ReconcileActionDeleted {
		logger.Info("Removing rule policy enforcement")
		return operator.ReconcileResult{}, r.clients.Remove(ctx, obj.GetNamespace(), managedName(obj.GetName()))
	}
	logger.Debug("Ensuring rule policy enforcement")
	return operator.ReconcileResult{}, r.clients.Ensure(ctx, managed.Pair{
		Namespace: obj.GetNamespace(),
		Name:      managedName(obj.GetName()),
		Labels:    map[string]string{ManagedLabel: obj.GetName()},
		Policy:    policySpec(),
		Binding:   bindingSpec(obj),
	})
}

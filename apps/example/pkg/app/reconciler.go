package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/apps/example/pkg/apis/example/v1alpha1"
)

// ExampleReconciler wraps TypedReconciler to simplify some of our reconciliation logic,
// as TypedReconciler will handle type checking of the input object for us.
type ExampleReconciler struct {
	operator.TypedReconciler[*v1alpha1.Example]
	client resource.Client
}

func NewExampleReconciler(client resource.Client) *ExampleReconciler {
	reconciler := ExampleReconciler{
		TypedReconciler: operator.TypedReconciler[*v1alpha1.Example]{},
		client:          client,
	}
	reconciler.ReconcileFunc = reconciler.doReconcile
	return &reconciler
}

// doReconcile is the main reconciliation loop for our app's Example reconciler.
// All it does is print a log message and then update the last observed generation in the status
// (if the request is a DELETE, it doesn't try to update the status, as the update would fail).
func (e *ExampleReconciler) doReconcile(ctx context.Context, req operator.TypedReconcileRequest[*v1alpha1.Example]) (operator.ReconcileResult, error) {
	if req.Object.GetGeneration() == req.Object.Status.LastObservedGeneration {
		// Skip if we've already processed this spec
		return operator.ReconcileResult{}, nil
	}

	logging.FromContext(ctx).Info("reconciling example", "name", req.Object.GetName(), "namespace", req.Object.GetNamespace(), "action", operator.ResourceActionFromReconcileAction(req.Action))

	// If this is a delete, we don't need to do anything
	if req.Action == operator.ReconcileActionDeleted {
		return operator.ReconcileResult{}, nil
	}

	// Update the status.
	// We use resource.UpdateObject here to handle conflicts when doing the update,
	// as it gets the current state, performs our update function, then pushes to the remote
	_, err := resource.UpdateObject(ctx, e.client, req.Object.GetStaticMetadata().Identifier(), func(obj *v1alpha1.Example, _ bool) (*v1alpha1.Example, error) {
		obj.Status.LastObservedGeneration = req.Object.GetGeneration()
		return obj, nil
	}, resource.UpdateOptions{
		Subresource: "status",
	})
	if err != nil {
		return operator.ReconcileResult{}, err
	}

	return operator.ReconcileResult{}, nil
}

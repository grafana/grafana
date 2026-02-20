package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/apps/stalebot/pkg/apis/stalebot/v1alpha1"
)

// StaleDashboardTrackerReconciler wraps TypedReconciler to simplify reconciliation logic
type StaleDashboardTrackerReconciler struct {
	operator.TypedReconciler[*v1alpha1.StaleDashboardTracker]
	client resource.Client
	config *Config
}

// NewReconciler creates a new reconciler for StaleDashboardTracker
func NewReconciler(config *Config) *StaleDashboardTrackerReconciler {
	reconciler := StaleDashboardTrackerReconciler{
		TypedReconciler: operator.TypedReconciler[*v1alpha1.StaleDashboardTracker]{},
		config:          config,
	}
	reconciler.ReconcileFunc = reconciler.doReconcile
	return &reconciler
}

// SetClient sets the resource client for the reconciler
func (r *StaleDashboardTrackerReconciler) SetClient(client resource.Client) {
	r.client = client
}

// doReconcile is the main reconciliation loop for the StaleDashboardTracker
// This is where we check if a dashboard is stale and update the status
func (r *StaleDashboardTrackerReconciler) doReconcile(ctx context.Context, req operator.TypedReconcileRequest[*v1alpha1.StaleDashboardTracker]) (operator.ReconcileResult, error) {
	if req.Object.Status.ObservedGeneration != nil && req.Object.GetGeneration() == *req.Object.Status.ObservedGeneration {
		// Skip if we've already processed this spec
		return operator.ReconcileResult{}, nil
	}

	logging.FromContext(ctx).Info("reconciling stale dashboard tracker",
		"name", req.Object.GetName(),
		"namespace", req.Object.GetNamespace(),
		"action", operator.ResourceActionFromReconcileAction(req.Action))

	// If this is a delete, we don't need to do anything
	if req.Action == operator.ReconcileActionDeleted {
		return operator.ReconcileResult{}, nil
	}

	// TODO: Implement reconciliation logic
	// 1. Query dashboard API for last accessed/updated time for the dashboardUID in req.Object.Spec.DashboardUID
	// 2. Calculate if dashboard is stale based on req.Object.Spec.StaleDaysThreshold
	// 3. Update status with findings
	// 4. Send notifications if configured in req.Object.Spec.Notification

	// Update the status
	if r.client != nil {
		_, err := resource.UpdateObject(ctx, r.client, req.Object.GetStaticMetadata().Identifier(), func(obj *v1alpha1.StaleDashboardTracker, _ bool) (*v1alpha1.StaleDashboardTracker, error) {
			generation := req.Object.GetGeneration()
			obj.Status.ObservedGeneration = &generation
			// TODO: Update other status fields based on staleness check
			return obj, nil
		}, resource.UpdateOptions{
			Subresource: "status",
		})
		if err != nil {
			return operator.ReconcileResult{}, err
		}
	}

	return operator.ReconcileResult{}, nil
}

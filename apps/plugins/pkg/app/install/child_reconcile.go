package install

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	"github.com/grafana/grafana/apps/plugins/pkg/app/metrics"
)

var (
	requeueAfter = 10 * time.Second
)

// ChildPluginReconciler reconciles Plugin resources and creates child plugin records.
type ChildPluginReconciler struct {
	operator.TypedReconciler[*pluginsv0alpha1.Plugin]
	metaManager *meta.ProviderManager
	registrar   Registrar
	logger      logging.Logger
}

// NewChildPluginReconciler creates a new ChildPluginReconciler instance.
func NewChildPluginReconciler(logger logging.Logger, metaManager *meta.ProviderManager, registrar Registrar) *ChildPluginReconciler {
	reconciler := &ChildPluginReconciler{
		TypedReconciler: operator.TypedReconciler[*pluginsv0alpha1.Plugin]{},
		metaManager:     metaManager,
		registrar:       registrar,
		logger:          logger,
	}
	reconciler.ReconcileFunc = reconciler.reconcile
	return reconciler
}

// reconcile is the main reconciliation loop for ChildPlugin resources.
func (r *ChildPluginReconciler) reconcile(ctx context.Context, req operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]) (operator.ReconcileResult, error) {
	start := time.Now()
	defer func() {
		metrics.ChildReconciliationDurationSeconds.Observe(time.Since(start).Seconds())
	}()

	plugin := req.Object
	logger := r.logger.WithContext(ctx).With(
		"pluginId", plugin.Spec.Id,
		"requestNamespace", plugin.Namespace,
		"version", plugin.Spec.Version,
		"action", req.Action,
		"parentId", plugin.Spec.ParentId,
	)

	// If the plugin already has a parent ID set, skip the reconciliation
	if plugin.Spec.ParentId != nil && *plugin.Spec.ParentId != "" {
		logger.Debug("Plugin is a child plugin, skipping child discovery")
		return operator.ReconcileResult{}, nil
	}

	result, err := r.metaManager.GetMeta(ctx, meta.PluginRef{
		ID:      plugin.Spec.Id,
		Version: plugin.Spec.Version,
	})
	if err != nil {
		logger.Error("Failed to get plugin metadata", "error", err)
		metrics.ChildReconciliationTotal.WithLabelValues("error").Inc()
		return operator.ReconcileResult{
			RequeueAfter: &requeueAfter,
		}, nil
	}

	if len(result.Meta.Children) == 0 {
		logger.Debug("Plugin has no children, skipping child plugin reconciliation")
		metrics.ChildReconciliationTotal.WithLabelValues("success").Inc()
		return operator.ReconcileResult{}, nil
	}

	logger.Debug("Plugin has children, reconciling child plugins",
		"childCount", len(result.Meta.Children),
		"action", req.Action,
	)

	var reconcileResult operator.ReconcileResult
	var reconcileErr error

	switch req.Action {
	case operator.ReconcileActionCreated, operator.ReconcileActionUpdated, operator.ReconcileActionResynced:
		reconcileResult, reconcileErr = r.registerChildren(ctx, plugin, result.Meta.Children)
	case operator.ReconcileActionDeleted:
		reconcileResult, reconcileErr = r.unregisterChildren(ctx, plugin.Namespace, result.Meta.Children)
	case operator.ReconcileActionUnknown:
		reconcileErr = fmt.Errorf("invalid action: %d", req.Action)
	default:
		reconcileErr = fmt.Errorf("invalid action: %d", req.Action)
	}

	status := "success"
	if reconcileErr != nil || reconcileResult.RequeueAfter != nil {
		status = "error"
	}
	metrics.ChildReconciliationTotal.WithLabelValues(status).Inc()

	return reconcileResult, reconcileErr
}

func (r *ChildPluginReconciler) unregisterChildren(ctx context.Context, namespace string, children []string) (operator.ReconcileResult, error) {
	logger := r.logger.WithContext(ctx).With("requestNamespace", namespace)
	retry := false
	for _, childID := range children {
		err := r.registrar.Unregister(ctx, namespace, childID, SourceChildPluginReconciler)
		if err != nil && !errorsK8s.IsNotFound(err) {
			logger.Error("Failed to unregister child plugin", "error", err, "pluginId", childID)
			retry = true
		}
	}
	result := operator.ReconcileResult{}
	if retry {
		result.RequeueAfter = &requeueAfter
	}
	return result, nil
}

func (r *ChildPluginReconciler) registerChildren(ctx context.Context, parent *pluginsv0alpha1.Plugin, children []string) (operator.ReconcileResult, error) {
	logger := r.logger.WithContext(ctx).With("requestNamespace", parent.Namespace)
	retry := false
	for _, childID := range children {
		childInstall := &PluginInstall{
			ID:       childID,
			Version:  parent.Spec.Version,
			ParentID: parent.Spec.Id,
			Source:   SourceChildPluginReconciler,
		}
		err := r.registrar.Register(ctx, parent.Namespace, childInstall)
		if err != nil {
			logger.Error("Failed to register child plugin", "error", err, "pluginId", childID)
			retry = true
		}
	}
	result := operator.ReconcileResult{}
	if retry {
		result.RequeueAfter = &requeueAfter
	}
	return result, nil
}

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
)

var (
	requeueAfter = 10 * time.Second
)

// ChildPluginReconciler reconciles Plugin resources and creates child plugin records.
type ChildPluginReconciler struct {
	operator.TypedReconciler[*pluginsv0alpha1.Plugin]
	metaManager *meta.ProviderManager
	registrar   Registrar
}

// NewChildPluginReconciler creates a new ChildPluginReconciler instance.
func NewChildPluginReconciler(metaManager *meta.ProviderManager, registrar Registrar) *ChildPluginReconciler {
	reconciler := &ChildPluginReconciler{
		TypedReconciler: operator.TypedReconciler[*pluginsv0alpha1.Plugin]{},
		metaManager:     metaManager,
		registrar:       registrar,
	}
	reconciler.ReconcileFunc = reconciler.reconcile
	return reconciler
}

// reconcile is the main reconciliation loop for ChildPlugin resources.
func (r *ChildPluginReconciler) reconcile(ctx context.Context, req operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]) (operator.ReconcileResult, error) {
	plugin := req.Object
	logger := logging.FromContext(ctx).With(
		"pluginId", plugin.Spec.Id,
		"namespace", plugin.Namespace,
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
		return operator.ReconcileResult{
			RequeueAfter: &requeueAfter,
		}, nil
	}

	if len(result.Meta.Children) == 0 {
		logger.Debug("Plugin has no children, skipping child plugin reconciliation")
		return operator.ReconcileResult{}, nil
	}

	logger.Debug("Plugin has children, reconciling child plugins",
		"childCount", len(result.Meta.Children),
		"action", req.Action,
	)

	switch req.Action {
	case operator.ReconcileActionCreated, operator.ReconcileActionUpdated, operator.ReconcileActionResynced:
		return r.registerChildren(ctx, plugin, result.Meta.Children)
	case operator.ReconcileActionDeleted:
		return r.unregisterChildren(ctx, plugin.Namespace, result.Meta.Children)
	case operator.ReconcileActionUnknown:
		break // handled by return statement below
	}
	return operator.ReconcileResult{}, fmt.Errorf("invalid action: %d", req.Action)
}

func (r *ChildPluginReconciler) unregisterChildren(ctx context.Context, namespace string, children []string) (operator.ReconcileResult, error) {
	logger := logging.FromContext(ctx)
	retry := false
	for _, childID := range children {
		err := r.registrar.Unregister(ctx, namespace, childID, SourceChildPluginReconciler)
		if err != nil && !errorsK8s.IsNotFound(err) {
			logger.Error("Failed to unregister child plugin", "error", err, "childId", childID)
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
	logger := logging.FromContext(ctx)
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
			logger.Error("Failed to register child plugin", "error", err, "childId", childID)
			retry = true
		}
	}
	result := operator.ReconcileResult{}
	if retry {
		result.RequeueAfter = &requeueAfter
	}
	return result, nil
}

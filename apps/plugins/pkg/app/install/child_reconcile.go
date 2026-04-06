package install

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	"github.com/grafana/grafana/apps/plugins/pkg/app/metrics"
)

const (
	requeueAfter  = 10 * time.Second
	requeueJitter = 5 * time.Second

	// childProcessingBatchSize is the maximum number of child plugins to register or
	// unregister in a single reconciliation cycle. Larger child sets are split across
	// multiple cycles using ReconcileResult.State to track progress, so that each
	// cycle holds a bounded number of in-flight API objects in memory.
	childProcessingBatchSize = 20

	// stateKeyChildIndex is the ReconcileResult.State key used to resume a multi-cycle batch.
	stateKeyChildIndex = "childIndex"
)

func actionLabel(action operator.ReconcileAction) string {
	switch action {
	case operator.ReconcileActionCreated:
		return "created"
	case operator.ReconcileActionUpdated:
		return "updated"
	case operator.ReconcileActionDeleted:
		return "deleted"
	case operator.ReconcileActionResynced:
		return "resynced"
	default:
		return "unknown"
	}
}

func requeueAfterWithJitter() time.Duration {
	n, err := rand.Int(rand.Reader, big.NewInt(int64(requeueJitter)))
	if err != nil {
		return requeueAfter
	}
	return requeueAfter + time.Duration(n.Int64())
}

// childState returns a ReconcileResult.State map that resumes processing from idx.
func childState(idx int) map[string]any {
	return map[string]any{stateKeyChildIndex: idx}
}

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

	// Resume from prior batch cycle if state is present.
	startIdx := 0
	if req.State != nil {
		if v, ok := req.State[stateKeyChildIndex].(int); ok {
			startIdx = v
		}
	}

	result, err := r.metaManager.GetMeta(ctx, meta.PluginRef{
		ID:      plugin.Spec.Id,
		Version: plugin.Spec.Version,
	})
	if err != nil {
		logger.Error("Failed to get plugin metadata", "error", err)
		metrics.ChildReconciliationTotal.WithLabelValues("error", actionLabel(req.Action)).Inc()
		d := requeueAfterWithJitter()
		return operator.ReconcileResult{
			RequeueAfter: &d,
		}, nil
	}

	metrics.ChildrenCountPerReconcile.Observe(float64(len(result.Meta.Children)))

	if len(result.Meta.Children) == 0 || startIdx >= len(result.Meta.Children) {
		if len(result.Meta.Children) == 0 {
			logger.Debug("Plugin has no children, skipping child plugin reconciliation")
		}
		metrics.ChildReconciliationTotal.WithLabelValues("success", actionLabel(req.Action)).Inc()
		return operator.ReconcileResult{}, nil
	}

	logger.Debug("Plugin has children, reconciling child plugins",
		"childCount", len(result.Meta.Children),
		"startIdx", startIdx,
		"action", req.Action,
	)

	var reconcileResult operator.ReconcileResult
	var reconcileErr error

	switch req.Action {
	case operator.ReconcileActionCreated, operator.ReconcileActionUpdated, operator.ReconcileActionResynced:
		reconcileResult, reconcileErr = r.registerChildren(ctx, plugin, result.Meta.Children, startIdx)
	case operator.ReconcileActionDeleted:
		reconcileResult, reconcileErr = r.unregisterChildren(ctx, plugin.Namespace, result.Meta.Children, startIdx)
	case operator.ReconcileActionUnknown:
		reconcileErr = fmt.Errorf("invalid action: %d", req.Action)
	default:
		reconcileErr = fmt.Errorf("invalid action: %d", req.Action)
	}

	// A zero RequeueAfter with no error means we're continuing to the next batch — count as success.
	// A positive RequeueAfter means an error retry is queued — count as error.
	status := "success"
	if reconcileErr != nil || (reconcileResult.RequeueAfter != nil && *reconcileResult.RequeueAfter > 0) {
		status = "error"
	}
	metrics.ChildReconciliationTotal.WithLabelValues(status, actionLabel(req.Action)).Inc()

	return reconcileResult, reconcileErr
}

func (r *ChildPluginReconciler) unregisterChildren(ctx context.Context, namespace string, children []string, startIdx int) (operator.ReconcileResult, error) {
	logger := r.logger.WithContext(ctx).With("requestNamespace", namespace)

	end := min(startIdx+childProcessingBatchSize, len(children))

	retry := false
	for _, childID := range children[startIdx:end] {
		if ctx.Err() != nil {
			d := requeueAfterWithJitter()
			return operator.ReconcileResult{RequeueAfter: &d, State: childState(startIdx)}, nil
		}
		err := r.registrar.Unregister(ctx, namespace, childID, SourceChildPluginReconciler)
		if err != nil && !errorsK8s.IsNotFound(err) {
			logger.Error("Failed to unregister child plugin", "error", err, "pluginId", childID)
			retry = true
		}
	}

	result := operator.ReconcileResult{}
	if retry {
		d := requeueAfterWithJitter()
		result.RequeueAfter = &d
		result.State = childState(startIdx)
	} else if end < len(children) {
		result.RequeueAfter = new(time.Duration)
		result.State = childState(end)
	}
	return result, nil
}

func (r *ChildPluginReconciler) registerChildren(ctx context.Context, parent *pluginsv0alpha1.Plugin, children []string, startIdx int) (operator.ReconcileResult, error) {
	logger := r.logger.WithContext(ctx).With("requestNamespace", parent.Namespace)

	end := min(startIdx+childProcessingBatchSize, len(children))

	retry := false
	for _, childID := range children[startIdx:end] {
		if ctx.Err() != nil {
			d := requeueAfterWithJitter()
			return operator.ReconcileResult{RequeueAfter: &d, State: childState(startIdx)}, nil
		}
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
		d := requeueAfterWithJitter()
		result.RequeueAfter = &d
		result.State = childState(startIdx)
	} else if end < len(children) {
		result.RequeueAfter = new(time.Duration)
		result.State = childState(end)
	}
	return result, nil
}

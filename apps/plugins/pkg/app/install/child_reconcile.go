package install

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	"github.com/grafana/grafana/apps/plugins/pkg/app/metrics"
)

const (
	maxChildConcurrency = 5

	childReconcilerStatusKey      = "child-plugin-reconciler"
	childStatusObservedGeneration = "observedGeneration"
	childStatusAppliedChildren    = "appliedChildren"

	childReconciliationStatusSuccess             = "success"
	childReconciliationStatusError               = "error"
	childReconciliationStatusSkippedShard        = "skipped_shard"
	childReconciliationStatusSkippedUpToDate     = "skipped_up_to_date"
	childReconciliationStatusSkippedMetaNotFound = "skipped_meta_not_found"
)

func ShouldHandlePlugin(plugin *pluginsv0alpha1.Plugin) bool {
	return plugin != nil && strings.HasSuffix(plugin.Spec.Id, "-app")
}

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

// ChildPluginReconciler reconciles Plugin resources and creates child plugin records.
type ChildPluginReconciler struct {
	operator.TypedReconciler[*pluginsv0alpha1.Plugin]
	metaManager     *meta.ProviderManager
	registrar       Registrar
	ownershipFilter OwnershipFilter
	logger          logging.Logger
}

type ChildPluginReconcilerFailureSource string

const (
	ChildPluginReconcilerFailureSourceOwnership      ChildPluginReconcilerFailureSource = "ownership"
	ChildPluginReconcilerFailureSourceMetadataLookup ChildPluginReconcilerFailureSource = "metadata_lookup"
	ChildPluginReconcilerFailureSourceApplyChildren  ChildPluginReconcilerFailureSource = "apply_children"
	ChildPluginReconcilerFailureSourceCleanup        ChildPluginReconcilerFailureSource = "cleanup"
)

type ChildPluginReconcilerError struct {
	Source    ChildPluginReconcilerFailureSource
	PluginID  string
	Version   string
	Namespace string
	Err       error
}

func (e *ChildPluginReconcilerError) Error() string {
	return fmt.Sprintf(
		"child plugin reconciliation failed: source=%s pluginId=%s version=%s namespace=%s: %v",
		e.Source,
		e.PluginID,
		e.Version,
		e.Namespace,
		e.Err,
	)
}

func (e *ChildPluginReconcilerError) Unwrap() error {
	return e.Err
}

func newChildPluginReconcilerError(
	source ChildPluginReconcilerFailureSource,
	plugin *pluginsv0alpha1.Plugin,
	err error,
) error {
	if err == nil {
		return nil
	}

	if plugin == nil {
		return &ChildPluginReconcilerError{
			Source: source,
			Err:    err,
		}
	}

	return &ChildPluginReconcilerError{
		Source:    source,
		PluginID:  plugin.Spec.Id,
		Version:   plugin.Spec.Version,
		Namespace: plugin.Namespace,
		Err:       err,
	}
}

// NewChildPluginReconciler creates a new ChildPluginReconciler instance.
func NewChildPluginReconciler(logger logging.Logger, metaManager *meta.ProviderManager, registrar Registrar, ownershipFilters ...OwnershipFilter) *ChildPluginReconciler {
	ownershipFilter := NewNoopOwnershipFilter()
	if len(ownershipFilters) > 0 && ownershipFilters[0] != nil {
		ownershipFilter = ownershipFilters[0]
	}

	reconciler := &ChildPluginReconciler{
		TypedReconciler: operator.TypedReconciler[*pluginsv0alpha1.Plugin]{},
		metaManager:     metaManager,
		registrar:       registrar,
		ownershipFilter: ownershipFilter,
		logger:          logger,
	}
	reconciler.ReconcileFunc = reconciler.reconcile
	return reconciler
}

type childReconcileResult struct {
	appliedChildren    []string
	observedGeneration int64
	state              pluginsv0alpha1.PluginStatusOperatorStateState
	description        *string
}

type childStoredState struct {
	appliedChildren    []string
	observedGeneration int64
	state              pluginsv0alpha1.PluginStatusOperatorStateState
}

func (s childStoredState) shouldSkipGeneration(generation int64) bool {
	return s.state == pluginsv0alpha1.PluginStatusOperatorStateStateSuccess &&
		s.observedGeneration != 0 &&
		s.observedGeneration == generation
}

// reconcile is the main reconciliation loop for ChildPlugin resources.
func (r *ChildPluginReconciler) reconcile(ctx context.Context, req operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin]) (operator.ReconcileResult, error) {
	start := time.Now()
	defer func() {
		metrics.ChildReconciliationDurationSeconds.Observe(time.Since(start).Seconds())
	}()

	plugin := req.Object
	baseLogger := r.logger.WithContext(ctx)

	if !ShouldHandlePlugin(plugin) {
		return operator.ReconcileResult{}, nil
	}

	if plugin.Spec.ParentId != nil && *plugin.Spec.ParentId != "" {
		return operator.ReconcileResult{}, nil
	}

	ctx, span := getTracer().Start(ctx, "child-reconciler.reconcile")
	span.SetAttributes(
		attribute.String("plugin.id", plugin.Spec.Id),
		attribute.String("plugin.namespace", plugin.Namespace),
		attribute.String("reconcile.action", actionLabel(req.Action)),
	)
	defer span.End()

	ownsPlugin, err := r.ownershipFilter.OwnsPlugin(ctx, plugin)
	if err != nil {
		err = newChildPluginReconcilerError(ChildPluginReconcilerFailureSourceOwnership, plugin, err)
		logger := baseLogger.With(
			"pluginId", plugin.Spec.Id,
			"requestNamespace", plugin.Namespace,
			"version", plugin.Spec.Version,
			"action", req.Action,
			"parentId", plugin.Spec.ParentId,
		)
		logger.Error("Failed to determine child reconciler shard ownership", "error", err)
		metrics.ChildReconciliationTotal.WithLabelValues(childReconciliationStatusError, actionLabel(req.Action), plugin.Spec.Id).Inc()
		return operator.ReconcileResult{}, err
	}
	if !ownsPlugin {
		metrics.ChildReconciliationTotal.WithLabelValues(childReconciliationStatusSkippedShard, actionLabel(req.Action), plugin.Spec.Id).Inc()
		return operator.ReconcileResult{}, nil
	}

	stored := getStoredChildState(plugin)
	if req.Action == operator.ReconcileActionUpdated && stored.shouldSkipGeneration(plugin.Generation) {
		metrics.ChildReconciliationTotal.WithLabelValues(childReconciliationStatusSkippedUpToDate, actionLabel(req.Action), plugin.Spec.Id).Inc()
		return operator.ReconcileResult{}, nil
	}

	outcome, shouldUpdateStatus, err := r.reconcileAction(ctx, req, plugin, stored)
	if errors.Is(err, meta.ErrMetaNotFound) {
		metrics.ChildReconciliationTotal.WithLabelValues(childReconciliationStatusSkippedMetaNotFound, actionLabel(req.Action), plugin.Spec.Id).Inc()
		return operator.ReconcileResult{}, nil
	}

	if shouldUpdateStatus {
		if statusErr := r.registrar.UpdateStatus(ctx, plugin, func(current *pluginsv0alpha1.Plugin) (pluginsv0alpha1.PluginStatus, bool) {
			status := buildChildReconcilerStatus(current, outcome)
			return status, childReconcilerStatusChanged(current.Status, status)
		}); statusErr != nil {
			err = errors.Join(err, statusErr)
		}
	}

	resultLabel := childReconciliationStatusSuccess
	if err != nil {
		resultLabel = childReconciliationStatusError
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
	}
	metrics.ChildReconciliationTotal.WithLabelValues(resultLabel, actionLabel(req.Action), plugin.Spec.Id).Inc()

	return operator.ReconcileResult{}, err
}

func (r *ChildPluginReconciler) reconcileAction(
	ctx context.Context,
	req operator.TypedReconcileRequest[*pluginsv0alpha1.Plugin],
	plugin *pluginsv0alpha1.Plugin,
	stored childStoredState,
) (childReconcileResult, bool, error) {
	switch req.Action {
	case operator.ReconcileActionCreated:
		return r.reconcileDesiredChildren(ctx, plugin, nil)
	case operator.ReconcileActionUpdated:
		return r.reconcileDesiredChildren(ctx, plugin, stored.appliedChildren)
	case operator.ReconcileActionResynced:
		if len(stored.appliedChildren) == 0 && stored.observedGeneration == 0 {
			return r.reconcileDesiredChildren(ctx, plugin, nil)
		}
		if stored.state != pluginsv0alpha1.PluginStatusOperatorStateStateSuccess ||
			stored.observedGeneration != plugin.Generation {
			return r.reconcileDesiredChildren(ctx, plugin, stored.appliedChildren)
		}
		return r.repairStoredChildren(ctx, plugin, stored)
	case operator.ReconcileActionDeleted:
		_, err := r.cleanupChildren(ctx, plugin.Namespace, stored.appliedChildren)
		if err != nil {
			err = newChildPluginReconcilerError(ChildPluginReconcilerFailureSourceCleanup, plugin, err)
		}
		return childReconcileResult{}, false, err
	case operator.ReconcileActionUnknown:
		return childReconcileResult{}, false, fmt.Errorf("invalid action: %d", req.Action)
	default:
		return childReconcileResult{}, false, fmt.Errorf("invalid action: %d", req.Action)
	}
}

func (r *ChildPluginReconciler) reconcileDesiredChildren(
	ctx context.Context,
	plugin *pluginsv0alpha1.Plugin,
	currentChildren []string,
) (childReconcileResult, bool, error) {
	desiredChildren, err := r.getDesiredChildren(ctx, plugin)
	if err != nil {
		if errors.Is(err, meta.ErrMetaNotFound) {
			return childReconcileResult{}, false, err
		}

		err = newChildPluginReconcilerError(ChildPluginReconcilerFailureSourceMetadataLookup, plugin, err)
		msg := err.Error()
		return childReconcileResult{
			appliedChildren:    normalizeChildren(currentChildren),
			observedGeneration: plugin.Generation,
			state:              pluginsv0alpha1.PluginStatusOperatorStateStateFailed,
			description:        &msg,
		}, true, err
	}

	hasChildren := len(desiredChildren) > 0
	if !hasChildren && len(currentChildren) == 0 {
		return childReconcileResult{}, false, nil
	}

	outcome, err := r.applyChildren(ctx, plugin, currentChildren, desiredChildren)
	if err != nil {
		err = newChildPluginReconcilerError(ChildPluginReconcilerFailureSourceApplyChildren, plugin, err)
		msg := err.Error()
		outcome.state = pluginsv0alpha1.PluginStatusOperatorStateStateFailed
		outcome.description = &msg
	} else {
		outcome.state = pluginsv0alpha1.PluginStatusOperatorStateStateSuccess
	}
	outcome.observedGeneration = plugin.Generation
	return outcome, true, err
}

func (r *ChildPluginReconciler) getDesiredChildren(ctx context.Context, plugin *pluginsv0alpha1.Plugin) ([]string, error) {
	ctx, span := getTracer().Start(ctx, "child-reconciler.getDesiredChildren")
	span.SetAttributes(
		attribute.String("plugin.id", plugin.Spec.Id),
		attribute.String("plugin.version", plugin.Spec.Version),
	)
	defer span.End()

	result, err := r.metaManager.GetMeta(ctx, meta.PluginRef{
		ID:      plugin.Spec.Id,
		Version: plugin.Spec.Version,
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	children := normalizeChildren(result.Meta.Children)
	span.SetAttributes(attribute.Int("children.count", len(children)))
	metrics.ChildrenCountPerReconcile.Observe(float64(len(children)))
	return children, nil
}

func (r *ChildPluginReconciler) cleanupChildren(ctx context.Context, namespace string, children []string) ([]string, error) {
	ctx, span := getTracer().Start(ctx, "child-reconciler.cleanupChildren")
	span.SetAttributes(
		attribute.String("plugin.namespace", namespace),
		attribute.Int("children.count", len(children)),
	)
	defer span.End()

	logger := r.logger.WithContext(ctx).With("requestNamespace", namespace)
	normalized := normalizeChildren(children)

	var (
		mu      sync.Mutex
		applied = sliceToSet(normalized)
		errs    []error
	)

	sem := make(chan struct{}, maxChildConcurrency)
	var wg sync.WaitGroup
	for _, childID := range normalized {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			err := r.registrar.Unregister(ctx, namespace, id, SourceChildPluginReconciler)
			mu.Lock()
			defer mu.Unlock()
			if err != nil && !errorsK8s.IsNotFound(err) {
				logger.Error("Failed to unregister child plugin", "error", err, "pluginId", id)
				errs = append(errs, err)
			} else {
				delete(applied, id)
			}
		}(childID)
	}
	wg.Wait()
	if ctxErr := ctx.Err(); ctxErr != nil {
		errs = append(errs, ctxErr)
	}

	err := errors.Join(errs...)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
	}
	return mapKeys(applied), err
}

func (r *ChildPluginReconciler) repairStoredChildren(
	ctx context.Context,
	parent *pluginsv0alpha1.Plugin,
	stored childStoredState,
) (childReconcileResult, bool, error) {
	ctx, span := getTracer().Start(ctx, "child-reconciler.repairStoredChildren")
	span.SetAttributes(
		attribute.String("plugin.namespace", parent.Namespace),
		attribute.Int("children.count", len(stored.appliedChildren)),
	)
	defer span.End()

	logger := r.logger.WithContext(ctx).With("requestNamespace", parent.Namespace)
	appliedChildren := normalizeChildren(stored.appliedChildren)

	outcome := childReconcileResult{
		appliedChildren:    appliedChildren,
		observedGeneration: parent.Generation,
	}
	if err := r.ensureChildrenMatchExpected(ctx, parent, appliedChildren, logger, "repair"); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		msg := err.Error()
		outcome.state = pluginsv0alpha1.PluginStatusOperatorStateStateFailed
		outcome.description = &msg
		return outcome, true, err
	}

	outcome.state = pluginsv0alpha1.PluginStatusOperatorStateStateSuccess
	return outcome, true, nil
}

func (r *ChildPluginReconciler) applyChildren(
	ctx context.Context,
	parent *pluginsv0alpha1.Plugin,
	currentChildren []string,
	desiredChildren []string,
) (childReconcileResult, error) {
	ctx, span := getTracer().Start(ctx, "child-reconciler.applyChildren")
	span.SetAttributes(attribute.String("plugin.namespace", parent.Namespace))
	defer span.End()

	logger := r.logger.WithContext(ctx).With("requestNamespace", parent.Namespace)

	currentChildren = normalizeChildren(currentChildren)
	desiredChildren = normalizeChildren(desiredChildren)
	span.SetAttributes(
		attribute.Int("children.current_count", len(currentChildren)),
		attribute.Int("children.desired_count", len(desiredChildren)),
	)
	desiredSet := sliceToSet(desiredChildren)

	var (
		mu      sync.Mutex
		applied = sliceToSet(currentChildren)
		errs    []error
	)

	sem := make(chan struct{}, maxChildConcurrency)
	var wg sync.WaitGroup

	for _, childID := range currentChildren {
		if _, ok := desiredSet[childID]; ok {
			continue
		}
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			err := r.registrar.Unregister(ctx, parent.Namespace, id, SourceChildPluginReconciler)
			mu.Lock()
			defer mu.Unlock()
			if err != nil && !errorsK8s.IsNotFound(err) {
				logger.Error("Failed to unregister child plugin", "error", err, "pluginId", id)
				errs = append(errs, err)
			} else {
				delete(applied, id)
			}
		}(childID)
	}
	wg.Wait()

	if ctxErr := ctx.Err(); ctxErr != nil {
		errs = append(errs, ctxErr)
	} else if slices.Equal(currentChildren, desiredChildren) {
		errs = append(errs, r.ensureChildrenMatchExpected(ctx, parent, desiredChildren, logger, "update"))
	} else {
		for _, childID := range desiredChildren {
			wg.Add(1)
			go func(id string) {
				defer wg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()
				err := r.registrar.Register(ctx, parent.Namespace, r.childInstall(parent, id))
				mu.Lock()
				defer mu.Unlock()
				if err != nil {
					logger.Error("Failed to register child plugin", "error", err, "pluginId", id)
					errs = append(errs, err)
				} else {
					applied[id] = struct{}{}
				}
			}(childID)
		}
		wg.Wait()
		if ctxErr := ctx.Err(); ctxErr != nil {
			errs = append(errs, ctxErr)
		}
	}

	err := errors.Join(errs...)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
	}
	return childReconcileResult{
		appliedChildren: normalizeChildren(mapKeys(applied)),
	}, err
}

func (r *ChildPluginReconciler) ensureChildrenMatchExpected(
	ctx context.Context,
	parent *pluginsv0alpha1.Plugin,
	childIDs []string,
	logger logging.Logger,
	logAction string,
) error {
	var (
		mu   sync.Mutex
		errs []error
	)

	sem := make(chan struct{}, maxChildConcurrency)
	var wg sync.WaitGroup
	for _, childID := range normalizeChildren(childIDs) {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			expected := r.childInstall(parent, id)
			existing, err := r.registrar.Get(ctx, parent.Namespace, id)
			switch {
			case errorsK8s.IsNotFound(err):
				err = r.registrar.Register(ctx, parent.Namespace, expected)
			case err != nil:
				logger.Error("Failed to get child plugin", "error", err, "pluginId", id, "action", logAction)
				mu.Lock()
				errs = append(errs, err)
				mu.Unlock()
				return
			case !expected.MatchesSpec(existing) || existing.Annotations[PluginInstallSourceAnnotation] != SourceChildPluginReconciler:
				err = r.registrar.Register(ctx, parent.Namespace, expected)
			default:
				return
			}

			if err != nil {
				logger.Error("Failed to ensure child plugin matches expected state", "error", err, "pluginId", id, "action", logAction)
				mu.Lock()
				errs = append(errs, err)
				mu.Unlock()
			}
		}(childID)
	}
	wg.Wait()
	if ctxErr := ctx.Err(); ctxErr != nil {
		mu.Lock()
		errs = append(errs, ctxErr)
		mu.Unlock()
	}

	return errors.Join(errs...)
}

func (r *ChildPluginReconciler) childInstall(parent *pluginsv0alpha1.Plugin, childID string) *PluginInstall {
	return &PluginInstall{
		ID:       childID,
		Version:  parent.Spec.Version,
		ParentID: parent.Spec.Id,
		Source:   SourceChildPluginReconciler,
	}
}

func buildChildReconcilerStatus(plugin *pluginsv0alpha1.Plugin, result childReconcileResult) pluginsv0alpha1.PluginStatus {
	status := plugin.Status
	if status.OperatorStates == nil {
		status.OperatorStates = make(map[string]pluginsv0alpha1.PluginstatusOperatorState)
	} else {
		status.OperatorStates = cloneOperatorStates(status.OperatorStates)
	}
	status.ChildAppliedChildren = normalizeChildren(result.appliedChildren)
	if result.observedGeneration != 0 {
		status.ChildObservedGeneration = &result.observedGeneration
	} else {
		status.ChildObservedGeneration = nil
	}

	status.OperatorStates[childReconcilerStatusKey] = pluginsv0alpha1.PluginstatusOperatorState{
		LastEvaluation:   plugin.ResourceVersion,
		State:            result.state,
		DescriptiveState: result.description,
	}

	return status
}

func cloneOperatorStates(states map[string]pluginsv0alpha1.PluginstatusOperatorState) map[string]pluginsv0alpha1.PluginstatusOperatorState {
	cloned := make(map[string]pluginsv0alpha1.PluginstatusOperatorState, len(states))
	for key, state := range states {
		cloned[key] = pluginsv0alpha1.PluginstatusOperatorState{
			LastEvaluation:   state.LastEvaluation,
			State:            state.State,
			DescriptiveState: state.DescriptiveState,
			Details:          cloneDetails(state.Details),
		}
	}
	return cloned
}

func cloneDetails(details map[string]interface{}) map[string]interface{} {
	if details == nil {
		return nil
	}

	cloned := make(map[string]interface{}, len(details))
	for key, value := range details {
		if children, ok := value.([]string); ok {
			cloned[key] = append([]string(nil), children...)
			continue
		}
		cloned[key] = value
	}
	return cloned
}

func childReconcilerStatusChanged(current, desired pluginsv0alpha1.PluginStatus) bool {
	currentState, currentOK := current.OperatorStates[childReconcilerStatusKey]
	desiredState, desiredOK := desired.OperatorStates[childReconcilerStatusKey]
	if currentOK != desiredOK {
		return true
	}
	if !currentOK {
		return false
	}

	return currentState.State != desiredState.State ||
		!equalOptionalStrings(currentState.DescriptiveState, desiredState.DescriptiveState) ||
		!reflect.DeepEqual(currentState.Details, desiredState.Details) ||
		!reflect.DeepEqual(current.ChildAppliedChildren, desired.ChildAppliedChildren) ||
		!equalOptionalInt64(current.ChildObservedGeneration, desired.ChildObservedGeneration)
}

func equalOptionalStrings(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func equalOptionalInt64(a, b *int64) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func getStoredChildState(plugin *pluginsv0alpha1.Plugin) childStoredState {
	if plugin.Status.OperatorStates == nil {
		return childStoredState{
			appliedChildren:    normalizeChildren(plugin.Status.ChildAppliedChildren),
			observedGeneration: derefInt64(plugin.Status.ChildObservedGeneration),
		}
	}

	operatorState, ok := plugin.Status.OperatorStates[childReconcilerStatusKey]
	if !ok {
		return childStoredState{
			appliedChildren:    normalizeChildren(plugin.Status.ChildAppliedChildren),
			observedGeneration: derefInt64(plugin.Status.ChildObservedGeneration),
		}
	}

	appliedChildren := normalizeChildren(plugin.Status.ChildAppliedChildren)
	if len(appliedChildren) == 0 {
		appliedChildren = normalizeChildren(extractStringSlice(operatorState.Details[childStatusAppliedChildren]))
	}

	observedGeneration := derefInt64(plugin.Status.ChildObservedGeneration)
	if observedGeneration == 0 {
		observedGeneration = extractGeneration(operatorState.Details[childStatusObservedGeneration])
	}

	return childStoredState{
		appliedChildren:    appliedChildren,
		observedGeneration: observedGeneration,
		state:              operatorState.State,
	}
}

func derefInt64(value *int64) int64 {
	if value == nil {
		return 0
	}
	return *value
}

func extractGeneration(value interface{}) int64 {
	switch v := value.(type) {
	case string:
		generation, _ := strconv.ParseInt(v, 10, 64)
		return generation
	case int:
		return int64(v)
	case int64:
		return v
	case float64:
		return int64(v)
	default:
		return 0
	}
}

func extractStringSlice(value interface{}) []string {
	switch v := value.(type) {
	case []string:
		return append([]string(nil), v...)
	case []interface{}:
		values := make([]string, 0, len(v))
		for _, item := range v {
			s, ok := item.(string)
			if ok && s != "" {
				values = append(values, s)
			}
		}
		return values
	default:
		return nil
	}
}

func normalizeChildren(children []string) []string {
	if len(children) == 0 {
		return nil
	}

	sorted := append([]string(nil), children...)
	sort.Strings(sorted)

	result := sorted[:0]
	var last string
	for _, child := range sorted {
		if child == "" || child == last {
			continue
		}
		result = append(result, child)
		last = child
	}
	if len(result) == 0 {
		return nil
	}
	return append([]string(nil), result...)
}

func sliceToSet(values []string) map[string]struct{} {
	set := make(map[string]struct{}, len(values))
	for _, value := range values {
		if value == "" {
			continue
		}
		set[value] = struct{}{}
	}
	return set
}

func mapKeys(values map[string]struct{}) []string {
	keys := make([]string, 0, len(values))
	for value := range values {
		keys = append(keys, value)
	}
	sort.Strings(keys)
	return keys
}

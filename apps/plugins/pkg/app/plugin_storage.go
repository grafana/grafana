package app

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	apiequality "k8s.io/apimachinery/pkg/api/equality"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/util/dryrun"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

const (
	parentIDLabel                 = "plugins.grafana.app/parent-id"
	dependencyLabel               = "plugins.grafana.app/dependency"
	appliedChildrenAnnotation     = "plugins.grafana.app/applied-children"
	appliedDependenciesAnnotation = install.AppliedDependenciesAnnotation
	dependencyParentsAnnotation   = install.DependencyParentsAnnotation
	dependencyPluginVersion       = install.DependencyPluginVersion
	pluginStorageHookTimeout      = 30 * time.Second
	pluginAttributeID             = "grafana.plugin.id"
	pluginAttributeVersion        = "grafana.plugin.version"
	pluginAttributeNamespace      = "grafana.plugin.namespace"
	pluginAttributeCleanupReason  = "grafana.plugin.cleanup.reason"
	pluginCleanupReasonMissing    = "missing_applied_annotation"

	// appPluginIDSuffix is the suffix used by app plugins. Only app plugins can
	// own child plugins, so child reconciliation uses the suffix as a fast path.
	appPluginIDSuffix = "-app"
)

var pluginStorageTracer = otel.Tracer("github.com/grafana/grafana/apps/plugins/pkg/app/plugin-storage")

type pluginStorage interface {
	rest.Getter
	rest.Lister
	rest.Creater
	rest.Updater
	rest.GracefulDeleter
}

// PluginStorageBeginHookProvider receives pre-commit plugin storage lifecycle
// callbacks. Mutations made in these hooks are persisted with the storage
// operation when it succeeds.
type PluginStorageBeginHookProvider interface {
	BeginCreate(ctx context.Context, plugin *pluginsv0alpha1.Plugin, options *metav1.CreateOptions) (genericregistry.FinishFunc, error)
	BeginUpdate(ctx context.Context, plugin, oldPlugin *pluginsv0alpha1.Plugin, options *metav1.UpdateOptions) (genericregistry.FinishFunc, error)
}

// PluginStorageAfterHookProvider receives post-commit plugin storage lifecycle
// callbacks. Mutations to the plugin they receive are not persisted, so they
// can only return an error (which is logged, never surfaced to the API caller).
type PluginStorageAfterHookProvider interface {
	AfterCreate(ctx context.Context, plugin *pluginsv0alpha1.Plugin, options *metav1.CreateOptions) error
	AfterUpdate(ctx context.Context, plugin *pluginsv0alpha1.Plugin, options *metav1.UpdateOptions) error
	AfterDelete(ctx context.Context, plugin *pluginsv0alpha1.Plugin, options *metav1.DeleteOptions) error
}

// PluginStorageHookProvider is the full default hook provider shape.
type PluginStorageHookProvider interface {
	PluginStorageBeginHookProvider
	PluginStorageAfterHookProvider
}

type pluginStorageHookProvider struct {
	storage pluginStorage

	logger      logging.Logger
	metaManager *meta.ProviderManager
}

func newPluginStorage(
	wrapped rest.Storage,
	logger logging.Logger,
	metaManager *meta.ProviderManager,
	wrapAfter func(base PluginStorageAfterHookProvider) PluginStorageAfterHookProvider,
) (rest.Storage, error) {
	store, ok := wrapped.(*genericregistry.Store)
	if !ok {
		return nil, fmt.Errorf("plugin storage must be *genericregistry.Store, got %T", wrapped)
	}
	hookProvider := NewDefaultPluginStorageHookProvider(store, logger, metaManager)
	beginHooks := PluginStorageBeginHookProvider(hookProvider)
	afterHooks := PluginStorageAfterHookProvider(hookProvider)
	if wrapAfter != nil {
		afterHooks = wrapAfter(afterHooks)
	}
	registerPluginStorageHooks(store, logger, beginHooks, afterHooks)
	return store, nil
}

func NewDefaultPluginStorageHookProvider(storage pluginStorage, logger logging.Logger, metaManager *meta.ProviderManager) PluginStorageHookProvider {
	return &pluginStorageHookProvider{
		storage:     storage,
		logger:      logger,
		metaManager: metaManager,
	}
}

func registerPluginStorageHooks(store *genericregistry.Store, logger logging.Logger, beginHooks PluginStorageBeginHookProvider, afterHooks PluginStorageAfterHookProvider) {
	beginCreate := store.BeginCreate
	store.BeginCreate = func(ctx context.Context, obj runtime.Object, options *metav1.CreateOptions) (genericregistry.FinishFunc, error) {
		finish := finishNoOp
		if beginCreate != nil {
			var err error
			finish, err = beginCreate(ctx, obj, options)
			if err != nil {
				return nil, err
			}
		}
		hookFinish := finishNoOp
		if plugin, ok := pluginFromRuntimeObject(obj); ok {
			var err error
			hookFinish, err = beginHooks.BeginCreate(ctx, plugin, options)
			if err != nil {
				// The original begin already succeeded; per the FinishFunc
				// contract its finish must still run with success=false.
				finish(ctx, false)
				return nil, err
			}
			if hookFinish == nil {
				hookFinish = finishNoOp
			}
		}

		return func(ctx context.Context, success bool) {
			finish(ctx, success)
			hookFinish(ctx, success)
		}, nil
	}

	afterCreate := store.AfterCreate
	store.AfterCreate = func(obj runtime.Object, options *metav1.CreateOptions) {
		if afterCreate != nil {
			afterCreate(obj, options)
		}
		plugin, ok := pluginFromRuntimeObject(obj)
		if !ok {
			return
		}
		ctx, finish := newPluginStorageHookContext(plugin.Namespace, "pluginStorage.afterCreate", logger)
		finish(afterHooks.AfterCreate(ctx, plugin, options))
	}

	beginUpdate := store.BeginUpdate
	store.BeginUpdate = func(ctx context.Context, obj, old runtime.Object, options *metav1.UpdateOptions) (genericregistry.FinishFunc, error) {
		finish := finishNoOp
		if beginUpdate != nil {
			var err error
			finish, err = beginUpdate(ctx, obj, old, options)
			if err != nil {
				return nil, err
			}
		}
		hookFinish := finishNoOp
		if plugin, ok := pluginFromRuntimeObject(obj); ok {
			oldPlugin, _ := pluginFromRuntimeObject(old)
			var err error
			hookFinish, err = beginHooks.BeginUpdate(ctx, plugin, oldPlugin, options)
			if err != nil {
				// The original begin already succeeded; per the FinishFunc
				// contract its finish must still run with success=false.
				finish(ctx, false)
				return nil, err
			}
			if hookFinish == nil {
				hookFinish = finishNoOp
			}
		}

		return func(ctx context.Context, success bool) {
			finish(ctx, success)
			hookFinish(ctx, success)
		}, nil
	}

	afterUpdate := store.AfterUpdate
	store.AfterUpdate = func(obj runtime.Object, options *metav1.UpdateOptions) {
		if afterUpdate != nil {
			afterUpdate(obj, options)
		}
		plugin, ok := pluginFromRuntimeObject(obj)
		if !ok {
			return
		}
		ctx, finish := newPluginStorageHookContext(plugin.Namespace, "pluginStorage.afterUpdate", logger)
		finish(afterHooks.AfterUpdate(ctx, plugin, options))
	}

	afterDelete := store.AfterDelete
	store.AfterDelete = func(obj runtime.Object, options *metav1.DeleteOptions) {
		if afterDelete != nil {
			afterDelete(obj, options)
		}
		plugin, ok := pluginFromRuntimeObject(obj)
		if !ok {
			return
		}
		ctx, finish := newPluginStorageHookContext(plugin.Namespace, "pluginStorage.afterDelete", logger)
		err := afterHooks.AfterDelete(ctx, plugin, options)
		finish(err)
	}
}

func (h *pluginStorageHookProvider) BeginCreate(ctx context.Context, plugin *pluginsv0alpha1.Plugin, _ *metav1.CreateOptions) (genericregistry.FinishFunc, error) {
	if !IsChildPlugin(plugin) {
		normalizePluginID(plugin)
		h.stampDesiredRelations(ctx, plugin, nil)
	}

	return finishNoOp, nil
}

func (h *pluginStorageHookProvider) AfterCreate(ctx context.Context, plugin *pluginsv0alpha1.Plugin, options *metav1.CreateOptions) error {
	if isCreateDryRun(options) {
		return nil
	}
	if IsChildPlugin(plugin) {
		return nil
	}
	normalizePluginID(plugin)
	if isAppPlugin(plugin) {
		if err := h.applyChildren(ctx, plugin); err != nil {
			return err
		}
	}
	return h.applyDependencies(ctx, plugin)
}

func (h *pluginStorageHookProvider) BeginUpdate(ctx context.Context, plugin, oldPlugin *pluginsv0alpha1.Plugin, _ *metav1.UpdateOptions) (genericregistry.FinishFunc, error) {
	if !IsChildPlugin(plugin) {
		normalizePluginID(plugin)
		h.stampDesiredRelations(ctx, plugin, oldPlugin)
	}

	return finishNoOp, nil
}

func (h *pluginStorageHookProvider) AfterUpdate(ctx context.Context, plugin *pluginsv0alpha1.Plugin, options *metav1.UpdateOptions) error {
	if isUpdateDryRun(options) {
		return nil
	}
	if IsChildPlugin(plugin) {
		return nil
	}
	normalizePluginID(plugin)
	if isAppPlugin(plugin) {
		if err := h.applyChildren(ctx, plugin); err != nil {
			return err
		}
	}
	return h.applyDependencies(ctx, plugin)
}

func (h *pluginStorageHookProvider) AfterDelete(ctx context.Context, plugin *pluginsv0alpha1.Plugin, options *metav1.DeleteOptions) error {
	if isDeleteDryRun(options) {
		return nil
	}
	if IsChildPlugin(plugin) {
		return nil
	}
	if isAppPlugin(plugin) {
		if err := h.deleteChildren(ctx, plugin.Annotations); err != nil {
			return fmt.Errorf("delete child plugins for %q: %w", plugin.Spec.Id, err)
		}
	}
	return h.removeAppliedDependencyParents(ctx, plugin.Spec.Id, plugin.Annotations)
}

func finishNoOp(context.Context, bool) {}

func isCreateDryRun(options *metav1.CreateOptions) bool {
	return options != nil && dryrun.IsDryRun(options.DryRun)
}

func isUpdateDryRun(options *metav1.UpdateOptions) bool {
	return options != nil && dryrun.IsDryRun(options.DryRun)
}

func isDeleteDryRun(options *metav1.DeleteOptions) bool {
	return options != nil && dryrun.IsDryRun(options.DryRun)
}

func (h *pluginStorageHookProvider) applyChildren(ctx context.Context, plugin *pluginsv0alpha1.Plugin) error {
	if err := h.reconcileChildren(ctx, plugin); err != nil {
		return fmt.Errorf("apply child plugins for %q: %w", plugin.Spec.Id, err)
	}
	return nil
}

func (h *pluginStorageHookProvider) deleteChildren(ctx context.Context, annotations map[string]string) error {
	for _, childID := range parseAppliedChildren(annotations) {
		if _, _, err := h.storage.Delete(ctx, childID, nil, &metav1.DeleteOptions{}); err != nil && !errorsK8s.IsNotFound(err) {
			return fmt.Errorf("delete child plugin %q: %w", childID, err)
		}
	}
	return nil
}

// pluginFromRuntimeObject returns the typed plugin behind a storage hook
// object. The store decodes every request into the kind's typed zero value, so
// hooks only ever see *pluginsv0alpha1.Plugin; anything else is skipped. Do
// not add a conversion fallback here: Begin* hooks mutate the plugin in place,
// and mutating a converted copy would silently be lost.
func pluginFromRuntimeObject(obj runtime.Object) (*pluginsv0alpha1.Plugin, bool) {
	plugin, ok := obj.(*pluginsv0alpha1.Plugin)
	return plugin, ok
}

// stampDesiredRelations writes the child and dependency plugins the parent
// should currently own onto the parent's annotations. Called before the
// Create/Update reaches the underlying storage so the annotations land in the
// same write — the caller's returned object already carries them.
//
// On meta lookup failure, the previous object's annotation is preserved so a
// transient meta outage during Update doesn't cause stale cleanup to wipe
// every child or dependency marker.
func (h *pluginStorageHookProvider) stampDesiredRelations(ctx context.Context, plugin, previous *pluginsv0alpha1.Plugin) {
	result, err := h.metaManager.GetMeta(ctx, meta.PluginRef{
		ID:      plugin.Spec.Id,
		Version: plugin.Spec.Version,
	})
	if err == nil {
		if isAppPlugin(plugin) {
			setAnnotation(plugin, appliedChildrenAnnotation, strings.Join(result.Meta.Children, ","))
		}
		stampAppliedDependencies(plugin, previous, pluginDependencyIDs(result.Meta))
		return
	}
	if !errors.Is(err, meta.ErrMetaNotFound) {
		h.logger.WithContext(ctx).Warn("Failed to look up plugin relation metadata; preserving previous applied relation annotations", "error", err, "pluginId", plugin.Spec.Id)
	}
	if previous == nil {
		return
	}
	if isAppPlugin(plugin) {
		if existing, ok := previous.Annotations[appliedChildrenAnnotation]; ok {
			setAnnotation(plugin, appliedChildrenAnnotation, existing)
		}
	}
	if existing, ok := previous.Annotations[appliedDependenciesAnnotation]; ok {
		setAnnotation(plugin, appliedDependenciesAnnotation, existing)
	}
}

func stampAppliedDependencies(plugin, previous *pluginsv0alpha1.Plugin, dependencies []string) {
	if len(dependencies) > 0 {
		setAnnotation(plugin, appliedDependenciesAnnotation, strings.Join(dependencies, ","))
		return
	}
	if previous != nil && len(parseAppliedDependencies(previous.Annotations)) > 0 {
		setAnnotation(plugin, appliedDependenciesAnnotation, "")
		return
	}
	if plugin.Annotations != nil {
		delete(plugin.Annotations, appliedDependenciesAnnotation)
	}
}

// reconcileChildren upserts each child listed in the parent's applied-children
// annotation and deletes any child this parent currently owns (matched by the
// parent-id label) that is no longer desired.
//
// Cleanup is driven by listing the parent's children via the parent-id label
// rather than diffing a previously-applied set: the post-commit AfterUpdate
// hook only sees the new parent object, not its prior annotation, so a label
// list is the only reliable way to find children that should be removed. When
// the applied-children annotation is absent the desired set is unknown (e.g. a
// meta lookup failed and left it unstamped), so deletions are skipped to avoid
// wiping children during a transient outage.
func (h *pluginStorageHookProvider) reconcileChildren(ctx context.Context, parent *pluginsv0alpha1.Plugin) error {
	ctx, span := pluginStorageTracer.Start(ctx, "reconcileChildren")
	defer span.End()

	desired := parseAppliedChildren(parent.Annotations)
	span.SetAttributes(
		attribute.String(pluginAttributeID, parent.Spec.Id),
		attribute.String(pluginAttributeVersion, parent.Spec.Version),
		attribute.String(pluginAttributeNamespace, pluginNamespace(ctx, parent)),
	)

	desiredSet := make(map[string]struct{}, len(desired))
	for _, childID := range desired {
		desiredSet[childID] = struct{}{}
		if err := h.upsertChildPlugin(ctx, parent, childID); err != nil {
			return fmt.Errorf("upsert child plugin %q: %w", childID, err)
		}
	}

	// Without a stamped annotation the desired set is unknown, so deleting here
	// would wipe children during a transient meta outage. Skip cleanup.
	if _, known := parent.Annotations[appliedChildrenAnnotation]; !known {
		span.AddEvent("cleanup_skipped", trace.WithAttributes(
			attribute.String(pluginAttributeCleanupReason, pluginCleanupReasonMissing),
		))
		return nil
	}

	owned, err := h.listOwnedChildren(ctx, parent)
	if err != nil {
		return fmt.Errorf("list owned child plugins: %w", err)
	}
	for _, childID := range owned {
		if _, ok := desiredSet[childID]; ok {
			continue
		}
		if _, _, err := h.storage.Delete(ctx, childID, nil, &metav1.DeleteOptions{}); err != nil && !errorsK8s.IsNotFound(err) {
			return fmt.Errorf("delete stale child plugin %q: %w", childID, err)
		}
	}

	return nil
}

// listOwnedChildren returns the names of plugins currently labelled as children
// of the given parent.
func (h *pluginStorageHookProvider) listOwnedChildren(ctx context.Context, parent *pluginsv0alpha1.Plugin) ([]string, error) {
	selector := labels.SelectorFromSet(labels.Set{parentIDLabel: parent.Spec.Id})
	obj, err := h.storage.List(ctx, &metainternalversion.ListOptions{LabelSelector: selector})
	if err != nil {
		return nil, err
	}
	list, ok := obj.(*pluginsv0alpha1.PluginList)
	if !ok {
		return nil, fmt.Errorf("expected *pluginsv0alpha1.PluginList, got %T", obj)
	}
	names := make([]string, 0, len(list.Items))
	for i := range list.Items {
		names = append(names, list.Items[i].Name)
	}
	return names, nil
}

func (h *pluginStorageHookProvider) getPlugin(ctx context.Context, name string) (*pluginsv0alpha1.Plugin, error) {
	obj, err := h.storage.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	plugin, ok := obj.(*pluginsv0alpha1.Plugin)
	if !ok {
		return nil, fmt.Errorf("expected *pluginsv0alpha1.Plugin, got %T", obj)
	}
	return plugin, nil
}

func (h *pluginStorageHookProvider) upsertChildPlugin(ctx context.Context, parent *pluginsv0alpha1.Plugin, childID string) error {
	namespace := pluginNamespace(ctx, parent)
	existing, err := h.getPlugin(ctx, childID)
	if err != nil && !errorsK8s.IsNotFound(err) {
		return err
	}

	expected := childPluginForParent(parent, namespace, childID)
	if existing == nil {
		_, err = h.storage.Create(ctx, expected, nil, &metav1.CreateOptions{})
		if errorsK8s.IsAlreadyExists(err) {
			return nil
		}
		return err
	}

	updated := existing.DeepCopy()
	updated.Labels = mergeStringMap(existing.Labels, expected.Labels)
	updated.Annotations = mergeStringMap(existing.Annotations, expected.Annotations)
	updated.Spec.Version = expected.Spec.Version
	updated.Spec.ParentId = expected.Spec.ParentId

	_, _, err = h.storage.Update(ctx, childID, rest.DefaultUpdatedObjectInfo(updated), nil, nil, false, &metav1.UpdateOptions{})
	return err
}

func childPluginForParent(parent *pluginsv0alpha1.Plugin, namespace string, childID string) *pluginsv0alpha1.Plugin {
	parentID := parent.Spec.Id
	child := (&install.PluginInstall{
		ID:       childID,
		Version:  parent.Spec.Version,
		Source:   install.SourceChildPlugin,
		ParentID: parentID,
	}).ToPluginInstallV0Alpha1(namespace)
	child.Labels = map[string]string{
		parentIDLabel: parentID,
	}
	return child
}

func (h *pluginStorageHookProvider) applyDependencies(ctx context.Context, parent *pluginsv0alpha1.Plugin) error {
	if err := h.reconcileDependencies(ctx, parent); err != nil {
		return fmt.Errorf("apply dependency plugins for %q: %w", parent.Spec.Id, err)
	}
	return nil
}

func (h *pluginStorageHookProvider) reconcileDependencies(ctx context.Context, parent *pluginsv0alpha1.Plugin) error {
	ctx, span := pluginStorageTracer.Start(ctx, "reconcileDependencies")
	defer span.End()

	desired := parseAppliedDependencies(parent.Annotations)
	span.SetAttributes(
		attribute.String(pluginAttributeID, parent.Spec.Id),
		attribute.String(pluginAttributeVersion, parent.Spec.Version),
		attribute.String(pluginAttributeNamespace, pluginNamespace(ctx, parent)),
	)

	desiredSet := make(map[string]struct{}, len(desired))
	for _, dependencyID := range desired {
		if dependencyID == "" || dependencyID == parent.Spec.Id {
			continue
		}
		desiredSet[dependencyID] = struct{}{}
		if err := h.upsertDependencyPlugin(ctx, parent, dependencyID); err != nil {
			return fmt.Errorf("upsert dependency plugin %q: %w", dependencyID, err)
		}
	}

	if _, known := parent.Annotations[appliedDependenciesAnnotation]; !known {
		span.AddEvent("cleanup_skipped", trace.WithAttributes(
			attribute.String(pluginAttributeCleanupReason, pluginCleanupReasonMissing),
		))
		return nil
	}

	owned, err := h.listOwnedDependencies(ctx, parent)
	if err != nil {
		return fmt.Errorf("list owned dependency plugins: %w", err)
	}
	for _, dependencyID := range owned {
		if _, ok := desiredSet[dependencyID]; ok {
			continue
		}
		if err := h.removeDependencyParent(ctx, parent.Spec.Id, dependencyID); err != nil {
			return fmt.Errorf("remove dependency parent %q from %q: %w", parent.Spec.Id, dependencyID, err)
		}
	}

	return nil
}

func (h *pluginStorageHookProvider) upsertDependencyPlugin(ctx context.Context, parent *pluginsv0alpha1.Plugin, dependencyID string) error {
	namespace := pluginNamespace(ctx, parent)
	parentID := parent.Spec.Id
	if parentID == "" || dependencyID == "" || parentID == dependencyID {
		return nil
	}

	existing, err := h.getPlugin(ctx, dependencyID)
	if err != nil && !errorsK8s.IsNotFound(err) {
		return err
	}

	expected := dependencyPluginForParent(parent, namespace, dependencyID)
	if existing == nil {
		_, err = h.storage.Create(ctx, expected, nil, &metav1.CreateOptions{})
		if err == nil {
			return nil
		}
		if !errorsK8s.IsAlreadyExists(err) {
			return err
		}
		existing, err = h.getPlugin(ctx, dependencyID)
		if err != nil {
			return err
		}
	}

	updated := existing.DeepCopy()
	addDependencyParent(updated, parentID)
	if existing.Annotations[install.PluginInstallSourceAnnotation] == install.SourceDependencyPlugin {
		updated.Spec.Version = expected.Spec.Version
	}

	if apiequality.Semantic.DeepEqual(existing, updated) {
		return nil
	}

	_, _, err = h.storage.Update(ctx, dependencyID, rest.DefaultUpdatedObjectInfo(updated), nil, nil, false, &metav1.UpdateOptions{})
	return err
}

func dependencyPluginForParent(parent *pluginsv0alpha1.Plugin, namespace string, dependencyID string) *pluginsv0alpha1.Plugin {
	dependency := (&install.PluginInstall{
		ID:      dependencyID,
		Version: dependencyPluginVersion,
		Source:  install.SourceDependencyPlugin,
	}).ToPluginInstallV0Alpha1(namespace)
	addDependencyParent(dependency, parent.Spec.Id)
	return dependency
}

func (h *pluginStorageHookProvider) listOwnedDependencies(ctx context.Context, parent *pluginsv0alpha1.Plugin) ([]string, error) {
	selector := labels.SelectorFromSet(labels.Set{dependencyLabel: "true"})
	obj, err := h.storage.List(ctx, &metainternalversion.ListOptions{LabelSelector: selector})
	if err != nil {
		return nil, err
	}
	list, ok := obj.(*pluginsv0alpha1.PluginList)
	if !ok {
		return nil, fmt.Errorf("expected *pluginsv0alpha1.PluginList, got %T", obj)
	}
	names := make([]string, 0, len(list.Items))
	for i := range list.Items {
		if hasDependencyParent(&list.Items[i], parent.Spec.Id) {
			names = append(names, list.Items[i].Name)
		}
	}
	return names, nil
}

func (h *pluginStorageHookProvider) removeAppliedDependencyParents(ctx context.Context, parentID string, annotations map[string]string) error {
	for _, dependencyID := range parseAppliedDependencies(annotations) {
		if err := h.removeDependencyParent(ctx, parentID, dependencyID); err != nil {
			return fmt.Errorf("remove dependency parent %q from %q: %w", parentID, dependencyID, err)
		}
	}

	return nil
}

func (h *pluginStorageHookProvider) removeDependencyParent(ctx context.Context, parentID, dependencyID string) error {
	if parentID == "" || dependencyID == "" || parentID == dependencyID {
		return nil
	}
	existing, err := h.getPlugin(ctx, dependencyID)
	if errorsK8s.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if !hasDependencyParent(existing, parentID) {
		return nil
	}

	updated := existing.DeepCopy()
	dropDependencyParent(updated, parentID)

	if len(parseDependencyParents(updated.Annotations)) == 0 && existing.Annotations[install.PluginInstallSourceAnnotation] == install.SourceDependencyPlugin {
		_, _, err = h.storage.Delete(ctx, dependencyID, nil, &metav1.DeleteOptions{})
		if errorsK8s.IsNotFound(err) {
			return nil
		}
		return err
	}

	_, _, err = h.storage.Update(ctx, dependencyID, rest.DefaultUpdatedObjectInfo(updated), nil, nil, false, &metav1.UpdateOptions{})
	return err
}

func pluginDependencyIDs(metaSpec pluginsv0alpha1.MetaSpec) []string {
	dependencies := metaSpec.PluginJson.Dependencies.Plugins
	ids := make([]string, 0, len(dependencies))
	for _, dependency := range dependencies {
		id := strings.TrimSpace(dependency.Id)
		if id != "" && !slices.Contains(ids, id) {
			ids = append(ids, id)
		}
	}
	return ids
}

func addDependencyParent(plugin *pluginsv0alpha1.Plugin, parentID string) {
	if parentID == "" {
		return
	}
	if plugin.Labels == nil {
		plugin.Labels = map[string]string{}
	}
	plugin.Labels[dependencyLabel] = "true"

	parents := parseDependencyParents(plugin.Annotations)
	if !slices.Contains(parents, parentID) {
		parents = append(parents, parentID)
	}
	setAnnotation(plugin, dependencyParentsAnnotation, strings.Join(parents, ","))
}

func dropDependencyParent(plugin *pluginsv0alpha1.Plugin, parentID string) {
	parents := slices.DeleteFunc(parseDependencyParents(plugin.Annotations), func(existing string) bool {
		return existing == parentID
	})
	if len(parents) > 0 {
		if plugin.Labels == nil {
			plugin.Labels = map[string]string{}
		}
		plugin.Labels[dependencyLabel] = "true"
		setAnnotation(plugin, dependencyParentsAnnotation, strings.Join(parents, ","))
		return
	}
	if plugin.Labels != nil {
		delete(plugin.Labels, dependencyLabel)
	}
	if plugin.Annotations != nil {
		delete(plugin.Annotations, dependencyParentsAnnotation)
	}
}

func hasDependencyParent(plugin *pluginsv0alpha1.Plugin, parentID string) bool {
	for _, existing := range parseDependencyParents(plugin.Annotations) {
		if existing == parentID {
			return true
		}
	}
	return false
}

func setAnnotation(plugin *pluginsv0alpha1.Plugin, key, value string) {
	if plugin.Annotations == nil {
		plugin.Annotations = map[string]string{}
	}
	plugin.Annotations[key] = value
}

func parseAppliedChildren(annotations map[string]string) []string {
	return parseCSVAnnotation(annotations, appliedChildrenAnnotation)
}

func parseAppliedDependencies(annotations map[string]string) []string {
	return parseCSVAnnotation(annotations, appliedDependenciesAnnotation)
}

func parseDependencyParents(annotations map[string]string) []string {
	return parseCSVAnnotation(annotations, dependencyParentsAnnotation)
}

func parseCSVAnnotation(annotations map[string]string, key string) []string {
	raw := annotations[key]
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := parts[:0]
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// IsChildPlugin reports whether the plugin is owned by a parent plugin.
// Exported so decorating hook providers (e.g. enterprise) share one
// definition of "child".
func IsChildPlugin(plugin *pluginsv0alpha1.Plugin) bool {
	return plugin.Spec.ParentId != nil && *plugin.Spec.ParentId != ""
}

// IsDependencyPlugin reports whether the plugin is installed as a dependency
// of another plugin. Exported so decorating hook providers (e.g. enterprise)
// share one definition of "dependency".
func IsDependencyPlugin(plugin *pluginsv0alpha1.Plugin) bool {
	if plugin.Labels[dependencyLabel] == "true" {
		return true
	}
	return len(parseDependencyParents(plugin.Annotations)) > 0
}

func isAppPlugin(plugin *pluginsv0alpha1.Plugin) bool {
	id := plugin.Spec.Id
	if id == "" {
		id = plugin.Name
	}
	return strings.HasSuffix(id, appPluginIDSuffix)
}

func normalizePluginID(plugin *pluginsv0alpha1.Plugin) {
	if plugin.Spec.Id == "" {
		plugin.Spec.Id = plugin.Name
	}
}

func pluginNamespace(ctx context.Context, plugin *pluginsv0alpha1.Plugin) string {
	if plugin.Namespace != "" {
		return plugin.Namespace
	}
	if namespace, ok := request.NamespaceFrom(ctx); ok {
		return namespace
	}
	return ""
}

func newPluginStorageHookContext(namespace string, operation string, logger logging.Logger) (context.Context, func(error)) {
	ctx := identity.WithServiceIdentityForSingleNamespaceContext(context.Background(), namespace)
	if namespace != "" {
		ctx = request.WithNamespace(ctx, namespace)
	}
	ctx, cancel := context.WithTimeout(ctx, pluginStorageHookTimeout)
	ctx, span := pluginStorageTracer.Start(ctx, operation)

	return ctx, func(err error) {
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			logger.Error(err.Error(), "error", err)
		}
		span.End()
		cancel()
	}
}

func mergeStringMap(existing, overlay map[string]string) map[string]string {
	if len(existing) == 0 && len(overlay) == 0 {
		return nil
	}
	out := make(map[string]string, len(existing)+len(overlay))
	for k, v := range existing {
		out[k] = v
	}
	for k, v := range overlay {
		out[k] = v
	}
	return out
}

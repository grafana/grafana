package prometheusrulefile

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"reflect"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	model "github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/apis/rulesextensions/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/app/config"
	alertingv0 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

// Reconciler keeps the AlertRule, RecordingRule and Folder children of a PrometheusRuleFile
// in sync with the file's spec. It is intended to be wrapped by the SDK's OpinionatedReconciler
// (the default behavior of simple.AppManagedKind), which attaches and removes the operator's
// finalizer for us so that deletions are observed even after operator restarts.
//
// AlertRule and RecordingRule are still served by Grafana's legacy storage, which does not
// preserve arbitrary labels. The reconciler therefore tracks the set of children it owns in
// the PrometheusRuleFile's status subresource (ManagedFolders / ManagedAlertRules /
// ManagedRecordingRules), and uses that list — not a label query — to decide what to prune.
//
// All AlertRule / RecordingRule shaping is delegated to the Converter — which is kept in
// lock-step with pkg/services/ngalert/prom.Converter (the engine behind the legacy /convert
// HTTP API). See converter.go and converter_xref_test.go for the cross-validation.
type Reconciler struct {
	operator.TypedReconciler[*model.PrometheusRuleFile]

	cfg            config.RuntimeConfig
	files          resource.Client
	folders        resource.Client
	alertRules     resource.Client
	recordingRules resource.Client
}

// NewReconciler builds a Reconciler. `files` is the client for the PrometheusRuleFile kind
// itself and is used to update the file's status subresource with the current child inventory.
// The other clients are typically produced from k8s.NewClientRegistry(...).ClientFor(<Kind>).
func NewReconciler(cfg config.RuntimeConfig, files, folders, alertRules, recordingRules resource.Client) (*Reconciler, error) {
	if files == nil || folders == nil || alertRules == nil || recordingRules == nil {
		return nil, errors.New("files, folders, alertRules and recordingRules clients are required")
	}
	r := &Reconciler{
		TypedReconciler: operator.TypedReconciler[*model.PrometheusRuleFile]{},
		cfg:             cfg,
		files:           files,
		folders:         folders,
		alertRules:      alertRules,
		recordingRules:  recordingRules,
	}
	r.ReconcileFunc = r.reconcile
	return r, nil
}

// converterForFile builds a Converter pinned to the datasource the file (and its runtime
// config defaults) target. The datasource is resolved once per reconcile so every child rule
// for the file ends up against the same datasource.
func (r *Reconciler) converterForFile(ctx context.Context, file *model.PrometheusRuleFile) (*Converter, error) {
	datasourceUID, err := r.resolveDatasourceUID(ctx, file)
	if err != nil {
		return nil, err
	}
	return NewConverter(ConverterConfig{
		DatasourceUID: datasourceUID,
	}), nil
}

// resolveDatasourceUID picks the datasource UID for a rule by checking, in order: the file's
// spec, the runtime resolver, the static default, and finally the fallback expression UID.
func (r *Reconciler) resolveDatasourceUID(ctx context.Context, file *model.PrometheusRuleFile) (string, error) {
	if file.Spec.DatasourceUID != nil && *file.Spec.DatasourceUID != "" {
		return string(*file.Spec.DatasourceUID), nil
	}
	return r.cfg.ResolveDatasourceUID(ctx)
}

func (r *Reconciler) reconcile(ctx context.Context, req operator.TypedReconcileRequest[*model.PrometheusRuleFile]) (operator.ReconcileResult, error) {
	logger := logging.FromContext(ctx).With(
		"component", "PrometheusRuleFileReconciler",
		"name", req.Object.GetName(),
		"namespace", req.Object.GetNamespace(),
		"action", operator.ResourceActionFromReconcileAction(req.Action),
	)

	switch req.Action {
	case operator.ReconcileActionDeleted:
		// OpinionatedReconciler converts the "delete pending" update event into a Deleted
		// action while our finalizer is still on the object — clean up every child currently
		// listed in the status subresource before the finalizer is removed.
		if err := r.cleanupChildren(ctx, req.Object); err != nil {
			logger.Error("failed to clean up child resources", "error", err)
			return operator.ReconcileResult{}, err
		}
		return operator.ReconcileResult{}, nil

	case operator.ReconcileActionCreated,
		operator.ReconcileActionUpdated,
		operator.ReconcileActionResynced:
		if err := r.applyChildren(ctx, req.Object); err != nil {
			logger.Error("failed to apply child resources", "error", err)
			// Surface the failure on the PrometheusRuleFile's status so the user can see
			// what went wrong without scraping operator logs. Best-effort: ignore the
			// status-write error since the real failure is already being returned.
			if statusErr := r.writeFailureOperatorState(ctx, req.Object, err); statusErr != nil {
				logger.Warn("failed to write failure operator state", "error", statusErr)
			}
			return operator.ReconcileResult{}, err
		}
		return operator.ReconcileResult{}, nil
	}

	return operator.ReconcileResult{}, nil
}

// applyChildren ensures that the desired set of child resources (one root folder for the file,
// one folder per group, and the alerting/recording rules) exists and matches the file's spec.
//
// Folder layout:
//
//	<user-supplied parent folder>
//	└── <file folder>     (one per PrometheusRuleFile, title = file.Name)
//	    ├── <group A>     (title = groupA.Name, unique within this file)
//	    │   ├── AlertRule
//	    │   └── RecordingRule
//	    └── <group B>
//	        └── ...
//
// The desired set is computed from the spec; the previous set is read from the file's status.
// Children in (previous \ desired) are deleted, and the status is rewritten to match.
func (r *Reconciler) applyChildren(ctx context.Context, file *model.PrometheusRuleFile) error {
	parentFolderUID := file.GetParentFolderUID()
	if parentFolderUID == "" {
		return fmt.Errorf("PrometheusRuleFile %s/%s is missing the %q annotation", file.GetNamespace(), file.GetName(), model.FolderAnnotationKey)
	}
	converter, err := r.converterForFile(ctx, file)
	if err != nil {
		return fmt.Errorf("build converter: %w", err)
	}

	// Ensure the per-file root folder first. Every group folder is parented under it, so
	// group titles only need to be unique within one PrometheusRuleFile.
	fileFolder := fileFolderName(file.GetName())
	if err := r.ensureFileFolder(ctx, file, fileFolder, parentFolderUID); err != nil {
		return fmt.Errorf("ensure file folder: %w", err)
	}

	desiredFolders := make([]string, 0, len(file.Spec.Groups))
	desiredAlertRules := make([]string, 0)
	desiredRecordingRules := make([]string, 0)

	for _, g := range file.Spec.Groups {
		folderName := childFolderName(file.GetName(), g.Name)
		desiredFolders = append(desiredFolders, folderName)
		if err := r.ensureGroupFolder(ctx, file, folderName, fileFolder, g.Name); err != nil {
			return fmt.Errorf("ensure folder for group %s: %w", g.Name, err)
		}

		for idx, rule := range g.Rules {
			switch {
			case rule.Alert != nil && *rule.Alert != "":
				name := childRuleName(file.GetName(), g.Name, *rule.Alert, idx)
				desiredAlertRules = append(desiredAlertRules, name)
				if err := r.ensureAlertRule(ctx, file, name, folderName, converter, g, rule); err != nil {
					return fmt.Errorf("ensure alert rule %s: %w", name, err)
				}
			case rule.Record != nil && *rule.Record != "":
				name := childRuleName(file.GetName(), g.Name, *rule.Record, idx)
				desiredRecordingRules = append(desiredRecordingRules, name)
				if err := r.ensureRecordingRule(ctx, file, name, folderName, converter, g, rule); err != nil {
					return fmt.Errorf("ensure recording rule %s: %w", name, err)
				}
			}
		}
	}

	// Delete previously-managed children that no longer appear in the spec.
	if err := deleteRemoved(ctx, r.alertRules, file.GetNamespace(), file.Status.ManagedAlertRules, desiredAlertRules); err != nil {
		return fmt.Errorf("prune alert rules: %w", err)
	}
	if err := deleteRemoved(ctx, r.recordingRules, file.GetNamespace(), file.Status.ManagedRecordingRules, desiredRecordingRules); err != nil {
		return fmt.Errorf("prune recording rules: %w", err)
	}
	if err := deleteRemoved(ctx, r.folders, file.GetNamespace(), file.Status.ManagedFolders, desiredFolders); err != nil {
		return fmt.Errorf("prune folders: %w", err)
	}

	// Record the new inventory in status so the next reconcile knows what we own.
	return r.updateStatus(ctx, file, fileFolder, desiredFolders, desiredAlertRules, desiredRecordingRules)
}

// cleanupChildren deletes every child still recorded in the file's status. It is invoked when
// the PrometheusRuleFile itself has been marked for deletion; the OpinionatedReconciler holds
// the finalizer until this returns successfully.
//
// Order matters: rules → group folders → file folder. Group folders cannot be deleted while
// they still contain rules, and the file folder cannot be deleted while it still contains
// group folders.
//
// Folder deletes are best-effort: if a folder contains anything we don't manage (a stray
// dashboard, a user-added sub-folder), the Folder API rejects the delete and we'd be stuck
// holding the finalizer forever. Log and continue instead — better to leak a folder than
// to leave the PrometheusRuleFile undeletable.
func (r *Reconciler) cleanupChildren(ctx context.Context, file *model.PrometheusRuleFile) error {
	logger := logging.FromContext(ctx).With(
		"component", "PrometheusRuleFileReconciler",
		"name", file.GetName(),
		"namespace", file.GetNamespace(),
	)
	if err := deleteAll(ctx, r.alertRules, file.GetNamespace(), file.Status.ManagedAlertRules); err != nil {
		return fmt.Errorf("delete alert rules: %w", err)
	}
	if err := deleteAll(ctx, r.recordingRules, file.GetNamespace(), file.Status.ManagedRecordingRules); err != nil {
		return fmt.Errorf("delete recording rules: %w", err)
	}
	for _, name := range file.Status.ManagedFolders {
		if err := deleteByName(ctx, r.folders, file.GetNamespace(), name); err != nil {
			logger.Warn("could not delete group folder during cleanup; leaving it in place", "folder", name, "error", err)
		}
	}
	if file.Status.ManagedFileFolder != "" {
		if err := deleteByName(ctx, r.folders, file.GetNamespace(), file.Status.ManagedFileFolder); err != nil {
			logger.Warn("could not delete file folder during cleanup; leaving it in place", "folder", file.Status.ManagedFileFolder, "error", err)
		}
	}
	return nil
}

// deleteRemoved deletes any name in `prev` that is not in `desired`.
func deleteRemoved(ctx context.Context, c resource.Client, namespace string, prev, desired []string) error {
	if len(prev) == 0 {
		return nil
	}
	want := make(map[string]struct{}, len(desired))
	for _, n := range desired {
		want[n] = struct{}{}
	}
	for _, name := range prev {
		if _, keep := want[name]; keep {
			continue
		}
		if err := deleteByName(ctx, c, namespace, name); err != nil {
			return err
		}
	}
	return nil
}

func deleteAll(ctx context.Context, c resource.Client, namespace string, names []string) error {
	for _, name := range names {
		if err := deleteByName(ctx, c, namespace, name); err != nil {
			return err
		}
	}
	return nil
}

func deleteByName(ctx context.Context, c resource.Client, namespace, name string) error {
	ident := resource.Identifier{Namespace: namespace, Name: name}
	if err := c.Delete(ctx, ident, resource.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
		return err
	}
	return nil
}

// operatorStateID is the key under PrometheusRuleFileStatus.OperatorStates that this app
// writes. Other operators consuming the same kind would write under their own key so we
// don't stomp each other's state.
const operatorStateID = "rules-extensions.alerting.grafana.app"

// updateStatus rewrites the file's status subresource with the supplied desired inventory
// and records a successful evaluation under OperatorStates. It uses resource.UpdateObject
// so the SDK handles ResourceVersion conflicts by re-fetching and re-applying our mutator.
func (r *Reconciler) updateStatus(ctx context.Context, file *model.PrometheusRuleFile, fileFolder string, folders, alertRules, recordingRules []string) error {
	_, err := resource.UpdateObject(ctx, r.files, file.GetStaticMetadata().Identifier(), func(obj *model.PrometheusRuleFile, _ bool) (*model.PrometheusRuleFile, error) {
		obj.Status.ManagedFileFolder = fileFolder
		obj.Status.ManagedFolders = folders
		obj.Status.ManagedAlertRules = alertRules
		obj.Status.ManagedRecordingRules = recordingRules
		setOperatorState(obj, model.PrometheusRuleFileStatusOperatorStateStateSuccess, obj.GetResourceVersion(), "")
		return obj, nil
	}, resource.UpdateOptions{Subresource: "status"})
	return err
}

// writeFailureOperatorState records that this reconcile failed. It does NOT touch the
// managed-inventory fields — those reflect the last successful reconcile and should not
// be invalidated just because a transient failure occurred. The error message is stamped
// into DescriptiveState so a `kubectl describe` reveals what broke.
func (r *Reconciler) writeFailureOperatorState(ctx context.Context, file *model.PrometheusRuleFile, applyErr error) error {
	_, err := resource.UpdateObject(ctx, r.files, file.GetStaticMetadata().Identifier(), func(obj *model.PrometheusRuleFile, _ bool) (*model.PrometheusRuleFile, error) {
		setOperatorState(obj, model.PrometheusRuleFileStatusOperatorStateStateFailed, obj.GetResourceVersion(), applyErr.Error())
		return obj, nil
	}, resource.UpdateOptions{Subresource: "status"})
	return err
}

func setOperatorState(obj *model.PrometheusRuleFile, state model.PrometheusRuleFileStatusOperatorStateState, lastEvaluation, descriptive string) {
	if obj.Status.OperatorStates == nil {
		obj.Status.OperatorStates = map[string]model.PrometheusRuleFilestatusOperatorState{}
	}
	entry := model.PrometheusRuleFilestatusOperatorState{
		LastEvaluation: lastEvaluation,
		State:          state,
	}
	if descriptive != "" {
		entry.DescriptiveState = &descriptive
	}
	obj.Status.OperatorStates[operatorStateID] = entry
}

// ensureFileFolder creates the per-file root folder under the user-supplied parent folder.
// Its title is the PrometheusRuleFile's name, guaranteeing it does not collide with the
// titles of folders this app creates for other PrometheusRuleFiles.
func (r *Reconciler) ensureFileFolder(
	ctx context.Context,
	file *model.PrometheusRuleFile,
	name, parentFolderUID string,
) error {
	desired := &folderv1.Folder{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: file.GetNamespace(),
			Annotations: map[string]string{
				model.FolderAnnotationKey: parentFolderUID,
			},
			OwnerReferences: []metav1.OwnerReference{ownerReferenceFor(file)},
		},
		Spec: folderv1.FolderSpec{
			Title: file.GetName(),
		},
	}
	desired.SetGroupVersionKind(folderv1.FolderKind().GroupVersionKind())
	return upsert(ctx, r.folders, desired)
}

// ensureGroupFolder creates a per-group folder under the file's root folder. Group titles
// only have to be unique inside one PrometheusRuleFile, which the spec validator already
// enforces, so the group's name can be used verbatim.
//
// TODO: sanitize groupName before stamping it on the folder title — group names are
// user-supplied and the Folder API may reject titles containing certain characters
// (slashes, control chars, very long strings, etc.). Track and address in a follow-up.
func (r *Reconciler) ensureGroupFolder(
	ctx context.Context,
	file *model.PrometheusRuleFile,
	name, fileFolderUID, groupName string,
) error {
	desired := &folderv1.Folder{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: file.GetNamespace(),
			Annotations: map[string]string{
				model.FolderAnnotationKey: fileFolderUID,
			},
			OwnerReferences: []metav1.OwnerReference{ownerReferenceFor(file)},
		},
		Spec: folderv1.FolderSpec{
			Title: groupName,
		},
	}
	desired.SetGroupVersionKind(folderv1.FolderKind().GroupVersionKind())
	return upsert(ctx, r.folders, desired)
}

func (r *Reconciler) ensureAlertRule(
	ctx context.Context,
	file *model.PrometheusRuleFile,
	name, folderUID string,
	converter *Converter,
	g model.PrometheusRuleFilePrometheusRuleGroup,
	rule model.PrometheusRuleFileRuleEntry,
) error {
	spec, err := converter.BuildAlertRuleSpec(g, rule)
	if err != nil {
		return err
	}
	// Note: AlertRule lives in legacy storage which only preserves a handful of metadata
	// fields. We intentionally avoid setting labels or ownerReferences on the rule itself —
	// our authoritative inventory is the parent file's status subresource.
	desired := &alertingv0.AlertRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: file.GetNamespace(),
			Annotations: map[string]string{
				alertingv0.FolderAnnotationKey: folderUID,
			},
		},
		Spec: spec,
	}
	desired.SetGroupVersionKind(alertingv0.GroupVersion.WithKind("AlertRule"))
	return upsert(ctx, r.alertRules, desired)
}

func (r *Reconciler) ensureRecordingRule(
	ctx context.Context,
	file *model.PrometheusRuleFile,
	name, folderUID string,
	converter *Converter,
	g model.PrometheusRuleFilePrometheusRuleGroup,
	rule model.PrometheusRuleFileRuleEntry,
) error {
	spec, err := converter.BuildRecordingRuleSpec(g, rule)
	if err != nil {
		return err
	}
	desired := &alertingv0.RecordingRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: file.GetNamespace(),
			Annotations: map[string]string{
				alertingv0.FolderAnnotationKey: folderUID,
			},
		},
		Spec: spec,
	}
	desired.SetGroupVersionKind(alertingv0.GroupVersion.WithKind("RecordingRule"))
	return upsert(ctx, r.recordingRules, desired)
}

// upsert performs a Create-or-Update on the desired object. On Update it preserves any
// metadata injected by admission/storage layers (provenance annotations, update timestamps,
// updated-by, kubectl last-applied, user labels, etc.) so each reconcile doesn't churn that
// state. The fields the reconciler owns — labels in our prefix, the folder annotation, our
// owner reference, and the entire Spec — overlay the existing object.
//
// If nothing the reconciler owns has changed relative to the storage state, the Update is
// skipped entirely. This matters because the informer resync delivers every object on a
// periodic interval; without the no-op skip every PrometheusRuleFile would generate a
// useless Update for every child on every resync.
func upsert(ctx context.Context, c resource.Client, desired resource.Object) error {
	ident := desired.GetStaticMetadata().Identifier()
	existing, err := c.Get(ctx, ident)
	if apierrors.IsNotFound(err) {
		_, createErr := c.Create(ctx, ident, desired, resource.CreateOptions{})
		return createErr
	}
	if err != nil {
		return err
	}
	mergeIntoExisting(existing, desired)
	if reconcilerOwnedFieldsEqual(existing, desired) {
		return nil
	}
	_, updateErr := c.Update(ctx, ident, desired, resource.UpdateOptions{})
	return updateErr
}

// reconcilerOwnedFieldsEqual returns true if every reconciler-owned field on `desired`
// already matches the corresponding field on `existing`. It is the gate for the no-op skip
// in upsert.
//
// We compare:
//   - GetSpec() — covers the entire Spec of every kind we manage.
//   - GetAnnotations() / GetLabels() — already merged into desired by mergeIntoExisting, so
//     this comparison flags only the keys the reconciler actually wrote.
//   - GetOwnerReferences() — likewise already merged.
//
// Status (subresource) is updated through a separate path and is intentionally not
// considered here.
func reconcilerOwnedFieldsEqual(existing, desired resource.Object) bool {
	if !reflect.DeepEqual(existing.GetSpec(), desired.GetSpec()) {
		return false
	}
	if !reflect.DeepEqual(existing.GetAnnotations(), desired.GetAnnotations()) {
		return false
	}
	if !reflect.DeepEqual(existing.GetLabels(), desired.GetLabels()) {
		return false
	}
	if !reflect.DeepEqual(existing.GetOwnerReferences(), desired.GetOwnerReferences()) {
		return false
	}
	return true
}

// mergeIntoExisting layers the reconciler-managed metadata of `desired` on top of the
// metadata returned by Get, so admission/storage-injected annotations and labels survive
// the Update.
//
// The reconciler owns:
//   - `grafana.app/folder` annotation (parent/folder pointer)
//   - the OwnerReference back to the PrometheusRuleFile (only meaningful for Folder, which
//     lives in unified storage that preserves it; AlertRule/RecordingRule legacy storage
//     drops OwnerReferences regardless, so this is a no-op for them)
//   - the entire Spec, which is already what `desired` carries
//
// Everything else on the existing object — UID, ResourceVersion, Finalizers, CreationTimestamp,
// Generation, ManagedFields, every non-folder annotation, every label — is kept.
func mergeIntoExisting(existing, desired resource.Object) {
	// ResourceVersion is required for the Update to succeed without a 409.
	desired.SetResourceVersion(existing.GetResourceVersion())
	desired.SetUID(existing.GetUID())
	desired.SetGeneration(existing.GetGeneration())
	desired.SetCreationTimestamp(existing.GetCreationTimestamp())
	desired.SetFinalizers(existing.GetFinalizers())
	desired.SetManagedFields(existing.GetManagedFields())

	// Annotations: start from existing, overlay our managed ones from desired.
	merged := map[string]string{}
	for k, v := range existing.GetAnnotations() {
		merged[k] = v
	}
	for k, v := range desired.GetAnnotations() {
		merged[k] = v
	}
	desired.SetAnnotations(merged)

	// Labels: same merge strategy. We currently don't set labels on any managed resource,
	// so this just preserves whatever's there. Keeping the merge so adding a managed label
	// later doesn't silently wipe user labels.
	mergedLabels := map[string]string{}
	for k, v := range existing.GetLabels() {
		mergedLabels[k] = v
	}
	for k, v := range desired.GetLabels() {
		mergedLabels[k] = v
	}
	desired.SetLabels(mergedLabels)

	// OwnerReferences: merge by UID so other controllers' owner refs survive while we
	// keep ours up to date (e.g. PrometheusRuleFile recreated under a new UID).
	desired.SetOwnerReferences(mergeOwnerReferences(existing.GetOwnerReferences(), desired.GetOwnerReferences()))
}

func mergeOwnerReferences(existing, desired []metav1.OwnerReference) []metav1.OwnerReference {
	out := make([]metav1.OwnerReference, 0, len(existing)+len(desired))
	seen := make(map[types.UID]int, len(desired))
	for i, ref := range desired {
		seen[ref.UID] = i
		out = append(out, ref)
	}
	for _, ref := range existing {
		if _, ok := seen[ref.UID]; ok {
			continue
		}
		out = append(out, ref)
	}
	return out
}

func ownerReferenceFor(file *model.PrometheusRuleFile) metav1.OwnerReference {
	gvk := model.PrometheusRuleFileKind().GroupVersionKind()
	t := true
	return metav1.OwnerReference{
		APIVersion:         gvk.GroupVersion().String(),
		Kind:               gvk.Kind,
		Name:               file.GetName(),
		UID:                types.UID(file.GetUID()),
		Controller:         &t,
		BlockOwnerDeletion: &t,
	}
}

// fileFolderName produces a deterministic, DNS-1123-compliant name for the per-file root
// folder. It is derived from the PrometheusRuleFile's own name, which is immutable, so the
// same file always resolves to the same folder name across reconciles.
func fileFolderName(fileName string) string {
	return truncate(model.ChildNamePrefix+shortHash(fileName), 253)
}

// childFolderName produces a deterministic, DNS-1123-compliant child folder name for a
// group folder. Group names are user-provided so we hash them to keep the resulting
// resource name valid regardless of the group's character set. The model.ChildNamePrefix
// prefix marks the resource as ours for human readability; the authoritative ownership
// signal is the parent file's status subresource.
func childFolderName(fileName, groupName string) string {
	return truncate(fmt.Sprintf("%s%s-%s", model.ChildNamePrefix, shortHash(fileName), shortHash(groupName)), 253)
}

func childRuleName(fileName, groupName, ruleName string, idx int) string {
	return truncate(fmt.Sprintf("%s%s-%s-%d-%s", model.ChildNamePrefix, shortHash(fileName), shortHash(groupName), idx, shortHash(ruleName)), 253)
}

func shortHash(s string) string {
	sum := sha1.Sum([]byte(s))
	return hex.EncodeToString(sum[:])[:12]
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

func mergeStringMaps(a, b map[string]string) map[string]string {
	if len(a) == 0 && len(b) == 0 {
		return nil
	}
	out := make(map[string]string, len(a)+len(b))
	for k, v := range a {
		out[k] = v
	}
	// Rule-level labels override group-level labels — matches the Prometheus semantics where
	// the inner scope wins.
	for k, v := range b {
		out[k] = v
	}
	return out
}

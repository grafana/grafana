package prometheusrulefile

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"

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
			return operator.ReconcileResult{}, err
		}
		return operator.ReconcileResult{}, nil
	}

	return operator.ReconcileResult{}, nil
}

// applyChildren ensures that the desired set of child resources (one folder per group, plus
// alerting/recording rules) exists and matches the file's spec. The desired set is computed
// from the spec; the previous set is read from the file's status. Children in
// (previous \ desired) are deleted, and the status is rewritten to match the new desired set.
func (r *Reconciler) applyChildren(ctx context.Context, file *model.PrometheusRuleFile) error {
	parentFolderUID := file.GetParentFolderUID()
	if parentFolderUID == "" {
		return fmt.Errorf("PrometheusRuleFile %s/%s is missing the %q annotation", file.GetNamespace(), file.GetName(), model.FolderAnnotationKey)
	}
	converter, err := r.converterForFile(ctx, file)
	if err != nil {
		return fmt.Errorf("build converter: %w", err)
	}

	desiredFolders := make([]string, 0, len(file.Spec.Groups))
	desiredAlertRules := make([]string, 0)
	desiredRecordingRules := make([]string, 0)

	for _, g := range file.Spec.Groups {
		folderName := childFolderName(file.GetName(), g.Name)
		desiredFolders = append(desiredFolders, folderName)
		if err := r.ensureFolder(ctx, file, folderName, parentFolderUID, g.Name); err != nil {
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
	return r.updateStatus(ctx, file, desiredFolders, desiredAlertRules, desiredRecordingRules)
}

// cleanupChildren deletes every child still recorded in the file's status. It is invoked when
// the PrometheusRuleFile itself has been marked for deletion; the OpinionatedReconciler holds
// the finalizer until this returns successfully.
func (r *Reconciler) cleanupChildren(ctx context.Context, file *model.PrometheusRuleFile) error {
	if err := deleteAll(ctx, r.alertRules, file.GetNamespace(), file.Status.ManagedAlertRules); err != nil {
		return fmt.Errorf("delete alert rules: %w", err)
	}
	if err := deleteAll(ctx, r.recordingRules, file.GetNamespace(), file.Status.ManagedRecordingRules); err != nil {
		return fmt.Errorf("delete recording rules: %w", err)
	}
	if err := deleteAll(ctx, r.folders, file.GetNamespace(), file.Status.ManagedFolders); err != nil {
		return fmt.Errorf("delete folders: %w", err)
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

// updateStatus rewrites the file's status subresource with the supplied desired inventory.
// It uses resource.UpdateObject so the SDK handles ResourceVersion conflicts by re-fetching
// and re-applying our mutator.
func (r *Reconciler) updateStatus(ctx context.Context, file *model.PrometheusRuleFile, folders, alertRules, recordingRules []string) error {
	_, err := resource.UpdateObject(ctx, r.files, file.GetStaticMetadata().Identifier(), func(obj *model.PrometheusRuleFile, _ bool) (*model.PrometheusRuleFile, error) {
		obj.Status.ManagedFolders = folders
		obj.Status.ManagedAlertRules = alertRules
		obj.Status.ManagedRecordingRules = recordingRules
		return obj, nil
	}, resource.UpdateOptions{Subresource: "status"})
	return err
}

func (r *Reconciler) ensureFolder(
	ctx context.Context,
	file *model.PrometheusRuleFile,
	name, parentFolderUID, groupName string,
) error {
	desired := &folderv1.Folder{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: file.GetNamespace(),
			Annotations: map[string]string{
				model.FolderAnnotationKey: parentFolderUID,
			},
			// Folder lives in unified storage which preserves ownerReferences, so we use them
			// as a secondary safety net for orphan cleanup via the k8s garbage collector.
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

// upsert performs a Create-or-Update on the desired object, copying the current ResourceVersion
// from the storage layer when an Update is required.
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
	desired.SetResourceVersion(existing.GetResourceVersion())
	_, updateErr := c.Update(ctx, ident, desired, resource.UpdateOptions{})
	return updateErr
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

// childFolderName produces a deterministic, DNS-1123-compliant child folder name.
// Group names are user-provided so we hash them to keep the resulting resource name valid
// regardless of the group's character set. The model.ChildNamePrefix prefix marks the
// resource as ours for human readability; the authoritative ownership signal is the parent
// file's status subresource.
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

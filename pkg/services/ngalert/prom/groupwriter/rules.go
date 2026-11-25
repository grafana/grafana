package groupwriter

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"

	"github.com/grafana/grafana-app-sdk/resource"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	k8svalidation "k8s.io/apimachinery/pkg/util/validation"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
	"github.com/grafana/grafana/pkg/services/ngalert/rules/legacy"
)

var ruleKinds = []resource.Kind{v1beta1.AlertRuleKind(), v1beta1.RecordingRuleKind()}

var errProvenanceMismatch = errutil.NewBase(errutil.StatusConflict, "alerting.provenanceMismatch").MustTemplate(
	"cannot {{ .Public.Operation }} with provided provenance '{{ .Public.ProvidedProvenance }}', needs '{{ .Public.StoredProvenance }}'",
	errutil.WithPublic("cannot {{ .Public.Operation }} with provided provenance '{{ .Public.ProvidedProvenance }}', needs '{{ .Public.StoredProvenance }}'"),
)

// The labels and annotations that a converted rule's writer sets. Two rules that agree on these and
// on the spec are the same, and the rule isn't written again.
var (
	ownedLabels      = []string{v1beta1.GroupLabelKey, v1beta1.GroupIndexLabelKey, v1beta1.FolderLabelKey}
	ownedAnnotations = []string{
		v1beta1.FolderAnnotationKey,
		v1beta1.ProvenanceStatusAnnotationKey,
		v1beta1.PrometheusRuleDefinitionAnnotationKey,
		utils.AnnoKeyManagerKind,
		utils.AnnoKeyManagerIdentity,
	}
)

// rule is an AlertRule or a RecordingRule.
type rule struct {
	kind resource.Kind
	obj  resource.Object
}

func (r rule) id(namespace string) resource.Identifier {
	return resource.Identifier{Namespace: namespace, Name: r.obj.GetName()}
}

// listRules returns the rules of both kinds in the folder.
func (w *Writer) listRules(ctx context.Context, c *clients, folderUID string) ([]rule, error) {
	opts := resource.ListOptions{}
	// A folder UID isn't always a valid label value, and then the rules are filtered here instead.
	if len(k8svalidation.IsValidLabelValue(folderUID)) == 0 {
		opts.LabelFilters = []string{v1beta1.FolderLabelKey + "=" + folderUID}
	}
	var result []rule
	for _, kind := range ruleKinds {
		client := c.rules[kind.Kind()]
		for {
			list, err := client.List(ctx, c.namespace, opts)
			if err != nil {
				return nil, fmt.Errorf("list %s objects: %w", kind.Kind(), err)
			}
			for _, obj := range list.GetItems() {
				if obj.GetAnnotations()[v1beta1.FolderAnnotationKey] == folderUID {
					result = append(result, rule{kind: kind, obj: obj})
				}
			}
			if list.GetContinue() == "" {
				break
			}
			opts.Continue = list.GetContinue()
		}
		opts.Continue = ""
	}
	return result, nil
}

// inGroup filters by the group label rather than a label selector, because a group name isn't
// always a valid label value.
func inGroup(rules []rule, title string) []rule {
	var result []rule
	for _, r := range rules {
		if r.obj.GetLabels()[v1beta1.GroupLabelKey] == title {
			result = append(result, r)
		}
	}
	return result
}

// converted returns the rules that carry their Prometheus definition.
func converted(rules []rule) []rule {
	var result []rule
	for _, r := range rules {
		if r.obj.GetAnnotations()[v1beta1.PrometheusRuleDefinitionAnnotationKey] != "" {
			result = append(result, r)
		}
	}
	return result
}

// writeRules makes the group's rules match g. Deletes go first, then updates, then creates.
func (w *Writer) writeRules(ctx context.Context, c *clients, orgID int64, g *models.AlertRuleGroup, manager utils.ManagerProperties) error {
	existing, err := w.listRules(ctx, c, g.FolderUID)
	if err != nil {
		return err
	}
	existing = inGroup(existing, g.Title)
	desired, err := w.desiredRules(orgID, g, manager)
	if err != nil {
		return err
	}

	wanted := make(map[string]rule, len(desired))
	for _, d := range desired {
		wanted[d.obj.GetName()] = d
	}
	current := make(map[string]rule, len(existing))
	for _, e := range existing {
		// A rule whose kind changed is deleted and created again as the other kind.
		if d, ok := wanted[e.obj.GetName()]; ok && d.kind.Kind() == e.kind.Kind() {
			current[e.obj.GetName()] = e
			continue
		}
		if err := w.deleteRule(ctx, c, e, manager); err != nil {
			return fmt.Errorf("delete rule %q of group %q: %w", e.obj.GetName(), g.Title, err)
		}
	}
	for _, d := range desired {
		e, ok := current[d.obj.GetName()]
		if !ok || same(e.obj, d.obj) {
			continue
		}
		if err := update(ctx, c, e.obj, d); err != nil {
			return fmt.Errorf("update rule %q of group %q: %w", d.obj.GetName(), g.Title, err)
		}
	}
	for _, d := range desired {
		if _, ok := current[d.obj.GetName()]; ok {
			continue
		}
		if err := create(ctx, c, d); err != nil {
			return fmt.Errorf("create rule %q of group %q: %w", d.obj.GetName(), g.Title, err)
		}
	}
	return nil
}

// desiredRules returns the group's rules as objects that carry the group.
func (w *Writer) desiredRules(orgID int64, g *models.AlertRuleGroup, manager utils.ManagerProperties) ([]rule, error) {
	result := make([]rule, 0, len(g.Rules))
	for i := range g.Rules {
		r := g.Rules[i]
		r.OrgID = orgID
		r.NamespaceUID = g.FolderUID
		r.RuleGroup = g.Title
		r.RuleGroupIndex = i
		r.IntervalSeconds = g.Interval

		var (
			obj  resource.Object
			kind resource.Kind
			err  error
		)
		if r.Type() == models.RuleTypeRecording {
			kind = v1beta1.RecordingRuleKind()
			obj, err = legacy.RecordingRuleToK8s(orgID, &r, manager, w.namespace)
		} else {
			kind = v1beta1.AlertRuleKind()
			obj, err = legacy.AlertRuleToK8s(orgID, &r, manager, w.namespace)
		}
		if err != nil {
			return nil, fmt.Errorf("convert rule %q: %w", r.UID, err)
		}
		obj.SetResourceVersion("")
		obj.SetUID("")
		obj.SetGeneration(0)
		annotations := obj.GetAnnotations()
		if annotations == nil {
			annotations = map[string]string{}
		}
		annotations[v1beta1.AllowGroupWritesAnnotationKey] = "true"
		obj.SetAnnotations(annotations)
		result = append(result, rule{kind: kind, obj: obj})
	}
	return result, nil
}

func same(existing, desired resource.Object) bool {
	for _, key := range ownedLabels {
		if existing.GetLabels()[key] != desired.GetLabels()[key] {
			return false
		}
	}
	for _, key := range ownedAnnotations {
		if existing.GetAnnotations()[key] != desired.GetAnnotations()[key] {
			return false
		}
	}
	return sameJSON(existing.GetSpec(), desired.GetSpec())
}

// sameJSON compares a and b as decoded JSON, because storage doesn't keep a query model's formatting.
func sameJSON(a, b any) bool {
	var decoded [2]any
	for i, v := range []any{a, b} {
		data, err := json.Marshal(v)
		if err != nil || json.Unmarshal(data, &decoded[i]) != nil {
			return false
		}
	}
	return reflect.DeepEqual(decoded[0], decoded[1])
}

func update(ctx context.Context, c *clients, existing resource.Object, d rule) error {
	d.obj.SetResourceVersion(existing.GetResourceVersion())
	d.obj.SetUID(existing.GetUID())
	_, err := c.rules[d.kind.Kind()].Update(ctx, d.id(c.namespace), d.obj, resource.UpdateOptions{ResourceVersion: existing.GetResourceVersion()})
	return err
}

// create creates the rule. A rule with the same UID can already exist in another group, when its UID
// is set explicitly rather than derived from its position, and is then moved into this group.
func create(ctx context.Context, c *clients, d rule) error {
	client := c.rules[d.kind.Kind()]
	_, err := client.Create(ctx, d.id(c.namespace), d.obj, resource.CreateOptions{})
	if !apierrors.IsAlreadyExists(err) && !apierrors.IsConflict(err) {
		return err
	}
	existing, getErr := client.Get(ctx, d.id(c.namespace))
	if getErr != nil {
		return err
	}
	return update(ctx, c, existing, d)
}

// deleteRule deletes the rule if the manager may delete it. Deleting through the rules API checks
// the rule against its own stored manager, so the check against the converting manager is made here.
func (w *Writer) deleteRule(ctx context.Context, c *clients, r rule, manager utils.ManagerProperties) error {
	stored, err := storedManager(r.obj)
	if err != nil {
		return err
	}
	if !validation.CanUpdateManagerInRuleGroup(stored, manager) {
		return errProvenanceMismatch.Build(errutil.TemplateData{
			Public: map[string]any{
				"ProvidedProvenance": manager.Kind,
				"StoredProvenance":   stored.Kind,
				"Operation":          "delete",
			},
		})
	}
	return w.retryWhileSequenceMember(ctx, func(ctx context.Context) error {
		err := c.rules[r.kind.Kind()].Delete(ctx, r.id(c.namespace), resource.DeleteOptions{})
		if apierrors.IsNotFound(err) {
			return nil
		}
		return err
	})
}

// storedManager reads the manager the rule was written by, the way the rules API reads it on write.
func storedManager(obj resource.Object) (utils.ManagerProperties, error) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return utils.ManagerProperties{}, err
	}
	if mp, ok := meta.GetManagerProperties(); ok {
		return mp, nil
	}
	return models.ProvenanceToManagerProperties(models.Provenance(obj.GetAnnotations()[v1beta1.ProvenanceStatusAnnotationKey])), nil
}

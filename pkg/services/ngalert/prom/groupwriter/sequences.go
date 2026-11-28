package groupwriter

import (
	"context"
	"fmt"
	"reflect"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	prommodel "github.com/prometheus/common/model"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// A sequence is deleted in two phases: it is gone only after the rules app has processed the
// deletion, which is also when its membership is updated. getSequence waits for a sequence that is
// being deleted to be gone.
func (w *Writer) getSequence(ctx context.Context, c *clients, name string) (*v1beta1.RuleSequence, error) {
	id := resource.Identifier{Namespace: c.namespace, Name: name}
	for attempt := 0; ; attempt++ {
		seq, err := c.sequences.Get(ctx, id)
		if err != nil || seq.DeletionTimestamp == nil {
			return seq, err
		}
		if attempt == w.retries {
			return nil, fmt.Errorf("rule sequence %q is still being deleted", name)
		}
		if err := w.wait(ctx, attempt); err != nil {
			return nil, err
		}
	}
}

// shrink removes the rules that the group no longer contains, as the same kind, from its sequence.
// A rule UID is derived from the rule's position, so a re-import can turn it into the other kind.
func (w *Writer) shrink(ctx context.Context, c *clients, orgID int64, g *models.AlertRuleGroup) error {
	seq, err := w.getSequence(ctx, c, SequenceUID(orgID, g.FolderUID, g.Title))
	if apierrors.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	recording, alerting := refs(g)
	keptRecording := intersect(seq.Spec.RecordingRules, recording)
	keptAlerting := intersect(seq.Spec.AlertRules, alerting)
	if len(keptRecording) == len(seq.Spec.RecordingRules) && len(keptAlerting) == len(seq.Spec.AlertRules) {
		return nil
	}
	if len(keptRecording) == 0 {
		return deleteSequence(ctx, c, seq.Name)
	}
	seq.Spec.RecordingRules, seq.Spec.AlertRules = keptRecording, keptAlerting
	_, err = c.sequences.Update(ctx, seq, resource.UpdateOptions{ResourceVersion: seq.ResourceVersion})
	return err
}

func (w *Writer) upsert(ctx context.Context, c *clients, orgID int64, g *models.AlertRuleGroup, provenance models.Provenance) error {
	name := SequenceUID(orgID, g.FolderUID, g.Title)
	recording, alerting := refs(g)
	if len(recording) == 0 {
		// A sequence needs a recording rule.
		return deleteSequence(ctx, c, name)
	}
	spec := v1beta1.RuleSequenceSpec{
		Trigger:        v1beta1.RuleSequenceIntervalTrigger{Interval: v1beta1.RuleSequencePromDuration(prommodel.Duration(time.Duration(g.Interval) * time.Second).String())},
		RecordingRules: recording,
		AlertRules:     alerting,
	}

	seq, err := w.getSequence(ctx, c, name)
	if apierrors.IsNotFound(err) {
		seq = &v1beta1.RuleSequence{
			ObjectMeta: metav1.ObjectMeta{
				Namespace:   c.namespace,
				Name:        name,
				Annotations: map[string]string{v1beta1.FolderAnnotationKey: g.FolderUID},
			},
			Spec: spec,
		}
		if err := seq.SetProvenanceStatus(string(provenance)); err != nil {
			return err
		}
		_, err = c.sequences.Create(ctx, seq, resource.CreateOptions{})
		return err
	}
	if err != nil {
		return err
	}
	if reflect.DeepEqual(seq.Spec, spec) && seq.GetProvenanceStatus() == string(provenance) {
		return nil
	}
	seq.Spec = spec
	if err := seq.SetProvenanceStatus(string(provenance)); err != nil {
		return err
	}
	_, err = c.sequences.Update(ctx, seq, resource.UpdateOptions{ResourceVersion: seq.ResourceVersion})
	return err
}

func deleteSequence(ctx context.Context, c *clients, name string) error {
	err := c.sequences.Delete(ctx, resource.Identifier{Namespace: c.namespace, Name: name}, resource.DeleteOptions{})
	if apierrors.IsNotFound(err) {
		return nil
	}
	return err
}

// refs returns the group's recording and alert rules, each in the group's order.
func refs(g *models.AlertRuleGroup) (recording, alerting []v1beta1.RuleSequenceRuleRef) {
	for i := range g.Rules {
		ref := v1beta1.RuleSequenceRuleRef{Name: v1beta1.RuleSequenceRuleUID(g.Rules[i].UID)}
		if g.Rules[i].Type() == models.RuleTypeRecording {
			recording = append(recording, ref)
		} else {
			alerting = append(alerting, ref)
		}
	}
	return recording, alerting
}

func intersect(current, wanted []v1beta1.RuleSequenceRuleRef) []v1beta1.RuleSequenceRuleRef {
	keep := make(map[v1beta1.RuleSequenceRuleUID]struct{}, len(wanted))
	for _, ref := range wanted {
		keep[ref.Name] = struct{}{}
	}
	var result []v1beta1.RuleSequenceRuleRef
	for _, ref := range current {
		if _, ok := keep[ref.Name]; ok {
			result = append(result, ref)
		}
	}
	return result
}

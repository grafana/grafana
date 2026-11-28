package rulesequence

import (
	"context"
	"fmt"
	"reflect"
	"slices"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/util"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/validation"
)

func ValidateWrite(cfg config.RuntimeConfig) validation.ValidateFunc[*model.RuleSequence] {
	return func(ctx context.Context, req validation.Request[*model.RuleSequence]) error {
		r := req.Object

		// Once deletion has started, the watcher removes its finalizer with a write that keeps the
		// spec. By then the referenced rules or the folder may already be gone, and rejecting that
		// write would keep the sequence from ever being deleted.
		if r.GetDeletionTimestamp() != nil && req.OldObject != nil && reflect.DeepEqual(r.Spec, req.OldObject.Spec) {
			return nil
		}

		sourceProv := r.GetProvenanceStatus()
		if !slices.Contains(model.AcceptedProvenanceStatuses, sourceProv) {
			return fmt.Errorf("invalid provenance status: %s", sourceProv)
		}
		// Note: validateGroupLabels is not called here because RuleSequences
		// are not grouped: they are the grouping mechanism themselves. Group
		// labels (grafana.com/group, grafana.com/group-index) are not applicable.
		if err := util.ValidateInterval(cfg.BaseEvaluationInterval, &r.Spec.Trigger.Interval); err != nil {
			return err
		}

		if len(r.Spec.RecordingRules) == 0 {
			return fmt.Errorf("rule sequence requires at least one recording rule")
		}

		seqFolderUID := r.Annotations[model.FolderAnnotationKey]
		if seqFolderUID == "" {
			return fmt.Errorf("rule sequence must be placed in a folder (set annotation %q)", model.FolderAnnotationKey)
		}
		if cfg.FolderValidator != nil {
			ok, err := cfg.FolderValidator(ctx, seqFolderUID)
			if err != nil {
				return fmt.Errorf("failed to validate folder %q: %w", seqFolderUID, err)
			}
			if !ok {
				return fmt.Errorf("folder %q does not exist or is not accessible", seqFolderUID)
			}
		}

		allRefs := make([]model.RuleSequenceRuleRef, 0, len(r.Spec.RecordingRules)+len(r.Spec.AlertRules))
		allRefs = append(allRefs, r.Spec.RecordingRules...)
		allRefs = append(allRefs, r.Spec.AlertRules...)

		// RuleSequence admission validates one object at a time, but that
		// object can reference many rule UIDs. Resolve membership in bulk
		// for CREATE/UPDATE to avoid per-UID scans.
		memberships := map[string]config.RuleSequenceMembership{}
		if cfg.MembershipResolver != nil {
			allUIDs := make([]string, 0, len(allRefs))
			for _, ref := range allRefs {
				if uid := string(ref.Name); uid != "" {
					allUIDs = append(allUIDs, uid)
				}
			}
			resolved, err := cfg.MembershipResolver.Resolve(ctx, allUIDs)
			if err != nil {
				return fmt.Errorf("failed to resolve sequence memberships: %w", err)
			}
			memberships = resolved
		}

		if err := validateRefs(ctx, cfg.ResolveRuleRef, r.Name, seqFolderUID, r.Spec.RecordingRules, true, memberships); err != nil {
			return err
		}
		return validateRefs(ctx, cfg.ResolveRuleRef, r.Name, seqFolderUID, r.Spec.AlertRules, false, memberships)
	}
}

// validateRefs checks the refs in one of a sequence's rule lists. A rule listed in both lists is
// rejected by the kind check.
func validateRefs(ctx context.Context, resolve config.RuleRefResolver, seqName, seqFolderUID string, refs []model.RuleSequenceRuleRef, wantRecording bool, memberships map[string]config.RuleSequenceMembership) error {
	seen := make(map[string]struct{}, len(refs))
	for _, ref := range refs {
		ruleUID := string(ref.Name)
		if ruleUID == "" {
			return fmt.Errorf("rule ref name must not be empty")
		}
		if _, exists := seen[ruleUID]; exists {
			return fmt.Errorf("rule %q appears multiple times in rule sequence", ruleUID)
		}
		seen[ruleUID] = struct{}{}

		if resolve != nil {
			ruleRef, found, err := resolve(ctx, ruleUID)
			if err != nil {
				return fmt.Errorf("failed to resolve rule %q: %w", ruleUID, err)
			}
			if !found {
				return fmt.Errorf("rule %q does not exist", ruleUID)
			}
			if ruleRef.FolderUID != seqFolderUID {
				return fmt.Errorf("rule %q is in folder %q but rule sequence is in folder %q: all rules must be in the same folder as the sequence", ruleUID, ruleRef.FolderUID, seqFolderUID)
			}
			if wantRecording && !ruleRef.IsRecording {
				return fmt.Errorf("rule %q is an alert rule but is listed in recordingRules", ruleUID)
			}
			if !wantRecording && ruleRef.IsRecording {
				return fmt.Errorf("rule %q is a recording rule but is listed in alertRules", ruleUID)
			}
		}

		if membership := memberships[ruleUID]; membership.Found && membership.SequenceUID != "" && membership.SequenceUID != seqName {
			return fmt.Errorf("rule %q already belongs to rule sequence %q", ruleUID, membership.SequenceUID)
		}
	}
	return nil
}

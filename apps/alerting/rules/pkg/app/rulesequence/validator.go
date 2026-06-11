package rulesequence

import (
	"context"
	"fmt"
	"slices"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/schemavalidation"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/util"
)

func NewValidator(cfg config.RuntimeConfig, sv *schemavalidation.SpecValidator) *simple.Validator {
	return &simple.Validator{
		ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
			r, ok := req.Object.(*model.RuleSequence)
			if !ok || r == nil {
				return fmt.Errorf("object is not of type *v0alpha1.RuleSequence")
			}

			// Validate against the openAPI spec first
			if sv != nil {
				if err := sv.ValidateOpenAPISpec(r.Name, r.Spec); err != nil {
					return err
				}
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

			seen := make(map[string]struct{}, len(r.Spec.RecordingRules)+len(r.Spec.AlertingRules))
			allRefs := make([]model.RuleSequenceRuleRef, 0, len(r.Spec.RecordingRules)+len(r.Spec.AlertingRules))
			allRefs = append(allRefs, r.Spec.RecordingRules...)
			allRefs = append(allRefs, r.Spec.AlertingRules...)

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

			for _, ref := range allRefs {
				ruleUID := string(ref.Name)
				if ruleUID == "" {
					return fmt.Errorf("rule ref name must not be empty")
				}
				if _, exists := seen[ruleUID]; exists {
					return fmt.Errorf("rule %q appears multiple times in rule sequence", ruleUID)
				}
				seen[ruleUID] = struct{}{}

				if cfg.ResolveRuleRef != nil {
					ruleRef, found, err := cfg.ResolveRuleRef(ctx, ruleUID)
					if err != nil {
						return fmt.Errorf("failed to resolve rule %q: %w", ruleUID, err)
					}
					if !found {
						return fmt.Errorf("rule %q does not exist", ruleUID)
					}
					if ruleRef.FolderUID != seqFolderUID {
						return fmt.Errorf("rule %q is in folder %q but rule sequence is in folder %q: all rules must be in the same folder as the sequence", ruleUID, ruleRef.FolderUID, seqFolderUID)
					}
				}

				membership, hasBulkMembership := memberships[ruleUID]
				if !hasBulkMembership {
					membership = config.RuleSequenceMembership{}
				}
				if membership.Found && membership.SequenceUID != "" && membership.SequenceUID != r.Name {
					return fmt.Errorf("rule %q already belongs to rule sequence %q", ruleUID, membership.SequenceUID)
				}
			}

			return nil
		},
	}
}

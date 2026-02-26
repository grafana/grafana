package rulechain

import (
	"context"
	"fmt"
	"slices"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/util"
)

func NewValidator(cfg config.RuntimeConfig) *simple.Validator {
	return &simple.Validator{
		ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
			r, ok := req.Object.(*model.RuleChain)
			if !ok || r == nil {
				return fmt.Errorf("object is not of type *v0alpha1.RuleChain")
			}

			sourceProv := r.GetProvenanceStatus()
			if !slices.Contains(model.AcceptedProvenanceStatuses, sourceProv) {
				return fmt.Errorf("invalid provenance status: %s", sourceProv)
			}

			// Note: validateGroupLabels is not called here because RuleChains are not
			// grouped — they are the grouping mechanism themselves. Group labels
			// (grafana.com/group, grafana.com/group-index) are not applicable.

			if err := util.ValidateInterval(cfg.BaseEvaluationInterval, &r.Spec.Trigger.Interval); err != nil {
				return err
			}

			if len(r.Spec.RecordingRules) == 0 {
				return fmt.Errorf("rulechain requires at least one recording rule")
			}

			// TODO: Validate folder annotation once EnableFolderSupport is
			// available for unified-storage-only resources (no legacy storage).
			// Currently the storage layer rejects the folder annotation for
			// app-sdk resources that don't go through the dual-writer.

			seen := make(map[string]struct{}, len(r.Spec.RecordingRules)+len(r.Spec.AlertingRules))
			allRefs := make([]model.RuleChainRuleRef, 0, len(r.Spec.RecordingRules)+len(r.Spec.AlertingRules))
			allRefs = append(allRefs, r.Spec.RecordingRules...)
			allRefs = append(allRefs, r.Spec.AlertingRules...)

			// RuleChain admission validates one object at a time, but that object can reference
			// many rule UIDs. Resolve membership in bulk for CREATE/UPDATE to avoid per-UID scans.
			memberships := map[string]config.RuleChainMembership{}
			if cfg.ResolveRuleChainMemberships != nil {
				allUIDs := make([]string, 0, len(allRefs))
				for _, ref := range allRefs {
					if uid := string(ref.Uid); uid != "" {
						allUIDs = append(allUIDs, uid)
					}
				}
				resolved, err := cfg.ResolveRuleChainMemberships(ctx, allUIDs)
				if err != nil {
					return fmt.Errorf("failed to resolve chain memberships: %w", err)
				}
				memberships = resolved
			}

			for _, ref := range allRefs {
				ruleUID := string(ref.Uid)
				if ruleUID == "" {
					return fmt.Errorf("rule ref uid must not be empty")
				}
				if _, exists := seen[ruleUID]; exists {
					return fmt.Errorf("rule %q appears multiple times in rulechain", ruleUID)
				}
				seen[ruleUID] = struct{}{}

				if cfg.ResolveRuleRef != nil {
					_, found, err := cfg.ResolveRuleRef(ctx, ruleUID)
					if err != nil {
						return fmt.Errorf("failed to resolve rule %q: %w", ruleUID, err)
					}
					if !found {
						return fmt.Errorf("rule %q does not exist", ruleUID)
					}
					// TODO: Validate that referenced rules are in the same folder
					// as the chain once folder support is enabled for RuleChain.
				}

				membership, hasBulkMembership := memberships[ruleUID]
				if !hasBulkMembership {
					membership = config.RuleChainMembership{}
				}
				if membership.Found && membership.ChainUID != "" && membership.ChainUID != r.Name {
					return fmt.Errorf("rule %q already belongs to rulechain %q", ruleUID, membership.ChainUID)
				}
			}

			return nil
		},
	}
}

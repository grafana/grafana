package validation

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// provenanceStore defines the interface for getting provenance information.
// This matches the GetProvenances method from the ProvisioningStore interface in the parent package.
type provenanceStore interface {
	GetProvenances(ctx context.Context, orgID int64, resourceType string) (map[string]models.Provenance, error)
}

// ValidateProvisioningConsistencyCreate validates that creating a new rule with targetProvenance
// would not create a mixed-provenance group (provisioned and non-provisioned rules in the same group).
// Use this function when adding a new rule to a group.
func ValidateProvisioningConsistencyCreate(
	ctx context.Context,
	store provenanceStore,
	orgID int64,
	targetProvenance models.Provenance,
	affectedGroups map[models.AlertRuleGroupKey]models.RulesGroup,
) error {
	return validateProvisioningConsistency(ctx, store, orgID, targetProvenance, affectedGroups, "")
}

// ValidateProvisioningConsistencyUpdate validates that updating an existing rule with targetProvenance
// would not create a mixed-provenance group (provisioned and non-provisioned rules in the same group).
// Use this function when modifying an existing rule. Single-rule groups are allowed to change provenance.
func ValidateProvisioningConsistencyUpdate(
	ctx context.Context,
	store provenanceStore,
	orgID int64,
	targetProvenance models.Provenance,
	affectedGroups map[models.AlertRuleGroupKey]models.RulesGroup,
	ruleUID string,
) error {
	if ruleUID == "" {
		return fmt.Errorf("ruleUID cannot be empty for update operations")
	}
	return validateProvisioningConsistency(ctx, store, orgID, targetProvenance, affectedGroups, ruleUID)
}

// validateProvisioningConsistency checks that adding/updating a rule with targetProvenance to the affected groups
// would not create a mixed-provenance group (provisioned and non-provisioned rules in the same group).
//
// This prevents the scenario where provisioned rules are added to groups with non-provisioned rules,
// which would lock the entire group from being editable in the UI.
//
// The ruleUID parameter should be:
// - Empty string ("") for CREATE operations (adding a new rule)
// - The rule's UID for UPDATE operations (changing an existing rule)
//
// Rules:
// - If targetProvenance != ProvenanceNone: no OTHER existing rule in the group can have ProvenanceNone
// - If targetProvenance == ProvenanceNone: no OTHER existing rule in the group can have provenance != ProvenanceNone
// - Empty groups (no existing rules) are always allowed
// - Single-rule groups being updated are allowed (can change the group's provenance entirely)
func validateProvisioningConsistency(
	ctx context.Context,
	store provenanceStore,
	orgID int64,
	targetProvenance models.Provenance,
	affectedGroups map[models.AlertRuleGroupKey]models.RulesGroup,
	ruleUID string,
) error {
	if len(affectedGroups) == 0 {
		return nil
	}

	// Get all provenances for the organization.
	provenances, err := store.GetProvenances(ctx, orgID, (&models.AlertRule{}).ResourceType())
	if err != nil {
		return fmt.Errorf("failed to get provenances: %w", err)
	}

	// Check each affected group for conflicts
	var conflictingGroups []string
	for groupKey, rules := range affectedGroups {
		// Special case: if updating a rule and it's the only rule in the group, allow changing provenance
		if ruleUID != "" && len(rules) == 1 && rules[0] != nil && rules[0].UID == ruleUID {
			continue
		}

		if hasProvenanceConflict(provenances, rules, targetProvenance, ruleUID) {
			// Format the group identifier as orgID/namespace/group
			conflictingGroups = append(conflictingGroups, fmt.Sprintf("%d/%s/%s", groupKey.OrgID, groupKey.NamespaceUID, groupKey.RuleGroup))
		}
	}

	if len(conflictingGroups) > 0 {
		// Sort for consistent error messages
		sort.Strings(conflictingGroups)

		var operation string
		if targetProvenance != models.ProvenanceNone {
			operation = fmt.Sprintf("cannot add provisioned (%s) rule to group containing non-provisioned rules", targetProvenance)
		} else {
			operation = "cannot add non-provisioned rule to group containing provisioned rules"
		}

		return fmt.Errorf("%w: %s [%s]", models.ErrAlertRuleFailedValidation, operation, strings.Join(conflictingGroups, ", "))
	}

	return nil
}

// hasProvenanceConflict checks if adding/updating a rule with targetProvenance would conflict with existing rules.
// The ruleUID parameter (if provided) identifies the rule being updated, which should be excluded from conflict checking.
func hasProvenanceConflict(provenances map[string]models.Provenance, rules []*models.AlertRule, targetProvenance models.Provenance, ruleUID string) bool {
	for _, rule := range rules {
		if rule == nil {
			continue
		}

		// Skip the rule being updated when checking for conflicts in UPDATE operations
		if ruleUID != "" && rule.UID == ruleUID {
			continue
		}

		existingProvenance, ok := provenances[rule.UID]
		if !ok {
			existingProvenance = models.ProvenanceNone
		}

		// Check for conflict:
		// 1. If we're adding a provisioned rule (targetProvenance != None) and existing rule is non-provisioned (ProvenanceNone)
		// 2. If we're adding a non-provisioned rule (targetProvenance == None) and existing rule is provisioned (!= ProvenanceNone)
		if targetProvenance != models.ProvenanceNone && existingProvenance == models.ProvenanceNone {
			return true
		}
		if targetProvenance == models.ProvenanceNone && existingProvenance != models.ProvenanceNone {
			return true
		}
	}

	return false
}

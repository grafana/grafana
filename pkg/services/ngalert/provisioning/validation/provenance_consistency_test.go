package validation

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// mockProvenanceStore implements the provenanceStore interface for testing.
type mockProvenanceStore struct {
	provenances map[string]models.Provenance
	err         error
}

func (m *mockProvenanceStore) GetProvenances(ctx context.Context, orgID int64, resourceType string) (map[string]models.Provenance, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.provenances, nil
}

func TestValidateProvisioningConsistency(t *testing.T) {
	ctx := context.Background()
	orgID := int64(1)
	groupKey := models.AlertRuleGroupKey{
		OrgID:        orgID,
		NamespaceUID: "test-namespace",
		RuleGroup:    "test-group",
	}

	makeRule := func(uid string) *models.AlertRule {
		return &models.AlertRule{
			UID:          uid,
			OrgID:        orgID,
			NamespaceUID: groupKey.NamespaceUID,
			RuleGroup:    groupKey.RuleGroup,
		}
	}

	t.Run("empty affected groups - should allow", func(t *testing.T) {
		store := &mockProvenanceStore{provenances: map[string]models.Provenance{}}
		affectedGroups := map[models.AlertRuleGroupKey]models.RulesGroup{}

		err := ValidateProvisioningConsistencyCreate(ctx, store, orgID, models.ProvenanceAPI, affectedGroups)
		require.NoError(t, err)
	})

	t.Run("empty group (no existing rules) - should allow any provenance", func(t *testing.T) {
		store := &mockProvenanceStore{provenances: map[string]models.Provenance{}}
		affectedGroups := map[models.AlertRuleGroupKey]models.RulesGroup{
			groupKey: {},
		}

		err := ValidateProvisioningConsistencyCreate(ctx, store, orgID, models.ProvenanceAPI, affectedGroups)
		require.NoError(t, err)
	})

	t.Run("adding provisioned rule to group with non-provisioned rules - should reject", func(t *testing.T) {
		store := &mockProvenanceStore{
			provenances: map[string]models.Provenance{
				"rule-1": models.ProvenanceNone,
				"rule-2": models.ProvenanceNone,
			},
		}
		affectedGroups := map[models.AlertRuleGroupKey]models.RulesGroup{
			groupKey: {makeRule("rule-1"), makeRule("rule-2")},
		}

		err := ValidateProvisioningConsistencyCreate(ctx, store, orgID, models.ProvenanceAPI, affectedGroups)
		require.Error(t, err)
		assert.ErrorIs(t, err, models.ErrAlertRuleFailedValidation)
		assert.Contains(t, err.Error(), "cannot add provisioned (api) rule to group containing non-provisioned rules")
		assert.Contains(t, err.Error(), "1/test-namespace/test-group")
	})

	t.Run("adding non-provisioned rule to group with provisioned rules - should reject", func(t *testing.T) {
		store := &mockProvenanceStore{
			provenances: map[string]models.Provenance{
				"rule-1": models.ProvenanceAPI,
				"rule-2": models.ProvenanceAPI,
			},
		}
		affectedGroups := map[models.AlertRuleGroupKey]models.RulesGroup{
			groupKey: {makeRule("rule-1"), makeRule("rule-2")},
		}

		err := ValidateProvisioningConsistencyCreate(ctx, store, orgID, models.ProvenanceNone, affectedGroups)
		require.Error(t, err)
		assert.ErrorIs(t, err, models.ErrAlertRuleFailedValidation)
		assert.Contains(t, err.Error(), "cannot add non-provisioned rule to group containing provisioned rules")
		assert.Contains(t, err.Error(), "1/test-namespace/test-group")
	})

	t.Run("adding provisioned rule to group with provisioned rules - should allow", func(t *testing.T) {
		store := &mockProvenanceStore{
			provenances: map[string]models.Provenance{
				"rule-1": models.ProvenanceAPI,
				"rule-2": models.ProvenanceFile,
			},
		}
		affectedGroups := map[models.AlertRuleGroupKey]models.RulesGroup{
			groupKey: {makeRule("rule-1"), makeRule("rule-2")},
		}

		err := ValidateProvisioningConsistencyCreate(ctx, store, orgID, models.ProvenanceAPI, affectedGroups)
		require.NoError(t, err)
	})

	t.Run("adding non-provisioned rule to group with non-provisioned rules - should allow", func(t *testing.T) {
		store := &mockProvenanceStore{
			provenances: map[string]models.Provenance{
				"rule-1": models.ProvenanceNone,
				"rule-2": models.ProvenanceNone,
			},
		}
		affectedGroups := map[models.AlertRuleGroupKey]models.RulesGroup{
			groupKey: {makeRule("rule-1"), makeRule("rule-2")},
		}

		err := ValidateProvisioningConsistencyCreate(ctx, store, orgID, models.ProvenanceNone, affectedGroups)
		require.NoError(t, err)
	})

	t.Run("mixed provenances in different groups - should only reject groups with multiple rules", func(t *testing.T) {
		groupKey2 := models.AlertRuleGroupKey{
			OrgID:        orgID,
			NamespaceUID: "test-namespace",
			RuleGroup:    "test-group-2",
		}

		store := &mockProvenanceStore{
			provenances: map[string]models.Provenance{
				"rule-1": models.ProvenanceNone, // Single rule - no conflict
				"rule-2": models.ProvenanceNone, // Multiple rules - conflict!
				"rule-3": models.ProvenanceAPI,
			},
		}
		affectedGroups := map[models.AlertRuleGroupKey]models.RulesGroup{
			groupKey:  {makeRule("rule-1")},                  // Single rule - should be allowed
			groupKey2: {makeRule("rule-2"), makeRule("rule-3")}, // Multiple with conflict - should fail
		}

		err := ValidateProvisioningConsistencyCreate(ctx, store, orgID, models.ProvenanceAPI, affectedGroups)
		require.Error(t, err)
		assert.ErrorIs(t, err, models.ErrAlertRuleFailedValidation)
		// group-1 should not be in the error since it has only 1 rule
		assert.NotContains(t, err.Error(), "test-group\"")
		// group-2 should be in the error since it has multiple rules with conflict
		assert.Contains(t, err.Error(), "test-group-2")
	})

	t.Run("updating single rule in group - should allow changing provenance", func(t *testing.T) {
		store := &mockProvenanceStore{
			provenances: map[string]models.Provenance{
				"rule-1": models.ProvenanceNone,
			},
		}
		affectedGroups := map[models.AlertRuleGroupKey]models.RulesGroup{
			groupKey: {makeRule("rule-1")},
		}

		// Single rule in group being UPDATED - should allow changing provenance from None to API
		err := ValidateProvisioningConsistencyUpdate(ctx, store, orgID, models.ProvenanceAPI, affectedGroups, "rule-1")
		require.NoError(t, err)
	})

	t.Run("nil rules in group are skipped", func(t *testing.T) {
		store := &mockProvenanceStore{
			provenances: map[string]models.Provenance{
				"rule-1": models.ProvenanceAPI,
			},
		}
		affectedGroups := map[models.AlertRuleGroupKey]models.RulesGroup{
			groupKey: {nil, makeRule("rule-1"), nil},
		}

		err := ValidateProvisioningConsistencyCreate(ctx, store, orgID, models.ProvenanceAPI, affectedGroups)
		require.NoError(t, err)
	})

	t.Run("provenance store error is propagated", func(t *testing.T) {
		expectedErr := errors.New("database error")
		store := &mockProvenanceStore{err: expectedErr}
		affectedGroups := map[models.AlertRuleGroupKey]models.RulesGroup{
			groupKey: {makeRule("rule-1")},
		}

		err := ValidateProvisioningConsistencyCreate(ctx, store, orgID, models.ProvenanceAPI, affectedGroups)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get provenances")
	})

	t.Run("different provisioning sources (api, file, converted_prometheus) are compatible", func(t *testing.T) {
		store := &mockProvenanceStore{
			provenances: map[string]models.Provenance{
				"rule-1": models.ProvenanceAPI,
				"rule-2": models.ProvenanceFile,
				"rule-3": models.ProvenanceConvertedPrometheus,
			},
		}
		affectedGroups := map[models.AlertRuleGroupKey]models.RulesGroup{
			groupKey: {makeRule("rule-1"), makeRule("rule-2"), makeRule("rule-3")},
		}

		// Adding another provisioned rule to a group with mixed provisioned sources should be fine
		err := ValidateProvisioningConsistencyCreate(ctx, store, orgID, models.ProvenanceAPI, affectedGroups)
		require.NoError(t, err)
	})
}

func TestHasProvenanceConflict(t *testing.T) {
	makeRule := func(uid string) *models.AlertRule {
		return &models.AlertRule{UID: uid}
	}

	t.Run("no conflict when target and existing are both provisioned", func(t *testing.T) {
		provenances := map[string]models.Provenance{
			"rule-1": models.ProvenanceAPI,
			"rule-2": models.ProvenanceFile,
		}
		rules := []*models.AlertRule{makeRule("rule-1"), makeRule("rule-2")}

		conflict := hasProvenanceConflict(provenances, rules, models.ProvenanceAPI, "")
		assert.False(t, conflict)
	})

	t.Run("no conflict when target and existing are both non-provisioned", func(t *testing.T) {
		provenances := map[string]models.Provenance{
			"rule-1": models.ProvenanceNone,
			"rule-2": models.ProvenanceNone,
		}
		rules := []*models.AlertRule{makeRule("rule-1"), makeRule("rule-2")}

		conflict := hasProvenanceConflict(provenances, rules, models.ProvenanceNone, "")
		assert.False(t, conflict)
	})

	t.Run("conflict when adding provisioned to non-provisioned", func(t *testing.T) {
		provenances := map[string]models.Provenance{
			"rule-1": models.ProvenanceNone,
		}
		rules := []*models.AlertRule{makeRule("rule-1")}

		conflict := hasProvenanceConflict(provenances, rules, models.ProvenanceAPI, "")
		assert.True(t, conflict)
	})

	t.Run("conflict when adding non-provisioned to provisioned", func(t *testing.T) {
		provenances := map[string]models.Provenance{
			"rule-1": models.ProvenanceAPI,
		}
		rules := []*models.AlertRule{makeRule("rule-1")}

		conflict := hasProvenanceConflict(provenances, rules, models.ProvenanceNone, "")
		assert.True(t, conflict)
	})

	t.Run("no conflict with empty rules list", func(t *testing.T) {
		provenances := map[string]models.Provenance{}
		rules := []*models.AlertRule{}

		conflict := hasProvenanceConflict(provenances, rules, models.ProvenanceAPI, "")
		assert.False(t, conflict)
	})

	t.Run("nil rules are skipped", func(t *testing.T) {
		provenances := map[string]models.Provenance{
			"rule-1": models.ProvenanceAPI,
		}
		rules := []*models.AlertRule{nil, makeRule("rule-1"), nil}

		conflict := hasProvenanceConflict(provenances, rules, models.ProvenanceAPI, "")
		assert.False(t, conflict)
	})
}

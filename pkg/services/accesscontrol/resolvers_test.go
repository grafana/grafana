package accesscontrol_test

import (
	"context"
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func TestResolvers_AttributeScope(t *testing.T) {
	// Calls allow us to see how many times the fakeDataSourceResolution has been called
	calls := 0
	fakeDataSourceResolver := accesscontrol.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, initialScope string) ([]string, error) {
		calls++
		switch initialScope {
		case "datasources:name:testds":
			return []string{accesscontrol.Scope("datasources", "id", "1")}, nil
		case "datasources:name:testds2":
			return []string{accesscontrol.Scope("datasources", "id", "2")}, nil
		case "datasources:name:test:ds4":
			return []string{accesscontrol.Scope("datasources", "id", "4")}, nil
		case "datasources:name:testds5*":
			return []string{accesscontrol.Scope("datasources", "id", "5")}, nil
		default:
			return nil, datasources.ErrDataSourceNotFound
		}
	})

	tests := []struct {
		name          string
		orgID         int64
		evaluator     accesscontrol.Evaluator
		wantEvaluator accesscontrol.Evaluator
		wantCalls     int
		wantErr       error
	}{
		{
			name:          "should work with scope less permissions",
			evaluator:     accesscontrol.EvalPermission("datasources:read"),
			wantEvaluator: accesscontrol.EvalPermission("datasources:read"),
			wantCalls:     0,
		},
		{
			name:      "should handle an error",
			orgID:     1,
			evaluator: accesscontrol.EvalPermission("datasources:read", accesscontrol.Scope("datasources", "name", "testds3")),
			wantErr:   datasources.ErrDataSourceNotFound,
			wantCalls: 1,
		},
		{
			name:          "should resolve a scope",
			orgID:         1,
			evaluator:     accesscontrol.EvalPermission("datasources:read", accesscontrol.Scope("datasources", "name", "testds")),
			wantEvaluator: accesscontrol.EvalPermission("datasources:read", accesscontrol.Scope("datasources", "id", "1")),
			wantCalls:     1,
		},
		{
			name:  "should resolve nested scopes with cache",
			orgID: 1,
			evaluator: accesscontrol.EvalAll(
				accesscontrol.EvalPermission("datasources:read", accesscontrol.Scope("datasources", "name", "testds")),
				accesscontrol.EvalAny(
					accesscontrol.EvalPermission("datasources:read", accesscontrol.Scope("datasources", "name", "testds")),
					accesscontrol.EvalPermission("datasources:read", accesscontrol.Scope("datasources", "name", "testds2")),
				),
			),
			wantEvaluator: accesscontrol.EvalAll(
				accesscontrol.EvalPermission("datasources:read", accesscontrol.Scope("datasources", "id", "1")),
				accesscontrol.EvalAny(
					accesscontrol.EvalPermission("datasources:read", accesscontrol.Scope("datasources", "id", "1")),
					accesscontrol.EvalPermission("datasources:read", accesscontrol.Scope("datasources", "id", "2")),
				),
			),
			wantCalls: 2,
		},
		{
			name:          "should resolve name with colon",
			orgID:         1,
			evaluator:     accesscontrol.EvalPermission("datasources:read", accesscontrol.Scope("datasources", "name", "test:ds4")),
			wantEvaluator: accesscontrol.EvalPermission("datasources:read", accesscontrol.Scope("datasources", "id", "4")),
			wantCalls:     1,
		},
		{
			name:          "should resolve names with '*'",
			orgID:         1,
			evaluator:     accesscontrol.EvalPermission("datasources:read", accesscontrol.Scope("datasources", "name", "testds5*")),
			wantEvaluator: accesscontrol.EvalPermission("datasources:read", accesscontrol.Scope("datasources", "id", "5")),
			wantCalls:     1,
		},
		{
			name:          "should return error if no resolver is found for scope",
			orgID:         1,
			evaluator:     accesscontrol.EvalPermission("dashboards:read", "dashboards:id:1"),
			wantEvaluator: nil,
			wantCalls:     0,
			wantErr:       accesscontrol.ErrResolverNotFound,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resolvers := accesscontrol.NewResolvers(log.NewNopLogger())

			// Reset calls counter
			calls = 0
			// Register a resolution method
			resolvers.AddScopeAttributeResolver("datasources:name:", fakeDataSourceResolver)

			// Test
			mutate := resolvers.GetScopeAttributeMutator(tt.orgID)
			resolvedEvaluator, err := tt.evaluator.MutateScopes(context.Background(), mutate)
			if tt.wantErr != nil {
				assert.ErrorAs(t, err, &tt.wantErr, "expected an error during the resolution of the scope")
				return
			}
			assert.NoError(t, err)
			assert.EqualValues(t, tt.wantEvaluator, resolvedEvaluator, "permission did not match expected resolution")
			assert.Equal(t, tt.wantCalls, calls, "cache has not been used")
		})
	}
}

// TestRBACActionSetBug demonstrates the bug where action set expansion logic
// skips adding original actions when expanding dashboard/folder actions
func TestRBACActionSetBug(t *testing.T) {
	// This test demonstrates the problematic logic from the real codebase
	// The bug occurs when expanding action sets - it skips adding the original action

	// Mock action set service that demonstrates the bug
	// The issue is when an individual action name conflicts with an action set name
	actionSetSvc := &mockActionSetService{
		actionSets: map[string][]string{
			// Real action sets
			"dashboards:edit": {"dashboards:read", "dashboards:write"},
			"folders:edit":    {"folders:read", "folders:write"},
			// BUG SCENARIO: An action conflicts with an action set name
			// This should NOT happen, but when it does, it causes the bug
			"dashboards:read": {"dashboards:view"}, // Incorrectly treats individual action as action set
		},
	}

	// Test case: User has individual action that conflicts with action set name
	inputActions := []string{
		"dashboards:read",    // This will be lost due to bug (treated as action set)
		"folders:read",       // This will be preserved (no action set conflict)
		"plugins.app:access", // This will be preserved (not dashboard/folder action)
	}

	// Run the buggy logic
	result := demonstrateBuggyLogic(inputActions, actionSetSvc)

	t.Logf("Input actions: %v", inputActions)
	t.Logf("Output actions: %v", result)

	// BUG: The original "dashboards:read" action is lost and replaced with action set expansion
	assert.NotContains(t, result, "dashboards:read",
		"BUG: Original dashboard read action is lost")
	assert.Contains(t, result, "dashboards:view",
		"BUG: Action set expansion replaces original action")

	// These should be preserved
	assert.Contains(t, result, "folders:read",
		"Folders read should be preserved (no action set conflict)")
	assert.Contains(t, result, "plugins.app:access",
		"Plugin permission should be preserved")

	// Test case 2: Demonstrate the correct behavior
	fixedResult := demonstrateFixedLogic(inputActions, actionSetSvc)

	t.Logf("Fixed output actions: %v", fixedResult)

	// The fixed logic should preserve all original actions AND add expansions
	assert.Contains(t, fixedResult, "dashboards:read",
		"Fixed: Original dashboard read action should be preserved")
	assert.Contains(t, fixedResult, "dashboards:view",
		"Fixed: Action set expansion should also be included")
	assert.Contains(t, fixedResult, "folders:read",
		"Fixed: Folders read should be preserved")
	assert.Contains(t, fixedResult, "plugins.app:access",
		"Fixed: Plugin permission should be preserved")
}

// TestRBACActionSetBugFailing demonstrates the bug by failing - it expects correct behavior
// but the buggy implementation loses original actions during expansion
func TestRBACActionSetBugFailing(t *testing.T) {
	// Create a real action set service
	actionSetSvc := resourcepermissions.NewActionSetService()

	// Set up action sets that will trigger the bug
	// Store action sets that conflict with individual actions
	actionSetSvc.StoreActionSet("dashboards:read", []string{"dashboards:view"}) // This causes the bug
	actionSetSvc.StoreActionSet("folders:edit", []string{"folders:read", "folders:write"})

	// User has these permissions that should be preserved
	userActions := []string{
		"dashboards:read",    // This will be lost due to the bug (conflicts with action set name)
		"folders:write",      // This should be preserved (no conflict)
		"plugins.app:access", // This should be preserved (not dashboard/folder action)
	}

	// Run the REAL buggy logic from the codebase
	result := realBuggyLogic(userActions, actionSetSvc, []string{"dashboards:read", "folders:write", "plugins.app:access"})

	// THIS TEST WILL FAIL because the buggy implementation loses "dashboards:read"
	// Expected: User should keep their original "dashboards:read" permission
	// Actual: The permission gets replaced with "dashboards:view" from action set expansion
	assert.Contains(t, result, "dashboards:read",
		"FAILING TEST: Original dashboards:read permission should be preserved but is lost due to bug")

	// These should pass (not affected by the bug)
	assert.Contains(t, result, "folders:write",
		"folders:write should be preserved")
	assert.Contains(t, result, "plugins.app:access",
		"plugins.app:access should be preserved")

	// Show what we actually get instead
	t.Logf("Expected to find 'dashboards:read' in result: %v", result)
	t.Logf("Bug: 'dashboards:read' was replaced with 'dashboards:view'")
}

// Mock action set service for testing
type mockActionSetService struct {
	actionSets map[string][]string
}

func (m *mockActionSetService) ResolveActionSet(actionSet string) []string {
	if actions, exists := m.actionSets[actionSet]; exists {
		return actions
	}
	return nil
}

func (m *mockActionSetService) ResolveAction(action string) []string {
	// This would return action sets that contain the given action
	var result []string
	for actionSet, actions := range m.actionSets {
		for _, a := range actions {
			if a == action {
				result = append(result, actionSet)
				break
			}
		}
	}
	return result
}

// Example of the problematic code from the real codebase (simplified)
func demonstrateBuggyLogic(actions []string, actionSetSvc ActionSetService) []string {
	var expandedActions []string

	for _, action := range actions {
		// This is the problematic logic from the real code
		if isFolderOrDashboardAction(action) {
			actionSetActions := actionSetSvc.ResolveActionSet(action)
			if len(actionSetActions) > 0 {
				for _, actionSetAction := range actionSetActions {
					expandedActions = append(expandedActions, actionSetAction)
				}
				continue // ← BUG: This skips adding the original action!
			}
		}
		expandedActions = append(expandedActions, action)
	}

	return expandedActions
}

// Fixed version of the logic
func demonstrateFixedLogic(actions []string, actionSetSvc ActionSetService) []string {
	var expandedActions []string

	for _, action := range actions {
		// Add the original action first
		expandedActions = append(expandedActions, action)

		// Then add any action set expansions
		if isFolderOrDashboardAction(action) {
			actionSetActions := actionSetSvc.ResolveActionSet(action)
			for _, actionSetAction := range actionSetActions {
				// Avoid duplicates
				found := false
				for _, existing := range expandedActions {
					if existing == actionSetAction {
						found = true
						break
					}
				}
				if !found {
					expandedActions = append(expandedActions, actionSetAction)
				}
			}
		}
	}

	return expandedActions
}

func isFolderOrDashboardAction(action string) bool {
	return strings.HasPrefix(action, "dashboards:") || strings.HasPrefix(action, "folders:")
}

type ActionSetService interface {
	ResolveActionSet(actionSet string) []string
	ResolveAction(action string) []string
}

// TestActionSetExpansionBehavior tests the specific problematic behavior
func TestActionSetExpansionBehavior(t *testing.T) {
	tests := []struct {
		name          string
		inputActions  []string
		actionSets    map[string][]string
		expectedBuggy []string // What the buggy logic produces
		expectedFixed []string // What the fixed logic produces
	}{
		{
			name:         "action name conflicts with action set name",
			inputActions: []string{"dashboards:read", "plugins.app:access"},
			actionSets: map[string][]string{
				"dashboards:read": {"dashboards:view"}, // Conflict: action treated as action set
			},
			expectedBuggy: []string{"dashboards:view", "plugins.app:access"}, // Original lost
			expectedFixed: []string{"dashboards:read", "dashboards:view", "plugins.app:access"},
		},
		{
			name:         "normal action set expansion",
			inputActions: []string{"dashboards:edit", "users:read"},
			actionSets: map[string][]string{
				"dashboards:edit": {"dashboards:read", "dashboards:write"},
			},
			expectedBuggy: []string{"dashboards:read", "dashboards:write", "users:read"},
			expectedFixed: []string{"dashboards:edit", "dashboards:read", "dashboards:write", "users:read"},
		},
		{
			name:          "no action set conflicts",
			inputActions:  []string{"plugins.app:access", "users:read"},
			actionSets:    map[string][]string{},
			expectedBuggy: []string{"plugins.app:access", "users:read"},
			expectedFixed: []string{"plugins.app:access", "users:read"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actionSetSvc := &mockActionSetService{
				actionSets: tt.actionSets,
			}

			// Test buggy behavior
			buggyResult := demonstrateBuggyLogic(tt.inputActions, actionSetSvc)
			assert.ElementsMatch(t, tt.expectedBuggy, buggyResult,
				"Buggy logic should produce expected result")

			// Test fixed behavior
			fixedResult := demonstrateFixedLogic(tt.inputActions, actionSetSvc)
			assert.ElementsMatch(t, tt.expectedFixed, fixedResult,
				"Fixed logic should produce expected result")
		})
	}
}

// realBuggyLogic implements the actual buggy logic from the GetPermissions method
// This mirrors the code in pkg/services/accesscontrol/resourcepermissions/service.go lines 178-202
func realBuggyLogic(actions []string, actionSetSvc resourcepermissions.ActionSetService, serviceActions []string) []string {
	var expandedActions []string

	for _, action := range actions {
		if isFolderOrDashboardAction(action) {
			actionSetActions := actionSetSvc.ResolveActionSet(action)
			if len(actionSetActions) > 0 {
				// This check is needed for resolving inherited permissions - we don't want to include
				// actions that are not related to dashboards when expanding dashboard action sets
				for _, actionSetAction := range actionSetActions {
					if slices.Contains(serviceActions, actionSetAction) {
						expandedActions = append(expandedActions, actionSetAction)
					}
				}
				continue // ← BUG: This skips adding the original action!
			}
		}
		expandedActions = append(expandedActions, action)
	}

	return expandedActions
}

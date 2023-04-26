package api

import (
	"math"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/go-openapi/loads"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/util"
)

func TestAuthorize(t *testing.T) {
	json, err := os.ReadFile(filepath.Join("tooling", "spec.json"))
	require.NoError(t, err)
	swaggerSpec, err := loads.Analyzed(json, "")
	require.NoError(t, err)

	paths := make(map[string][]string)

	for p, item := range swaggerSpec.Spec().Paths.Paths {
		var methods []string

		if item.Get != nil {
			methods = append(methods, http.MethodGet)
		}
		if item.Put != nil {
			methods = append(methods, http.MethodPut)
		}
		if item.Post != nil {
			methods = append(methods, http.MethodPost)
		}
		if item.Delete != nil {
			methods = append(methods, http.MethodDelete)
		}
		if item.Patch != nil {
			methods = append(methods, http.MethodPatch)
		}
		paths[p] = methods
	}
	require.Len(t, paths, 47)

	ac := acmock.New()
	api := &API{AccessControl: ac}

	t.Run("should not panic on known routes", func(t *testing.T) {
		for path, methods := range paths {
			for _, method := range methods {
				require.NotPanics(t, func() {
					api.authorize(method, path)
				})
			}
		}
	})

	t.Run("should panic if route is unknown", func(t *testing.T) {
		require.Panics(t, func() {
			api.authorize("test", "test")
		})
	})
}

func createAllCombinationsOfPermissions(permissions map[string][]string) []map[string][]string {
	type actionscope struct {
		action string
		scope  string
	}

	var flattenPermissions []actionscope
	for action, scopes := range permissions {
		for _, scope := range scopes {
			flattenPermissions = append(flattenPermissions, actionscope{
				action,
				scope,
			})
		}
	}

	l := len(flattenPermissions)
	// this is all possible combinations of the permissions
	var permissionCombinations []map[string][]string
	for bit := uint(0); bit < uint(math.Pow(2, float64(l))); bit++ {
		var tuple []actionscope
		for idx := 0; idx < l; idx++ {
			if (bit>>idx)&1 == 1 {
				tuple = append(tuple, flattenPermissions[idx])
			}
		}

		combination := make(map[string][]string)
		for _, perm := range tuple {
			combination[perm.action] = append(combination[perm.action], perm.scope)
		}

		permissionCombinations = append(permissionCombinations, combination)
	}
	return permissionCombinations
}

func getDatasourceScopesForRules(rules models.RulesGroup) []string {
	scopesMap := map[string]struct{}{}
	var result []string
	for _, rule := range rules {
		for _, query := range rule.Data {
			scope := datasources.ScopeProvider.GetResourceScopeUID(query.DatasourceUID)
			if _, ok := scopesMap[scope]; ok {
				continue
			}
			result = append(result, scope)
			scopesMap[scope] = struct{}{}
		}
	}
	return result
}

func mapUpdates(updates []store.RuleDelta, mapFunc func(store.RuleDelta) *models.AlertRule) models.RulesGroup {
	result := make(models.RulesGroup, 0, len(updates))
	for _, update := range updates {
		result = append(result, mapFunc(update))
	}
	return result
}

func TestAuthorizeRuleChanges(t *testing.T) {
	groupKey := models.GenerateGroupKey(rand.Int63())
	namespaceIdScope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(groupKey.NamespaceUID)

	testCases := []struct {
		name        string
		changes     func() *store.GroupDelta
		permissions func(c *store.GroupDelta) map[string][]string
	}{
		{
			name: "if there are rules to add it should check create action and query for datasource",
			changes: func() *store.GroupDelta {
				return &store.GroupDelta{
					GroupKey: groupKey,
					New:      models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(withGroupKey(groupKey))),
					Update:   nil,
					Delete:   nil,
				}
			},
			permissions: func(c *store.GroupDelta) map[string][]string {
				var scopes []string
				for _, rule := range c.New {
					for _, query := range rule.Data {
						scopes = append(scopes, datasources.ScopeProvider.GetResourceScopeUID(query.DatasourceUID))
					}
				}
				return map[string][]string{
					ac.ActionAlertingRuleCreate: {
						namespaceIdScope,
					},
					datasources.ActionQuery: scopes,
				}
			},
		},
		{
			name: "if there are rules to delete it should check delete action and query for datasource",
			changes: func() *store.GroupDelta {
				rules := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(withGroupKey(groupKey)))
				rules2 := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(withGroupKey(groupKey)))
				return &store.GroupDelta{
					GroupKey: groupKey,
					AffectedGroups: map[models.AlertRuleGroupKey]models.RulesGroup{
						groupKey: append(rules, rules2...),
					},
					New:    nil,
					Update: nil,
					Delete: rules2,
				}
			},
			permissions: func(c *store.GroupDelta) map[string][]string {
				return map[string][]string{
					ac.ActionAlertingRuleDelete: {
						namespaceIdScope,
					},
					datasources.ActionQuery: getDatasourceScopesForRules(c.AffectedGroups[c.GroupKey]),
				}
			},
		},
		{
			name: "if there are rules to update within the same namespace it should check update action and access to datasource",
			changes: func() *store.GroupDelta {
				rules1 := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(withGroupKey(groupKey)))
				rules := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(withGroupKey(groupKey)))
				updates := make([]store.RuleDelta, 0, len(rules))

				for _, rule := range rules {
					cp := models.CopyRule(rule)
					cp.Data = []models.AlertQuery{models.GenerateAlertQuery()}
					updates = append(updates, store.RuleDelta{
						Existing: rule,
						New:      cp,
						Diff:     nil,
					})
				}

				return &store.GroupDelta{
					GroupKey: groupKey,
					AffectedGroups: map[models.AlertRuleGroupKey]models.RulesGroup{
						groupKey: append(rules, rules1...),
					},
					New:    nil,
					Update: updates,
					Delete: nil,
				}
			},
			permissions: func(c *store.GroupDelta) map[string][]string {
				scopes := getDatasourceScopesForRules(append(c.AffectedGroups[c.GroupKey], mapUpdates(c.Update, func(update store.RuleDelta) *models.AlertRule {
					return update.New
				})...))
				return map[string][]string{
					ac.ActionAlertingRuleUpdate: {
						namespaceIdScope,
					},
					datasources.ActionQuery: scopes,
				}
			},
		},
		{
			name: "if there are rules that are moved between namespaces it should check delete+add action and access to group where rules come from",
			changes: func() *store.GroupDelta {
				rules1 := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(withGroupKey(groupKey)))
				rules := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(withGroupKey(groupKey)))

				targetGroupKey := models.GenerateGroupKey(groupKey.OrgID)

				updates := make([]store.RuleDelta, 0, len(rules))
				for _, rule := range rules {
					cp := models.CopyRule(rule)
					withGroupKey(targetGroupKey)(cp)
					cp.Data = []models.AlertQuery{
						models.GenerateAlertQuery(),
					}

					updates = append(updates, store.RuleDelta{
						Existing: rule,
						New:      cp,
					})
				}

				return &store.GroupDelta{
					GroupKey: targetGroupKey,
					AffectedGroups: map[models.AlertRuleGroupKey]models.RulesGroup{
						groupKey: append(rules, rules1...),
					},
					New:    nil,
					Update: updates,
					Delete: nil,
				}
			},
			permissions: func(c *store.GroupDelta) map[string][]string {
				dsScopes := getDatasourceScopesForRules(
					append(append(append(c.AffectedGroups[c.GroupKey],
						mapUpdates(c.Update, func(update store.RuleDelta) *models.AlertRule {
							return update.New
						})...,
					), mapUpdates(c.Update, func(update store.RuleDelta) *models.AlertRule {
						return update.Existing
					})...), c.AffectedGroups[groupKey]...),
				)

				var deleteScopes []string
				for key := range c.AffectedGroups {
					deleteScopes = append(deleteScopes, dashboards.ScopeFoldersProvider.GetResourceScopeUID(key.NamespaceUID))
				}

				return map[string][]string{
					ac.ActionAlertingRuleDelete: deleteScopes,
					ac.ActionAlertingRuleCreate: {
						dashboards.ScopeFoldersProvider.GetResourceScopeUID(c.GroupKey.NamespaceUID),
					},
					datasources.ActionQuery: dsScopes,
				}
			},
		},
		{
			name: "if there are rules that are moved between groups in the same namespace it should check update action and access to all groups (source+target)",
			changes: func() *store.GroupDelta {
				targetGroupKey := models.AlertRuleGroupKey{
					OrgID:        groupKey.OrgID,
					NamespaceUID: groupKey.NamespaceUID,
					RuleGroup:    util.GenerateShortUID(),
				}
				sourceGroup := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(withGroupKey(groupKey)))
				targetGroup := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(withGroupKey(targetGroupKey)))

				updates := make([]store.RuleDelta, 0, len(sourceGroup))
				toCopy := len(sourceGroup)
				if toCopy > 1 {
					toCopy = rand.Intn(toCopy-1) + 1
				}
				for i := 0; i < toCopy; i++ {
					rule := sourceGroup[0]
					cp := models.CopyRule(rule)
					withGroupKey(targetGroupKey)(cp)
					cp.Data = []models.AlertQuery{
						models.GenerateAlertQuery(),
					}

					updates = append(updates, store.RuleDelta{
						Existing: rule,
						New:      cp,
					})
				}

				return &store.GroupDelta{
					GroupKey: targetGroupKey,
					AffectedGroups: map[models.AlertRuleGroupKey]models.RulesGroup{
						groupKey:       sourceGroup,
						targetGroupKey: targetGroup,
					},
					New:    nil,
					Update: updates,
					Delete: nil,
				}
			},
			permissions: func(c *store.GroupDelta) map[string][]string {
				scopes := make(map[string]struct{})
				for _, update := range c.Update {
					for _, query := range update.New.Data {
						scopes[datasources.ScopeProvider.GetResourceScopeUID(query.DatasourceUID)] = struct{}{}
					}
					for _, query := range update.Existing.Data {
						scopes[datasources.ScopeProvider.GetResourceScopeUID(query.DatasourceUID)] = struct{}{}
					}
				}
				for _, rules := range c.AffectedGroups {
					for _, rule := range rules {
						for _, query := range rule.Data {
							scopes[datasources.ScopeProvider.GetResourceScopeUID(query.DatasourceUID)] = struct{}{}
						}
					}
				}

				dsScopes := make([]string, 0, len(scopes))
				for key := range scopes {
					dsScopes = append(dsScopes, key)
				}

				return map[string][]string{
					ac.ActionAlertingRuleUpdate: {
						dashboards.ScopeFoldersProvider.GetResourceScopeUID(c.GroupKey.NamespaceUID),
					},
					datasources.ActionQuery: dsScopes,
				}
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			groupChanges := testCase.changes()
			permissions := testCase.permissions(groupChanges)

			t.Run("should fail with insufficient permissions", func(t *testing.T) {
				permissionCombinations := createAllCombinationsOfPermissions(permissions)
				permissionCombinations = permissionCombinations[0 : len(permissionCombinations)-1] // exclude all permissions
				for _, missing := range permissionCombinations {
					executed := false
					err := authorizeRuleChanges(groupChanges, func(evaluator ac.Evaluator) bool {
						response := evaluator.Evaluate(missing)
						executed = true
						return response
					})
					require.Errorf(t, err, "expected error because less permissions than expected were provided. Provided: %v; Expected: %v", missing, permissions)
					require.ErrorIs(t, err, ErrAuthorization)
					require.Truef(t, executed, "evaluation function is expected to be called but it was not.")
				}
			})

			executed := false

			err := authorizeRuleChanges(groupChanges, func(evaluator ac.Evaluator) bool {
				response := evaluator.Evaluate(permissions)
				require.Truef(t, response, "provided permissions [%v] is not enough for requested permissions [%s]", permissions, evaluator.GoString())
				executed = true
				return true
			})
			require.NoError(t, err)
			require.Truef(t, executed, "evaluation function is expected to be called but it was not.")
		})
	}
}

func TestCheckDatasourcePermissionsForRule(t *testing.T) {
	rule := models.AlertRuleGen()()

	expressionByType := models.GenerateAlertQuery()
	expressionByType.QueryType = expr.DatasourceType
	expressionByUID := models.GenerateAlertQuery()
	expressionByUID.DatasourceUID = expr.DatasourceUID

	var data []models.AlertQuery
	var scopes []string
	expectedExecutions := rand.Intn(3) + 2
	for i := 0; i < expectedExecutions; i++ {
		q := models.GenerateAlertQuery()
		scopes = append(scopes, datasources.ScopeProvider.GetResourceScopeUID(q.DatasourceUID))
		data = append(data, q)
	}

	data = append(data, expressionByType, expressionByUID)
	rand.Shuffle(len(data), func(i, j int) {
		data[j], data[i] = data[i], data[j]
	})

	rule.Data = data

	t.Run("should check only expressions", func(t *testing.T) {
		permissions := map[string][]string{
			datasources.ActionQuery: scopes,
		}

		executed := 0

		eval := authorizeDatasourceAccessForRule(rule, func(evaluator ac.Evaluator) bool {
			response := evaluator.Evaluate(permissions)
			require.Truef(t, response, "provided permissions [%v] is not enough for requested permissions [%s]", permissions, evaluator.GoString())
			executed++
			return true
		})

		require.True(t, eval)
		require.Equal(t, expectedExecutions, executed)
	})

	t.Run("should return on first negative evaluation", func(t *testing.T) {
		executed := 0

		eval := authorizeDatasourceAccessForRule(rule, func(evaluator ac.Evaluator) bool {
			executed++
			return false
		})

		require.False(t, eval)
		require.Equal(t, 1, executed)
	})
}

func Test_authorizeAccessToRuleGroup(t *testing.T) {
	t.Run("should return true if user has access to all datasources of all rules in group", func(t *testing.T) {
		rules := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen())
		var scopes []string
		for _, rule := range rules {
			for _, query := range rule.Data {
				scopes = append(scopes, datasources.ScopeProvider.GetResourceScopeUID(query.DatasourceUID))
			}
		}
		permissions := map[string][]string{
			datasources.ActionQuery: scopes,
		}

		result := authorizeAccessToRuleGroup(rules, func(evaluator ac.Evaluator) bool {
			response := evaluator.Evaluate(permissions)
			require.Truef(t, response, "provided permissions [%v] is not enough for requested permissions [%s]", permissions, evaluator.GoString())
			return true
		})

		require.True(t, result)
	})
	t.Run("should return false if user does not have access to at least one rule in group", func(t *testing.T) {
		rules := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen())
		var scopes []string
		for _, rule := range rules {
			for _, query := range rule.Data {
				scopes = append(scopes, datasources.ScopeProvider.GetResourceScopeUID(query.DatasourceUID))
			}
		}
		permissions := map[string][]string{
			datasources.ActionQuery: scopes,
		}

		rule := models.AlertRuleGen()()
		rules = append(rules, rule)

		result := authorizeAccessToRuleGroup(rules, func(evaluator ac.Evaluator) bool {
			response := evaluator.Evaluate(permissions)
			return response
		})

		require.False(t, result)
	})
}

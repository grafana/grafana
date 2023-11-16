package accesscontrol

import (
	"context"
	"math"
	"math/rand"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

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

func createUserWithPermissions(permissions map[string][]string) identity.Requester {
	return &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: permissions,
	}}
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
					New:      models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(models.WithGroupKey(groupKey))),
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
					ruleCreate: {
						namespaceIdScope,
					},
					datasources.ActionQuery: scopes,
				}
			},
		},
		{
			name: "if there are rules to delete it should check delete action and query for datasource",
			changes: func() *store.GroupDelta {
				rules := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(models.WithGroupKey(groupKey)))
				rules2 := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(models.WithGroupKey(groupKey)))
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
					ruleRead: {
						namespaceIdScope,
					},
					dashboards.ActionFoldersRead: {
						namespaceIdScope,
					},
					ruleDelete: {
						namespaceIdScope,
					},
					datasources.ActionQuery: getDatasourceScopesForRules(c.AffectedGroups[c.GroupKey]),
				}
			},
		},
		{
			name: "if there are rules to update within the same namespace it should check update action and access to datasource",
			changes: func() *store.GroupDelta {
				rules1 := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(models.WithGroupKey(groupKey)))
				rules := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(models.WithGroupKey(groupKey)))
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
					ruleRead: {
						namespaceIdScope,
					},
					dashboards.ActionFoldersRead: {
						namespaceIdScope,
					},
					ruleUpdate: {
						namespaceIdScope,
					},
					datasources.ActionQuery: scopes,
				}
			},
		},
		{
			name: "if there are rules that are moved between namespaces it should check delete+add action and access to group where rules come from",
			changes: func() *store.GroupDelta {
				rules1 := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(models.WithGroupKey(groupKey)))
				rules := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(models.WithGroupKey(groupKey)))

				targetGroupKey := models.GenerateGroupKey(groupKey.OrgID)

				updates := make([]store.RuleDelta, 0, len(rules))
				for _, rule := range rules {
					cp := models.CopyRule(rule)
					models.WithGroupKey(targetGroupKey)(cp)
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
					ruleDelete: deleteScopes,
					ruleCreate: {
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
				sourceGroup := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(models.WithGroupKey(groupKey)))
				targetGroup := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(models.WithGroupKey(targetGroupKey)))

				updates := make([]store.RuleDelta, 0, len(sourceGroup))
				toCopy := len(sourceGroup)
				if toCopy > 1 {
					toCopy = rand.Intn(toCopy-1) + 1
				}
				for i := 0; i < toCopy; i++ {
					rule := sourceGroup[0]
					cp := models.CopyRule(rule)
					models.WithGroupKey(targetGroupKey)(cp)
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
					ruleRead: {
						dashboards.ScopeFoldersProvider.GetResourceScopeUID(c.GroupKey.NamespaceUID),
					},
					dashboards.ActionFoldersRead: {
						dashboards.ScopeFoldersProvider.GetResourceScopeUID(c.GroupKey.NamespaceUID),
					},
					ruleUpdate: {
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
					ac := &recordingAccessControlFake{}
					srv := RuleService{
						ac: ac,
					}
					err := srv.AuthorizeRuleChanges(context.Background(), createUserWithPermissions(missing), groupChanges)

					assert.Errorf(t, err, "expected error because less permissions than expected were provided. Provided: %v; Expected: %v; Diff: %v", missing, permissions, cmp.Diff(permissions, missing))
					require.NotEmptyf(t, ac.EvaluateRecordings, "Access control was supposed to be called but it was not")
				}
			})

			ac := &recordingAccessControlFake{
				Callback: func(user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
					response := evaluator.Evaluate(user.GetPermissions())
					require.Truef(t, response, "provided permissions [%v] is not enough for requested permissions [%s]", permissions, evaluator.GoString())
					return response, nil
				},
			}
			srv := RuleService{
				ac: ac,
			}
			err := srv.AuthorizeRuleChanges(context.Background(), createUserWithPermissions(permissions), groupChanges)
			require.NoError(t, err)
			require.NotEmptyf(t, ac.EvaluateRecordings, "evaluation function is expected to be called but it was not.")
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
	for i := 0; i < rand.Intn(3)+2; i++ {
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
			ruleRead: {
				dashboards.ScopeFoldersProvider.GetResourceScopeUID(rule.NamespaceUID),
			},
			dashboards.ActionFoldersRead: {
				dashboards.ScopeFoldersProvider.GetResourceScopeUID(rule.NamespaceUID),
			},
			datasources.ActionQuery: scopes,
		}

		ac := &recordingAccessControlFake{}
		svc := RuleService{
			ac: ac,
		}

		eval := svc.AuthorizeDatasourceAccessForRule(context.Background(), createUserWithPermissions(permissions), rule)

		require.NoError(t, eval)
		require.Len(t, ac.EvaluateRecordings, 1)
	})

	t.Run("should return on first negative evaluation", func(t *testing.T) {
		ac := &recordingAccessControlFake{
			Callback: func(user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
				return false, nil
			},
		}
		svc := RuleService{
			ac: ac,
		}

		result := svc.AuthorizeDatasourceAccessForRule(context.Background(), createUserWithPermissions(nil), rule)

		require.Error(t, result)
		require.Len(t, ac.EvaluateRecordings, 1)
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
		namespaceScopes := make([]string, 0)
		for _, rule := range rules {
			namespaceScopes = append(namespaceScopes, dashboards.ScopeFoldersProvider.GetResourceScopeUID(rule.NamespaceUID))
		}
		permissions := map[string][]string{
			ruleRead:                     namespaceScopes,
			dashboards.ActionFoldersRead: namespaceScopes,
			datasources.ActionQuery:      scopes,
		}
		ac := &recordingAccessControlFake{}
		svc := RuleService{
			ac: ac,
		}

		result := svc.AuthorizeAccessToRuleGroup(context.Background(), createUserWithPermissions(permissions), rules)

		require.NoError(t, result)
		require.NotEmpty(t, ac.EvaluateRecordings)
	})
	t.Run("should return false if user does not have access to at least one rule in group", func(t *testing.T) {
		f := &folder.Folder{UID: "test-folder"}
		rules := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(models.WithNamespace(f)))
		var scopes []string
		for _, rule := range rules {
			for _, query := range rule.Data {
				scopes = append(scopes, datasources.ScopeProvider.GetResourceScopeUID(query.DatasourceUID))
			}
		}
		permissions := map[string][]string{
			ruleRead: {
				dashboards.ScopeFoldersProvider.GetResourceScopeUID(f.UID),
			},
			dashboards.ActionFoldersRead: {
				dashboards.ScopeFoldersProvider.GetResourceScopeUID(f.UID),
			},
			datasources.ActionQuery: scopes,
		}

		rule := models.AlertRuleGen(models.WithNamespace(f))()
		rules = append(rules, rule)

		ac := &recordingAccessControlFake{}

		svc := RuleService{
			ac: ac,
		}

		result := svc.AuthorizeAccessToRuleGroup(context.Background(), createUserWithPermissions(permissions), rules)

		require.Error(t, result)
	})
}

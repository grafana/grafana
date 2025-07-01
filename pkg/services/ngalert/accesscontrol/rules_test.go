package accesscontrol

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/cmputil"
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

func getReceiverScopesForRules(rules models.RulesGroup) []string {
	scopesMap := map[string]struct{}{}
	var result []string
	for _, rule := range rules {
		for _, ns := range rule.NotificationSettings {
			scope := ScopeReceiversProvider.GetResourceScopeUID(legacy_storage.NameToUid(ns.Receiver))
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

func getShallowQueryDiffs(queries []models.AlertQuery) []cmputil.Diff {
	result := make([]cmputil.Diff, 0, len(queries))
	for i := range queries {
		result = append(result, []cmputil.Diff{
			{
				Path: fmt.Sprintf("Data[%d].DatasourceUID", i),
			},
			{
				Path: fmt.Sprintf("Data[%d].Model", i),
			},
			{
				Path: fmt.Sprintf("Data[%d].RelativeTimeRange", i),
			},
			{
				Path: fmt.Sprintf("Data[%d].RefID", i),
			},
			{
				Path: fmt.Sprintf("Data[%d].QueryType", i),
			},
		}...)
	}
	return result
}

func TestAuthorizeRuleChanges(t *testing.T) {
	groupKey := models.GenerateGroupKey(rand.Int63())
	namespaceIdScope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(groupKey.NamespaceUID)
	gen := models.RuleGen
	genWithGroupKey := gen.With(gen.WithGroupKey(groupKey))

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
					New:      genWithGroupKey.GenerateManyRef(1, 5),
					Update:   nil,
					Delete:   nil,
				}
			},
			permissions: func(c *store.GroupDelta) map[string][]string {
				return map[string][]string{
					ruleCreate: {
						namespaceIdScope,
					},
					ruleRead: {
						namespaceIdScope,
					},
					dashboards.ActionFoldersRead: {
						namespaceIdScope,
					},
					datasources.ActionQuery:                   getDatasourceScopesForRules(c.New),
					accesscontrol.ActionAlertingReceiversRead: getReceiverScopesForRules(c.New),
				}
			},
		},
		{
			name: "if there are rules to delete it should check delete action and NOT query for datasource",
			changes: func() *store.GroupDelta {
				rules := genWithGroupKey.GenerateManyRef(1, 5)
				rules2 := genWithGroupKey.GenerateManyRef(1, 5)
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
				}
			},
		},
		{
			name: "if there are rules with query updates within the same namespace it should check update action and access to datasource",
			changes: func() *store.GroupDelta {
				rules1 := genWithGroupKey.GenerateManyRef(1, 5)
				rules := genWithGroupKey.GenerateManyRef(1, 5)
				updates := make([]store.RuleDelta, 0, len(rules))

				for _, rule := range rules {
					cp := models.CopyRule(rule)
					cp.Data = []models.AlertQuery{models.GenerateAlertQuery()}
					updates = append(updates, store.RuleDelta{
						Existing: rule,
						New:      cp,
						Diff:     getShallowQueryDiffs(cp.Data),
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
				scopes := getDatasourceScopesForRules(mapUpdates(c.Update, func(update store.RuleDelta) *models.AlertRule {
					return update.New
				}))
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
			name: "if there are rules w/o query updates to update within the same namespace it should check update action",
			changes: func() *store.GroupDelta {
				rules1 := genWithGroupKey.GenerateManyRef(1, 5)
				rules := genWithGroupKey.GenerateManyRef(1, 5)
				updates := make([]store.RuleDelta, 0, len(rules))

				for _, rule := range rules {
					cp := models.CopyRule(rule)
					cp.IsPaused = !rule.IsPaused
					cp.Title = rule.Title + " updated"
					updates = append(updates, store.RuleDelta{
						Existing: rule,
						New:      cp,
						Diff: []cmputil.Diff{
							{
								Path: "IsPaused",
							},
							{
								Path: "Title",
							},
						},
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
				}
			},
		},
		{
			name: "if there are rules that are moved between namespaces it should check delete+add action and access to group where rules come from",
			changes: func() *store.GroupDelta {
				rules1 := genWithGroupKey.GenerateManyRef(1, 5)
				rules := genWithGroupKey.GenerateManyRef(1, 5)

				targetGroupKey := models.GenerateGroupKey(groupKey.OrgID)

				updates := make([]store.RuleDelta, 0, len(rules))
				for _, rule := range rules {
					cp := models.CopyRule(rule, gen.WithGroupKey(targetGroupKey))

					updates = append(updates, store.RuleDelta{
						Existing: rule,
						New:      cp,
						Diff: []cmputil.Diff{
							{
								Path: "OrgID",
							},
							{
								Path: "NamespaceUID",
							},
							{
								Path: "RuleGroup",
							},
						},
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
				var deleteScopes []string
				for key := range c.AffectedGroups {
					deleteScopes = append(deleteScopes, dashboards.ScopeFoldersProvider.GetResourceScopeUID(key.NamespaceUID))
				}

				return map[string][]string{
					ruleDelete: deleteScopes,
					ruleCreate: {
						dashboards.ScopeFoldersProvider.GetResourceScopeUID(c.GroupKey.NamespaceUID),
					},
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
				sourceGroup := genWithGroupKey.GenerateManyRef(1, 5)
				targetGroup := gen.With(gen.WithGroupKey(targetGroupKey)).GenerateManyRef(1, 5)

				updates := make([]store.RuleDelta, 0, len(sourceGroup))
				toCopy := len(sourceGroup)
				if toCopy > 1 {
					toCopy = rand.Intn(toCopy-1) + 1
				}
				for i := 0; i < toCopy; i++ {
					rule := sourceGroup[0]
					cp := models.CopyRule(rule, gen.WithGroupKey(targetGroupKey))

					updates = append(updates, store.RuleDelta{
						Existing: rule,
						New:      cp,
						Diff: []cmputil.Diff{
							{
								Path: "OrgID",
							},
							{
								Path: "NamespaceUID",
							},
							{
								Path: "RuleGroup",
							},
						},
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
				}
			},
		},
		{
			name: "if there are rules that are moved between groups in the same namespace AND the query is changed it should check update action and access to all groups (source+target) and datasources",
			changes: func() *store.GroupDelta {
				targetGroupKey := models.AlertRuleGroupKey{
					OrgID:        groupKey.OrgID,
					NamespaceUID: groupKey.NamespaceUID,
					RuleGroup:    util.GenerateShortUID(),
				}
				sourceGroup := genWithGroupKey.GenerateManyRef(1, 5)
				targetGroup := gen.With(gen.WithGroupKey(targetGroupKey)).GenerateManyRef(1, 5)

				updates := make([]store.RuleDelta, 0, len(sourceGroup))
				toCopy := len(sourceGroup)
				if toCopy > 1 {
					toCopy = rand.Intn(toCopy-1) + 1
				}
				for i := 0; i < toCopy; i++ {
					rule := sourceGroup[0]
					cp := models.CopyRule(rule, gen.WithGroupKey(targetGroupKey), gen.WithQuery(models.GenerateAlertQuery()))

					updates = append(updates, store.RuleDelta{
						Existing: rule,
						New:      cp,
						Diff: append(
							[]cmputil.Diff{
								{
									Path: "OrgID",
								},
								{
									Path: "NamespaceUID",
								},
								{
									Path: "RuleGroup",
								},
							},
							getShallowQueryDiffs(cp.Data)...,
						),
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
				dsScopes := getDatasourceScopesForRules(
					mapUpdates(c.Update, func(update store.RuleDelta) *models.AlertRule {
						return update.New
					}),
				)

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
		{
			name: "if there are new rules that have notification settings it should check access to all receivers",
			changes: func() *store.GroupDelta {
				receiverName := "test-receiver"
				genWithNotificationSettings := genWithGroupKey.With(gen.WithNotificationSettingsGen(models.NotificationSettingsGen(models.NSMuts.WithReceiver(receiverName))))
				return &store.GroupDelta{
					GroupKey: groupKey,
					New:      genWithNotificationSettings.GenerateManyRef(1, 5),
					Update:   nil,
					Delete:   nil,
				}
			},
			permissions: func(c *store.GroupDelta) map[string][]string {
				return map[string][]string{
					ruleCreate: {
						namespaceIdScope,
					},
					ruleRead: {
						namespaceIdScope,
					},
					dashboards.ActionFoldersRead: {
						namespaceIdScope,
					},
					datasources.ActionQuery:                   getDatasourceScopesForRules(c.New),
					accesscontrol.ActionAlertingReceiversRead: getReceiverScopesForRules(c.New),
				}
			},
		},
		{
			name: "if there are rules that modify notification settings it should check access to all receivers",
			changes: func() *store.GroupDelta {
				receiverName := "test-receiver"
				genWithNotificationSettings := genWithGroupKey.With(gen.WithNotificationSettingsGen(models.NotificationSettingsGen(models.NSMuts.WithReceiver(receiverName))))
				rules1 := genWithNotificationSettings.GenerateManyRef(1, 5)
				rules := genWithNotificationSettings.GenerateManyRef(1, 5)
				updates := make([]store.RuleDelta, 0, len(rules))

				for _, rule := range rules {
					cp := models.CopyRule(rule)
					for i := range cp.NotificationSettings {
						cp.NotificationSettings[i].Receiver = "new-receiver"
					}
					updates = append(updates, store.RuleDelta{
						Existing: rule,
						New:      cp,
						Diff: []cmputil.Diff{
							{
								Path: "NotificationSettings[0].Receiver",
							},
						},
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
					accesscontrol.ActionAlertingReceiversRead: getReceiverScopesForRules(mapUpdates(c.Update, func(update store.RuleDelta) *models.AlertRule {
						return update.New
					})),
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
					srv := NewRuleService(ac)
					err := srv.AuthorizeRuleChanges(context.Background(), createUserWithPermissions(missing), groupChanges)

					assert.Errorf(t, err, "expected error because less permissions than expected were provided. Provided: %v; Expected: %v; Diff: %v", missing, permissions, cmp.Diff(permissions, missing))
					require.NotEmptyf(t, ac.EvaluateRecordings, "Access control was supposed to be called but it was not")
				}
			})

			ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())
			srv := NewRuleService(ac)
			err := srv.AuthorizeRuleChanges(context.Background(), createUserWithPermissions(permissions), groupChanges)
			require.NoError(t, err)
		})
	}
}

func TestCheckDatasourcePermissionsForRule(t *testing.T) {
	rule := models.RuleGen.GenerateRef()

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
		svc := NewRuleService(ac)

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
		svc := NewRuleService(ac)

		result := svc.AuthorizeDatasourceAccessForRule(context.Background(), createUserWithPermissions(nil), rule)

		require.Error(t, result)
		require.Len(t, ac.EvaluateRecordings, 1)
	})
}

func Test_authorizeAccessToRuleGroup(t *testing.T) {
	t.Run("should succeed if user has access to all namespaces", func(t *testing.T) {
		rules := models.RuleGen.GenerateManyRef(1, 5)
		namespaceScopes := make([]string, 0)
		for _, rule := range rules {
			namespaceScopes = append(namespaceScopes, dashboards.ScopeFoldersProvider.GetResourceScopeUID(rule.NamespaceUID))
		}
		permissions := map[string][]string{
			ruleRead:                     namespaceScopes,
			dashboards.ActionFoldersRead: namespaceScopes,
		}
		ac := &recordingAccessControlFake{}
		svc := NewRuleService(ac)

		result := svc.AuthorizeAccessToRuleGroup(context.Background(), createUserWithPermissions(permissions), rules)

		require.NoError(t, result)
		require.NotEmpty(t, ac.EvaluateRecordings)
	})

	t.Run("should fail if user does not have access to namespace", func(t *testing.T) {
		f := &folder.Folder{UID: "test-folder"}
		gen := models.RuleGen
		genWithFolder := gen.With(gen.WithNamespace(f.ToFolderReference()))
		rules := genWithFolder.GenerateManyRef(1, 5)

		ac := &recordingAccessControlFake{}
		svc := NewRuleService(ac)

		result := svc.AuthorizeAccessToRuleGroup(context.Background(), createUserWithPermissions(map[string][]string{}), rules)

		require.Error(t, result)
		require.ErrorIs(t, result, ErrAuthorizationBase)
	})
}

func TestCanReadAllRules(t *testing.T) {
	ac := &recordingAccessControlFake{}
	svc := NewRuleService(ac)

	testCases := []struct {
		permissions map[string][]string
		expected    bool
	}{
		{
			permissions: map[string][]string{
				ruleRead:                     {dashboards.ScopeFoldersProvider.GetResourceAllScope()},
				dashboards.ActionFoldersRead: {dashboards.ScopeFoldersProvider.GetResourceAllScope()},
			},
			expected: true,
		},
		{
			permissions: make(map[string][]string),
		},
		{
			permissions: map[string][]string{
				ruleRead:                     {dashboards.ScopeFoldersProvider.GetResourceScopeUID("test")},
				dashboards.ActionFoldersRead: {dashboards.ScopeFoldersProvider.GetResourceAllScope()},
			},
		},
		{
			permissions: map[string][]string{
				ruleRead:                     {dashboards.ScopeFoldersProvider.GetResourceAllScope()},
				dashboards.ActionFoldersRead: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("test")},
			},
		},
		{
			permissions: map[string][]string{
				ruleRead: {dashboards.ScopeFoldersProvider.GetResourceAllScope()},
			},
		},
		{
			permissions: map[string][]string{
				dashboards.ActionFoldersRead: {dashboards.ScopeFoldersProvider.GetResourceAllScope()},
			},
		},
	}

	for _, tc := range testCases {
		result, err := svc.CanReadAllRules(context.Background(), createUserWithPermissions(tc.permissions))
		assert.NoError(t, err)
		assert.Equalf(t, tc.expected, result, "permissions: %v", tc.permissions)
	}
}

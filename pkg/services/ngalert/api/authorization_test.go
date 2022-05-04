package api

import (
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/go-openapi/loads"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
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
	require.Len(t, paths, 34)

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

func TestAuthorizeRuleChanges(t *testing.T) {
	namespace := randFolder()
	namespaceIdScope := dashboards.ScopeFoldersProvider.GetResourceScope(strconv.FormatInt(namespace.Id, 10))

	testCases := []struct {
		name        string
		changes     func() *changes
		permissions func(c *changes) map[string][]string
	}{
		{
			name: "if there are rules to add it should check create action and query for datasource",
			changes: func() *changes {
				return &changes{
					New:    models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(withNamespace(namespace))),
					Update: nil,
					Delete: nil,
				}
			},
			permissions: func(c *changes) map[string][]string {
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
			name: "if there are rules to update within the same namespace it should check update action",
			changes: func() *changes {
				rules := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(withNamespace(namespace)))
				updates := make([]ruleUpdate, 0, len(rules))

				for _, rule := range rules {
					updates = append(updates, ruleUpdate{
						Existing: rule,
						New:      models.CopyRule(rule),
						Diff:     nil,
					})
				}

				return &changes{
					New:    nil,
					Update: updates,
					Delete: nil,
				}
			},
			permissions: func(c *changes) map[string][]string {
				var scopes []string
				for _, update := range c.Update {
					for _, query := range update.New.Data {
						scopes = append(scopes, datasources.ScopeProvider.GetResourceScopeUID(query.DatasourceUID))
					}
				}

				return map[string][]string{
					ac.ActionAlertingRuleUpdate: {
						namespaceIdScope,
					},
					datasources.ActionQuery: scopes,
				}
			},
		},
		{
			name: "if there are rules that are moved between namespaces it should check update action",
			changes: func() *changes {
				rules := models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(withNamespace(namespace)))
				updates := make([]ruleUpdate, 0, len(rules))

				for _, rule := range rules {
					cp := models.CopyRule(rule)
					cp.NamespaceUID = rule.NamespaceUID + "other"
					updates = append(updates, ruleUpdate{
						Existing: cp,
						New:      rule,
						Diff:     nil,
					})
				}

				return &changes{
					New:    nil,
					Update: updates,
					Delete: nil,
				}
			},
			permissions: func(c *changes) map[string][]string {
				var scopes []string
				for _, update := range c.Update {
					for _, query := range update.New.Data {
						scopes = append(scopes, datasources.ScopeProvider.GetResourceScopeUID(query.DatasourceUID))
					}
				}
				return map[string][]string{
					ac.ActionAlertingRuleDelete: {
						dashboards.ScopeFoldersProvider.GetResourceScopeUID(namespace.Uid + "other"),
					},
					ac.ActionAlertingRuleCreate: {
						namespaceIdScope,
					},
					datasources.ActionQuery: scopes,
				}
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			executed := false

			groupChanges := testCase.changes()

			result, err := authorizeRuleChanges(namespace, groupChanges, func(evaluator ac.Evaluator) bool {
				response, err := evaluator.Evaluate(make(map[string][]string))
				require.False(t, response)
				require.NoError(t, err)
				executed = true
				return false
			})
			require.Nil(t, result)
			require.Error(t, err)
			require.Truef(t, executed, "evaluation function is expected to be called but it was not.")

			permissions := testCase.permissions(groupChanges)
			executed = false
			result, err = authorizeRuleChanges(namespace, groupChanges, func(evaluator ac.Evaluator) bool {
				response, err := evaluator.Evaluate(permissions)
				require.Truef(t, response, "provided permissions [%v] is not enough for requested permissions [%s]", testCase.permissions, evaluator.GoString())
				require.NoError(t, err)
				executed = true
				return true
			})
			require.NoError(t, err)
			require.Equal(t, groupChanges, result)
			require.Truef(t, executed, "evaluation function is expected to be called but it was not.")
		})
	}
}

func TestAuthorizeRuleDelete(t *testing.T) {
	namespace := randFolder()
	namespaceIdScope := dashboards.ScopeFoldersProvider.GetResourceScope(strconv.FormatInt(namespace.Id, 10))

	getScopes := func(rules []*models.AlertRule) []string {
		var scopes []string
		for _, rule := range rules {
			for _, query := range rule.Data {
				scopes = append(scopes, datasources.ScopeProvider.GetResourceScopeUID(query.DatasourceUID))
			}
		}
		return scopes
	}

	testCases := []struct {
		name        string
		changes     func() *changes
		permissions func(c *changes) map[string][]string
		assert      func(t *testing.T, orig, authz *changes, err error)
	}{
		{
			name: "should validate check access to data source and folder",
			changes: func() *changes {
				return &changes{
					New:    nil,
					Update: nil,
					Delete: models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withNamespace(namespace))),
				}
			},
			permissions: func(c *changes) map[string][]string {
				return map[string][]string{
					ac.ActionAlertingRuleDelete: {
						namespaceIdScope,
					},
					datasources.ActionQuery: getScopes(c.Delete),
				}
			},
			assert: func(t *testing.T, orig, authz *changes, err error) {
				require.NoError(t, err)
				require.Equal(t, orig, authz)
			},
		},
		{
			name: "should remove rules user does not have access to data source",
			changes: func() *changes {
				return &changes{
					New:    nil,
					Update: nil,
					Delete: models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withNamespace(namespace))),
				}
			},
			permissions: func(c *changes) map[string][]string {
				return map[string][]string{
					ac.ActionAlertingRuleDelete: {
						namespaceIdScope,
					},
					datasources.ActionQuery: {
						getScopes(c.Delete[:1])[0],
					},
				}
			},
			assert: func(t *testing.T, orig, authz *changes, err error) {
				require.NoError(t, err)
				require.Greater(t, len(orig.Delete), len(authz.Delete))
			},
		},
		{
			name: "should not fail if no changes other than unauthorized",
			changes: func() *changes {
				return &changes{
					New:    nil,
					Update: nil,
					Delete: models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withNamespace(namespace))),
				}
			},
			permissions: func(c *changes) map[string][]string {
				return map[string][]string{
					ac.ActionAlertingRuleDelete: {
						namespaceIdScope,
					},
				}
			},
			assert: func(t *testing.T, orig, authz *changes, err error) {
				require.NoError(t, err)
				require.False(t, orig.isEmpty())
				require.True(t, authz.isEmpty())
			},
		},
		{
			name: "should not fail if there are changes and no rules can be deleted",
			changes: func() *changes {
				return &changes{
					New:    models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withNamespace(namespace))),
					Update: nil,
					Delete: models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withNamespace(namespace))),
				}
			},
			permissions: func(c *changes) map[string][]string {
				return map[string][]string{
					ac.ActionAlertingRuleDelete: {
						namespaceIdScope,
					},
					ac.ActionAlertingRuleCreate: {
						namespaceIdScope,
					},
					datasources.ActionQuery: getScopes(c.New),
				}
			},
			assert: func(t *testing.T, _, c *changes, err error) {
				require.NoError(t, err)
				require.Empty(t, c.Delete)
			},
		},
		{
			name: "should fail if no access to folder",
			changes: func() *changes {
				return &changes{
					New:    nil,
					Update: nil,
					Delete: models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withNamespace(namespace))),
				}
			},
			permissions: func(c *changes) map[string][]string {
				return map[string][]string{
					datasources.ActionQuery: getScopes(c.Delete),
				}
			},
			assert: func(t *testing.T, _, c *changes, err error) {
				require.ErrorIs(t, err, ErrAuthorization)
				require.Nil(t, c)
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			groupChanges := testCase.changes()
			permissions := testCase.permissions(groupChanges)
			result, err := authorizeRuleChanges(namespace, groupChanges, func(evaluator ac.Evaluator) bool {
				response, err := evaluator.Evaluate(permissions)
				require.NoError(t, err)
				return response
			})

			testCase.assert(t, groupChanges, result, err)
		})
	}
}

func TestCheckDatasourcePermissionsForRule(t *testing.T) {
	rule := models.AlertRuleGen()()

	expressionByType := models.GenerateAlertQuery()
	expressionByType.QueryType = expr.DatasourceType
	expressionByUID := models.GenerateAlertQuery()
	expressionByUID.DatasourceUID = expr.OldDatasourceUID

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
			response, err := evaluator.Evaluate(permissions)
			require.Truef(t, response, "provided permissions [%v] is not enough for requested permissions [%s]", permissions, evaluator.GoString())
			require.NoError(t, err)
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

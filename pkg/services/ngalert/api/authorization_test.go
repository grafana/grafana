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
	require.Len(t, paths, 29)

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
			name: "if there are rules to delete it should check delete action and access to data sources",
			changes: func() *changes {
				return &changes{
					New:    nil,
					Update: nil,
					Delete: models.GenerateAlertRules(rand.Intn(4)+1, models.AlertRuleGen(withNamespace(namespace))),
				}
			},
			permissions: func(c *changes) map[string][]string {
				return map[string][]string{
					ac.ActionAlertingRuleDelete: {
						namespaceIdScope,
					},
				}
			},
		},
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
						scopes = append(scopes, dashboards.ScopeFoldersProvider.GetResourceScopeUID(query.DatasourceUID))
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
						scopes = append(scopes, dashboards.ScopeFoldersProvider.GetResourceScopeUID(query.DatasourceUID))
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
						scopes = append(scopes, dashboards.ScopeFoldersProvider.GetResourceScopeUID(query.DatasourceUID))
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

			err := authorizeRuleChanges(namespace, groupChanges, func(evaluator ac.Evaluator) bool {
				response, err := evaluator.Evaluate(make(map[string][]string))
				require.False(t, response)
				require.NoError(t, err)
				executed = true
				return false
			})
			require.Error(t, err)
			require.Truef(t, executed, "evaluation function is expected to be called but it was not.")

			permissions := testCase.permissions(groupChanges)
			executed = false
			err = authorizeRuleChanges(namespace, groupChanges, func(evaluator ac.Evaluator) bool {
				response, err := evaluator.Evaluate(permissions)
				require.Truef(t, response, "provided permissions [%v] is not enough for requested permissions [%s]", testCase.permissions, evaluator.GoString())
				require.NoError(t, err)
				executed = true
				return true
			})
			require.NoError(t, err)
			require.Truef(t, executed, "evaluation function is expected to be called but it was not.")
		})
	}
}

func TestGetEvaluatorForAlertRule(t *testing.T) {
	t.Run("should not consider expressions", func(t *testing.T) {
		rule := models.AlertRuleGen()()

		expressionByType := models.GenerateAlertQuery()
		expressionByType.QueryType = expr.DatasourceType
		expressionByUID := models.GenerateAlertQuery()
		expressionByUID.DatasourceUID = expr.OldDatasourceUID

		var data []models.AlertQuery
		var scopes []string
		for i := 0; i < rand.Intn(3)+2; i++ {
			q := models.GenerateAlertQuery()
			scopes = append(scopes, dashboards.ScopeFoldersProvider.GetResourceScopeUID(q.DatasourceUID))
			data = append(data, q)
		}

		data = append(data, expressionByType, expressionByUID)
		rand.Shuffle(len(data), func(i, j int) {
			data[j], data[i] = data[i], data[j]
		})

		rule.Data = data

		eval := getEvaluatorForAlertRule(rule)

		allowed, err := eval.Evaluate(map[string][]string{
			datasources.ActionQuery: scopes,
		})

		require.NoError(t, err)
		require.True(t, allowed)
	})
}

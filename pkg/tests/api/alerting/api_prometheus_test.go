package alerting

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"testing"
	"time"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Declare respModel at the function level
var respModel apimodels.UpdateRuleGroupResponse

func TestIntegrationPrometheusRules(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testinfra.SQLiteIntegrationTest(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	// Create a user to make authenticated requests
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")

	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "default", "default")

	interval, err := model.ParseDuration("10s")
	require.NoError(t, err)

	// an unauthenticated request to get rules should fail
	{
		promRulesURL := fmt.Sprintf("http://%s/api/prometheus/grafana/api/v1/rules", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		require.NoError(t, err)
		assert.Equal(t, 401, resp.StatusCode)
	}

	// When we have no alerting rules, it returns an empty list.
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
		require.JSONEq(t, `{"status": "success", "data": {"groups": []}}`, string(b))
	}

	// Now, let's create some rules
	{
		rules := apimodels.PostableRuleGroupConfig{
			Name: "arulegroup",
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:         &interval,
						Labels:      map[string]string{"label1": "val1"},
						Annotations: map[string]string{"annotation1": "val1"},
					},
					// this rule does not explicitly set no data and error states
					// therefore it should get the default values
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     "AlwaysFiring",
						Condition: "A",
						Data: []apimodels.AlertQuery{
							{
								RefID: "A",
								RelativeTimeRange: apimodels.RelativeTimeRange{
									From: apimodels.Duration(time.Duration(5) * time.Hour),
									To:   apimodels.Duration(time.Duration(3) * time.Hour),
								},
								DatasourceUID: expr.DatasourceUID,
								Model: json.RawMessage(`{
									"type": "math",
									"expression": "2 + 3 > 1"
									}`),
							},
						},
					},
				},
				{
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     "AlwaysFiringButSilenced",
						Condition: "A",
						Data: []apimodels.AlertQuery{
							{
								RefID: "A",
								RelativeTimeRange: apimodels.RelativeTimeRange{
									From: apimodels.Duration(time.Duration(5) * time.Hour),
									To:   apimodels.Duration(time.Duration(3) * time.Hour),
								},
								DatasourceUID: expr.DatasourceUID,
								Model: json.RawMessage(`{
									"type": "math",
									"expression": "2 + 3 > 1"
									}`),
							},
						},
						NoDataState:  apimodels.NoDataState(ngmodels.Alerting),
						ExecErrState: apimodels.ExecutionErrorState(ngmodels.AlertingErrState),
					},
				},
			},
		}
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err := enc.Encode(&rules)
		require.NoError(t, err)

		u := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", &buf)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, http.StatusAccepted, resp.StatusCode)
		require.NoError(t, json.Unmarshal(b, &respModel))
		require.Len(t, respModel.Created, len(rules.Rules))
	}

	// Check that we cannot create a rule that has a panel_id and no dashboard_uid
	{
		rules := apimodels.PostableRuleGroupConfig{
			Name: "anotherrulegroup",
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:         &interval,
						Labels:      map[string]string{},
						Annotations: map[string]string{"__panelId__": "1"},
					},
					// this rule does not explicitly set no data and error states
					// therefore it should get the default values
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     "NeverCreated",
						Condition: "A",
						Data: []apimodels.AlertQuery{
							{
								RefID: "A",
								RelativeTimeRange: apimodels.RelativeTimeRange{
									From: apimodels.Duration(time.Duration(5) * time.Hour),
									To:   apimodels.Duration(time.Duration(3) * time.Hour),
								},
								DatasourceUID: expr.DatasourceUID,
								Model: json.RawMessage(`{
									"type": "math",
									"expression": "2 + 3 > 1"
									}`),
							},
						},
						IsPaused: util.Pointer(true),
					},
				},
			},
		}
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err := enc.Encode(&rules)
		require.NoError(t, err)

		u := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", &buf)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, 400, resp.StatusCode)
		var res map[string]any
		require.NoError(t, json.Unmarshal(b, &res))
		require.Contains(t, res["message"], "[0]") // Index of the invalid rule.
		require.Contains(t, res["message"], ngmodels.ErrAlertRuleFailedValidation.Error())
		require.Contains(t, res["message"], ngmodels.DashboardUIDAnnotation)
		require.Contains(t, res["message"], ngmodels.PanelIDAnnotation)
	}

	// Now, let's see how this looks like.
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		require.JSONEq(t, fmt.Sprintf(`
{
	"status": "success",
	"data": {
		"groups": [{
			"name": "arulegroup",
			"file": "default",
			"folderUid": "default",
			"rules": [{
				"state": "inactive",
				"name": "AlwaysFiring",
				"query": "[{\"refId\":\"A\",\"queryType\":\"\",\"relativeTimeRange\":{\"from\":18000,\"to\":10800},\"datasourceUid\":\"__expr__\",\"model\":{\"expression\":\"2 + 3 \\u003e 1\",\"intervalMs\":1000,\"maxDataPoints\":43200,\"refId\":\"A\",\"type\":\"math\"}}]",
				"duration": 10,
				"folderUid": "default",
				"uid": "%s",
				"annotations": {
					"annotation1": "val1"
				},
				"labels": {
					"label1": "val1"
				},
				"health": "ok",
				"isPaused": false,
				"type": "alerting",
				"lastEvaluation": "0001-01-01T00:00:00Z",
				"evaluationTime": 0
			}, {
				"state": "inactive",
				"name": "AlwaysFiringButSilenced",
				"query": "[{\"refId\":\"A\",\"queryType\":\"\",\"relativeTimeRange\":{\"from\":18000,\"to\":10800},\"datasourceUid\":\"__expr__\",\"model\":{\"expression\":\"2 + 3 \\u003e 1\",\"intervalMs\":1000,\"maxDataPoints\":43200,\"refId\":\"A\",\"type\":\"math\"}}]",
				"folderUid": "default",
				"uid": "%s",
				"health": "ok",
				"isPaused": false,
				"type": "alerting",
				"lastEvaluation": "0001-01-01T00:00:00Z",
				"evaluationTime": 0
			}],
			"totals": {
				"inactive": 2
			},
			"interval": 60,
			"lastEvaluation": "0001-01-01T00:00:00Z",
			"evaluationTime": 0
		}],
		"totals": {
			"inactive": 2
		}
	}
}`, respModel.Created[0], respModel.Created[1]), string(b))
	}

	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules", grafanaListedAddr)
		// nolint:gosec
		require.Eventually(t, func() bool {
			resp, err := http.Get(promRulesURL)
			require.NoError(t, err)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
			b, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			require.Equal(t, 200, resp.StatusCode)
			require.JSONEq(t, fmt.Sprintf(`
{
	"status": "success",
	"data": {
		"groups": [{
			"name": "arulegroup",
			"file": "default",
			"folderUid": "default",
			"rules": [{
				"state": "inactive",
				"name": "AlwaysFiring",
				"query": "[{\"refId\":\"A\",\"queryType\":\"\",\"relativeTimeRange\":{\"from\":18000,\"to\":10800},\"datasourceUid\":\"__expr__\",\"model\":{\"expression\":\"2 + 3 \\u003e 1\",\"intervalMs\":1000,\"maxDataPoints\":43200,\"refId\":\"A\",\"type\":\"math\"}}]",
				"duration": 10,
				"folderUid": "default",
				"uid": "%s",
				"annotations": {
					"annotation1": "val1"
				},
				"labels": {
					"label1": "val1"
				},
				"health": "ok",
				"isPaused": false,
				"type": "alerting",
				"lastEvaluation": "0001-01-01T00:00:00Z",
				"evaluationTime": 0
			}, {
				"state": "inactive",
				"name": "AlwaysFiringButSilenced",
				"query": "[{\"refId\":\"A\",\"queryType\":\"\",\"relativeTimeRange\":{\"from\":18000,\"to\":10800},\"datasourceUid\":\"__expr__\",\"model\":{\"expression\":\"2 + 3 \\u003e 1\",\"intervalMs\":1000,\"maxDataPoints\":43200,\"refId\":\"A\",\"type\":\"math\"}}]",
				"folderUid": "default",
				"uid": "%s",
				"health": "ok",
				"isPaused": false,
				"type": "alerting",
				"lastEvaluation": "0001-01-01T00:00:00Z",
				"evaluationTime": 0
			}],
			"totals": {
				"inactive": 2
			},
			"interval": 60,
			"lastEvaluation": "0001-01-01T00:00:00Z",
			"evaluationTime": 0
		}],
		"totals": {
			"inactive": 2
		}
	}
}`, respModel.Created[0], respModel.Created[1]), string(b))
			return true
		}, 18*time.Second, 2*time.Second)
	}
}

func TestIntegrationPrometheusRulesPagination(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")
	apiClient.CreateFolder(t, "default", "default")

	interval, err := model.ParseDuration("10s")
	require.NoError(t, err)

	// Create 3 rule groups with different numbers of rules
	// Group 1: 5 rules with team=backend
	// Group 2: 3 rules with team=frontend
	// Group 3: 2 rules with team=platform
	for groupIdx := 1; groupIdx <= 3; groupIdx++ {
		var rulesCount int
		var team string
		switch groupIdx {
		case 1:
			rulesCount = 5
			team = "backend"
		case 2:
			rulesCount = 3
			team = "frontend"
		case 3:
			rulesCount = 2
			team = "platform"
		}

		rules := make([]apimodels.PostableExtendedRuleNode, rulesCount)
		for i := 0; i < rulesCount; i++ {
			rules[i] = apimodels.PostableExtendedRuleNode{
				ApiRuleNode: &apimodels.ApiRuleNode{
					For:    &interval,
					Labels: map[string]string{"team": team},
				},
				GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
					Title:     fmt.Sprintf("rule-%d-%d", groupIdx, i+1),
					Condition: "A",
					Data: []apimodels.AlertQuery{
						{
							RefID: "A",
							RelativeTimeRange: apimodels.RelativeTimeRange{
								From: apimodels.Duration(time.Duration(5) * time.Hour),
								To:   apimodels.Duration(time.Duration(3) * time.Hour),
							},
							DatasourceUID: expr.DatasourceUID,
							Model: json.RawMessage(`{
								"type": "math",
								"expression": "0 > 1"
							}`),
						},
					},
				},
			}
		}

		ruleGroup := apimodels.PostableRuleGroupConfig{
			Name:  fmt.Sprintf("group-%d", groupIdx),
			Rules: rules,
		}

		apiClient.PostRulesGroup(t, "default", &ruleGroup, false)
	}

	t.Run("with group_limit should return only 2 groups", func(t *testing.T) {
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules?group_limit=2", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})

		var result apimodels.RuleResponse
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Len(t, result.Data.RuleGroups, 2)
		require.NotEmpty(t, result.Data.NextToken)
	})

	// Test rule_limit: with limit of 7, should return groups 1 and 2 (5+3=8 rules in total expected)
	t.Run("with rule_limit should return full groups with rules limit", func(t *testing.T) {
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules?rule_limit=7", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})

		var result apimodels.RuleResponse
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Len(t, result.Data.RuleGroups, 2)

		totalRules := 0
		for _, group := range result.Data.RuleGroups {
			totalRules += len(group.Rules)
		}
		require.Equal(t, 8, totalRules)
		require.NotEmpty(t, result.Data.NextToken)
	})

	// With both group_limit and rule_limit set, the API should return
	// data with respect to whichever limit is reached first.
	t.Run("both limits respect whichever is reached first", func(t *testing.T) {
		// group_limit=1 with rule_limit=100: group limit reached first
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules?group_limit=1&rule_limit=100", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})

		var result apimodels.RuleResponse
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Len(t, result.Data.RuleGroups, 1)
	})

	t.Run("rule_limit=0 returns empty results", func(t *testing.T) {
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules?rule_limit=0", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})

		var result apimodels.RuleResponse
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Len(t, result.Data.RuleGroups, 0, "should return no groups")
	})

	t.Run("with rule_matcher filter returns only matching rules", func(t *testing.T) {
		matcher := url.QueryEscape(`{"name":"team","value":"frontend","isRegex":false,"isEqual":true}`)
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules?rule_matcher=%s", grafanaListedAddr, matcher)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})

		var result apimodels.RuleResponse
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// Should only return group-2 (team=frontend, 3 rules)
		foundGroups := make([]string, 0, len(result.Data.RuleGroups))
		total := 0
		for _, group := range result.Data.RuleGroups {
			foundGroups = append(foundGroups, group.Name)
			total += len(group.Rules)
		}
		require.Equal(t, []string{"group-2"}, foundGroups)
		require.Equal(t, 3, total)
	})

	t.Run("with rule_matcher regex filter", func(t *testing.T) {
		// Filter with regex team=~plat.* (should match group-3 with team=platform)
		matcher := url.QueryEscape(`{"name":"team","value":"plat.*","isRegex":true,"isEqual":true}`)
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules?rule_matcher=%s", grafanaListedAddr, matcher)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})

		var result apimodels.RuleResponse
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// Should only return group-3 (team=platform matches plat.*)
		foundGroups := make([]string, 0, len(result.Data.RuleGroups))
		total := 0
		for _, group := range result.Data.RuleGroups {
			foundGroups = append(foundGroups, group.Name)
			total += len(group.Rules)
		}
		require.Equal(t, []string{"group-3"}, foundGroups)
		require.Equal(t, 2, total)
	})
}

func TestIntegrationPrometheusRulesFilterByDashboard(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testinfra.SQLiteIntegrationTest(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{"ngalert"},
		DisableAnonymous:     true,
		AppModeProduction:    true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	// Create a user to make authenticated requests
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")
	// Create the namespace we'll save our alerts to.
	dashboardUID := "default"
	apiClient.CreateFolder(t, dashboardUID, dashboardUID)

	interval, err := model.ParseDuration("10s")
	require.NoError(t, err)

	keepFiringFor, err := model.ParseDuration("15s")
	require.NoError(t, err)

	// Now, let's create some rules
	{
		rules := apimodels.PostableRuleGroupConfig{
			Name: "anotherrulegroup",
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:           &interval,
						KeepFiringFor: &keepFiringFor,
						Labels:        map[string]string{},
						Annotations: map[string]string{
							"__dashboardUid__": dashboardUID,
							"__panelId__":      "1",
						},
					},
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     "AlwaysFiring",
						Condition: "A",
						Data: []apimodels.AlertQuery{
							{
								RefID: "A",
								RelativeTimeRange: apimodels.RelativeTimeRange{
									From: apimodels.Duration(time.Duration(5) * time.Hour),
									To:   apimodels.Duration(time.Duration(3) * time.Hour),
								},
								DatasourceUID: expr.DatasourceUID,
								Model: json.RawMessage(`{
									"type": "math",
									"expression": "2 + 3 > 1"
									}`),
							},
						},
					},
				},
				{
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     "AlwaysFiringButSilenced",
						Condition: "A",
						Data: []apimodels.AlertQuery{
							{
								RefID: "A",
								RelativeTimeRange: apimodels.RelativeTimeRange{
									From: apimodels.Duration(time.Duration(5) * time.Hour),
									To:   apimodels.Duration(time.Duration(3) * time.Hour),
								},
								DatasourceUID: expr.DatasourceUID,
								Model: json.RawMessage(`{
									"type": "math",
									"expression": "2 + 3 > 1"
									}`),
							},
						},
						NoDataState:  apimodels.NoDataState(ngmodels.Alerting),
						ExecErrState: apimodels.ExecutionErrorState(ngmodels.AlertingErrState),
					},
				},
			},
		}
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err := enc.Encode(&rules)
		require.NoError(t, err)

		u := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", &buf)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, http.StatusAccepted, resp.StatusCode)
		require.NoError(t, json.Unmarshal(b, &respModel))
		require.Len(t, respModel.Created, len(rules.Rules))
	}

	expectedAllJSON := fmt.Sprintf(`
{
	"status": "success",
	"data": {
		"groups": [{
			"name": "anotherrulegroup",
			"file": "default",
			"folderUid": "default",
			"rules": [{
				"state": "inactive",
				"name": "AlwaysFiring",
				"uid": "%s",
				"folderUid": "default",
				"query": "[{\"refId\":\"A\",\"queryType\":\"\",\"relativeTimeRange\":{\"from\":18000,\"to\":10800},\"datasourceUid\":\"__expr__\",\"model\":{\"expression\":\"2 + 3 \\u003e 1\",\"intervalMs\":1000,\"maxDataPoints\":43200,\"refId\":\"A\",\"type\":\"math\"}}]",
				"duration": 10,
				"keepFiringFor": 15,
				"annotations": {
					"__dashboardUid__": "%s",
					"__panelId__": "1"
				},
				"health": "ok",
				"isPaused": false,
				"type": "alerting",
				"lastEvaluation": "0001-01-01T00:00:00Z",
				"evaluationTime": 0
			}, {
				"state": "inactive",
				"name": "AlwaysFiringButSilenced",
				"uid": "%s",
				"folderUid": "default",
				"query": "[{\"refId\":\"A\",\"queryType\":\"\",\"relativeTimeRange\":{\"from\":18000,\"to\":10800},\"datasourceUid\":\"__expr__\",\"model\":{\"expression\":\"2 + 3 \\u003e 1\",\"intervalMs\":1000,\"maxDataPoints\":43200,\"refId\":\"A\",\"type\":\"math\"}}]",
				"health": "ok",
				"isPaused": false,
				"type": "alerting",
				"lastEvaluation": "0001-01-01T00:00:00Z",
				"evaluationTime": 0
			}],
			"totals": {
				"inactive": 2
			},
			"interval": 60,
			"lastEvaluation": "0001-01-01T00:00:00Z",
			"evaluationTime": 0
		}],
		"totals": {
			"inactive": 2
		}
	}
}`, respModel.Created[0], dashboardUID, respModel.Created[1])
	expectedFilteredByJSON := fmt.Sprintf(`
{
	"status": "success",
	"data": {
		"groups": [{
			"name": "anotherrulegroup",
			"file": "default",
			"folderUid": "default",
			"rules": [{
				"state": "inactive",
				"name": "AlwaysFiring",
				"uid": "%s",
				"folderUid": "default",
				"query": "[{\"refId\":\"A\",\"queryType\":\"\",\"relativeTimeRange\":{\"from\":18000,\"to\":10800},\"datasourceUid\":\"__expr__\",\"model\":{\"expression\":\"2 + 3 \\u003e 1\",\"intervalMs\":1000,\"maxDataPoints\":43200,\"refId\":\"A\",\"type\":\"math\"}}]",
				"duration": 10,
				"keepFiringFor": 15,
				"annotations": {
					"__dashboardUid__": "%s",
					"__panelId__": "1"
				},
				"health": "ok",
				"isPaused": false,
				"type": "alerting",
				"lastEvaluation": "0001-01-01T00:00:00Z",
				"evaluationTime": 0
			}],
			"totals": {
				"inactive": 1
			},
			"interval": 60,
			"lastEvaluation": "0001-01-01T00:00:00Z",
			"evaluationTime": 0
		}],
		"totals": {
			"inactive": 1
		}
	}
}`, respModel.Created[0], dashboardUID)
	expectedNoneJSON := `
{
	"status": "success",
	"data": {
		"groups": []
	}
}`

	// Now, let's see how this looks like.
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		require.JSONEq(t, expectedAllJSON, string(b))
	}

	// Now, let's check we get the same rule when filtering by dashboard_uid
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules?dashboard_uid=%s", grafanaListedAddr, dashboardUID)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		require.JSONEq(t, expectedFilteredByJSON, string(b))
	}

	// Now, let's check we get no rules when filtering by an unknown dashboard_uid
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules?dashboard_uid=%s", grafanaListedAddr, "abc")
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		require.JSONEq(t, expectedNoneJSON, string(b))
	}

	// Now, let's check we get the same rule when filtering by dashboard_uid and panel_id
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules?dashboard_uid=%s&panel_id=1", grafanaListedAddr, dashboardUID)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		require.JSONEq(t, expectedFilteredByJSON, string(b))
	}

	// Now, let's check we get no rules when filtering by dashboard_uid and unknown panel_id
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules?dashboard_uid=%s&panel_id=2", grafanaListedAddr, dashboardUID)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		require.JSONEq(t, expectedNoneJSON, string(b))
	}

	// Now, let's check an invalid panel_id returns a 400 Bad Request response
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules?dashboard_uid=%s&panel_id=invalid", grafanaListedAddr, dashboardUID)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var res map[string]any
		require.NoError(t, json.Unmarshal(b, &res))
		// These APIs return Prometheus-like errors.
		require.Equal(t, "error", res["status"])
		require.Equal(t, "bad_data", res["errorType"])
		require.Equal(t, `invalid panel_id: strconv.ParseInt: parsing "invalid": invalid syntax`, res["error"])
	}

	// Now, let's check a panel_id without dashboard_uid returns a 400 Bad Request response
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules?panel_id=1", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var res map[string]any
		require.NoError(t, json.Unmarshal(b, &res))
		// These APIs return Prometheus-like errors.
		require.Equal(t, "error", res["status"])
		require.Equal(t, "bad_data", res["errorType"])
		require.Equal(t, "panel_id must be set with dashboard_uid", res["error"])
	}
}

func TestIntegrationPrometheusPluginsFilter(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")

	apiClient.CreateFolder(t, "folder1", "folder1")

	// Create a regular alert rule
	createRule(t, apiClient, "folder1", withRuleGroup("group1"))
	// Create a rule from plugin
	createRule(t, apiClient, "folder1", withRuleGroup("group2"), withLabels(map[string]string{"__grafana_origin": "plugin/grafana-slo-app"}))

	verifyRulesResponse := func(t *testing.T, b []byte, expectedGroupName string, shouldHaveOriginLabel bool) {
		t.Helper()

		var result apimodels.RuleResponse
		require.NoError(t, json.Unmarshal(b, &result))
		require.Equal(t, "success", result.Status)

		require.Len(t, result.Data.RuleGroups, 1)
		group := result.Data.RuleGroups[0]
		require.Equal(t, expectedGroupName, group.Name)

		require.Len(t, group.Rules, 1)
		rule := group.Rules[0]
		_, hasOriginLabel := rule.Labels.Map()["__grafana_origin"]
		require.Equal(t, shouldHaveOriginLabel, hasOriginLabel)
	}

	t.Run("plugins=hide returns only non-plugin rules", func(t *testing.T) {
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules?plugins=hide", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)

		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})

		require.Equal(t, http.StatusOK, resp.StatusCode)
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		verifyRulesResponse(t, b, "group1", false)
	})

	t.Run("plugins=only returns only plugin rules", func(t *testing.T) {
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules?plugins=only", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)

		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})

		require.Equal(t, http.StatusOK, resp.StatusCode)
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		verifyRulesResponse(t, b, "group2", true)
	})
}

func TestIntegrationPrometheusRulesPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testinfra.SQLiteIntegrationTest(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	// Create a user to make authenticated requests
	userID := createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")

	// access control permissions store
	permissionsStore := resourcepermissions.NewStore(env.Cfg, env.SQLStore, featuremgmt.WithFeatures())

	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "folder1", "folder1")

	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "folder2", "folder2")

	// Create rule under folder1
	createRule(t, apiClient, "folder1")

	// Create rule under folder2
	createRule(t, apiClient, "folder2")

	// Now, let's see how this looks like.
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		body := asJson(t, b)
		// Sort, for test consistency.
		sort.Slice(body.Data.Groups, func(i, j int) bool { return body.Data.Groups[i].File < body.Data.Groups[j].File })
		require.Equal(t, "success", body.Status)
		// The request should see both groups, and all rules underneath.
		require.Len(t, body.Data.Groups, 2)
		require.Len(t, body.Data.Groups[0].Rules, 1)
		require.Len(t, body.Data.Groups[1].Rules, 1)
		require.Equal(t, "folder1", body.Data.Groups[0].File)
		require.Equal(t, "folder2", body.Data.Groups[1].File)
	}

	// remove permissions from folder2org.ROLE
	removeFolderPermission(t, permissionsStore, 1, userID, org.RoleEditor, "folder2")
	apiClient.ReloadCachedPermissions(t)

	// make sure that folder2 is not included in the response
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		body := asJson(t, b)
		require.Equal(t, "success", body.Status)
		require.Len(t, body.Data.Groups, 1)
		require.Len(t, body.Data.Groups[0].Rules, 1)
		require.Equal(t, "folder1", body.Data.Groups[0].File)
	}

	// remove permissions from folder1org.ROLE
	removeFolderPermission(t, permissionsStore, 1, userID, org.RoleEditor, "folder1")
	apiClient.ReloadCachedPermissions(t)

	// make sure that no folders are included in the response
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/prometheus/grafana/api/v1/rules", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(promRulesURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		require.JSONEq(t, `
{
	"status": "success",
	"data": {
		"groups": []
	}
}`, string(b))
	}
}

func removeFolderPermission(t *testing.T, store resourcepermissions.Store, orgID, userID int64, role org.RoleType, uid string) {
	t.Helper()
	// remove user permissions on folder
	_, _ = store.SetUserResourcePermission(context.Background(), orgID, accesscontrol.User{ID: userID}, resourcepermissions.SetResourcePermissionCommand{
		Resource:          "folders",
		ResourceID:        uid,
		ResourceAttribute: "uid",
	}, nil)

	// remove org role permissions from folder
	_, _ = store.SetBuiltInResourcePermission(context.Background(), orgID, string(role), resourcepermissions.SetResourcePermissionCommand{
		Resource:          "folders",
		ResourceID:        uid,
		ResourceAttribute: "uid",
	}, nil)

	// remove org role children permissions from folder
	for _, c := range role.Children() {
		_, _ = store.SetBuiltInResourcePermission(context.Background(), orgID, string(c), resourcepermissions.SetResourcePermissionCommand{
			Resource:          "folders",
			ResourceID:        uid,
			ResourceAttribute: "uid",
		}, nil)
	}
}

func asJson(t *testing.T, blob []byte) rulesResponse {
	t.Helper()
	var r rulesResponse
	require.NoError(t, json.Unmarshal(blob, &r))
	return r
}

type rulesResponse struct {
	Status string
	Data   rulesData
}

type rulesData struct {
	Groups []groupData
}

type groupData struct {
	Name  string
	File  string
	Rules []any
}

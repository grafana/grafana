package alerting

import (
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util"
)

func TestIntegrationAlertRulePermissions(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)
	permissionsStore := resourcepermissions.NewStore(store)

	// Create a user to make authenticated requests
	userID := createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")

	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "folder1", "folder1")
	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "folder2", "folder2")

	// Create rule under folder1
	createRule(t, apiClient, "folder1")

	// Create rule under folder2
	createRule(t, apiClient, "folder2")

	// With the rules created, let's make sure that rule definitions are stored.
	{
		u := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(u)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, resp.StatusCode, 200)

		body, _ := rulesNamespaceWithoutVariableValues(t, b)
		expectedGetNamespaceResponseBody := `
		{
		   "folder1":[
			  {
				 "name":"arulegroup",
				 "interval":"1m",
				 "rules":[
					{
						"annotations": {
							"annotation1": "val1"
					   },
					   "expr":"",
					   "for": "2m",
					   "labels": {
							"label1": "val1"
					   },
					   "grafana_alert":{
						  "id":1,
						  "orgId":1,
						  "title":"rule under folder folder1",
						  "condition":"A",
						  "data":[
		                     {
		                        "refId":"A",
		                        "queryType":"",
		                        "relativeTimeRange":{
		                           "from":18000,
		                           "to":10800
		                        },
		                        "datasourceUid":"__expr__",
								"model":{
		                           "expression":"2 + 3 \u003E 1",
		                           "intervalMs":1000,
		                           "maxDataPoints":43200,
		                           "type":"math"
		                        }
		                     }
		                  ],
						  "updated":"2021-02-21T01:10:30Z",
						  "intervalSeconds":60,
						  "is_paused":false,
						  "version":1,
						  "uid":"uid",
						  "namespace_uid":"nsuid",
						  "namespace_id":1,
						  "rule_group":"arulegroup",
						  "no_data_state":"NoData",
						  "exec_err_state":"Alerting"
					   }
					}
				 ]
			  }
		   ],
		"folder2":[
			{
			   "name":"arulegroup",
			   "interval":"1m",
			   "rules":[
				  {
					  "annotations": {
						  "annotation1": "val1"
					 },
					 "expr":"",
					 "for": "2m",
					 "labels": {
						  "label1": "val1"
					 },
					 "grafana_alert":{
						"id":2,
						"orgId":1,
						"title":"rule under folder folder2",
						"condition":"A",
						"data":[
		                     {
		                        "refId":"A",
		                        "queryType":"",
		                        "relativeTimeRange":{
		                           "from":18000,
		                           "to":10800
		                        },
		                        "datasourceUid":"__expr__",
								"model":{
		                           "expression":"2 + 3 \u003E 1",
		                           "intervalMs":1000,
		                           "maxDataPoints":43200,
		                           "type":"math"
		                        }
		                     }
		                  ],
						"updated":"2021-02-21T01:10:30Z",
						"intervalSeconds":60,
						"is_paused":false,
						"version":1,
						"uid":"uid",
						"namespace_uid":"nsuid",
						"namespace_id":2,
						"rule_group":"arulegroup",
						"no_data_state":"NoData",
						"exec_err_state":"Alerting"
					 }
				  }
			   ]
			}
		 ]
		}`
		assert.JSONEq(t, expectedGetNamespaceResponseBody, body)

		// remove permissions from folder2
		removeFolderPermission(t, permissionsStore, 1, userID, org.RoleEditor, "folder2")
		apiClient.ReloadCachedPermissions(t)

		// make sure that folder2 is not included in the response
		// nolint:gosec
		resp, err = http.Get(u)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err = io.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, resp.StatusCode, 200)

		body, _ = rulesNamespaceWithoutVariableValues(t, b)
		expectedGetNamespaceResponseBody = `
		{
		   "folder1":[
			  {
				 "name":"arulegroup",
				 "interval":"1m",
				 "rules":[
					{
						"annotations": {
							"annotation1": "val1"
					   },
					   "expr":"",
					   "for": "2m",
					   "labels": {
							"label1": "val1"
					   },
					   "grafana_alert":{
						  "id":1,
						  "orgId":1,
						  "title":"rule under folder folder1",
						  "condition":"A",
						  "data":[
		                     {
		                        "refId":"A",
		                        "queryType":"",
		                        "relativeTimeRange":{
		                           "from":18000,
		                           "to":10800
		                        },
		                        "datasourceUid":"__expr__",
								"model":{
		                           "expression":"2 + 3 \u003E 1",
		                           "intervalMs":1000,
		                           "maxDataPoints":43200,
		                           "type":"math"
		                        }
		                     }
		                  ],
						  "updated":"2021-02-21T01:10:30Z",
						  "intervalSeconds":60,
						  "is_paused":false,
						  "version":1,
						  "uid":"uid",
						  "namespace_uid":"nsuid",
						  "namespace_id":1,
						  "rule_group":"arulegroup",
						  "no_data_state":"NoData",
						  "exec_err_state":"Alerting"
					   }
					}
				 ]
			  }
		   ]
		}`
		assert.JSONEq(t, expectedGetNamespaceResponseBody, body)
	}

	// Remove permissions from folder1.
	removeFolderPermission(t, permissionsStore, 1, userID, org.RoleEditor, "folder1")
	apiClient.ReloadCachedPermissions(t)
	{
		u := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(u)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, resp.StatusCode, 200)
		require.JSONEq(t, `{}`, string(b))
	}
}

func createRule(t *testing.T, client apiClient, folder string) {
	t.Helper()

	interval, err := model.ParseDuration("1m")
	require.NoError(t, err)
	doubleInterval := 2 * interval
	rules := apimodels.PostableRuleGroupConfig{
		Name:     "arulegroup",
		Interval: interval,
		Rules: []apimodels.PostableExtendedRuleNode{
			{
				ApiRuleNode: &apimodels.ApiRuleNode{
					For:         &doubleInterval,
					Labels:      map[string]string{"label1": "val1"},
					Annotations: map[string]string{"annotation1": "val1"},
				},
				GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
					Title:     fmt.Sprintf("rule under folder %s", folder),
					Condition: "A",
					Data: []ngmodels.AlertQuery{
						{
							RefID: "A",
							RelativeTimeRange: ngmodels.RelativeTimeRange{
								From: ngmodels.Duration(time.Duration(5) * time.Hour),
								To:   ngmodels.Duration(time.Duration(3) * time.Hour),
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
		},
	}
	status, body := client.PostRulesGroup(t, folder, &rules)
	assert.Equal(t, http.StatusAccepted, status)
	require.JSONEq(t, `{"message":"rule group updated successfully"}`, body)
}

func TestIntegrationAlertRuleConflictingTitle(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		EnableQuota:           true,
		DisableAnonymous:      true,
		ViewersCanEdit:        true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)

	// Create user
	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")

	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "folder1", "folder1")
	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "folder2", "folder2")

	rules := newTestingRuleConfig(t)

	status, body := apiClient.PostRulesGroup(t, "folder1", &rules)
	assert.Equal(t, http.StatusAccepted, status)
	require.JSONEq(t, `{"message":"rule group updated successfully"}`, body)

	// fetch the created rules, so we can get the uid's and trigger
	// and update by reusing the uid's
	createdRuleGroup := apiClient.GetRulesGroup(t, "folder1", rules.Name).GettableRuleGroupConfig
	require.Len(t, createdRuleGroup.Rules, 2)

	t.Run("trying to create alert with same title under same folder should fail", func(t *testing.T) {
		rules := newTestingRuleConfig(t)

		status, body := apiClient.PostRulesGroup(t, "folder1", &rules)
		assert.Equal(t, http.StatusInternalServerError, status)

		var res map[string]interface{}
		require.NoError(t, json.Unmarshal([]byte(body), &res))
		require.Equal(t, "failed to update rule group: failed to add rules: a conflicting alert rule is found: rule title under the same organisation and folder should be unique", res["message"])
	})

	t.Run("trying to update an alert to the title of an existing alert in the same folder should fail", func(t *testing.T) {
		rules := newTestingRuleConfig(t)
		rules.Rules[0].GrafanaManagedAlert.UID = createdRuleGroup.Rules[0].GrafanaManagedAlert.UID
		rules.Rules[1].GrafanaManagedAlert.UID = createdRuleGroup.Rules[1].GrafanaManagedAlert.UID
		rules.Rules[1].GrafanaManagedAlert.Title = "AlwaysFiring"

		status, body := apiClient.PostRulesGroup(t, "folder1", &rules)
		assert.Equal(t, http.StatusInternalServerError, status)

		var res map[string]interface{}
		require.NoError(t, json.Unmarshal([]byte(body), &res))
		require.Equal(t, "failed to update rule group: failed to update rules: a conflicting alert rule is found: rule title under the same organisation and folder should be unique", res["message"])
	})

	t.Run("trying to create alert with same title under another folder should succeed", func(t *testing.T) {
		rules := newTestingRuleConfig(t)
		status, body := apiClient.PostRulesGroup(t, "folder2", &rules)
		assert.Equal(t, http.StatusAccepted, status)
		require.JSONEq(t, `{"message":"rule group updated successfully"}`, body)
	})
}

func TestIntegrationRulerRulesFilterByDashboard(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{"ngalert"},
		DisableAnonymous:     true,
		AppModeProduction:    true,
	})

	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)

	// Create a user to make authenticated requests
	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")

	dashboardUID := "default"
	// Create the namespace under default organisation (orgID = 1) where we'll save our alerts to.
	apiClient.CreateFolder(t, "default", "default")

	interval, err := model.ParseDuration("10s")
	require.NoError(t, err)

	// Now, let's create some rules
	{
		rules := apimodels.PostableRuleGroupConfig{
			Name: "anotherrulegroup",
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:    &interval,
						Labels: map[string]string{},
						Annotations: map[string]string{
							"__dashboardUid__": dashboardUID,
							"__panelId__":      "1",
						},
					},
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     "AlwaysFiring",
						Condition: "A",
						Data: []ngmodels.AlertQuery{
							{
								RefID: "A",
								RelativeTimeRange: ngmodels.RelativeTimeRange{
									From: ngmodels.Duration(time.Duration(5) * time.Hour),
									To:   ngmodels.Duration(time.Duration(3) * time.Hour),
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
						Data: []ngmodels.AlertQuery{
							{
								RefID: "A",
								RelativeTimeRange: ngmodels.RelativeTimeRange{
									From: ngmodels.Duration(time.Duration(5) * time.Hour),
									To:   ngmodels.Duration(time.Duration(3) * time.Hour),
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
		status, body := apiClient.PostRulesGroup(t, "default", &rules)
		assert.Equal(t, http.StatusAccepted, status)
		require.JSONEq(t, `{"message":"rule group updated successfully"}`, body)
	}

	expectedAllJSON := fmt.Sprintf(`
{
	"default": [{
		"name": "anotherrulegroup",
		"interval": "1m",
		"rules": [{
			"expr": "",
			"for": "10s",
			"annotations": {
				"__dashboardUid__": "%s",
				"__panelId__": "1"
			},
			"grafana_alert": {
				"id": 1,
				"orgId": 1,
				"title": "AlwaysFiring",
				"condition": "A",
				"data": [{
					"refId": "A",
					"queryType": "",
					"relativeTimeRange": {
						"from": 18000,
						"to": 10800
					},
					"datasourceUid": "__expr__",
					"model": {
						"expression": "2 + 3 \u003e 1",
						"intervalMs": 1000,
						"maxDataPoints": 43200,
						"type": "math"
					}
				}],
				"updated": "2021-02-21T01:10:30Z",
				"intervalSeconds": 60,
				"is_paused": false,
				"version": 1,
				"uid": "uid",
				"namespace_uid": "nsuid",
				"namespace_id": 1,
				"rule_group": "anotherrulegroup",
				"no_data_state": "NoData",
				"exec_err_state": "Alerting"
			}
		}, {
			"expr": "",
			"for":"0s",
			"grafana_alert": {
				"id": 2,
				"orgId": 1,
				"title": "AlwaysFiringButSilenced",
				"condition": "A",
				"data": [{
					"refId": "A",
					"queryType": "",
					"relativeTimeRange": {
						"from": 18000,
						"to": 10800
					},
					"datasourceUid": "__expr__",
					"model": {
						"expression": "2 + 3 \u003e 1",
						"intervalMs": 1000,
						"maxDataPoints": 43200,
						"type": "math"
					}
				}],
				"updated": "2021-02-21T01:10:30Z",
				"intervalSeconds": 60,
				"is_paused": false,
				"version": 1,
				"uid": "uid",
				"namespace_uid": "nsuid",
				"namespace_id": 1,
				"rule_group": "anotherrulegroup",
				"no_data_state": "Alerting",
				"exec_err_state": "Alerting"
			}
		}]
	}]
}`, dashboardUID)
	expectedFilteredByJSON := fmt.Sprintf(`
{
	"default": [{
		"name": "anotherrulegroup",
		"interval": "1m",
		"rules": [{
			"expr": "",
			"for": "10s",
			"annotations": {
				"__dashboardUid__": "%s",
				"__panelId__": "1"
			},
			"grafana_alert": {
				"id": 1,
				"orgId": 1,
				"title": "AlwaysFiring",
				"condition": "A",
				"data": [{
					"refId": "A",
					"queryType": "",
					"relativeTimeRange": {
						"from": 18000,
						"to": 10800
					},
					"datasourceUid": "__expr__",
					"model": {
						"expression": "2 + 3 \u003e 1",
						"intervalMs": 1000,
						"maxDataPoints": 43200,
						"type": "math"
					}
				}],
				"updated": "2021-02-21T01:10:30Z",
				"intervalSeconds": 60,
				"is_paused": false,
				"version": 1,
				"uid": "uid",
				"namespace_uid": "nsuid",
				"namespace_id": 1,
				"rule_group": "anotherrulegroup",
				"no_data_state": "NoData",
				"exec_err_state": "Alerting"
			}
		}]
	}]
}`, dashboardUID)
	expectedNoneJSON := `{}`

	// Now, let's see how this looks like.
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules", grafanaListedAddr)
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

		body, _ := rulesNamespaceWithoutVariableValues(t, b)
		require.JSONEq(t, expectedAllJSON, body)
	}

	// Now, let's check we get the same rule when filtering by dashboard_uid
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules?dashboard_uid=%s", grafanaListedAddr, dashboardUID)
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

		body, _ := rulesNamespaceWithoutVariableValues(t, b)
		require.JSONEq(t, expectedFilteredByJSON, body)
	}

	// Now, let's check we get no rules when filtering by an unknown dashboard_uid
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules?dashboard_uid=%s", grafanaListedAddr, "abc")
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
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules?dashboard_uid=%s&panel_id=1", grafanaListedAddr, dashboardUID)
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

		body, _ := rulesNamespaceWithoutVariableValues(t, b)
		require.JSONEq(t, expectedFilteredByJSON, body)
	}

	// Now, let's check we get no rules when filtering by dashboard_uid and unknown panel_id
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules?dashboard_uid=%s&panel_id=2", grafanaListedAddr, dashboardUID)
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
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules?dashboard_uid=%s&panel_id=invalid", grafanaListedAddr, dashboardUID)
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
		var res map[string]interface{}
		require.NoError(t, json.Unmarshal(b, &res))
		require.Equal(t, `invalid panel_id: strconv.ParseInt: parsing "invalid": invalid syntax`, res["message"])
	}

	// Now, let's check a panel_id without dashboard_uid returns a 400 Bad Request response
	{
		promRulesURL := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules?panel_id=1", grafanaListedAddr)
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
		var res map[string]interface{}
		require.NoError(t, json.Unmarshal(b, &res))
		require.Equal(t, "panel_id must be set with dashboard_uid", res["message"])
	}
}

func TestIntegrationRuleGroupSequence(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})
	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)

	// Create a user to make authenticated requests
	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	client := newAlertingApiClient(grafanaListedAddr, "grafana", "password")
	folder1Title := "folder1"
	client.CreateFolder(t, util.GenerateShortUID(), folder1Title)

	group1 := generateAlertRuleGroup(5, alertRuleGen())
	group2 := generateAlertRuleGroup(5, alertRuleGen())

	status, _ := client.PostRulesGroup(t, folder1Title, &group1)
	require.Equal(t, http.StatusAccepted, status)
	status, _ = client.PostRulesGroup(t, folder1Title, &group2)
	require.Equal(t, http.StatusAccepted, status)

	t.Run("should persist order of the rules in a group", func(t *testing.T) {
		group1Get := client.GetRulesGroup(t, folder1Title, group1.Name)
		assert.Equal(t, group1.Name, group1Get.Name)
		assert.Equal(t, group1.Interval, group1Get.Interval)
		assert.Len(t, group1Get.Rules, len(group1.Rules))
		for i, getRule := range group1Get.Rules {
			rule := group1.Rules[i]
			assert.Equal(t, getRule.GrafanaManagedAlert.Title, rule.GrafanaManagedAlert.Title)
			assert.NotEmpty(t, getRule.GrafanaManagedAlert.UID)
		}

		// now shuffle the rules
		postableGroup1 := convertGettableRuleGroupToPostable(group1Get.GettableRuleGroupConfig)
		rand.Shuffle(len(postableGroup1.Rules), func(i, j int) {
			postableGroup1.Rules[i], postableGroup1.Rules[j] = postableGroup1.Rules[j], postableGroup1.Rules[i]
		})
		expectedUids := make([]string, 0, len(postableGroup1.Rules))
		for _, rule := range postableGroup1.Rules {
			expectedUids = append(expectedUids, rule.GrafanaManagedAlert.UID)
		}
		status, _ := client.PostRulesGroup(t, folder1Title, &postableGroup1)
		require.Equal(t, http.StatusAccepted, status)

		group1Get = client.GetRulesGroup(t, folder1Title, group1.Name)

		require.Len(t, group1Get.Rules, len(postableGroup1.Rules))

		actualUids := make([]string, 0, len(group1Get.Rules))
		for _, getRule := range group1Get.Rules {
			actualUids = append(actualUids, getRule.GrafanaManagedAlert.UID)
		}
		assert.Equal(t, expectedUids, actualUids)
	})

	t.Run("should be able to move a rule from another group in a specific position", func(t *testing.T) {
		group1Get := client.GetRulesGroup(t, folder1Title, group1.Name)
		group2Get := client.GetRulesGroup(t, folder1Title, group2.Name)

		movedRule := convertGettableRuleToPostable(group2Get.Rules[3])
		// now shuffle the rules
		postableGroup1 := convertGettableRuleGroupToPostable(group1Get.GettableRuleGroupConfig)
		postableGroup1.Rules = append(append(append([]apimodels.PostableExtendedRuleNode{}, postableGroup1.Rules[0:1]...), movedRule), postableGroup1.Rules[2:]...)
		expectedUids := make([]string, 0, len(postableGroup1.Rules))
		for _, rule := range postableGroup1.Rules {
			expectedUids = append(expectedUids, rule.GrafanaManagedAlert.UID)
		}
		status, _ := client.PostRulesGroup(t, folder1Title, &postableGroup1)
		require.Equal(t, http.StatusAccepted, status)

		group1Get = client.GetRulesGroup(t, folder1Title, group1.Name)

		require.Len(t, group1Get.Rules, len(postableGroup1.Rules))

		actualUids := make([]string, 0, len(group1Get.Rules))
		for _, getRule := range group1Get.Rules {
			actualUids = append(actualUids, getRule.GrafanaManagedAlert.UID)
		}
		assert.Equal(t, expectedUids, actualUids)

		group2Get = client.GetRulesGroup(t, folder1Title, group2.Name)
		assert.Len(t, group2Get.Rules, len(group2.Rules)-1)
		for _, rule := range group2Get.Rules {
			require.NotEqual(t, movedRule.GrafanaManagedAlert.UID, rule.GrafanaManagedAlert.UID)
		}
	})
}

func TestIntegrationRuleUpdate(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})
	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)

	// Create a user to make authenticated requests
	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	client := newAlertingApiClient(grafanaListedAddr, "grafana", "password")
	folder1Title := "folder1"
	client.CreateFolder(t, util.GenerateShortUID(), folder1Title)

	t.Run("should be able to reset 'for' to 0", func(t *testing.T) {
		group := generateAlertRuleGroup(1, alertRuleGen())
		expected := model.Duration(10 * time.Second)
		group.Rules[0].ApiRuleNode.For = &expected

		status, body := client.PostRulesGroup(t, folder1Title, &group)
		require.Equalf(t, http.StatusAccepted, status, "failed to post rule group. Response: %s", body)
		getGroup := client.GetRulesGroup(t, folder1Title, group.Name)
		require.Equal(t, expected, *getGroup.Rules[0].ApiRuleNode.For)

		group = convertGettableRuleGroupToPostable(getGroup.GettableRuleGroupConfig)
		expected = 0
		group.Rules[0].ApiRuleNode.For = &expected
		status, body = client.PostRulesGroup(t, folder1Title, &group)
		require.Equalf(t, http.StatusAccepted, status, "failed to post rule group. Response: %s", body)

		getGroup = client.GetRulesGroup(t, folder1Title, group.Name)
		require.Equal(t, expected, *getGroup.Rules[0].ApiRuleNode.For)
	})
}

func newTestingRuleConfig(t *testing.T) apimodels.PostableRuleGroupConfig {
	interval, err := model.ParseDuration("1m")
	require.NoError(t, err)

	firstRule := apimodels.PostableExtendedRuleNode{
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
			Data: []ngmodels.AlertQuery{
				{
					RefID: "A",
					RelativeTimeRange: ngmodels.RelativeTimeRange{
						From: ngmodels.Duration(time.Duration(5) * time.Hour),
						To:   ngmodels.Duration(time.Duration(3) * time.Hour),
					},
					DatasourceUID: expr.DatasourceUID,
					Model: json.RawMessage(`{
						"type": "math",
						"expression": "2 + 3 > 1"
						}`),
				},
			},
		},
	}
	secondRule := apimodels.PostableExtendedRuleNode{
		ApiRuleNode: &apimodels.ApiRuleNode{
			For:         &interval,
			Labels:      map[string]string{"label1": "val1"},
			Annotations: map[string]string{"annotation1": "val1"},
		},
		// this rule does not explicitly set no data and error states
		// therefore it should get the default values
		GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
			Title:     "AlwaysFiring2",
			Condition: "A",
			Data: []ngmodels.AlertQuery{
				{
					RefID: "A",
					RelativeTimeRange: ngmodels.RelativeTimeRange{
						From: ngmodels.Duration(time.Duration(5) * time.Hour),
						To:   ngmodels.Duration(time.Duration(3) * time.Hour),
					},
					DatasourceUID: expr.DatasourceUID,
					Model: json.RawMessage(`{
						"type": "math",
						"expression": "2 + 3 > 1"
						}`),
				},
			},
		},
	}

	return apimodels.PostableRuleGroupConfig{
		Name: "arulegroup",
		Rules: []apimodels.PostableExtendedRuleNode{
			firstRule,
			secondRule,
		},
	}
}

func TestIntegrationRulePause(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})
	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)

	// Create a user to make authenticated requests
	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	client := newAlertingApiClient(grafanaListedAddr, "grafana", "password")
	folder1Title := "folder1"
	client.CreateFolder(t, util.GenerateShortUID(), folder1Title)

	t.Run("should create a paused rule if isPaused is true", func(t *testing.T) {
		group := generateAlertRuleGroup(1, alertRuleGen())
		expectedIsPaused := true
		group.Rules[0].GrafanaManagedAlert.IsPaused = &expectedIsPaused

		status, body := client.PostRulesGroup(t, folder1Title, &group)
		require.Equalf(t, http.StatusAccepted, status, "failed to post rule group. Response: %s", body)
		getGroup := client.GetRulesGroup(t, folder1Title, group.Name)
		require.Equalf(t, http.StatusAccepted, status, "failed to get rule group. Response: %s", body)
		require.Equal(t, expectedIsPaused, getGroup.Rules[0].GrafanaManagedAlert.IsPaused)
	})

	t.Run("should create a unpaused rule if isPaused is false", func(t *testing.T) {
		group := generateAlertRuleGroup(1, alertRuleGen())
		expectedIsPaused := false
		group.Rules[0].GrafanaManagedAlert.IsPaused = &expectedIsPaused

		status, body := client.PostRulesGroup(t, folder1Title, &group)
		require.Equalf(t, http.StatusAccepted, status, "failed to post rule group. Response: %s", body)
		getGroup := client.GetRulesGroup(t, folder1Title, group.Name)
		require.Equalf(t, http.StatusAccepted, status, "failed to get rule group. Response: %s", body)
		require.Equal(t, expectedIsPaused, getGroup.Rules[0].GrafanaManagedAlert.IsPaused)
	})

	t.Run("should create a unpaused rule if isPaused is not present", func(t *testing.T) {
		group := generateAlertRuleGroup(1, alertRuleGen())
		group.Rules[0].GrafanaManagedAlert.IsPaused = nil

		status, body := client.PostRulesGroup(t, folder1Title, &group)
		require.Equalf(t, http.StatusAccepted, status, "failed to post rule group. Response: %s", body)
		getGroup := client.GetRulesGroup(t, folder1Title, group.Name)
		require.Equalf(t, http.StatusAccepted, status, "failed to get rule group. Response: %s", body)
		require.False(t, getGroup.Rules[0].GrafanaManagedAlert.IsPaused)
	})

	getBooleanPointer := func(b bool) *bool { return &b }
	testCases := []struct {
		description          string
		isPausedInDb         bool
		isPausedInBody       *bool
		expectedIsPausedInDb bool
	}{
		{
			description:          "should pause rule if there is a paused rule in DB and isPaused is true",
			isPausedInDb:         true,
			isPausedInBody:       getBooleanPointer(true),
			expectedIsPausedInDb: true,
		},
		{
			description:          "should unpause rule if there is a paused rule in DB and isPaused is false",
			isPausedInDb:         true,
			isPausedInBody:       getBooleanPointer(false),
			expectedIsPausedInDb: false,
		},
		{
			description:          "should keep rule paused if there is a paused rule in DB and isPaused is not present",
			isPausedInDb:         true,
			isPausedInBody:       nil,
			expectedIsPausedInDb: true,
		},
		{
			description:          "should pause rule if there is an unpaused rule in DB and isPaused is true",
			isPausedInDb:         false,
			isPausedInBody:       getBooleanPointer(true),
			expectedIsPausedInDb: true,
		},
		{
			description:          "should unpause rule if there is an unpaused rule in DB and isPaused is false",
			isPausedInDb:         false,
			isPausedInBody:       getBooleanPointer(false),
			expectedIsPausedInDb: false,
		},
		{
			description:          "should keep rule unpaused if there is an unpaused rule in DB and isPaused is not present",
			isPausedInDb:         false,
			isPausedInBody:       nil,
			expectedIsPausedInDb: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.description, func(t *testing.T) {
			group := generateAlertRuleGroup(1, alertRuleGen())
			group.Rules[0].GrafanaManagedAlert.IsPaused = &tc.isPausedInDb

			status, body := client.PostRulesGroup(t, folder1Title, &group)
			require.Equalf(t, http.StatusAccepted, status, "failed to post rule group. Response: %s", body)
			getGroup := client.GetRulesGroup(t, folder1Title, group.Name)
			require.Equalf(t, http.StatusAccepted, status, "failed to get rule group. Response: %s", body)

			group = convertGettableRuleGroupToPostable(getGroup.GettableRuleGroupConfig)
			group.Rules[0].GrafanaManagedAlert.IsPaused = tc.isPausedInBody
			status, body = client.PostRulesGroup(t, folder1Title, &group)
			require.Equalf(t, http.StatusAccepted, status, "failed to post rule group. Response: %s", body)

			getGroup = client.GetRulesGroup(t, folder1Title, group.Name)
			require.Equal(t, tc.expectedIsPausedInDb, getGroup.Rules[0].GrafanaManagedAlert.IsPaused)
		})
	}
}

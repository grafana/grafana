package alerting

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"testing"
	"time"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	acdb "github.com/grafana/grafana/pkg/services/accesscontrol/database"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestAlertRulePermissions(t *testing.T) {
	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)
	permissionsStore := acdb.ProvideService(store)

	// Create a user to make authenticated requests
	userID := createUser(t, store, models.CreateUserCommand{
		DefaultOrgRole: string(models.ROLE_EDITOR),
		Password:       "password",
		Login:          "grafana",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")

	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "folder1", "folder1")
	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "folder2", "folder2")

	reloadCachedPermissions(t, grafanaListedAddr, "grafana", "password")

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
		b, err := ioutil.ReadAll(resp.Body)
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
		                        "datasourceUid":"-100",
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
		                        "datasourceUid":"-100",
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
		removeFolderPermission(t, permissionsStore, 1, userID, models.ROLE_EDITOR, "folder2")
		reloadCachedPermissions(t, grafanaListedAddr, "grafana", "password")

		// make sure that folder2 is not included in the response
		// nolint:gosec
		resp, err = http.Get(u)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err = ioutil.ReadAll(resp.Body)
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
		                        "datasourceUid":"-100",
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
	removeFolderPermission(t, permissionsStore, 1, userID, models.ROLE_EDITOR, "folder1")
	reloadCachedPermissions(t, grafanaListedAddr, "grafana", "password")
	{
		u := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(u)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, resp.StatusCode, 200)
		require.JSONEq(t, `{}`, string(b))
	}
}

func createRule(t *testing.T, client apiClient, folder string) {
	t.Helper()

	interval, err := model.ParseDuration("1m")
	require.NoError(t, err)

	rules := apimodels.PostableRuleGroupConfig{
		Name:     "arulegroup",
		Interval: interval,
		Rules: []apimodels.PostableExtendedRuleNode{
			{
				ApiRuleNode: &apimodels.ApiRuleNode{
					For:         2 * interval,
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
							DatasourceUID: "-100",
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

func TestAlertRuleConflictingTitle(t *testing.T) {
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
	createUser(t, store, models.CreateUserCommand{
		DefaultOrgRole: string(models.ROLE_ADMIN),
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

func TestRulerRulesFilterByDashboard(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{"ngalert"},
		DisableAnonymous:     true,
		AppModeProduction:    true,
	})

	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)

	// Create a user to make authenticated requests
	createUser(t, store, models.CreateUserCommand{
		DefaultOrgRole: string(models.ROLE_EDITOR),
		Password:       "password",
		Login:          "grafana",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")

	dashboardUID := "default"
	// Create the namespace under default organisation (orgID = 1) where we'll save our alerts to.
	apiClient.CreateFolder(t, "default", "default")

	reloadCachedPermissions(t, grafanaListedAddr, "grafana", "password")

	interval, err := model.ParseDuration("10s")
	require.NoError(t, err)

	// Now, let's create some rules
	{
		rules := apimodels.PostableRuleGroupConfig{
			Name: "anotherrulegroup",
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:    interval,
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
								DatasourceUID: "-100",
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
								DatasourceUID: "-100",
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
					"datasourceUid": "-100",
					"model": {
						"expression": "2 + 3 \u003e 1",
						"intervalMs": 1000,
						"maxDataPoints": 43200,
						"type": "math"
					}
				}],
				"updated": "2021-02-21T01:10:30Z",
				"intervalSeconds": 60,
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
					"datasourceUid": "-100",
					"model": {
						"expression": "2 + 3 \u003e 1",
						"intervalMs": 1000,
						"maxDataPoints": 43200,
						"type": "math"
					}
				}],
				"updated": "2021-02-21T01:10:30Z",
				"intervalSeconds": 60,
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
					"datasourceUid": "-100",
					"model": {
						"expression": "2 + 3 \u003e 1",
						"intervalMs": 1000,
						"maxDataPoints": 43200,
						"type": "math"
					}
				}],
				"updated": "2021-02-21T01:10:30Z",
				"intervalSeconds": 60,
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
		b, err := ioutil.ReadAll(resp.Body)
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
		b, err := ioutil.ReadAll(resp.Body)
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
		b, err := ioutil.ReadAll(resp.Body)
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
		b, err := ioutil.ReadAll(resp.Body)
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
		b, err := ioutil.ReadAll(resp.Body)
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
		b, err := ioutil.ReadAll(resp.Body)
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
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		var res map[string]interface{}
		require.NoError(t, json.Unmarshal(b, &res))
		require.Equal(t, "panel_id must be set with dashboard_uid", res["message"])
	}
}

func newTestingRuleConfig(t *testing.T) apimodels.PostableRuleGroupConfig {
	interval, err := model.ParseDuration("1m")
	require.NoError(t, err)

	firstRule := apimodels.PostableExtendedRuleNode{
		ApiRuleNode: &apimodels.ApiRuleNode{
			For:         interval,
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
					DatasourceUID: "-100",
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
			For:         interval,
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
					DatasourceUID: "-100",
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

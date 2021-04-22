package alerting

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	ngstore "github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestAlertAndGroupsQuery(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{"ngalert"},
		AnonymousUserRole:    models.ROLE_EDITOR,
	})

	store := testinfra.SetUpDatabase(t, dir)
	grafanaListedAddr := testinfra.StartGrafana(t, dir, path, store)

	// When there are no alerts available, it returns an empty list.
	{
		alertsURL := fmt.Sprintf("http://%s/api/alertmanager/grafana/api/v2/alerts", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(alertsURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)
		require.JSONEq(t, "[]", string(b))
	}

	// When are there no alerts available, it returns an empty list of groups.
	{
		alertsURL := fmt.Sprintf("http://%s/api/alertmanager/grafana/api/v2/alerts/groups", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(alertsURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)
		require.JSONEq(t, "[]", string(b))
	}

	// Now, let's test the endpoint with some alerts.
	{
		// Create the namespace we'll save our alerts to.
		require.NoError(t, createFolder(t, store, 0, "default"))
	}

	// Create an alert that will fire as quickly as possible
	{
		interval, err := model.ParseDuration("10s")
		require.NoError(t, err)
		rules := apimodels.PostableRuleGroupConfig{
			Name:     "arulegroup",
			Interval: interval,
			Rules: []apimodels.PostableExtendedRuleNode{
				{
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
								Model: json.RawMessage(`{
									"datasourceUid": "-100",
									"type": "math",
									"expression": "2 + 3 > 1"
									}`),
							},
						},
					},
				},
			},
		}
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err = enc.Encode(&rules)
		require.NoError(t, err)

		u := fmt.Sprintf("http://%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", &buf)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		require.NoError(t, err)
		assert.Equal(t, resp.StatusCode, 202)
	}

	// Eventually, we'll get an alert with its state being active.
	{
		alertsURL := fmt.Sprintf("http://%s/api/alertmanager/grafana/api/v2/alerts", grafanaListedAddr)
		// nolint:gosec
		require.Eventually(t, func() bool {
			resp, err := http.Get(alertsURL)
			require.NoError(t, err)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
			b, err := ioutil.ReadAll(resp.Body)
			require.NoError(t, err)
			require.Equal(t, 200, resp.StatusCode)

			var alerts apimodels.GettableAlerts
			err = json.Unmarshal(b, &alerts)
			require.NoError(t, err)

			if len(alerts) > 0 {
				status := alerts[0].Status
				return status != nil && status.State != nil && *status.State == "active"
			}

			return false
		}, 18*time.Second, 2*time.Second)
	}
}

func TestAlertRuleCRUD(t *testing.T) {
	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{"ngalert"},
		AnonymousUserRole:    models.ROLE_EDITOR,
	})
	store := testinfra.SetUpDatabase(t, dir)
	grafanaListedAddr := testinfra.StartGrafana(t, dir, path, store)

	// Create the namespace we'll save our alerts to.
	require.NoError(t, createFolder(t, store, 0, "default"))

	interval, err := model.ParseDuration("1m")
	require.NoError(t, err)

	invalidInterval, err := model.ParseDuration("1s")
	require.NoError(t, err)

	// Now, let's try to create some invalid alert rules.
	{
		testCases := []struct {
			desc             string
			rulegroup        string
			interval         model.Duration
			rule             apimodels.PostableExtendedRuleNode
			expectedResponse string
		}{
			{
				desc:      "alert rule without queries and expressions",
				rulegroup: "arulegroup",
				rule: apimodels.PostableExtendedRuleNode{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:         interval,
						Labels:      map[string]string{"label1": "val1"},
						Annotations: map[string]string{"annotation1": "val1"},
					},
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     "AlwaysFiring",
						Condition: "A",
					},
				},
				expectedResponse: `{"error":"invalid alert rule: no queries or expressions are found", "message":"failed to update rule group"}`,
			},
			{
				desc:      "alert rule with empty title",
				rulegroup: "arulegroup",
				rule: apimodels.PostableExtendedRuleNode{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:         interval,
						Labels:      map[string]string{"label1": "val1"},
						Annotations: map[string]string{"annotation1": "val1"},
					},
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     "",
						Condition: "A",
						Data: []ngmodels.AlertQuery{
							{
								RefID: "A",
								RelativeTimeRange: ngmodels.RelativeTimeRange{
									From: ngmodels.Duration(time.Duration(5) * time.Hour),
									To:   ngmodels.Duration(time.Duration(3) * time.Hour),
								},
								Model: json.RawMessage(`{
									"datasourceUid": "-100",
									"type": "math",
									"expression": "2 + 3 > 1"
									}`),
							},
						},
					},
				},
				expectedResponse: `{"error":"invalid alert rule: title is empty", "message":"failed to update rule group"}`,
			},
			{
				desc:      "alert rule with too long name",
				rulegroup: "arulegroup",
				rule: apimodels.PostableExtendedRuleNode{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:         interval,
						Labels:      map[string]string{"label1": "val1"},
						Annotations: map[string]string{"annotation1": "val1"},
					},
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     getLongString(ngstore.AlertRuleMaxTitleLength + 1),
						Condition: "A",
						Data: []ngmodels.AlertQuery{
							{
								RefID: "A",
								RelativeTimeRange: ngmodels.RelativeTimeRange{
									From: ngmodels.Duration(time.Duration(5) * time.Hour),
									To:   ngmodels.Duration(time.Duration(3) * time.Hour),
								},
								Model: json.RawMessage(`{
									"datasourceUid": "-100",
									"type": "math",
									"expression": "2 + 3 > 1"
									}`),
							},
						},
					},
				},
				expectedResponse: `{"error":"invalid alert rule: name length should not be greater than 190", "message":"failed to update rule group"}`,
			},
			{
				desc:      "alert rule with too long rulegroup",
				rulegroup: getLongString(ngstore.AlertRuleMaxTitleLength + 1),
				rule: apimodels.PostableExtendedRuleNode{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:         interval,
						Labels:      map[string]string{"label1": "val1"},
						Annotations: map[string]string{"annotation1": "val1"},
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
								Model: json.RawMessage(`{
									"datasourceUid": "-100",
									"type": "math",
									"expression": "2 + 3 > 1"
									}`),
							},
						},
					},
				},
				expectedResponse: `{"error":"invalid alert rule: rule group name length should not be greater than 190", "message":"failed to update rule group"}`,
			},
			{
				desc:      "alert rule with invalid interval",
				rulegroup: "arulegroup",
				interval:  invalidInterval,
				rule: apimodels.PostableExtendedRuleNode{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:         interval,
						Labels:      map[string]string{"label1": "val1"},
						Annotations: map[string]string{"annotation1": "val1"},
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
								Model: json.RawMessage(`{
									"datasourceUid": "-100",
									"type": "math",
									"expression": "2 + 3 > 1"
									}`),
							},
						},
					},
				},
				expectedResponse: `{"error":"invalid alert rule: interval (1s) should be divided exactly by scheduler interval: 10s", "message":"failed to update rule group"}`,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				rules := apimodels.PostableRuleGroupConfig{
					Name:     tc.rulegroup,
					Interval: tc.interval,
					Rules: []apimodels.PostableExtendedRuleNode{
						tc.rule,
					},
				}
				buf := bytes.Buffer{}
				enc := json.NewEncoder(&buf)
				err := enc.Encode(&rules)
				require.NoError(t, err)

				u := fmt.Sprintf("http://%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
				// nolint:gosec
				resp, err := http.Post(u, "application/json", &buf)
				require.NoError(t, err)
				t.Cleanup(func() {
					err := resp.Body.Close()
					require.NoError(t, err)
				})
				b, err := ioutil.ReadAll(resp.Body)
				require.NoError(t, err)

				assert.Equal(t, resp.StatusCode, http.StatusBadRequest)
				require.JSONEq(t, tc.expectedResponse, string(b))
			})
		}
	}

	var ruleUID string
	var expectedGetNamespaceResponseBody string
	// Now, let's create two alerts.
	{
		rules := apimodels.PostableRuleGroupConfig{
			Name: "arulegroup",
			Rules: []apimodels.PostableExtendedRuleNode{
				{
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
								Model: json.RawMessage(`{
									"datasourceUid": "-100",
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
								Model: json.RawMessage(`{
									"datasourceUid": "-100",
									"type": "math",
									"expression": "2 + 3 > 1"
									}`),
							},
						},
						NoDataState:  apimodels.NoDataState(ngmodels.Alerting),
						ExecErrState: apimodels.ExecutionErrorState(ngmodels.KeepLastStateErrState),
					},
				},
			},
		}
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err := enc.Encode(&rules)
		require.NoError(t, err)

		u := fmt.Sprintf("http://%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", &buf)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, resp.StatusCode, 202)
		require.JSONEq(t, `{"message":"rule group updated successfully"}`, string(b))
	}

	// With the rules created, let's make sure that rule definition is stored correctly.
	{
		u := fmt.Sprintf("http://%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(u)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, resp.StatusCode, 202)

		body, m := rulesNamespaceWithoutVariableValues(t, b)
		generatedUIDs, ok := m["default,arulegroup"]
		assert.True(t, ok)
		assert.Equal(t, 2, len(generatedUIDs))
		// assert that generated UIDs are unique
		assert.NotEqual(t, generatedUIDs[0], generatedUIDs[1])
		// copy result to a variable with a wider scope
		// to be used by the next test
		ruleUID = generatedUIDs[0]
		expectedGetNamespaceResponseBody = `
		{
		   "default":[
			  {
				 "name":"arulegroup",
				 "interval":"1m",
				 "rules":[
					{
						"annotations": {
							"annotation1": "val1"
					   },
					   "expr":"",
					   "for": "1m",
					   "labels": {
							"label1": "val1"
					   },
					   "grafana_alert":{
						  "id":1,
						  "orgId":2,
						  "title":"AlwaysFiring",
						  "condition":"A",
						  "data":[
							 {
								"refId":"A",
								"queryType":"",
								"relativeTimeRange":{
								   "from":18000,
								   "to":10800
								},
								"model":{
								   "datasourceUid":"-100",
								   "expression":"2 + 3 \u003e 1",
								   "intervalMs":1000,
								   "maxDataPoints":100,
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
					},
					{
					   "expr":"",
					   "grafana_alert":{
						  "id":2,
						  "orgId":2,
						  "title":"AlwaysFiringButSilenced",
						  "condition":"A",
						  "data":[
							 {
								"refId":"A",
								"queryType":"",
								"relativeTimeRange":{
								   "from":18000,
								   "to":10800
								},
								"model":{
								   "datasourceUid":"-100",
								   "expression":"2 + 3 \u003e 1",
								   "intervalMs":1000,
								   "maxDataPoints":100,
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
						  "no_data_state":"Alerting",
						  "exec_err_state":"KeepLastState"
					   }
					}
				 ]
			  }
		   ]
		}`
		assert.JSONEq(t, expectedGetNamespaceResponseBody, body)
	}

	// try to update by pass an invalid UID
	{
		interval, err := model.ParseDuration("30s")
		require.NoError(t, err)

		rules := apimodels.PostableRuleGroupConfig{
			Name: "arulegroup",
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For: interval,
						Labels: map[string]string{
							"label1": "val42",
							"foo":    "bar",
						},
						Annotations: map[string]string{
							"annotation1": "val42",
							"foo":         "bar",
						},
					},
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						UID:       "unknown",
						Title:     "AlwaysNormal",
						Condition: "A",
						Data: []ngmodels.AlertQuery{
							{
								RefID: "A",
								RelativeTimeRange: ngmodels.RelativeTimeRange{
									From: ngmodels.Duration(time.Duration(5) * time.Hour),
									To:   ngmodels.Duration(time.Duration(3) * time.Hour),
								},
								Model: json.RawMessage(`{
											"datasourceUid": "-100",
											"type": "math",
											"expression": "2 + 3 < 1"
											}`),
							},
						},
						NoDataState:  apimodels.NoDataState(ngmodels.Alerting),
						ExecErrState: apimodels.ExecutionErrorState(ngmodels.KeepLastStateErrState),
					},
				},
			},
		}
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err = enc.Encode(&rules)
		require.NoError(t, err)

		u := fmt.Sprintf("http://%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", &buf)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
		require.JSONEq(t, `{"error":"failed to get alert rule unknown: could not find alert rule", "message": "failed to update rule group"}`, string(b))

		// let's make sure that rule definitions are not affected by the failed POST request.
		u = fmt.Sprintf("http://%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err = http.Get(u)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err = ioutil.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, resp.StatusCode, 202)

		body, m := rulesNamespaceWithoutVariableValues(t, b)
		returnedUIDs, ok := m["default,arulegroup"]
		assert.True(t, ok)
		assert.Equal(t, 2, len(returnedUIDs))
		assert.JSONEq(t, expectedGetNamespaceResponseBody, body)
	}

	// update the first rule and completely remove the other
	{
		interval, err := model.ParseDuration("30s")
		require.NoError(t, err)

		rules := apimodels.PostableRuleGroupConfig{
			Name: "arulegroup",
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For: interval,
						Labels: map[string]string{
							"label1": "val42",
							"foo":    "bar",
						},
						Annotations: map[string]string{
							"annotation1": "val42",
							"foo":         "bar",
						},
					},
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						UID:       ruleUID, // Including the UID in the payload makes the endpoint update the existing rule.
						Title:     "AlwaysNormal",
						Condition: "A",
						Data: []ngmodels.AlertQuery{
							{
								RefID: "A",
								RelativeTimeRange: ngmodels.RelativeTimeRange{
									From: ngmodels.Duration(time.Duration(5) * time.Hour),
									To:   ngmodels.Duration(time.Duration(3) * time.Hour),
								},
								Model: json.RawMessage(`{
											"datasourceUid": "-100",
											"type": "math",
											"expression": "2 + 3 < 1"
											}`),
							},
						},
						NoDataState:  apimodels.NoDataState(ngmodels.Alerting),
						ExecErrState: apimodels.ExecutionErrorState(ngmodels.KeepLastStateErrState),
					},
				},
			},
		}
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err = enc.Encode(&rules)
		require.NoError(t, err)

		u := fmt.Sprintf("http://%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", &buf)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, resp.StatusCode, 202)
		require.JSONEq(t, `{"message":"rule group updated successfully"}`, string(b))

		// let's make sure that rule definitions are updated correctly.
		u = fmt.Sprintf("http://%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err = http.Get(u)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err = ioutil.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, resp.StatusCode, 202)

		body, m := rulesNamespaceWithoutVariableValues(t, b)
		returnedUIDs, ok := m["default,arulegroup"]
		assert.True(t, ok)
		assert.Equal(t, 1, len(returnedUIDs))
		assert.Equal(t, ruleUID, returnedUIDs[0])
		assert.JSONEq(t, `
		{
		   "default":[
		      {
		         "name":"arulegroup",
		         "interval":"1m",
		         "rules":[
		            {
						"annotations": {
							"annotation1": "val42",
							"foo": "bar"
					   },
		               "expr":"",
					   "for": "30s",
					   "labels": {
							"foo": "bar",
							"label1": "val42"
					   },
		               "grafana_alert":{
		                  "id":1,
		                  "orgId":2,
		                  "title":"AlwaysNormal",
		                  "condition":"A",
		                  "data":[
		                     {
		                        "refId":"A",
		                        "queryType":"",
		                        "relativeTimeRange":{
		                           "from":18000,
		                           "to":10800
		                        },
		                        "model":{
		                           "datasourceUid":"-100",
		                           "expression":"2 + 3 \u003C 1",
		                           "intervalMs":1000,
		                           "maxDataPoints":100,
		                           "type":"math"
		                        }
		                     }
		                  ],
		                  "updated":"2021-02-21T01:10:30Z",
		                  "intervalSeconds":60,
		                  "version":2,
		                  "uid":"uid",
		                  "namespace_uid":"nsuid",
		                  "namespace_id":1,
		                  "rule_group":"arulegroup",
		                  "no_data_state":"Alerting",
		                  "exec_err_state":"KeepLastState"
		               }
		            }
		         ]
		      }
		   ]
		}`, body)
	}

	client := &http.Client{}
	// Finally, make sure we can delete it.
	{
		t.Run("fail if he rule group name does not exists", func(t *testing.T) {
			u := fmt.Sprintf("http://%s/api/ruler/grafana/api/v1/rules/default/groupnotexist", grafanaListedAddr)
			req, err := http.NewRequest(http.MethodDelete, u, nil)
			require.NoError(t, err)
			resp, err := client.Do(req)
			require.NoError(t, err)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
			b, err := ioutil.ReadAll(resp.Body)
			require.NoError(t, err)

			require.Equal(t, http.StatusNotFound, resp.StatusCode)
			require.JSONEq(t, `{"error":"rule group not found under this namespace", "message": "failed to delete rule group"}`, string(b))
		})

		t.Run("succeed if the rule group name does exist", func(t *testing.T) {
			u := fmt.Sprintf("http://%s/api/ruler/grafana/api/v1/rules/default/arulegroup", grafanaListedAddr)
			req, err := http.NewRequest(http.MethodDelete, u, nil)
			require.NoError(t, err)
			resp, err := client.Do(req)
			require.NoError(t, err)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
			b, err := ioutil.ReadAll(resp.Body)
			require.NoError(t, err)

			require.Equal(t, http.StatusAccepted, resp.StatusCode)
			require.JSONEq(t, `{"message":"rule group deleted"}`, string(b))
		})
	}

	// test eval conditions
	testCases := []struct {
		desc               string
		payload            string
		expectedStatusCode int
		expectedResponse   string
	}{
		{
			desc: "alerting condition",
			payload: `
			{
				"grafana_condition": {
				"condition": "A",
				"data": [
					{
						"refId": "A",
						"relativeTimeRange": {
							"from": 18000,
							"to": 10800
						},
						"model": {
							"datasourceUid": "-100",
							"type":"math",
							"expression":"1 < 2"
						}
					}
				],
				"now": "2021-04-11T14:38:14Z"
				}
			}
			`,
			expectedStatusCode: http.StatusOK,
			expectedResponse: `{
			"instances": [
			  {
				"schema": {
				  "name": "evaluation results",
				  "fields": [
					{
					  "name": "State",
					  "type": "string",
					  "typeInfo": {
						"frame": "string"
					  }
					}
				  ]
				},
				"data": {
				  "values": [
					[
					  "Alerting"
					]
				  ]
				}
			  }
			]
		  }`,
		},
		{
			desc: "normal condition",
			payload: `
			{
				"grafana_condition": {
				"condition": "A",
				"data": [
					{
						"refId": "A",
						"relativeTimeRange": {
							"from": 18000,
							"to": 10800
						},
						"model": {
							"datasourceUid": "-100",
							"type":"math",
							"expression":"1 > 2"
						}
					}
				],
				"now": "2021-04-11T14:38:14Z"
				}
			}
			`,
			expectedStatusCode: http.StatusOK,
			expectedResponse: `{
			"instances": [
			  {
				"schema": {
				  "name": "evaluation results",
				  "fields": [
					{
					  "name": "State",
					  "type": "string",
					  "typeInfo": {
						"frame": "string"
					  }
					}
				  ]
				},
				"data": {
				  "values": [
					[
					  "Normal"
					]
				  ]
				}
			  }
			]
		  }`,
		},
		{
			desc: "condition not found in any query or expression",
			payload: `
			{
				"grafana_condition": {
				"condition": "B",
				"data": [
					{
						"refId": "A",
						"relativeTimeRange": {
							"from": 18000,
							"to": 10800
						},
						"model": {
							"datasourceUid": "-100",
							"type":"math",
							"expression":"1 > 2"
						}
					}
				],
				"now": "2021-04-11T14:38:14Z"
				}
			}
			`,
			expectedStatusCode: http.StatusBadRequest,
			expectedResponse:   `{"error":"condition B not found in any query or expression","message":"invalid condition"}`,
		},
		{
			desc: "unknown query datasource",
			payload: `
			{
				"grafana_condition": {
				"condition": "A",
				"data": [
					{
						"refId": "A",
						"relativeTimeRange": {
							"from": 18000,
							"to": 10800
						},
						"model": {
							"datasourceUid": "unknown"
						}
					}
				],
				"now": "2021-04-11T14:38:14Z"
				}
			}
			`,
			expectedStatusCode: http.StatusBadRequest,
			expectedResponse:   `{"error":"failed to get datasource: unknown: data source not found","message":"invalid condition"}`,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			u := fmt.Sprintf("http://%s/api/v1/rule/test/grafana", grafanaListedAddr)
			r := strings.NewReader(tc.payload)
			// nolint:gosec
			resp, err := http.Post(u, "application/json", r)
			require.NoError(t, err)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
			b, err := ioutil.ReadAll(resp.Body)
			require.NoError(t, err)

			assert.Equal(t, tc.expectedStatusCode, resp.StatusCode)
			require.JSONEq(t, tc.expectedResponse, string(b))
		})
	}

	// test eval queries and expressions
	testCases = []struct {
		desc               string
		payload            string
		expectedStatusCode int
		expectedResponse   string
	}{
		{
			desc: "alerting condition",
			payload: `
			{
				"data": [
						{
							"refId": "A",
							"relativeTimeRange": {
								"from": 18000,
								"to": 10800
							},
							"model": {
								"datasourceUid": "-100",
								"type":"math",
								"expression":"1 < 2"
							}
						}
					],
				"now": "2021-04-11T14:38:14Z"
			}
			`,
			expectedStatusCode: http.StatusOK,
			expectedResponse: `{
				"results": {
				  "A": {
					"frames": [
					  {
						"schema": {
						  "refId": "A",
						  "fields": [
							{
							  "name": "A",
							  "type": "number",
							  "typeInfo": {
								"frame": "float64",
								"nullable": true
							  }
							}
						  ]
						},
						"data": {
						  "values": [
							[
							  1
							]
						  ]
						}
					  }
					]
				  }
				}
			}`,
		},
		{
			desc: "normal condition",
			payload: `
			{
				"data": [
						{
							"refId": "A",
							"relativeTimeRange": {
								"from": 18000,
								"to": 10800
							},
							"model": {
								"datasourceUid": "-100",
								"type":"math",
								"expression":"1 > 2"
							}
						}
					],
				"now": "2021-04-11T14:38:14Z"
			}
			`,
			expectedStatusCode: http.StatusOK,
			expectedResponse: `{
				"results": {
				  "A": {
					"frames": [
					  {
						"schema": {
						  "refId": "A",
						  "fields": [
							{
							  "name": "A",
							  "type": "number",
							  "typeInfo": {
								"frame": "float64",
								"nullable": true
							  }
							}
						  ]
						},
						"data": {
						  "values": [
							[
							  0
							]
						  ]
						}
					  }
					]
				  }
				}
			}`,
		},
		{
			desc: "unknown query datasource",
			payload: `
			{
				"data": [
						{
							"refId": "A",
							"relativeTimeRange": {
								"from": 18000,
								"to": 10800
							},
							"model": {
								"datasourceUid": "unknown"
							}
						}
					],
				"now": "2021-04-11T14:38:14Z"
			}
			`,
			expectedStatusCode: http.StatusBadRequest,
			expectedResponse:   `{"error":"failed to get datasource: unknown: data source not found","message":"invalid queries or expressions"}`,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			u := fmt.Sprintf("http://%s/api/v1/eval", grafanaListedAddr)
			r := strings.NewReader(tc.payload)
			// nolint:gosec
			resp, err := http.Post(u, "application/json", r)
			require.NoError(t, err)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
			b, err := ioutil.ReadAll(resp.Body)
			require.NoError(t, err)

			assert.Equal(t, tc.expectedStatusCode, resp.StatusCode)
			require.JSONEq(t, tc.expectedResponse, string(b))
		})
	}
}

// createFolder creates a folder for storing our alerts under. Grafana uses folders as a replacement for alert namespaces to match its permission model.
// We use the dashboard command using IsFolder = true to tell it's a folder, it takes the dashboard as the name of the folder.
func createFolder(t *testing.T, store *sqlstore.SQLStore, folderID int64, folderName string) error {
	t.Helper()

	cmd := models.SaveDashboardCommand{
		OrgId:    2, // This is the orgID of the anonymous user.
		FolderId: folderID,
		IsFolder: true,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"title": folderName,
		}),
	}
	_, err := store.SaveDashboard(cmd)

	return err
}

// rulesNamespaceWithoutVariableValues takes a apimodels.NamespaceConfigResponse JSON-based input and makes the dynamic fields static e.g. uid, dates, etc.
// it returns a map of the modified rule UIDs with the namespace,rule_group as a key
func rulesNamespaceWithoutVariableValues(t *testing.T, b []byte) (string, map[string][]string) {
	t.Helper()

	var r apimodels.NamespaceConfigResponse
	require.NoError(t, json.Unmarshal(b, &r))
	// create a map holding the created rule UIDs per namespace/group
	m := make(map[string][]string)
	for namespace, nodes := range r {
		for _, node := range nodes {
			compositeKey := strings.Join([]string{namespace, node.Name}, ",")
			_, ok := m[compositeKey]
			if !ok {
				m[compositeKey] = make([]string, 0, len(node.Rules))
			}
			for _, rule := range node.Rules {
				m[compositeKey] = append(m[compositeKey], rule.GrafanaManagedAlert.UID)
				rule.GrafanaManagedAlert.UID = "uid"
				rule.GrafanaManagedAlert.NamespaceUID = "nsuid"
				rule.GrafanaManagedAlert.Updated = time.Date(2021, time.Month(2), 21, 1, 10, 30, 0, time.UTC)
			}
		}
	}

	json, err := json.Marshal(&r)
	require.NoError(t, err)
	return string(json), m
}

func getLongString(n int) string {
	b := make([]rune, n)
	for i := range b {
		b[i] = 'a'
	}
	return string(b)
}

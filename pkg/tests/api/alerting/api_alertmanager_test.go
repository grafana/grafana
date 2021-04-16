package alerting

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"testing"
	"time"

	"github.com/prometheus/common/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestAlertAndGroupsQuery(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{"ngalert"},
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

	dur, err := model.ParseDuration("1m")
	require.NoError(t, err)

	ruleUIDs := make([]string, 2)
	// Now, let's create two alerts.
	{
		rules := apimodels.PostableRuleGroupConfig{
			Name: "arulegroup",
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:         dur,
						Labels:      map[string]string{"label1": "val1"},
						Annotations: map[string]string{"annotation1": "val1"},
					},
					// this rule does not explicitly set no data and error states
					// thererfore it should get the default values
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						OrgID:     2,
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
						OrgID:     2,
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

		fmt.Println(string(b))
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
		assert.JSONEq(t, `
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
}`, rulesNamespaceWithoutVariableValues(t, b, ruleUIDs))
		require.Equal(t, 2, len(ruleUIDs))
		assert.NotEqual(t, ruleUIDs[0], ruleUIDs[1])
	}

	// update the first rule and completely remove the other
	{
		dur, err := model.ParseDuration("30s")
		require.NoError(t, err)

		rules := apimodels.PostableRuleGroupConfig{
			Name: "arulegroup",
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For: dur,
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
						OrgID:     2,
						UID:       ruleUIDs[0],
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

		fmt.Println(string(b))
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
		}`, rulesNamespaceWithoutVariableValues(t, b, ruleUIDs))
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
func rulesNamespaceWithoutVariableValues(t *testing.T, b []byte, ruleUIDs []string) string {
	t.Helper()

	var r apimodels.NamespaceConfigResponse
	require.NoError(t, json.Unmarshal(b, &r))
	for _, nodes := range r {
		for _, node := range nodes {
			for idx, rule := range node.Rules {
				ruleUIDs[idx] = rule.GrafanaManagedAlert.UID
				rule.GrafanaManagedAlert.UID = "uid"
				rule.GrafanaManagedAlert.NamespaceUID = "nsuid"
				rule.GrafanaManagedAlert.Updated = time.Date(2021, time.Month(2), 21, 1, 10, 30, 0, time.UTC)
			}
		}
	}

	json, err := json.Marshal(&r)
	require.NoError(t, err)
	return string(json)
}

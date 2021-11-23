package alerting

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAlertRulePermissions(t *testing.T) {
	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
	})

	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)
	// override bus to get the GetSignedInUserQuery handler
	store.Bus = bus.GetBus()

	// Create a user to make authenticated requests
	createUser(t, store, models.CreateUserCommand{
		DefaultOrgRole: string(models.ROLE_EDITOR),
		Password:       "password",
		Login:          "grafana",
	})

	// Create the namespace we'll save our alerts to.
	_, err := createFolder(t, store, 0, "folder1")
	require.NoError(t, err)

	_, err = createFolder(t, store, 0, "folder2")
	// Create the namespace we'll save our alerts to.
	require.NoError(t, err)

	// Create rule under folder1
	createRule(t, grafanaListedAddr, "folder1", "grafana", "password")

	// Create rule under folder2
	createRule(t, grafanaListedAddr, "folder2", "grafana", "password")

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
		require.NoError(t, store.UpdateDashboardACL(2, nil))

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

	// Remove permissions from ALL folders.
	require.NoError(t, store.UpdateDashboardACL(1, nil))
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

func createRule(t *testing.T, grafanaListedAddr string, folder string, user, password string) {
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
	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	err = enc.Encode(&rules)
	require.NoError(t, err)

	u := fmt.Sprintf("http://%s:%s@%s/api/ruler/grafana/api/v1/rules/%s", user, password, grafanaListedAddr, folder)
	// nolint:gosec
	resp, err := http.Post(u, "application/json", &buf)
	require.NoError(t, err)
	t.Cleanup(func() {
		err := resp.Body.Close()
		require.NoError(t, err)
	})
	b, err := ioutil.ReadAll(resp.Body)
	require.NoError(t, err)

	assert.Equal(t, http.StatusAccepted, resp.StatusCode)
	require.JSONEq(t, `{"message":"rule group updated successfully"}`, string(b))
}

func TestAlertRuleConflictingTitle(t *testing.T) {
	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		EnableQuota:           true,
		DisableAnonymous:      true,
		ViewersCanEdit:        true,
	})

	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)
	// override bus to get the GetSignedInUserQuery handler
	store.Bus = bus.GetBus()

	// Create the namespace we'll save our alerts to.
	_, err := createFolder(t, store, 0, "folder1")
	require.NoError(t, err)
	_, err = createFolder(t, store, 0, "folder2")
	require.NoError(t, err)

	// Create user
	createUser(t, store, models.CreateUserCommand{
		DefaultOrgRole: string(models.ROLE_ADMIN),
		Password:       "admin",
		Login:          "admin",
	})

	interval, err := model.ParseDuration("1m")
	require.NoError(t, err)

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
	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	err = enc.Encode(&rules)
	require.NoError(t, err)

	u := fmt.Sprintf("http://admin:admin@%s/api/ruler/grafana/api/v1/rules/folder1", grafanaListedAddr)
	// nolint:gosec
	resp, err := http.Post(u, "application/json", &buf)
	require.NoError(t, err)
	t.Cleanup(func() {
		err := resp.Body.Close()
		require.NoError(t, err)
	})
	b, err := ioutil.ReadAll(resp.Body)
	require.NoError(t, err)

	assert.Equal(t, http.StatusAccepted, resp.StatusCode)
	require.JSONEq(t, `{"message":"rule group updated successfully"}`, string(b))

	t.Run("trying to create alert with same title under same folder should fail", func(t *testing.T) {
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err = enc.Encode(&rules)
		require.NoError(t, err)

		u := fmt.Sprintf("http://admin:admin@%s/api/ruler/grafana/api/v1/rules/folder1", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", &buf)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
		require.JSONEq(t, `{"message":"failed to update rule group: a conflicting alert rule is found: rule title under the same organisation and folder should be unique"}`, string(b))
	})

	t.Run("trying to create alert with same title under another folder should succeed", func(t *testing.T) {
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err = enc.Encode(&rules)
		require.NoError(t, err)

		u := fmt.Sprintf("http://admin:admin@%s/api/ruler/grafana/api/v1/rules/folder2", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", &buf)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, http.StatusAccepted, resp.StatusCode)
		require.JSONEq(t, `{"message":"rule group updated successfully"}`, string(b))
	})
}

func TestRulerRulesFilterByDashboard(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{"ngalert"},
		DisableAnonymous:     true,
	})

	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)
	// override bus to get the GetSignedInUserQuery handler
	store.Bus = bus.GetBus()

	// Create the namespace under default organisation (orgID = 1) where we'll save our alerts to.
	dashboardUID, err := createFolder(t, store, 0, "default")
	require.NoError(t, err)

	// Create a user to make authenticated requests
	createUser(t, store, models.CreateUserCommand{
		DefaultOrgRole: string(models.ROLE_EDITOR),
		Password:       "password",
		Login:          "grafana",
	})

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
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, resp.StatusCode, 202)
		require.JSONEq(t, `{"message":"rule group updated successfully"}`, string(b))
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
		require.JSONEq(t, `{"message":"invalid panel_id: strconv.ParseInt: parsing \"invalid\": invalid syntax"}`, string(b))
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
		require.JSONEq(t, `{"message":"panel_id must be set with dashboard_uid"}`, string(b))
	}
}

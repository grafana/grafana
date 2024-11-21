package alerting

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/go-openapi/strfmt"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	ngstore "github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util"
)

type Response struct {
	Message string `json:"message"`
	TraceID string `json:"traceID"`
}

func TestIntegrationAMConfigAccess(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	// Create a users to make authenticated requests
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleViewer),
		Password:       "viewer",
		Login:          "viewer",
	})
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "editor",
		Login:          "editor",
	})
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	type testCase struct {
		desc      string
		url       string
		expStatus int
		expBody   string
	}

	t.Run("when creating alertmanager configuration", func(t *testing.T) {
		body := `
		{
			"alertmanager_config": {
				"route": {
					"receiver": "grafana-default-email"
				},
				"receivers": [{
					"name": "grafana-default-email",
					"grafana_managed_receiver_configs": [{
						"uid": "",
						"name": "email receiver",
						"type": "email",
						"isDefault": true,
						"settings": {
							"addresses": "<example@email.com>"
						}
					}]
				}]
			}
		}
		`

		testCases := []testCase{
			{
				desc:      "un-authenticated request should fail",
				url:       "http://%s/api/alertmanager/grafana/config/api/v1/alerts",
				expStatus: http.StatusUnauthorized,
				expBody:   `"message":"Unauthorized"`,
			},
			{
				desc:      "viewer request should fail",
				url:       "http://viewer:viewer@%s/api/alertmanager/grafana/config/api/v1/alerts",
				expStatus: http.StatusForbidden,
				expBody:   `"title":"Access denied"`,
			},
			{
				desc:      "editor request should succeed",
				url:       "http://editor:editor@%s/api/alertmanager/grafana/config/api/v1/alerts",
				expStatus: http.StatusAccepted,
				expBody:   `{"message":"configuration created"}`,
			},
			{
				desc:      "admin request should succeed",
				url:       "http://admin:admin@%s/api/alertmanager/grafana/config/api/v1/alerts",
				expStatus: http.StatusAccepted,
				expBody:   `{"message":"configuration created"}`,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				url := fmt.Sprintf(tc.url, grafanaListedAddr)
				buf := bytes.NewReader([]byte(body))
				// nolint:gosec
				resp, err := http.Post(url, "application/json", buf)
				t.Cleanup(func() {
					require.NoError(t, resp.Body.Close())
				})
				require.NoError(t, err)
				require.Equal(t, tc.expStatus, resp.StatusCode)
				b, err := io.ReadAll(resp.Body)
				require.NoError(t, err)
				require.Contains(t, string(b), tc.expBody)
			})
		}
	})

	t.Run("when retrieve alertmanager configuration", func(t *testing.T) {
		cfgTemplate := `
		{
			"template_files": null,
			"alertmanager_config": {
				"route": %s,
				"receivers": [{
					"name": "grafana-default-email",
					"grafana_managed_receiver_configs": [{
						"disableResolveMessage": false,
						"uid": "",
						"name": "email receiver",
						"type": "email",
						"secureFields": {},
						"settings": {
							"addresses": "<example@email.com>"
						}
					}]
				}]
			}
		}
		`
		cfgWithoutAutogen := fmt.Sprintf(cfgTemplate, `{
			"receiver": "grafana-default-email"
		}`)
		cfgWithAutogen := fmt.Sprintf(cfgTemplate, `{
					"receiver": "grafana-default-email",
					"routes": [{
						"receiver": "grafana-default-email",
						"object_matchers": [["__grafana_autogenerated__", "=", "true"]],
						"routes": [{
							"receiver": "grafana-default-email",
							"group_by": ["grafana_folder", "alertname"],
							"object_matchers": [["__grafana_receiver__", "=", "grafana-default-email"]]
						}]
					}]
				}`)

		testCases := []testCase{
			{
				desc:      "un-authenticated request should fail",
				url:       "http://%s/api/alertmanager/grafana/config/api/v1/alerts",
				expStatus: http.StatusUnauthorized,
				expBody:   `{"extra":null,"message":"Unauthorized","messageId":"auth.unauthorized","statusCode":401,"traceID":""}`,
			},
			{
				desc:      "viewer request should succeed",
				url:       "http://viewer:viewer@%s/api/alertmanager/grafana/config/api/v1/alerts",
				expStatus: http.StatusOK,
				expBody:   cfgWithoutAutogen,
			},
			{
				desc:      "editor request should succeed",
				url:       "http://editor:editor@%s/api/alertmanager/grafana/config/api/v1/alerts",
				expStatus: http.StatusOK,
				expBody:   cfgWithoutAutogen,
			},
			{
				desc:      "admin request should succeed",
				url:       "http://admin:admin@%s/api/alertmanager/grafana/config/api/v1/alerts",
				expStatus: http.StatusOK,
				expBody:   cfgWithAutogen,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				resp, err := http.Get(fmt.Sprintf(tc.url, grafanaListedAddr))
				t.Cleanup(func() {
					require.NoError(t, resp.Body.Close())
				})
				require.NoError(t, err)
				require.Equal(t, tc.expStatus, resp.StatusCode)
				b, err := io.ReadAll(resp.Body)
				if tc.expStatus == http.StatusOK {
					re := regexp.MustCompile(`"uid":"([\w|-]+)"`)
					b = re.ReplaceAll(b, []byte(`"uid":""`))
				}
				require.NoError(t, err)
				require.JSONEq(t, tc.expBody, string(b))
			})
		}
	})

	t.Run("when creating silence", func(t *testing.T) {
		now := time.Now()
		body := fmt.Sprintf(`
		{
			"comment": "string",
			"createdBy": "string",
			"matchers": [
			  {
				"isRegex": true,
				"name": "string",
				"value": "string"
			  }
			],
			"startsAt": "%s",
			"endsAt": "%s"
		  }
		`, now.Format(time.RFC3339), now.Add(10*time.Second).Format(time.RFC3339))

		testCases := []testCase{
			{
				desc:      "un-authenticated request should fail",
				url:       "http://%s/api/alertmanager/grafana/config/api/v2/silences",
				expStatus: http.StatusUnauthorized,
				expBody:   `"message":"Unauthorized"`,
			},
			{
				desc:      "viewer request should fail",
				url:       "http://viewer:viewer@%s/api/alertmanager/grafana/api/v2/silences",
				expStatus: http.StatusForbidden,
				expBody:   `"title":"Access denied"`,
			},
			{
				desc:      "editor request should succeed",
				url:       "http://editor:editor@%s/api/alertmanager/grafana/api/v2/silences",
				expStatus: http.StatusAccepted,
			},
			{
				desc:      "admin request should succeed",
				url:       "http://admin:admin@%s/api/alertmanager/grafana/api/v2/silences",
				expStatus: http.StatusAccepted,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				url := fmt.Sprintf(tc.url, grafanaListedAddr)
				buf := bytes.NewReader([]byte(body))
				// nolint:gosec
				resp, err := http.Post(url, "application/json", buf)
				t.Cleanup(func() {
					require.NoError(t, resp.Body.Close())
				})
				require.NoError(t, err)
				require.Equal(t, tc.expStatus, resp.StatusCode)
				b, err := io.ReadAll(resp.Body)
				require.NoError(t, err)
				if tc.expStatus == http.StatusAccepted {
					response := apimodels.PostSilencesOKBody{}
					require.NoError(t, json.Unmarshal(b, &response))
					require.NotEmpty(t, response.SilenceID)
					return
				}
				require.Contains(t, string(b), tc.expBody)
			})
		}
	})

	var blob []byte
	t.Run("when getting silences", func(t *testing.T) {
		testCases := []testCase{
			{
				desc:      "un-authenticated request should fail",
				url:       "http://%s/api/alertmanager/grafana/api/v2/silences",
				expStatus: http.StatusUnauthorized,
				expBody:   `"message": "Unauthorized"`,
			},
			{
				desc:      "viewer request should succeed",
				url:       "http://viewer:viewer@%s/api/alertmanager/grafana/api/v2/silences",
				expStatus: http.StatusOK,
			},
			{
				desc:      "editor request should succeed",
				url:       "http://editor:editor@%s/api/alertmanager/grafana/api/v2/silences",
				expStatus: http.StatusOK,
			},
			{
				desc:      "admin request should succeed",
				url:       "http://admin:admin@%s/api/alertmanager/grafana/api/v2/silences",
				expStatus: http.StatusOK,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				url := fmt.Sprintf(tc.url, grafanaListedAddr)
				// nolint:gosec
				resp, err := http.Get(url)
				t.Cleanup(func() {
					require.NoError(t, resp.Body.Close())
				})
				require.NoError(t, err)
				require.Equal(t, tc.expStatus, resp.StatusCode)
				require.NoError(t, err)
				if tc.expStatus == http.StatusOK {
					b, err := io.ReadAll(resp.Body)
					require.NoError(t, err)
					blob = b
				}
			})
		}
	})

	var silences apimodels.GettableSilences
	err := json.Unmarshal(blob, &silences)
	require.NoError(t, err)
	assert.Len(t, silences, 2)
	silenceIDs := make([]string, 0, len(silences))
	for _, s := range silences {
		silenceIDs = append(silenceIDs, *s.ID)
	}

	unconsumedSilenceIdx := 0
	t.Run("when deleting a silence", func(t *testing.T) {
		testCases := []testCase{
			{
				desc:      "un-authenticated request should fail",
				url:       "http://%s/api/alertmanager/grafana/api/v2/silence/%s",
				expStatus: http.StatusUnauthorized,
				expBody:   `"message":"Unauthorized"`,
			},
			{
				desc:      "viewer request should fail",
				url:       "http://viewer:viewer@%s/api/alertmanager/grafana/api/v2/silence/%s",
				expStatus: http.StatusForbidden,
				expBody:   `"title":"Access denied"`,
			},
			{
				desc:      "editor request should succeed",
				url:       "http://editor:editor@%s/api/alertmanager/grafana/api/v2/silence/%s",
				expStatus: http.StatusOK,
				expBody:   `{"message":"silence deleted"}`,
			},
			{
				desc:      "admin request should succeed",
				url:       "http://admin:admin@%s/api/alertmanager/grafana/api/v2/silence/%s",
				expStatus: http.StatusOK,
				expBody:   `{"message":"silence deleted"}`,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				url := fmt.Sprintf(tc.url, grafanaListedAddr, silenceIDs[unconsumedSilenceIdx])

				// Create client
				client := &http.Client{}

				// Create request
				req, err := http.NewRequest("DELETE", url, nil)
				if err != nil {
					fmt.Println(err)
					return
				}

				// Fetch Request
				resp, err := client.Do(req)
				if err != nil {
					return
				}
				t.Cleanup(func() {
					require.NoError(t, resp.Body.Close())
				})
				require.NoError(t, err)
				require.Equal(t, tc.expStatus, resp.StatusCode)
				b, err := io.ReadAll(resp.Body)
				require.NoError(t, err)
				if tc.expStatus == http.StatusOK {
					unconsumedSilenceIdx++
				}
				require.Contains(t, string(b), tc.expBody)
			})
		}
	})
}

func TestIntegrationAlertAndGroupsQuery(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	// unauthenticated request to get the alerts should fail
	{
		alertsURL := fmt.Sprintf("http://%s/api/alertmanager/grafana/api/v2/alerts", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(alertsURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		require.Contains(t, string(b), `"message":"Unauthorized"`)
	}

	// Create a user to make authenticated requests
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")

	// invalid credentials request to get the alerts should fail
	{
		alertsURL := fmt.Sprintf("http://grafana:invalid@%s/api/alertmanager/grafana/api/v2/alerts", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(alertsURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)

		var res map[string]any
		require.NoError(t, json.Unmarshal(b, &res))
		assert.Equal(t, "Invalid username or password", res["message"])
	}

	// When there are no alerts available, it returns an empty list.
	{
		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/alertmanager/grafana/api/v2/alerts", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(alertsURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)
		require.JSONEq(t, "[]", string(b))
	}

	// When are there no alerts available, it returns an empty list of groups.
	{
		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/alertmanager/grafana/api/v2/alerts/groups", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(alertsURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)
		require.JSONEq(t, "[]", string(b))
	}

	// Now, let's test the endpoint with some alerts.
	{
		// Create the namespace we'll save our alerts to.
		apiClient.CreateFolder(t, "default", "default")
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
			},
		}

		_, status, _ := apiClient.PostRulesGroupWithStatus(t, "default", &rules)
		assert.Equal(t, http.StatusAccepted, status)
	}

	// Eventually, we'll get an alert with its state being active.
	{
		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/alertmanager/grafana/api/v2/alerts", grafanaListedAddr)
		// nolint:gosec
		require.Eventually(t, func() bool {
			resp, err := http.Get(alertsURL)
			require.NoError(t, err)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
			b, err := io.ReadAll(resp.Body)
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

func TestIntegrationRulerAccess(t *testing.T) {
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

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	// Create a users to make authenticated requests
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleViewer),
		Password:       "viewer",
		Login:          "viewer",
	})
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "editor",
		Login:          "editor",
	})
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	client := newAlertingApiClient(grafanaListedAddr, "editor", "editor")

	// Create the namespace we'll save our alerts to.
	client.CreateFolder(t, "default", "default")

	// Now, let's test the access policies.
	testCases := []struct {
		desc            string
		client          apiClient
		expStatus       int
		expectedMessage string
	}{
		{
			desc:            "un-authenticated request should fail",
			client:          newAlertingApiClient(grafanaListedAddr, "", ""),
			expStatus:       http.StatusUnauthorized,
			expectedMessage: `Unauthorized`,
		},
		{
			desc:            "viewer request should fail",
			client:          newAlertingApiClient(grafanaListedAddr, "viewer", "viewer"),
			expStatus:       http.StatusForbidden,
			expectedMessage: `You'll need additional permissions to perform this action. Permissions needed: all of alert.rules:read, folders:read, any of alert.rules:write, alert.rules:create, alert.rules:delete`,
		},
		{
			desc:            "editor request should succeed",
			client:          newAlertingApiClient(grafanaListedAddr, "editor", "editor"),
			expStatus:       http.StatusAccepted,
			expectedMessage: `rule group updated successfully`,
		},
		{
			desc:            "admin request should succeed",
			client:          newAlertingApiClient(grafanaListedAddr, "admin", "admin"),
			expStatus:       http.StatusAccepted,
			expectedMessage: `rule group updated successfully`,
		},
	}

	for i, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			interval, err := model.ParseDuration("1m")
			require.NoError(t, err)

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
							Title:     fmt.Sprintf("AlwaysFiring %d", i),
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
				},
			}
			_, status, body := tc.client.PostRulesGroupWithStatus(t, "default", &rules)
			assert.Equal(t, tc.expStatus, status)
			res := &Response{}
			err = json.Unmarshal([]byte(body), &res)
			require.NoError(t, err)
			require.Equal(t, tc.expectedMessage, res.Message)
		})
	}
}

func TestIntegrationDeleteFolderWithRules(t *testing.T) {
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

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleViewer),
		Password:       "viewer",
		Login:          "viewer",
	})
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "editor",
		Login:          "editor",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "editor", "editor")

	// Create the namespace we'll save our alerts to.
	namespaceUID := "default" //nolint:goconst
	apiClient.CreateFolder(t, namespaceUID, namespaceUID)

	createRule(t, apiClient, "default")

	// First, let's have an editor create a rule within the folder/namespace.
	{
		u := fmt.Sprintf("http://editor:editor@%s/api/ruler/grafana/api/v1/rules", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(u)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, 200, resp.StatusCode)

		re := regexp.MustCompile(`"uid":"([\w|-]+)"`)
		b = re.ReplaceAll(b, []byte(`"uid":""`))
		re = regexp.MustCompile(`"updated":"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)"`)
		b = re.ReplaceAll(b, []byte(`"updated":"2021-05-19T19:47:55Z"`))

		expectedGetRulesResponseBody := fmt.Sprintf(`{
			"default": [
				{
					"name": "arulegroup",
					"interval": "1m",
					"rules": [
						{
							"expr": "",
							"for": "2m",
							"labels": {
								"label1": "val1"
							},
							"annotations": {
								"annotation1": "val1"
							},
							"grafana_alert": {
								"id": 1,
								"orgId": 1,
								"title": "rule under folder default",
								"condition": "A",
								"data": [
									{
										"refId": "A",
										"queryType": "",
										"relativeTimeRange": {
											"from": 18000,
											"to": 10800
										},
										"datasourceUid": "__expr__",
										"model": {
											"expression": "2 + 3 > 1",
											"intervalMs": 1000,
											"maxDataPoints": 43200,
											"type": "math"
										}
									}
								],
								"updated": "2021-05-19T19:47:55Z",
								"intervalSeconds": 60,
								"is_paused": false,
								"version": 1,
								"uid": "",
								"namespace_uid": %q,
								"rule_group": "arulegroup",
								"no_data_state": "NoData",
								"exec_err_state": "Alerting",
								"metadata": {
									"editor_settings": {
										"simplified_query_and_expressions_section": false,
										"simplified_notifications_section": false
									}
								}
							}
						}
					]
				}
			]
		}`, namespaceUID)
		assert.JSONEq(t, expectedGetRulesResponseBody, string(b))
	}

	// Next, the editor can not delete the folder because it contains Grafana 8 alerts.
	{
		u := fmt.Sprintf("http://editor:editor@%s/api/folders/%s", grafanaListedAddr, namespaceUID)
		req, err := http.NewRequest(http.MethodDelete, u, nil)
		require.NoError(t, err)
		client := &http.Client{}
		resp, err := client.Do(req)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
		var errutilErr errutil.PublicError
		err = json.Unmarshal(b, &errutilErr)
		require.NoError(t, err)
		assert.Equal(t, "Folder cannot be deleted: folder is not empty", errutilErr.Message)
	}

	// Next, the editor can delete the folder if forceDeleteRules is true.
	{
		u := fmt.Sprintf("http://editor:editor@%s/api/folders/%s?forceDeleteRules=true", grafanaListedAddr, namespaceUID)
		req, err := http.NewRequest(http.MethodDelete, u, nil)
		require.NoError(t, err)
		client := &http.Client{}
		resp, err := client.Do(req)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		_, err = io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)
	}

	// Finally, we ensure the rules were deleted.
	{
		u := fmt.Sprintf("http://editor:editor@%s/api/ruler/grafana/api/v1/rules", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(u)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, 200, resp.StatusCode)
		assert.JSONEq(t, "{}", string(b))
	}
}

func TestIntegrationAlertRuleCRUD(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		EnableQuota:           true,
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

	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "default", "default")

	interval, err := model.ParseDuration("1m")
	require.NoError(t, err)

	invalidInterval, err := model.ParseDuration("1s")
	require.NoError(t, err)

	// Now, let's try to create some invalid alert rules.
	{
		testCases := []struct {
			desc            string
			rulegroup       string
			interval        model.Duration
			rule            apimodels.PostableExtendedRuleNode
			expectedCode    int
			expectedMessage string
		}{
			{
				desc:      "alert rule without queries and expressions",
				rulegroup: "arulegroup",
				rule: apimodels.PostableExtendedRuleNode{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:         &interval,
						Labels:      map[string]string{"label1": "val1"},
						Annotations: map[string]string{"annotation1": "val1"},
					},
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     "AlwaysFiring",
						Condition: "A",
						Data:      []apimodels.AlertQuery{},
					},
				},
				expectedMessage: "invalid rule specification at index [0]: invalid alert rule: no queries or expressions are found",
			},
			{
				desc:      "alert rule with empty title",
				rulegroup: "arulegroup",
				rule: apimodels.PostableExtendedRuleNode{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:         &interval,
						Labels:      map[string]string{"label1": "val1"},
						Annotations: map[string]string{"annotation1": "val1"},
					},
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     "",
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
				expectedMessage: "invalid rule specification at index [0]: alert rule title cannot be empty",
			},
			{
				desc:      "alert rule with too long name",
				rulegroup: "arulegroup",
				rule: apimodels.PostableExtendedRuleNode{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:         &interval,
						Labels:      map[string]string{"label1": "val1"},
						Annotations: map[string]string{"annotation1": "val1"},
					},
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     getLongString(t, ngstore.AlertRuleMaxTitleLength+1),
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
				expectedMessage: "invalid rule specification at index [0]: alert rule title is too long. Max length is 190",
			},
			{
				desc:      "alert rule with too long rulegroup",
				rulegroup: getLongString(t, ngstore.AlertRuleMaxTitleLength+1),
				rule: apimodels.PostableExtendedRuleNode{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:         &interval,
						Labels:      map[string]string{"label1": "val1"},
						Annotations: map[string]string{"annotation1": "val1"},
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
				expectedMessage: "rule group name is too long. Max length is 190",
			},
			{
				desc:      "alert rule with invalid interval",
				rulegroup: "arulegroup",
				interval:  invalidInterval,
				rule: apimodels.PostableExtendedRuleNode{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:         &interval,
						Labels:      map[string]string{"label1": "val1"},
						Annotations: map[string]string{"annotation1": "val1"},
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
				expectedMessage: "rule evaluation interval (1 second) should be positive number that is multiple of the base interval of 10 seconds",
			},
			{
				desc:      "alert rule with unknown datasource",
				rulegroup: "arulegroup",
				rule: apimodels.PostableExtendedRuleNode{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:         &interval,
						Labels:      map[string]string{"label1": "val1"},
						Annotations: map[string]string{"annotation1": "val1"},
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
								DatasourceUID: "unknown",
								Model: json.RawMessage(`{
									"type": "math",
									"expression": "2 + 3 > 1"
									}`),
							},
						},
					},
				},
				expectedCode: func() int {
					if setting.IsEnterprise {
						return http.StatusForbidden
					}
					return http.StatusBadRequest
				}(),
				expectedMessage: func() string {
					if setting.IsEnterprise {
						return "user is not authorized to create a new alert rule 'AlwaysFiring'"
					}
					return "failed to update rule group: invalid alert rule 'AlwaysFiring': failed to build query 'A': data source not found"
				}(),
			},
			{
				desc:      "alert rule with invalid condition",
				rulegroup: "arulegroup",
				rule: apimodels.PostableExtendedRuleNode{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For:         &interval,
						Labels:      map[string]string{"label1": "val1"},
						Annotations: map[string]string{"annotation1": "val1"},
					},
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     "AlwaysFiring",
						Condition: "B",
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
				expectedMessage: "invalid rule specification at index [0]: invalid alert rule: condition B does not exist, must be one of [A]",
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
				_, status, body := apiClient.PostRulesGroupWithStatus(t, "default", &rules)
				res := &Response{}
				err = json.Unmarshal([]byte(body), &res)
				require.NoError(t, err)

				assert.Equal(t, tc.expectedMessage, res.Message)
				expectedCode := tc.expectedCode
				if expectedCode == 0 {
					expectedCode = http.StatusBadRequest
				}
				assert.Equal(t, expectedCode, status)
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
		resp, status, _ := apiClient.PostRulesGroupWithStatus(t, "default", &rules)
		assert.Equal(t, http.StatusAccepted, status)
		require.Equal(t, "rule group updated successfully", resp.Message)
		assert.Len(t, resp.Created, 2)
		assert.Empty(t, resp.Updated)
		assert.Empty(t, resp.Deleted)
	}

	// With the rules created, let's make sure that rule definition is stored correctly.
	{
		u := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(u)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
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
						  "orgId":1,
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
								"datasourceUid":"__expr__",
								"model":{
								   "expression":"2 + 3 \u003e 1",
								   "intervalMs":1000,
								   "maxDataPoints":43200,
								   "type":"math"
								}
							 }
						  ],
						  "updated":"2021-02-21T01:10:30Z",
						  "intervalSeconds":60,
						  "is_paused": false,
						  "version":1,
						  "uid":"uid",
						  "namespace_uid":"nsuid",
						  "rule_group":"arulegroup",
						  "no_data_state":"NoData",
						  "exec_err_state":"Alerting",
						  "metadata": {
						      "editor_settings": {
							      "simplified_query_and_expressions_section": false,
								  "simplified_notifications_section": false
							  }
						  }
					   }
					},
					{
					   "expr":"",
					   "for": "0s",
					   "grafana_alert":{
						  "id":2,
						  "orgId":1,
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
								"datasourceUid":"__expr__",
								"model":{
								   "expression":"2 + 3 \u003e 1",
								   "intervalMs":1000,
								   "maxDataPoints":43200,
								   "type":"math"
								}
							 }
						  ],
						  "updated":"2021-02-21T01:10:30Z",
						  "intervalSeconds":60,
						  "is_paused": false,
						  "version":1,
						  "uid":"uid",
						  "namespace_uid":"nsuid",
						  "rule_group":"arulegroup",
						  "no_data_state":"Alerting",
						  "exec_err_state":"Alerting",
						  "metadata": {
						      "editor_settings": {
							      "simplified_query_and_expressions_section": false,
								  "simplified_notifications_section": false
							  }
						  }
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
						For: &interval,
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
											"expression": "2 + 3 < 1"
											}`),
							},
						},
						NoDataState:  apimodels.NoDataState(ngmodels.Alerting),
						ExecErrState: apimodels.ExecutionErrorState(ngmodels.AlertingErrState),
					},
				},
			},
			Interval: interval,
		}

		_, status, body := apiClient.PostRulesGroupWithStatus(t, "default", &rules)
		assert.Equal(t, http.StatusNotFound, status)
		var res map[string]any
		assert.NoError(t, json.Unmarshal([]byte(body), &res))
		require.Equal(t, "failed to update rule group: failed to update rule with UID unknown because could not find alert rule", res["message"])

		// let's make sure that rule definitions are not affected by the failed POST request.
		u := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(u)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, resp.StatusCode, 202)

		body, m := rulesNamespaceWithoutVariableValues(t, b)
		returnedUIDs, ok := m["default,arulegroup"]
		assert.True(t, ok)
		assert.Equal(t, 2, len(returnedUIDs))
		assert.JSONEq(t, expectedGetNamespaceResponseBody, body)
	}

	// try to update by pass two rules with conflicting UIDs
	{
		interval, err := model.ParseDuration("30s")
		require.NoError(t, err)

		rules := apimodels.PostableRuleGroupConfig{
			Name: "arulegroup",
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For: &interval,
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
						UID:       ruleUID,
						Title:     "AlwaysNormal",
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
												"expression": "2 + 3 < 1"
												}`),
							},
						},
						NoDataState:  apimodels.NoDataState(ngmodels.Alerting),
						ExecErrState: apimodels.ExecutionErrorState(ngmodels.AlertingErrState),
					},
				},
				{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For: &interval,
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
						UID:       ruleUID,
						Title:     "AlwaysAlerting",
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
			Interval: interval,
		}
		_, status, body := apiClient.PostRulesGroupWithStatus(t, "default", &rules)
		assert.Equal(t, http.StatusBadRequest, status)
		var res map[string]any
		require.NoError(t, json.Unmarshal([]byte(body), &res))
		require.Equal(t, fmt.Sprintf("rule [1] has UID %s that is already assigned to another rule at index 0", ruleUID), res["message"])

		// let's make sure that rule definitions are not affected by the failed POST request.
		u := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(u)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
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
		forValue, err := model.ParseDuration("30s")
		require.NoError(t, err)

		rules := apimodels.PostableRuleGroupConfig{
			Name: "arulegroup",
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For: &forValue,
						Labels: map[string]string{
							// delete foo label
							"label1": "val1", // update label value
							"label2": "val2", // new label
						},
						Annotations: map[string]string{
							// delete foo annotation
							"annotation1": "val1", // update annotation value
							"annotation2": "val2", // new annotation
						},
					},
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						UID:       ruleUID, // Including the UID in the payload makes the endpoint update the existing rule.
						Title:     "AlwaysNormal",
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
											"expression": "2 + 3 < 1"
											}`),
							},
						},
						NoDataState:  apimodels.NoDataState(ngmodels.Alerting),
						ExecErrState: apimodels.ExecutionErrorState(ngmodels.AlertingErrState),
					},
				},
			},
			Interval: interval,
		}
		respModel, status, _ := apiClient.PostRulesGroupWithStatus(t, "default", &rules)
		assert.Equal(t, http.StatusAccepted, status)
		require.Equal(t, respModel.Updated, []string{ruleUID})
		require.Len(t, respModel.Deleted, 1)

		// let's make sure that rule definitions are updated correctly.
		u := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(u)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
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
							"annotation1": "val1",
							"annotation2": "val2"
					   },
		               "expr":"",
					   "for": "30s",
					   "labels": {
							"label1": "val1",
							"label2": "val2"
					   },
		               "grafana_alert":{
		                  "id":1,
		                  "orgId":1,
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
		                        "datasourceUid":"__expr__",
								"model":{
		                           "expression":"2 + 3 \u003C 1",
		                           "intervalMs":1000,
		                           "maxDataPoints":43200,
		                           "type":"math"
		                        }
		                     }
		                  ],
		                  "updated":"2021-02-21T01:10:30Z",
		                  "intervalSeconds":60,
		                  "is_paused": false,
		                  "version":2,
		                  "uid":"uid",
		                  "namespace_uid":"nsuid",
		                  "rule_group":"arulegroup",
		                  "no_data_state":"Alerting",
		                  "exec_err_state":"Alerting",
						  "metadata": {
						      "editor_settings": {
							      "simplified_query_and_expressions_section": false,
								  "simplified_notifications_section": false
							  }
						  }
		               }
		            }
		         ]
		      }
		   ]
		}`, body)
	}

	// update the rule; delete labels and annotations
	{
		forValue, err := model.ParseDuration("30s")
		require.NoError(t, err)

		rules := apimodels.PostableRuleGroupConfig{
			Name: "arulegroup",
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					ApiRuleNode: &apimodels.ApiRuleNode{
						For: &forValue,
					},
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						UID:       ruleUID, // Including the UID in the payload makes the endpoint update the existing rule.
						Title:     "AlwaysNormal",
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
												"expression": "2 + 3 < 1"
												}`),
							},
						},
						NoDataState:  apimodels.NoDataState(ngmodels.Alerting),
						ExecErrState: apimodels.ExecutionErrorState(ngmodels.AlertingErrState),
					},
				},
			},
			Interval: interval,
		}
		respModel, status, _ := apiClient.PostRulesGroupWithStatus(t, "default", &rules)
		assert.Equal(t, http.StatusAccepted, status)
		require.Equal(t, respModel.Updated, []string{ruleUID})

		// let's make sure that rule definitions are updated correctly.
		u := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(u)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
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
				       "expr":"",
				       "for": "30s",
				       "grafana_alert":{
					  "id":1,
					  "orgId":1,
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
						"datasourceUid":"__expr__",
									"model":{
						   "expression":"2 + 3 \u003C 1",
						   "intervalMs":1000,
						   "maxDataPoints":43200,
						   "type":"math"
						}
					     }
					  ],
					  "updated":"2021-02-21T01:10:30Z",
					  "intervalSeconds":60,
					  "is_paused":false,
					  "version":3,
					  "uid":"uid",
					  "namespace_uid":"nsuid",
					  "rule_group":"arulegroup",
					  "no_data_state":"Alerting",
					  "exec_err_state":"Alerting",
					  "metadata": {
				        "editor_settings": {
					      "simplified_query_and_expressions_section": false,
						  "simplified_notifications_section": false
					    }
					   }
				      }
				    }
				 ]
			      }
			   ]
			}`, body)
	}

	// update the rule; keep title, condition, no data state, error state, queries and expressions if not provided. should be noop
	{
		rules := apimodels.PostableRuleGroupConfig{
			Name: "arulegroup",
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						UID: ruleUID, // Including the UID in the payload makes the endpoint update the existing rule.
					},
				},
			},
			Interval: interval,
		}
		respModel, status, _ := apiClient.PostRulesGroupWithStatus(t, "default", &rules)
		assert.Equal(t, http.StatusAccepted, status)
		require.Equal(t, "no changes detected in the rule group", respModel.Message)
		assert.Empty(t, respModel.Created)
		assert.Empty(t, respModel.Updated)
		assert.Empty(t, respModel.Deleted)

		// let's make sure that rule definitions are updated correctly.
		u := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(u)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
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
				       "expr":"",
                       "for": "30s",
				       "grafana_alert":{
					  "id":1,
					  "orgId":1,
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
						"datasourceUid":"__expr__",
									"model":{
						   "expression":"2 + 3 \u003C 1",
						   "intervalMs":1000,
						   "maxDataPoints":43200,
						   "type":"math"
						}
					     }
					  ],
					  "updated":"2021-02-21T01:10:30Z",
					  "intervalSeconds":60,
					  "is_paused":false,
					  "version":3,
					  "uid":"uid",
					  "namespace_uid":"nsuid",
					  "rule_group":"arulegroup",
					  "no_data_state":"Alerting",
					  "exec_err_state":"Alerting",
					  "metadata": {
				        "editor_settings": {
					      "simplified_query_and_expressions_section": false,
						  "simplified_notifications_section": false
					    }
					   }
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
		t.Run("succeed if the rule group name does not exists", func(t *testing.T) {
			u := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules/default/groupnotexist", grafanaListedAddr)
			req, err := http.NewRequest(http.MethodDelete, u, nil)
			require.NoError(t, err)
			resp, err := client.Do(req)
			require.NoError(t, err)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
			b, err := io.ReadAll(resp.Body)
			require.NoError(t, err)

			require.Equal(t, http.StatusAccepted, resp.StatusCode)
			var res map[string]any
			require.NoError(t, json.Unmarshal(b, &res))
			require.Equal(t, "rules deleted", res["message"])
		})

		t.Run("succeed if the rule group name does exist", func(t *testing.T) {
			u := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules/default/arulegroup", grafanaListedAddr)
			req, err := http.NewRequest(http.MethodDelete, u, nil)
			require.NoError(t, err)
			resp, err := client.Do(req)
			require.NoError(t, err)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
			b, err := io.ReadAll(resp.Body)
			require.NoError(t, err)

			require.Equal(t, http.StatusAccepted, resp.StatusCode)
			require.JSONEq(t, `{"message":"rules deleted"}`, string(b))
		})
	}
}

func TestIntegrationAlertmanagerCreateSilence(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		AppModeProduction:     true,
	})
	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})
	client := newAlertingApiClient(grafanaListedAddr, "admin", "admin")

	cases := []struct {
		name    string
		silence apimodels.PostableSilence
		expErr  string
	}{{
		name: "can create silence for foo=bar",
		silence: apimodels.PostableSilence{
			Silence: amv2.Silence{
				Comment:   util.Pointer("This is a comment"),
				CreatedBy: util.Pointer("test"),
				EndsAt:    util.Pointer(strfmt.DateTime(time.Now().Add(time.Minute))),
				Matchers: amv2.Matchers{{
					IsEqual: util.Pointer(true),
					IsRegex: util.Pointer(false),
					Name:    util.Pointer("foo"),
					Value:   util.Pointer("bar"),
				}},
				StartsAt: util.Pointer(strfmt.DateTime(time.Now())),
			},
		},
	}, {
		name: "can create silence for _foo1=bar",
		silence: apimodels.PostableSilence{
			Silence: amv2.Silence{
				Comment:   util.Pointer("This is a comment"),
				CreatedBy: util.Pointer("test"),
				EndsAt:    util.Pointer(strfmt.DateTime(time.Now().Add(time.Minute))),
				Matchers: amv2.Matchers{{
					IsEqual: util.Pointer(true),
					IsRegex: util.Pointer(false),
					Name:    util.Pointer("_foo1"),
					Value:   util.Pointer("bar"),
				}},
				StartsAt: util.Pointer(strfmt.DateTime(time.Now())),
			},
		},
	}, {
		name: "can create silence for 0foo=bar",
		silence: apimodels.PostableSilence{
			Silence: amv2.Silence{
				Comment:   util.Pointer("This is a comment"),
				CreatedBy: util.Pointer("test"),
				EndsAt:    util.Pointer(strfmt.DateTime(time.Now().Add(time.Minute))),
				Matchers: amv2.Matchers{{
					IsEqual: util.Pointer(true),
					IsRegex: util.Pointer(false),
					Name:    util.Pointer("0foo"),
					Value:   util.Pointer("bar"),
				}},
				StartsAt: util.Pointer(strfmt.DateTime(time.Now())),
			},
		},
	}, {
		name: "can create silence for foo=🙂bar",
		silence: apimodels.PostableSilence{
			Silence: amv2.Silence{
				Comment:   util.Pointer("This is a comment"),
				CreatedBy: util.Pointer("test"),
				EndsAt:    util.Pointer(strfmt.DateTime(time.Now().Add(time.Minute))),
				Matchers: amv2.Matchers{{
					IsEqual: util.Pointer(true),
					IsRegex: util.Pointer(false),
					Name:    util.Pointer("foo"),
					Value:   util.Pointer("🙂bar"),
				}},
				StartsAt: util.Pointer(strfmt.DateTime(time.Now())),
			},
		},
	}, {
		name: "can create silence for foo🙂=bar",
		silence: apimodels.PostableSilence{
			Silence: amv2.Silence{
				Comment:   util.Pointer("This is a comment"),
				CreatedBy: util.Pointer("test"),
				EndsAt:    util.Pointer(strfmt.DateTime(time.Now().Add(time.Minute))),
				Matchers: amv2.Matchers{{
					IsEqual: util.Pointer(true),
					IsRegex: util.Pointer(false),
					Name:    util.Pointer("foo🙂"),
					Value:   util.Pointer("bar"),
				}},
				StartsAt: util.Pointer(strfmt.DateTime(time.Now())),
			},
		},
	}, {
		name: "can't create silence for missing label name",
		silence: apimodels.PostableSilence{
			Silence: amv2.Silence{
				Comment:   util.Pointer("This is a comment"),
				CreatedBy: util.Pointer("test"),
				EndsAt:    util.Pointer(strfmt.DateTime(time.Now().Add(time.Minute))),
				Matchers: amv2.Matchers{{
					IsEqual: util.Pointer(true),
					IsRegex: util.Pointer(false),
					Name:    util.Pointer(""),
					Value:   util.Pointer("bar"),
				}},
				StartsAt: util.Pointer(strfmt.DateTime(time.Now())),
			},
		},
		expErr: "unable to upsert silence: invalid silence: invalid label matcher 0: invalid label name \"\": unable to create silence",
	}, {
		name: "can't create silence for missing label value",
		silence: apimodels.PostableSilence{
			Silence: amv2.Silence{
				Comment:   util.Pointer("This is a comment"),
				CreatedBy: util.Pointer("test"),
				EndsAt:    util.Pointer(strfmt.DateTime(time.Now().Add(time.Minute))),
				Matchers: amv2.Matchers{{
					IsEqual: util.Pointer(true),
					IsRegex: util.Pointer(false),
					Name:    util.Pointer("foo"),
					Value:   util.Pointer(""),
				}},
				StartsAt: util.Pointer(strfmt.DateTime(time.Now())),
			},
		},
		expErr: "unable to upsert silence: invalid silence: at least one matcher must not match the empty string: unable to create silence",
	}}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			silenceOkBody, status, body := client.PostSilence(t, tc.silence)
			t.Log(body)
			if tc.expErr != "" {
				assert.NotEqual(t, http.StatusAccepted, status)

				var validationError errutil.PublicError
				assert.NoError(t, json.Unmarshal([]byte(body), &validationError))
				assert.Contains(t, validationError.Message, tc.expErr)
				assert.Empty(t, silenceOkBody.SilenceID)
			} else {
				assert.Equal(t, http.StatusAccepted, status)
				assert.NotEmpty(t, silenceOkBody.SilenceID)
			}
		})
	}
}

func TestIntegrationAlertmanagerStatus(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	// Create a users to make authenticated requests
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleViewer),
		Password:       "viewer",
		Login:          "viewer",
	})
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "editor",
		Login:          "editor",
	})
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	type testCase struct {
		desc      string
		url       string
		expStatus int
		expBody   string
	}

	cfgTemplate := `
{
	"cluster": {
		"peers": [],
		"status": "disabled"
	},
	"config": {
		"route": %s,
		"receivers": [{
			"name": "grafana-default-email",
			"grafana_managed_receiver_configs": [{
				"uid": "",
				"name": "email receiver",
				"type": "email",
				"disableResolveMessage": false,
				"settings": {
					"addresses": "\u003cexample@email.com\u003e"
				}
			}]
		}]
	},
	"uptime": null,
	"versionInfo": {
		"branch": "N/A",
		"buildDate": "N/A",
		"buildUser": "N/A",
		"goVersion": "N/A",
		"revision": "N/A",
		"version": "N/A"
	}
}
`
	cfgWithoutAutogen := fmt.Sprintf(cfgTemplate, `{
			"receiver": "grafana-default-email",
			"group_by": ["grafana_folder", "alertname"]
		}`)
	cfgWithAutogen := fmt.Sprintf(cfgTemplate, `{
					"receiver": "grafana-default-email",
					"routes": [{
						"receiver": "grafana-default-email",
						"object_matchers": [["__grafana_autogenerated__", "=", "true"]],
						"routes": [{
							"receiver": "grafana-default-email",
							"group_by": ["grafana_folder", "alertname"],
							"object_matchers": [["__grafana_receiver__", "=", "grafana-default-email"]]
						}]
					}],
					"group_by": ["grafana_folder", "alertname"]
				}`)

	testCases := []testCase{
		{
			desc:      "un-authenticated request should fail",
			url:       "http://%s/api/alertmanager/grafana/api/v2/status",
			expStatus: http.StatusUnauthorized,
			expBody:   `{"extra":null,"message":"Unauthorized","messageId":"auth.unauthorized","statusCode":401,"traceID":""}`,
		},
		{
			desc:      "viewer request should succeed",
			url:       "http://viewer:viewer@%s/api/alertmanager/grafana/api/v2/status",
			expStatus: http.StatusOK,
			expBody:   cfgWithoutAutogen,
		},
		{
			desc:      "editor request should succeed",
			url:       "http://editor:editor@%s/api/alertmanager/grafana/api/v2/status",
			expStatus: http.StatusOK,
			expBody:   cfgWithoutAutogen,
		},
		{
			desc:      "admin request should succeed",
			url:       "http://admin:admin@%s/api/alertmanager/grafana/api/v2/status",
			expStatus: http.StatusOK,
			expBody:   cfgWithAutogen,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			resp, err := http.Get(fmt.Sprintf(tc.url, grafanaListedAddr))
			t.Cleanup(func() {
				require.NoError(t, resp.Body.Close())
			})
			require.NoError(t, err)
			require.Equal(t, tc.expStatus, resp.StatusCode)
			b, err := io.ReadAll(resp.Body)
			if tc.expStatus == http.StatusOK {
				re := regexp.MustCompile(`"uid":"([\w|-]+)"`)
				b = re.ReplaceAll(b, []byte(`"uid":""`))
			}
			require.NoError(t, err)
			require.JSONEq(t, tc.expBody, string(b))
		})
	}
}

func TestIntegrationQuota(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		EnableQuota:           true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	// Create a user to make authenticated requests
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		// needs permission to update org quota
		IsAdmin:        true,
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})
	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")
	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "default", "default")

	interval, err := model.ParseDuration("1m")
	require.NoError(t, err)

	// Create rule under folder1
	createRule(t, apiClient, "default")

	// get the generated rule UID
	var ruleUID string
	{
		u := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(u)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		assert.Equal(t, resp.StatusCode, 202)

		_, m := rulesNamespaceWithoutVariableValues(t, b)
		generatedUIDs, ok := m["default,arulegroup"]
		assert.True(t, ok)
		assert.Equal(t, 1, len(generatedUIDs))
		ruleUID = generatedUIDs[0]
	}

	// check quota limits
	t.Run("when quota limit exceed creating new rule should fail", func(t *testing.T) {
		// get existing org quota
		limit, used := apiClient.GetOrgQuotaLimits(t, 1)
		apiClient.UpdateAlertRuleOrgQuota(t, 1, used)
		t.Cleanup(func() {
			apiClient.UpdateAlertRuleOrgQuota(t, 1, limit)
		})

		// try to create an alert rule
		rules := apimodels.PostableRuleGroupConfig{
			Name:     "arulegroup",
			Interval: interval,
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     "One more alert rule",
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
			},
		}
		_, status, body := apiClient.PostRulesGroupWithStatus(t, "default", &rules)
		assert.Equal(t, http.StatusForbidden, status)
		var res map[string]any
		require.NoError(t, json.Unmarshal([]byte(body), &res))
		require.Equal(t, "quota has been exceeded", res["message"])
	})

	t.Run("when quota limit exceed updating existing rule should succeed", func(t *testing.T) {
		// try to create an alert rule
		rules := apimodels.PostableRuleGroupConfig{
			Name:     "arulegroup",
			Interval: interval,
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						Title:     "Updated alert rule",
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
									"expression": "2 + 4 > 1"
									}`),
							},
						},
						UID: ruleUID,
					},
				},
			},
		}

		respModel, status, _ := apiClient.PostRulesGroupWithStatus(t, "default", &rules)
		assert.Equal(t, http.StatusAccepted, status)
		require.Len(t, respModel.Updated, 1)

		// let's make sure that rule definitions are updated correctly.
		u := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(u)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
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
					       "expr":"",
						   "for": "2m",
					       "grafana_alert":{
						  "id":1,
						  "orgId":1,
						  "title":"Updated alert rule",
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
							   "expression":"2 + 4 \u003E 1",
							   "intervalMs":1000,
							   "maxDataPoints":43200,
							   "type":"math"
							}
						     }
						  ],
						  "updated":"2021-02-21T01:10:30Z",
						  "intervalSeconds":60,
						  "is_paused": false,
						  "version":2,
						  "uid":"uid",
						  "namespace_uid":"nsuid",
						  "rule_group":"arulegroup",
						  "no_data_state":"NoData",
						  "exec_err_state":"Alerting",
						  "metadata": {
						    "editor_settings": {
							  "simplified_query_and_expressions_section": false,
							  "simplified_notifications_section": false
							 }
						   }
					      }
					    }
					 ]
				      }
				   ]
				}`, body)
	})
}

func TestIntegrationEval(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		EnableQuota:           true,
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
	// Create the namespace we'll save our alerts to.
	apiClient.CreateFolder(t, "default", "default")

	// test eval conditions
	testCases := []struct {
		desc               string
		payload            string
		expectedStatusCode func() int
		expectedResponse   func() string
		expectedMessage    func() string
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
							"datasourceUid": "__expr__",
							"model": {
								"type":"math",
								"expression":"1 < 2"
							}
						}
					],
				"condition": "A",
				"now": "2021-04-11T14:38:14Z"
			}
			`,
			expectedMessage:    func() string { return "" },
			expectedStatusCode: func() int { return http.StatusOK },
			expectedResponse: func() string {
				return `{
				"results": {
				  "A": {
					"status": 200,
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
						  ],
						  "meta": {
						    "type": "numeric-multi",
							"typeVersion": [0, 1]
						  }
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
			}`
			},
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
							"datasourceUid": "__expr__",
							"model": {
								"type":"math",
								"expression":"1 > 2"
							}
						}
					],
				"condition": "A",
				"now": "2021-04-11T14:38:14Z"
			}
			`,
			expectedMessage:    func() string { return "" },
			expectedStatusCode: func() int { return http.StatusOK },
			expectedResponse: func() string {
				return `{
				"results": {
				  "A": {
					"status": 200,
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
						  ],
						  "meta": {
						    "type": "numeric-multi",
							"typeVersion": [0, 1]
						  }
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
			}`
			},
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
							"datasourceUid": "unknown",
							"model": {
							}
						}
					],
				"condition": "A",
				"now": "2021-04-11T14:38:14Z"
			}
			`,
			expectedResponse: func() string { return "" },
			expectedStatusCode: func() int {
				if setting.IsEnterprise {
					return http.StatusForbidden
				}
				return http.StatusBadRequest
			},
			expectedMessage: func() string {
				if setting.IsEnterprise {
					return "user is not authorized to access one or many data sources"
				}
				return "Failed to build evaluator for queries and expressions: failed to build query 'A': data source not found"
			},
		},
		{
			desc: "condition is empty",
			payload: `
			{
				"data": [
						{
							"refId": "A",
							"relativeTimeRange": {
								"from": 18000,
								"to": 10800
							},
							"datasourceUid": "__expr__",
							"model": {
								"type":"math",
								"expression":"1 > 2"
							}
						}
					],
				"now": "2021-04-11T14:38:14Z"
			}
			`,
			expectedStatusCode: func() int { return http.StatusOK },
			expectedMessage:    func() string { return "" },
			expectedResponse: func() string {
				return `{
				"results": {
				  "A": {
					"status": 200,
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
						  ],
						  "meta": {
						    "type": "numeric-multi",
							"typeVersion": [0, 1]
						  }
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
			}`
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			u := fmt.Sprintf("http://grafana:password@%s/api/v1/eval", grafanaListedAddr)
			r := strings.NewReader(tc.payload)
			// nolint:gosec
			resp, err := http.Post(u, "application/json", r)
			require.NoError(t, err)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
			b, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			res := Response{}
			err = json.Unmarshal(b, &res)
			require.NoError(t, err)

			assert.Equal(t, tc.expectedStatusCode(), resp.StatusCode)
			if tc.expectedResponse() != "" {
				require.JSONEq(t, tc.expectedResponse(), string(b))
			}
			if tc.expectedMessage() != "" {
				require.Equal(t, tc.expectedMessage(), res.Message)
			}
		})
	}
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

func createUser(t *testing.T, db db.DB, cfg *setting.Cfg, cmd user.CreateUserCommand) int64 {
	t.Helper()

	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgId = 1

	quotaService := quotaimpl.ProvideService(db, cfg)
	orgService, err := orgimpl.ProvideService(db, cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(
		db, orgService, cfg, nil, nil, tracing.InitializeTracerForTest(),
		quotaService, supportbundlestest.NewFakeBundleService(),
	)
	require.NoError(t, err)

	u, err := usrSvc.Create(context.Background(), &cmd)
	require.NoError(t, err)
	return u.ID
}

func getLongString(t *testing.T, n int) string {
	t.Helper()

	b := make([]rune, n)
	for i := range b {
		b[i] = 'a'
	}
	return string(b)
}

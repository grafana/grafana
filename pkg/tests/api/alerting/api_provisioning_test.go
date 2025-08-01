package alerting

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util"
)

func createRuleWithNotificationSettings(t *testing.T, client apiClient, folder string, nfSettings *definitions.AlertRuleNotificationSettings) (definitions.PostableRuleGroupConfig, string) {
	t.Helper()

	interval, err := model.ParseDuration("1m")
	require.NoError(t, err)
	doubleInterval := 2 * interval
	rules := definitions.PostableRuleGroupConfig{
		Name:     "arulegroup",
		Interval: interval,
		Rules: []definitions.PostableExtendedRuleNode{
			{
				ApiRuleNode: &definitions.ApiRuleNode{
					For:         &doubleInterval,
					Labels:      map[string]string{"label1": "val1"},
					Annotations: map[string]string{"annotation1": "val1"},
				},
				GrafanaManagedAlert: &definitions.PostableGrafanaRule{
					Title:     fmt.Sprintf("rule under folder %s", folder),
					Condition: "A",
					Data: []definitions.AlertQuery{
						{
							RefID: "A",
							RelativeTimeRange: definitions.RelativeTimeRange{
								From: definitions.Duration(time.Duration(5) * time.Hour),
								To:   definitions.Duration(time.Duration(3) * time.Hour),
							},
							DatasourceUID: expr.DatasourceUID,
							Model: json.RawMessage(`{
								"type": "math",
								"expression": "2 + 3 > 1"
								}`),
						},
					},
					NotificationSettings: nfSettings,
				},
			},
		},
	}
	resp, status, _ := client.PostRulesGroupWithStatus(t, folder, &rules, false)
	assert.Equal(t, http.StatusAccepted, status)
	require.Len(t, resp.Created, 1)
	return rules, resp.Created[0]
}

func TestIntegrationProvisioning(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	testinfra.SQLiteIntegrationTest(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	// Create users to make authenticated requests
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
	namespaceUID := "default"
	apiClient.CreateFolder(t, namespaceUID, namespaceUID)

	t.Run("when provisioning notification policies", func(t *testing.T) {
		url := fmt.Sprintf("http://%s/api/v1/provisioning/policies", grafanaListedAddr)
		body := `
		{
			"receiver": "test-receiver",
			"group_by": [
				"..."
			],
			"routes": []
		}`

		// As we check if the receiver exists that is referenced in the policy,
		// we first need to create it, so the tests passes correctly.
		urlReceiver := fmt.Sprintf("http://%s/api/v1/provisioning/contact-points", grafanaListedAddr)
		bodyReceiver := `
		{
			"name": "test-receiver",
			"type": "slack",
			"settings": {
				"recipient": "value_recipient",
				"token": "value_token"
			}
		}`

		req := createTestRequest("POST", urlReceiver, "admin", bodyReceiver)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, 202, resp.StatusCode)

		t.Run("un-authenticated GET should 401", func(t *testing.T) {
			req := createTestRequest("GET", url, "", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 401, resp.StatusCode)
		})

		t.Run("viewer GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "viewer", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})

		t.Run("editor GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "editor", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})

		t.Run("admin GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "admin", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})

		t.Run("un-authenticated PUT should 401", func(t *testing.T) {
			req := createTestRequest("PUT", url, "", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 401, resp.StatusCode)
		})

		t.Run("viewer PUT should 403", func(t *testing.T) {
			req := createTestRequest("PUT", url, "viewer", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("editor PUT should succeed", func(t *testing.T) {
			req := createTestRequest("PUT", url, "editor", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())
			require.Equal(t, 202, resp.StatusCode)
		})

		t.Run("admin PUT should succeed", func(t *testing.T) {
			req := createTestRequest("PUT", url, "admin", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())
			require.Equal(t, 202, resp.StatusCode)
		})
	})

	t.Run("when provisioning contactpoints", func(t *testing.T) {
		url := fmt.Sprintf("http://%s/api/v1/provisioning/contact-points", grafanaListedAddr)
		body := `
		{
			"name": "my-contact-point",
			"type": "slack",
			"settings": {
				"recipient": "value_recipient",
				"token": "value_token"
			}
		}`

		t.Run("un-authenticated GET should 401", func(t *testing.T) {
			req := createTestRequest("GET", url, "", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 401, resp.StatusCode)
		})

		t.Run("viewer GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "viewer", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})

		t.Run("editor GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "editor", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})

		t.Run("admin GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "admin", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})

		t.Run("un-authenticated POST should 401", func(t *testing.T) {
			req := createTestRequest("POST", url, "", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 401, resp.StatusCode)
		})

		t.Run("viewer POST should 403", func(t *testing.T) {
			req := createTestRequest("POST", url, "viewer", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("editor POST should succeed", func(t *testing.T) {
			req := createTestRequest("POST", url, "editor", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 202, resp.StatusCode)
		})

		t.Run("admin POST should succeed", func(t *testing.T) {
			req := createTestRequest("POST", url, "admin", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 202, resp.StatusCode)
		})

		createContactPoint := func(t *testing.T, name string) definitions.EmbeddedContactPoint {
			cpBody := fmt.Sprintf(`
			{
				"name": "%s",
				"type": "slack",
				"settings": {
					"recipient": "value_recipient",
					"token": "value_token"
				}
			}`, name)

			req := createTestRequest("POST", url, "admin", cpBody)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.Equal(t, 202, resp.StatusCode)

			ecp := definitions.EmbeddedContactPoint{}
			require.NoError(t, json.NewDecoder(resp.Body).Decode(&ecp))
			require.NoError(t, resp.Body.Close())

			return ecp
		}

		createPolicyForContactPoint := func(t *testing.T, receiver string) {
			url := fmt.Sprintf("http://%s/api/v1/provisioning/policies", grafanaListedAddr)
			body := fmt.Sprintf(`
			{
				"receiver": "%s",
				"group_by": [
					"..."
				],
				"routes": []
			}`, receiver)

			req := createTestRequest("PUT", url, "admin", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())
			require.Equal(t, 202, resp.StatusCode)
		}

		t.Run("viewer DELETE should 403", func(t *testing.T) {
			ecp := createContactPoint(t, "my-contact-point")

			deleteURL := fmt.Sprintf("http://%s/api/v1/provisioning/contact-points/%s", grafanaListedAddr, ecp.UID)
			req := createTestRequest("DELETE", deleteURL, "viewer", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())
			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("admin DELETE should succeed", func(t *testing.T) {
			ecp := createContactPoint(t, "my-contact-point")

			deleteURL := fmt.Sprintf("http://%s/api/v1/provisioning/contact-points/%s", grafanaListedAddr, ecp.UID)
			req := createTestRequest("DELETE", deleteURL, "admin", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())
			require.Equal(t, 202, resp.StatusCode)
		})

		t.Run("admin DELETE should 409 when contact point used by notification policy", func(t *testing.T) {
			ecp := createContactPoint(t, "my-cp-used-by-policy")

			createPolicyForContactPoint(t, "my-cp-used-by-policy")

			deleteURL := fmt.Sprintf("http://%s/api/v1/provisioning/contact-points/%s", grafanaListedAddr, ecp.UID)
			deleteReq := createTestRequest("DELETE", deleteURL, "admin", "")

			resp, err := http.DefaultClient.Do(deleteReq)
			require.NoError(t, err)
			require.Equal(t, 409, resp.StatusCode)
			var validationError errutil.PublicError
			assert.NoError(t, json.NewDecoder(resp.Body).Decode(&validationError))
			require.NoError(t, resp.Body.Close())
			assert.NotEmpty(t, validationError, validationError.Message)
			assert.Equal(t, "alerting.notifications.contact-points.referenced", validationError.MessageID)
		})

		t.Run("admin DELETE should 409 when contact point used by rule", func(t *testing.T) {
			ecp := createContactPoint(t, "my-cp-used-by-rule")

			nfSettings := &definitions.AlertRuleNotificationSettings{
				Receiver: "my-cp-used-by-rule",
			}
			apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")
			createRuleWithNotificationSettings(t, apiClient, namespaceUID, nfSettings)

			deleteURL := fmt.Sprintf("http://%s/api/v1/provisioning/contact-points/%s", grafanaListedAddr, ecp.UID)
			deleteReq := createTestRequest("DELETE", deleteURL, "admin", "")

			resp, err := http.DefaultClient.Do(deleteReq)
			require.NoError(t, err)
			require.Equal(t, 409, resp.StatusCode)
			var validationError errutil.PublicError
			assert.NoError(t, json.NewDecoder(resp.Body).Decode(&validationError))
			require.NoError(t, resp.Body.Close())
			assert.NotEmpty(t, validationError, validationError.Message)
			assert.Equal(t, "alerting.notifications.contact-points.used-by-rule", validationError.MessageID)
		})
	})

	t.Run("when provisioning templates", func(t *testing.T) {
		url := fmt.Sprintf("http://%s/api/v1/provisioning/templates", grafanaListedAddr)

		t.Run("un-authenticated GET should 401", func(t *testing.T) {
			req := createTestRequest("GET", url, "", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 401, resp.StatusCode)
		})

		t.Run("viewer GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "viewer", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})

		t.Run("editor GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "editor", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})

		t.Run("admin GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "admin", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})
	})

	t.Run("when provisioning mute timings", func(t *testing.T) {
		url := fmt.Sprintf("http://%s/api/v1/provisioning/mute-timings", grafanaListedAddr)

		t.Run("un-authenticated GET should 401", func(t *testing.T) {
			req := createTestRequest("GET", url, "", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 401, resp.StatusCode)
		})

		t.Run("viewer GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "viewer", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})

		t.Run("editor GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "editor", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})

		t.Run("admin GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "admin", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})
	})

	t.Run("when provisioning alert rules", func(t *testing.T) {
		url := fmt.Sprintf("http://%s/api/v1/provisioning/alert-rules", grafanaListedAddr)
		body := `
		{
			"orgID":1,
			"folderUID":"default",
			"ruleGroup":"Test Group",
			"title":"Provisioned",
			"condition":"A",
			"data":[{
					"refId":"A",
					"queryType":"",
					"relativeTimeRange":{"from":600,"to":0},
					"datasourceUid":"f558c85f-66ad-4fd1-b31d-7979e6c93db4",
					"model":{
						"editorMode":"code",
						"exemplar":false,
						"expr":"sum(rate(low_card[5m])) \u003e 0",
						"format":"time_series",
						"instant":true,
						"intervalMs":1000,
						"legendFormat":"__auto",
						"maxDataPoints":43200,
						"range":false,"refId":"A"
					}
			}],
			"noDataState":"NoData",
			"execErrState":"Error",
			"for":"0s"
		}`
		req := createTestRequest("POST", url, "admin", body)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, 201, resp.StatusCode)

		// We want to check the provenances of both provisioned and non-provisioned rules
		createRule(t, apiClient, namespaceUID)

		req = createTestRequest("GET", url, "admin", "")
		resp, err = http.DefaultClient.Do(req)
		require.NoError(t, err)

		var rules definitions.ProvisionedAlertRules
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&rules))
		require.NoError(t, resp.Body.Close())

		require.Len(t, rules, 2)
		sort.Slice(rules, func(i, j int) bool {
			return rules[i].ID < rules[j].ID
		})
		require.Equal(t, definitions.Provenance("api"), rules[0].Provenance)
		require.Equal(t, definitions.Provenance(""), rules[1].Provenance)
	})
}

func TestIntegrationProvisioningRules(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	testinfra.SQLiteIntegrationTest(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	// Create users to make authenticated requests
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
	namespaceUID := "default"
	apiClient.CreateFolder(t, namespaceUID, namespaceUID)

	t.Run("when provisioning alert rules", func(t *testing.T) {
		originalRuleGroup := definitions.AlertRuleGroup{
			Title:     "TestGroup",
			Interval:  60,
			FolderUID: "default",
			Rules: []definitions.ProvisionedAlertRule{
				{
					UID:          "rule1",
					Title:        "Rule1",
					OrgID:        1,
					RuleGroup:    "TestGroup",
					Condition:    "A",
					NoDataState:  definitions.Alerting,
					ExecErrState: definitions.AlertingErrState,
					For:          model.Duration(time.Duration(60) * time.Second),
					Data: []definitions.AlertQuery{
						{
							RefID: "A",
							RelativeTimeRange: definitions.RelativeTimeRange{
								From: definitions.Duration(time.Duration(5) * time.Hour),
								To:   definitions.Duration(time.Duration(3) * time.Hour),
							},
							DatasourceUID: expr.DatasourceUID,
							Model:         json.RawMessage([]byte(`{"type":"math","expression":"2 + 3 \u003e 1"}`)),
						},
					},
				},
				{
					UID:          "rule2",
					Title:        "Rule2",
					OrgID:        1,
					RuleGroup:    "TestGroup",
					Condition:    "A",
					NoDataState:  definitions.Alerting,
					ExecErrState: definitions.AlertingErrState,
					For:          model.Duration(time.Duration(60) * time.Second),
					Data: []definitions.AlertQuery{
						{
							RefID: "A",
							RelativeTimeRange: definitions.RelativeTimeRange{
								From: definitions.Duration(time.Duration(5) * time.Hour),
								To:   definitions.Duration(time.Duration(3) * time.Hour),
							},
							DatasourceUID: expr.DatasourceUID,
							Model:         json.RawMessage([]byte(`{"type":"math","expression":"2 + 3 \u003e 1"}`)),
						},
					},
				},
				{
					UID:          "rule3",
					Title:        "Rule3",
					OrgID:        1,
					RuleGroup:    "TestGroup",
					Condition:    "A",
					NoDataState:  definitions.Alerting,
					ExecErrState: definitions.AlertingErrState,
					For:          model.Duration(time.Duration(60) * time.Second),
					Data: []definitions.AlertQuery{
						{
							RefID: "A",
							RelativeTimeRange: definitions.RelativeTimeRange{
								From: definitions.Duration(time.Duration(5) * time.Hour),
								To:   definitions.Duration(time.Duration(3) * time.Hour),
							},
							DatasourceUID: expr.DatasourceUID,
							Model:         json.RawMessage([]byte(`{"type":"math","expression":"2 + 3 \u003e 1"}`)),
						},
					},
					MissingSeriesEvalsToResolve: util.Pointer(3),
				},
			},
		}

		result, status, raw := apiClient.CreateOrUpdateRuleGroupProvisioning(t, originalRuleGroup)

		t.Run("should create a new rule group with UIDs specified", func(t *testing.T) {
			requireStatusCode(t, http.StatusOK, status, raw)
			require.Equal(t, originalRuleGroup, result)

			require.Len(t, result.Rules, 3)
			for _, rule := range result.Rules {
				require.NotEmpty(t, rule.UID)
				if rule.UID == "rule3" {
					require.Equal(t, 3, *rule.MissingSeriesEvalsToResolve)
				}
			}
		})

		t.Run("should remove a rule when updating group with a rule removed", func(t *testing.T) {
			existingRuleGroup, status, raw := apiClient.GetRuleGroupProvisioning(t, "default", "TestGroup")
			requireStatusCode(t, http.StatusOK, status, raw)
			require.Len(t, existingRuleGroup.Rules, 3)

			updatedRuleGroup := existingRuleGroup
			updatedRuleGroup.Rules = updatedRuleGroup.Rules[:2]
			result, status, raw := apiClient.CreateOrUpdateRuleGroupProvisioning(t, updatedRuleGroup)
			requireStatusCode(t, http.StatusOK, status, raw)
			require.Equal(t, updatedRuleGroup, result)

			// Check that the rule was removed
			rules, status, raw := apiClient.GetRuleGroupProvisioning(t, existingRuleGroup.FolderUID, existingRuleGroup.Title)
			requireStatusCode(t, http.StatusOK, status, raw)
			require.Len(t, rules.Rules, 2)
		})

		t.Run("should recreate a rule when updating group with the rule added back", func(t *testing.T) {
			result, status, raw := apiClient.CreateOrUpdateRuleGroupProvisioning(t, originalRuleGroup)
			requireStatusCode(t, http.StatusOK, status, raw)
			require.Equal(t, originalRuleGroup, result)
			require.Len(t, result.Rules, 3)

			// Check that the rule was re-added
			rules, status, raw := apiClient.GetRuleGroupProvisioning(t, originalRuleGroup.FolderUID, originalRuleGroup.Title)
			requireStatusCode(t, http.StatusOK, status, raw)
			require.Len(t, rules.Rules, 3)
		})
	})
}

func TestMuteTimings(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, path)

	apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")

	t.Run("default config should return empty list", func(t *testing.T) {
		mt, status, body := apiClient.GetAllMuteTimingsWithStatus(t)
		requireStatusCode(t, http.StatusOK, status, body)
		require.Empty(t, mt)
	})

	emptyMuteTiming := definitions.MuteTimeInterval{
		MuteTimeInterval: config.MuteTimeInterval{
			Name:          "Empty Mute Timing",
			TimeIntervals: []timeinterval.TimeInterval{},
		},
	}

	t.Run("should create a new mute timing without any intervals", func(t *testing.T) {
		mt, status, body := apiClient.CreateMuteTimingWithStatus(t, emptyMuteTiming)
		requireStatusCode(t, http.StatusCreated, status, body)
		require.Equal(t, emptyMuteTiming.MuteTimeInterval, mt.MuteTimeInterval)
		require.EqualValues(t, models.ProvenanceAPI, mt.Provenance)
	})

	anotherMuteTiming := definitions.MuteTimeInterval{
		MuteTimeInterval: config.MuteTimeInterval{
			Name: "Not Empty Mute Timing",
			TimeIntervals: []timeinterval.TimeInterval{
				{
					Times: []timeinterval.TimeRange{
						{
							StartMinute: 10,
							EndMinute:   45,
						},
					},
					Weekdays: []timeinterval.WeekdayRange{
						{
							InclusiveRange: timeinterval.InclusiveRange{
								Begin: 0,
								End:   2,
							},
						},
						{
							InclusiveRange: timeinterval.InclusiveRange{
								Begin: 4,
								End:   5,
							},
						},
					},
				},
			},
		},
	}

	t.Run("should create a new mute timing with some settings", func(t *testing.T) {
		mt, status, body := apiClient.CreateMuteTimingWithStatus(t, anotherMuteTiming)
		requireStatusCode(t, http.StatusCreated, status, body)
		require.Equal(t, anotherMuteTiming.MuteTimeInterval, mt.MuteTimeInterval)
		require.EqualValues(t, models.ProvenanceAPI, mt.Provenance)
	})

	t.Run("should return mute timing by name", func(t *testing.T) {
		mt, status, body := apiClient.GetMuteTimingByNameWithStatus(t, emptyMuteTiming.Name)
		requireStatusCode(t, http.StatusOK, status, body)
		require.Equal(t, emptyMuteTiming.MuteTimeInterval, mt.MuteTimeInterval)
		require.EqualValues(t, models.ProvenanceAPI, mt.Provenance)

		mt, status, body = apiClient.GetMuteTimingByNameWithStatus(t, anotherMuteTiming.Name)
		requireStatusCode(t, http.StatusOK, status, body)
		require.Equal(t, anotherMuteTiming.MuteTimeInterval, mt.MuteTimeInterval)
		require.EqualValues(t, models.ProvenanceAPI, mt.Provenance)
	})

	t.Run("should return NotFound if mute timing does not exist", func(t *testing.T) {
		_, status, body := apiClient.GetMuteTimingByNameWithStatus(t, "some-missing-timing")
		requireStatusCode(t, http.StatusNotFound, status, body)
	})

	t.Run("should return all mute timings", func(t *testing.T) {
		mt, status, body := apiClient.GetAllMuteTimingsWithStatus(t)
		requireStatusCode(t, http.StatusOK, status, body)
		require.Len(t, mt, 2)

		slices.SortFunc(mt, func(a, b definitions.MuteTimeInterval) int {
			return strings.Compare(a.Name, b.Name)
		})

		require.Equal(t, emptyMuteTiming.MuteTimeInterval, mt[0].MuteTimeInterval)
		require.EqualValues(t, models.ProvenanceAPI, mt[0].Provenance)

		require.Equal(t, anotherMuteTiming.MuteTimeInterval, mt[1].MuteTimeInterval)
		require.EqualValues(t, models.ProvenanceAPI, mt[1].Provenance)
	})

	t.Run("should get BadRequest if creates a new mute timing with the same name", func(t *testing.T) {
		m := anotherMuteTiming
		m.TimeIntervals = nil
		_, status, body := apiClient.CreateMuteTimingWithStatus(t, m)
		t.Log(body)
		requireStatusCode(t, http.StatusBadRequest, status, body)
		var validationError errutil.PublicError
		assert.NoError(t, json.Unmarshal([]byte(body), &validationError))
		assert.NotEmpty(t, validationError, validationError.Message)
		assert.Equal(t, "alerting.notifications.time-intervals.nameExists", validationError.MessageID)
		if t.Failed() {
			t.Fatalf("response: %s", body)
		}
	})

	t.Run("should get BadRequest if creates an invalid mute timing", func(t *testing.T) {
		m := definitions.MuteTimeInterval{
			MuteTimeInterval: config.MuteTimeInterval{
				Name: "Invalid",
				TimeIntervals: []timeinterval.TimeInterval{
					{
						Times: []timeinterval.TimeRange{
							{
								StartMinute: 20000,
								EndMinute:   90000,
							},
						},
					},
				},
			},
		}
		_, status, body := apiClient.CreateMuteTimingWithStatus(t, m)
		t.Log(body)
		requireStatusCode(t, http.StatusBadRequest, status, body)
		var validationError map[string]any
		assert.NoError(t, json.Unmarshal([]byte(body), &validationError))
		assert.Contains(t, validationError, "message")
		if t.Failed() {
			t.Fatalf("response: %s", body)
		}
	})

	t.Run("should fail to update mute timing if version does not match", func(t *testing.T) {
		tm := anotherMuteTiming
		tm.Version = "wrong-version"
		tm.TimeIntervals = []timeinterval.TimeInterval{
			{
				Times: []timeinterval.TimeRange{
					{
						StartMinute: 36,
						EndMinute:   49,
					},
				},
			},
		}
		_, status, body := apiClient.UpdateMuteTimingWithStatus(t, tm)
		requireStatusCode(t, http.StatusConflict, status, body)
		var validationError errutil.PublicError
		assert.NoError(t, json.Unmarshal([]byte(body), &validationError))
		assert.NotEmpty(t, validationError, validationError.Message)
		assert.Equal(t, "alerting.notifications.conflict", validationError.MessageID)
		if t.Failed() {
			t.Fatalf("response: %s", body)
		}
	})

	t.Run("should update existing mute timing", func(t *testing.T) {
		mt, _, _ := apiClient.GetMuteTimingByNameWithStatus(t, anotherMuteTiming.Name)

		anotherMuteTiming.TimeIntervals = []timeinterval.TimeInterval{
			{
				Times: []timeinterval.TimeRange{
					{
						StartMinute: 36,
						EndMinute:   49,
					},
				},
			},
		}
		anotherMuteTiming.Version = mt.Version

		mt, status, body := apiClient.UpdateMuteTimingWithStatus(t, anotherMuteTiming)
		requireStatusCode(t, http.StatusAccepted, status, body)
		require.Equal(t, anotherMuteTiming.MuteTimeInterval, mt.MuteTimeInterval)
	})

	t.Run("should fail to update existing mute timing with invalid one", func(t *testing.T) {
		mt := anotherMuteTiming
		mt.TimeIntervals = []timeinterval.TimeInterval{
			{
				Times: []timeinterval.TimeRange{
					{
						StartMinute: 360000,
						EndMinute:   490000,
					},
				},
			},
		}

		_, status, body := apiClient.UpdateMuteTimingWithStatus(t, mt)

		requireStatusCode(t, http.StatusBadRequest, status, body)
		var validationError map[string]any
		assert.NoError(t, json.Unmarshal([]byte(body), &validationError))
		assert.Contains(t, validationError, "message")
		if t.Failed() {
			t.Fatalf("response: %s", body)
		}
	})

	t.Run("should get NotFound if updates mute timing that does not exist", func(t *testing.T) {
		mt := definitions.MuteTimeInterval{
			MuteTimeInterval: config.MuteTimeInterval{
				Name: "Missing Mute Timing",
			},
		}
		_, status, body := apiClient.UpdateMuteTimingWithStatus(t, mt)
		requireStatusCode(t, http.StatusNotFound, status, body)
	})

	t.Run("should delete unused mute timing", func(t *testing.T) {
		status, body := apiClient.DeleteMuteTimingWithStatus(t, emptyMuteTiming.Name)
		requireStatusCode(t, http.StatusNoContent, status, body)

		_, status, body = apiClient.GetMuteTimingByNameWithStatus(t, emptyMuteTiming.Name)
		requireStatusCode(t, http.StatusNotFound, status, body)
	})

	t.Run("should get 409 Conflict if deletes used mute-timing", func(t *testing.T) {
		route, status, response := apiClient.GetRouteWithStatus(t)
		requireStatusCode(t, http.StatusOK, status, response)
		route.Routes = append(route.Routes, &definitions.Route{
			Receiver: route.Receiver,
			ObjectMatchers: definitions.ObjectMatchers{
				{
					Name:  "a",
					Value: "b",
				},
			},
			MuteTimeIntervals: []string{anotherMuteTiming.Name},
		})
		status, response = apiClient.UpdateRouteWithStatus(t, route, false)
		requireStatusCode(t, http.StatusAccepted, status, response)

		status, response = apiClient.DeleteMuteTimingWithStatus(t, anotherMuteTiming.Name)
		requireStatusCode(t, http.StatusConflict, status, response)
		var validationError errutil.PublicError
		assert.NoError(t, json.Unmarshal([]byte(response), &validationError))
		assert.NotEmpty(t, validationError, validationError.Message)
		assert.Equal(t, "alerting.notifications.time-intervals.used", validationError.MessageID)
		if t.Failed() {
			t.Fatalf("response: %s", response)
		}
	})
}

func createTestRequest(method string, url string, user string, body string) *http.Request {
	var bodyBuf io.Reader
	if body != "" {
		bodyBuf = bytes.NewReader([]byte(body))
	}
	req, _ := http.NewRequest(method, url, bodyBuf)
	if bodyBuf != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if user != "" {
		req.SetBasicAuth(user, user)
	}
	return req
}

func TestIntegrationExportFileProvision(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	provisioningDir := filepath.Join(dir, "conf", "provisioning")
	alertingDir := filepath.Join(provisioningDir, "alerting")
	err := os.MkdirAll(alertingDir, 0750)
	require.NoError(t, err)

	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, p)

	apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")
	apiClient.ReloadCachedPermissions(t)
	t.Run("when provisioning alert rules from files", func(t *testing.T) {
		// add file provisioned alert rules
		fileProvisionedAlertRules, err := testData.ReadFile(path.Join("test-data", "provisioning-rules.yaml"))
		require.NoError(t, err)

		var expected definitions.AlertingFileExport
		require.NoError(t, yaml.Unmarshal(fileProvisionedAlertRules, &expected))
		expectedYaml, err := yaml.Marshal(expected)
		require.NoError(t, err)

		// create folder
		folderUID := "my_first_folder_uid"
		apiClient.CreateFolder(t, folderUID, "my_first_folder_with_$escaped_symbols")

		err = os.WriteFile(filepath.Join(alertingDir, "provisioning-rules.yaml"), fileProvisionedAlertRules, 0750)
		require.NoError(t, err)

		apiClient.ReloadAlertingFileProvisioning(t)

		data, status, _ := apiClient.GetAllRulesWithStatus(t)
		require.Equal(t, http.StatusOK, status)
		require.Greater(t, len(data), 0)

		t.Run("exported alert rules should escape $ characters", func(t *testing.T) {
			// call export endpoint
			status, exportRaw := apiClient.ExportRulesWithStatus(t, &definitions.AlertRulesExportParameters{
				ExportQueryParams: definitions.ExportQueryParams{Format: "yaml"},
				FolderUID:         []string{folderUID},
				GroupName:         "my_rule_group",
			})
			require.Equal(t, http.StatusOK, status)
			var export definitions.AlertingFileExport
			require.NoError(t, yaml.Unmarshal([]byte(exportRaw), &export))

			// verify the file exported matches the file provisioned thing
			require.Len(t, export.Groups, 1)
			require.YAMLEq(t, string(expectedYaml), exportRaw)
		})
	})
	t.Run("when provisioning mute times from files", func(t *testing.T) {
		// add file provisioned mute times
		fileProvisionedMuteTimings, err := testData.ReadFile(path.Join("test-data", "provisioning-mute-times.yaml"))
		require.NoError(t, err)

		var expected definitions.AlertingFileExport
		require.NoError(t, yaml.Unmarshal(fileProvisionedMuteTimings, &expected))
		expected.MuteTimings[0].OrgID = 1 // HACK to deal with weird goyaml behavior
		expectedYamlRaw, err := yaml.Marshal(expected)
		require.NoError(t, err)

		err = os.WriteFile(filepath.Join(alertingDir, "provisioning-mute-times.yaml"), fileProvisionedMuteTimings, 0750)
		require.NoError(t, err)

		apiClient.ReloadAlertingFileProvisioning(t)

		t.Run("exported mute times shouldn't escape $ characters", func(t *testing.T) {
			// call export endpoint
			exportRaw := apiClient.ExportMuteTiming(t, "$mute_time_a", "yaml")
			var export definitions.AlertingFileExport
			require.NoError(t, yaml.Unmarshal([]byte(exportRaw), &export))
			expectedYaml := string(expectedYamlRaw)
			// verify the file exported matches the file provisioned thing
			require.Len(t, export.MuteTimings, 1)
			require.YAMLEq(t, expectedYaml, exportRaw)
		})
		t.Run("reloading provisioning should not fail", func(t *testing.T) {
			apiClient.ReloadAlertingFileProvisioning(t)
		})
	})
}

func TestIntegrationExportFileProvisionMixed(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	provisioningDir := filepath.Join(dir, "conf", "provisioning")
	alertingDir := filepath.Join(provisioningDir, "alerting")
	err := os.MkdirAll(alertingDir, 0750)
	require.NoError(t, err)

	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, p)

	apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")
	apiClient.ReloadCachedPermissions(t)
	t.Run("when provisioning mixed set of alerting configurations from files", func(t *testing.T) {
		// add file provisioned mixed set of alerting configurations
		fileProvisionedResources, err := testData.ReadFile(path.Join("test-data", "provisioning-mixed-set.yaml"))
		require.NoError(t, err)

		var expected definitions.AlertingFileExport
		require.NoError(t, yaml.Unmarshal(fileProvisionedResources, &expected))
		expected.MuteTimings[0].OrgID = 1 // HACK to deal with weird goyaml behavior

		err = os.WriteFile(filepath.Join(alertingDir, "provisioning-mixed-set.yaml"), fileProvisionedResources, 0750)
		require.NoError(t, err)

		apiClient.ReloadAlertingFileProvisioning(t)

		t.Run("exported notification policy matches imported", func(t *testing.T) {
			notificationPolicyExpected := expected
			notificationPolicyExpected.MuteTimings = nil
			notificationPolicyExpected.ContactPoints = nil
			notificationPolicyExpected.Groups = nil
			serializedExpected, err := yaml.Marshal(notificationPolicyExpected)
			require.NoError(t, err)

			actual := apiClient.ExportNotificationPolicy(t, "yaml")

			require.YAMLEq(t, string(serializedExpected), actual)
		})
	})
}

func TestIntegrationExportFileProvisionContactPoints(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	provisioningDir := filepath.Join(dir, "conf", "provisioning")
	alertingDir := filepath.Join(provisioningDir, "alerting")
	err := os.MkdirAll(alertingDir, 0750)
	require.NoError(t, err)

	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, p)

	apiClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")

	apiClient.ReloadCachedPermissions(t)
	t.Run("when provisioning contact points from files", func(t *testing.T) {
		// add file provisioned contact points
		fileProvisionedContactPoints, err := testData.ReadFile(path.Join("test-data", "provisioning-contact-points.yaml"))
		require.NoError(t, err)

		var expected definitions.AlertingFileExport
		require.NoError(t, yaml.Unmarshal(fileProvisionedContactPoints, &expected))
		expectedYaml, err := yaml.Marshal(expected)
		require.NoError(t, err)

		err = os.WriteFile(filepath.Join(alertingDir, "provisioning-contact-points.yaml"), fileProvisionedContactPoints, 0750)
		require.NoError(t, err)

		apiClient.ReloadAlertingFileProvisioning(t)

		t.Run("exported contact points should escape $ characters", func(t *testing.T) {
			// call export endpoint
			exportRaw := apiClient.ExportReceiver(t, "cp_1_$escaped", "yaml", true)
			var export definitions.AlertingFileExport
			require.NoError(t, yaml.Unmarshal([]byte(exportRaw), &export))

			// verify the file exported matches the file provisioned thing
			require.Len(t, export.ContactPoints, 1)
			require.YAMLEq(t, string(expectedYaml), exportRaw)
		})
		t.Run("reloading provisioning should not change things", func(t *testing.T) {
			apiClient.ReloadAlertingFileProvisioning(t)

			exportRaw := apiClient.ExportReceiver(t, "cp_1_$escaped", "yaml", true)
			var export definitions.AlertingFileExport
			require.NoError(t, yaml.Unmarshal([]byte(exportRaw), &export))

			// verify the file exported matches the file provisioned thing
			require.Len(t, export.ContactPoints, 1)
			require.YAMLEq(t, string(expectedYaml), exportRaw)
		})
	})
}

func TestIntegrationFullpath(t *testing.T) {
	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, p)

	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")

	namespaceUID := "my-namespace"
	namespaceTitle := namespaceUID
	apiClient.CreateFolder(t, namespaceUID, namespaceTitle)

	t.Run("for a rule under a root folder should set the right fullpath", func(t *testing.T) {
		interval, err := model.ParseDuration("1m")
		require.NoError(t, err)
		doubleInterval := 2 * interval
		rules := definitions.PostableRuleGroupConfig{
			Name:     "group",
			Interval: interval,
			Rules: []definitions.PostableExtendedRuleNode{
				{
					ApiRuleNode: &definitions.ApiRuleNode{
						For:         &doubleInterval,
						Labels:      map[string]string{"label1": "val1"},
						Annotations: map[string]string{"annotation1": "val1"},
					},
					GrafanaManagedAlert: &definitions.PostableGrafanaRule{
						Title:     "rule",
						Condition: "A",
						Data: []definitions.AlertQuery{
							{
								RefID: "A",
								RelativeTimeRange: definitions.RelativeTimeRange{
									From: definitions.Duration(time.Duration(5) * time.Hour),
									To:   definitions.Duration(time.Duration(3) * time.Hour),
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

		resp, status, _ := apiClient.PostRulesGroupWithStatus(t, namespaceUID, &rules, false)
		require.Equal(t, http.StatusAccepted, status)
		require.Len(t, resp.Created, 1)
		ruleUID := resp.Created[0]

		status, response := apiClient.GetProvisioningAlertRuleExport(t, ruleUID, &definitions.ExportQueryParams{Format: "json"})
		require.Equal(t, http.StatusOK, status)
		var export definitions.AlertingFileExport
		require.NoError(t, json.Unmarshal([]byte(response), &export))
		require.Len(t, export.Groups, 1)
		assert.Equal(t, "", export.Groups[0].Folder)
	})

	t.Run("for a rule under a subfolder should set the right fullpath", func(t *testing.T) {
		otherNamespaceUID := "my-other-namespace"
		otherNamespaceTitle := "my-other-namespace containing multiple //"
		apiClient.CreateFolder(t, otherNamespaceUID, otherNamespaceTitle, namespaceUID)

		interval, err := model.ParseDuration("1m")
		require.NoError(t, err)
		doubleInterval := 2 * interval
		rules := definitions.PostableRuleGroupConfig{
			Name:     "group-2",
			Interval: interval,
			Rules: []definitions.PostableExtendedRuleNode{
				{
					ApiRuleNode: &definitions.ApiRuleNode{
						For:         &doubleInterval,
						Labels:      map[string]string{"label1": "val1"},
						Annotations: map[string]string{"annotation1": "val1"},
					},
					GrafanaManagedAlert: &definitions.PostableGrafanaRule{
						Title:     "rule-2",
						Condition: "A",
						Data: []definitions.AlertQuery{
							{
								RefID: "A",
								RelativeTimeRange: definitions.RelativeTimeRange{
									From: definitions.Duration(time.Duration(5) * time.Hour),
									To:   definitions.Duration(time.Duration(3) * time.Hour),
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

		resp, status, _ := apiClient.PostRulesGroupWithStatus(t, otherNamespaceUID, &rules, false)
		require.Equal(t, http.StatusAccepted, status)
		require.Len(t, resp.Created, 1)
		ruleUID := resp.Created[0]

		status, response := apiClient.GetProvisioningAlertRuleExport(t, ruleUID, &definitions.ExportQueryParams{Format: "json"})
		require.Equal(t, http.StatusOK, status)
		var export definitions.AlertingFileExport
		require.NoError(t, json.Unmarshal([]byte(response), &export))
		require.Len(t, export.Groups, 1)
		assert.Equal(t, "my-namespace/my-other-namespace containing multiple //", export.Groups[0].Folder)
	})
}

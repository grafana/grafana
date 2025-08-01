package alerting

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/sender"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestIntegrationAdminConfiguration_SendingToExternalAlertmanagers(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	testinfra.SQLiteIntegrationTest(t)

	const disableOrgID int64 = 2
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting:          true,
		EnableUnifiedAlerting:          true,
		DisableAnonymous:               true,
		NGAlertAdminConfigPollInterval: 2 * time.Second,
		UnifiedAlertingDisabledOrgs:    []int64{disableOrgID}, // disable unified alerting for organisation 2
		AppModeProduction:              true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	orgService, err := orgimpl.ProvideService(env.SQLStore, env.Cfg, quotatest.New(false, nil))
	require.NoError(t, err)

	// Create a user to make authenticated requests
	userID := createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Login:          "grafana",
		Password:       "password",
	})
	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")

	// create another organisation
	newOrg, err := orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: "another org", UserID: userID})
	require.NoError(t, err)
	orgID := newOrg.ID

	// ensure that the orgID is 3 (the disabled org)
	require.Equal(t, disableOrgID, orgID)

	// create user under different organisation
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin-42",
		Login:          "admin-42",
		OrgID:          orgID,
	})

	// Create a couple of "fake" Alertmanagers
	fakeAM1 := sender.NewFakeExternalAlertmanager(t)
	fakeAM2 := sender.NewFakeExternalAlertmanager(t)
	fakeAM3 := sender.NewFakeExternalAlertmanager(t)

	// Now, let's test the configuration API.
	{
		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/v1/ngalert/admin_config", grafanaListedAddr)
		resp := getRequest(t, alertsURL, http.StatusNotFound) // nolint
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var res map[string]any
		err = json.Unmarshal(b, &res)
		require.NoError(t, err)
		require.Equal(t, "no admin configuration available", res["message"])
	}

	// An invalid alertmanager choice should return an error.
	{
		ac := apimodels.PostableNGalertConfig{
			AlertmanagersChoice: apimodels.AlertmanagersChoice("invalid"),
		}
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err := enc.Encode(&ac)
		require.NoError(t, err)

		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/v1/ngalert/admin_config", grafanaListedAddr)
		resp := postRequest(t, alertsURL, buf.String(), http.StatusBadRequest) // nolint
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var res map[string]any
		err = json.Unmarshal(b, &res)
		require.NoError(t, err)
		require.Equal(t, "Invalid alertmanager choice specified", res["message"])
	}

	// Let's try to send all the alerts to an external Alertmanager
	// but never specify any. This should return an error.
	{
		ac := apimodels.PostableNGalertConfig{
			AlertmanagersChoice: apimodels.AlertmanagersChoice(ngmodels.ExternalAlertmanagers.String()),
		}
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err := enc.Encode(&ac)
		require.NoError(t, err)

		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/v1/ngalert/admin_config", grafanaListedAddr)
		resp := postRequest(t, alertsURL, buf.String(), http.StatusBadRequest) // nolint
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var res map[string]any
		err = json.Unmarshal(b, &res)
		require.NoError(t, err)
		require.Equal(t, "At least one Alertmanager must be provided or configured as a datasource that handles alerts to choose this option", res["message"])
	}

	// Add an alertmanager datasource
	{
		cmd := datasources.AddDataSourceCommand{
			OrgID:  1,
			Name:   "AM1",
			Type:   datasources.DS_ALERTMANAGER,
			Access: "proxy",
			URL:    fakeAM1.URL(),
			JsonData: simplejson.NewFromAny(map[string]any{
				"handleGrafanaManagedAlerts": true,
				"implementation":             "prometheus",
			}),
		}
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err := enc.Encode(&cmd)
		require.NoError(t, err)
		dataSourcesUrl := fmt.Sprintf("http://grafana:password@%s/api/datasources", grafanaListedAddr)
		resp := postRequest(t, dataSourcesUrl, buf.String(), http.StatusOK) // nolint
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var res map[string]any
		err = json.Unmarshal(b, &res)
		require.NoError(t, err)
		require.Equal(t, "Datasource added", res["message"])
	}

	// Add another alertmanager datasource
	{
		cmd := datasources.AddDataSourceCommand{
			OrgID:  1,
			Name:   "AM2",
			Type:   datasources.DS_ALERTMANAGER,
			Access: "proxy",
			URL:    fakeAM2.URL(),
			JsonData: simplejson.NewFromAny(map[string]any{
				"handleGrafanaManagedAlerts": true,
				"implementation":             "prometheus",
			}),
		}
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err := enc.Encode(&cmd)
		require.NoError(t, err)
		dataSourcesUrl := fmt.Sprintf("http://grafana:password@%s/api/datasources", grafanaListedAddr)
		resp := postRequest(t, dataSourcesUrl, buf.String(), http.StatusOK) // nolint
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var res map[string]any
		err = json.Unmarshal(b, &res)
		require.NoError(t, err)
		require.Equal(t, "Datasource added", res["message"])
	}

	// Now, lets re-set external Alertmanagers for main organisation
	// and make it so that only the external Alertmanagers handle the alerts.
	{
		ac := apimodels.PostableNGalertConfig{
			AlertmanagersChoice: apimodels.AlertmanagersChoice(ngmodels.ExternalAlertmanagers.String()),
		}
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err := enc.Encode(&ac)
		require.NoError(t, err)

		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/v1/ngalert/admin_config", grafanaListedAddr)
		resp := postRequest(t, alertsURL, buf.String(), http.StatusCreated) // nolint
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var res map[string]any
		err = json.Unmarshal(b, &res)
		require.NoError(t, err)
		require.Equal(t, "admin configuration updated", res["message"])
	}

	// If we get the configuration again, it shows us what we've set.
	{
		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/v1/ngalert/admin_config", grafanaListedAddr)
		resp := getRequest(t, alertsURL, http.StatusOK) // nolint
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.JSONEq(t, fmt.Sprintf("{\"alertmanagersChoice\": %q}\n", ngmodels.ExternalAlertmanagers), string(b))
	}

	// With the configuration set, we should eventually discover those Alertmanagers.
	{
		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/v1/ngalert/alertmanagers", grafanaListedAddr)
		require.Eventually(t, func() bool {
			resp := getRequest(t, alertsURL, http.StatusOK) // nolint
			b, err := io.ReadAll(resp.Body)
			require.NoError(t, err)

			var alertmanagers apimodels.GettableAlertmanagers
			require.NoError(t, json.Unmarshal(b, &alertmanagers))

			return len(alertmanagers.Data.Active) == 2
		}, 16*time.Second, 8*time.Second) // the sync interval is 2s so after 8s all alertmanagers most probably are started
	}

	// Now, let's set an alert that should fire as quickly as possible.
	{
		// Create the namespace we'll save our alerts to
		apiClient.CreateFolder(t, "default", "default")
		interval, err := model.ParseDuration("10s")
		require.NoError(t, err)

		rules := apimodels.PostableRuleGroupConfig{
			Name:     "arulegroup",
			Interval: interval,
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
			},
		}
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err = enc.Encode(&rules)
		require.NoError(t, err)

		ruleURL := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint
		_ = postRequest(t, ruleURL, buf.String(), http.StatusAccepted)
	}

	// Eventually, our Alertmanagers should receiver the alert.
	{
		require.Eventually(t, func() bool {
			return fakeAM1.AlertsCount() == 1 && fakeAM2.AlertsCount() == 1
		}, time.Minute, 5*time.Second)
	}

	// Add an alertmanager datasource fot the other organisation
	{
		cmd := datasources.AddDataSourceCommand{
			OrgID:  2,
			Name:   "AM3",
			Type:   datasources.DS_ALERTMANAGER,
			Access: "proxy",
			URL:    fakeAM3.URL(),
			JsonData: simplejson.NewFromAny(map[string]any{
				"handleGrafanaManagedAlerts": true,
				"implementation":             "prometheus",
			}),
		}
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err := enc.Encode(&cmd)
		require.NoError(t, err)
		dataSourcesUrl := fmt.Sprintf("http://admin-42:admin-42@%s/api/datasources", grafanaListedAddr)
		resp := postRequest(t, dataSourcesUrl, buf.String(), http.StatusOK) // nolint
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var res map[string]any
		err = json.Unmarshal(b, &res)
		require.NoError(t, err)
		require.Equal(t, "Datasource added", res["message"])
	}

	// Now, lets re-set external Alertmanagers for the other organisation.
	// Sending an empty value for AlertmanagersChoice should default to AllAlertmanagers.
	{
		ac := apimodels.PostableNGalertConfig{}
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err := enc.Encode(&ac)
		require.NoError(t, err)

		alertsURL := fmt.Sprintf("http://admin-42:admin-42@%s/api/v1/ngalert/admin_config", grafanaListedAddr)
		resp := postRequest(t, alertsURL, buf.String(), http.StatusCreated) // nolint
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var res map[string]any
		err = json.Unmarshal(b, &res)
		require.NoError(t, err)
		require.Equal(t, "admin configuration updated", res["message"])
	}

	// If we get the configuration again, it shows us what we've set.
	{
		alertsURL := fmt.Sprintf("http://admin-42:admin-42@%s/api/v1/ngalert/admin_config", grafanaListedAddr)
		resp := getRequest(t, alertsURL, http.StatusOK) // nolint
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.JSONEq(t, fmt.Sprintf("{\"alertmanagersChoice\": %q}\n", ngmodels.AllAlertmanagers), string(b))
	}

	// With the configuration set, we should eventually not discover Alertmanagers.
	{
		alertsURL := fmt.Sprintf("http://admin-42:admin-42@%s/api/v1/ngalert/alertmanagers", grafanaListedAddr)
		require.Eventually(t, func() bool {
			resp := getRequest(t, alertsURL, http.StatusOK) // nolint
			b, err := io.ReadAll(resp.Body)
			require.NoError(t, err)

			var alertmanagers apimodels.GettableAlertmanagers
			require.NoError(t, json.Unmarshal(b, &alertmanagers))

			return len(alertmanagers.Data.Active) == 0
		}, 16*time.Second, 8*time.Second) // the sync interval is 2s so after 8s all alertmanagers (if any) most probably are started
	}
}

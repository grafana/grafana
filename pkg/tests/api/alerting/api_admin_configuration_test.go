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
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/sender"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestAdminConfiguration_SendingToExternalAlertmanagers(t *testing.T) {
	const disableOrgID int64 = 3
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting:          true,
		EnableUnifiedAlerting:          true,
		DisableAnonymous:               true,
		NGAlertAdminConfigPollInterval: 2 * time.Second,
		UnifiedAlertingDisabledOrgs:    []int64{disableOrgID}, // disable unified alerting for organisation 3
		AppModeProduction:              true,
	})

	grafanaListedAddr, s := testinfra.StartGrafana(t, dir, path)

	// Create a user to make authenticated requests
	userID := createUser(t, s, user.CreateUserCommand{
		DefaultOrgRole: string(models.ROLE_ADMIN),
		Login:          "grafana",
		Password:       "password",
	})
	apiClient := newAlertingApiClient(grafanaListedAddr, "grafana", "password")
	// create another organisation
	orgID := createOrg(t, s, "another org", userID)
	// ensure that the orgID is 3 (the disabled org)
	require.Equal(t, disableOrgID, orgID)

	// create user under different organisation
	createUser(t, s, user.CreateUserCommand{
		DefaultOrgRole: string(models.ROLE_ADMIN),
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
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		var res map[string]interface{}
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
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.JSONEq(t, `{"message": "Invalid alertmanager choice specified"}`, string(b))
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
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.JSONEq(t, `{"message": "At least one Alertmanager must be provided to choose this option"}`, string(b))
	}

	// Now, lets re-set external Alertmanagers for main organisation
	// and make it so that only the external Alertmanagers handle the alerts.
	{
		ac := apimodels.PostableNGalertConfig{
			Alertmanagers:       []string{fakeAM1.URL(), fakeAM2.URL()},
			AlertmanagersChoice: apimodels.AlertmanagersChoice(ngmodels.ExternalAlertmanagers.String()),
		}
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err := enc.Encode(&ac)
		require.NoError(t, err)

		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/v1/ngalert/admin_config", grafanaListedAddr)
		resp := postRequest(t, alertsURL, buf.String(), http.StatusCreated) // nolint
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.JSONEq(t, `{"message": "admin configuration updated"}`, string(b))
	}

	// If we get the configuration again, it shows us what we've set.
	{
		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/v1/ngalert/admin_config", grafanaListedAddr)
		resp := getRequest(t, alertsURL, http.StatusOK) // nolint
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.JSONEq(t, fmt.Sprintf("{\"alertmanagers\":[\"%s\",\"%s\"], \"alertmanagersChoice\": %q}\n", fakeAM1.URL(), fakeAM2.URL(), ngmodels.ExternalAlertmanagers), string(b))
	}

	// With the configuration set, we should eventually discover those Alertmanagers.
	{
		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/v1/ngalert/alertmanagers", grafanaListedAddr)
		require.Eventually(t, func() bool {
			resp := getRequest(t, alertsURL, http.StatusOK) // nolint
			b, err := ioutil.ReadAll(resp.Body)
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

		ruleURL := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint
		_ = postRequest(t, ruleURL, buf.String(), http.StatusAccepted)
	}

	//Eventually, our Alertmanagers should receiver the alert.
	{
		require.Eventually(t, func() bool {
			return fakeAM1.AlertsCount() == 1 && fakeAM2.AlertsCount() == 1
		}, 60*time.Second, 5*time.Second)
	}

	// Now, lets re-set external Alertmanagers for the other organisation.
	// Sending an empty value for AlertmanagersChoice should default to AllAlertmanagers.
	{
		ac := apimodels.PostableNGalertConfig{
			Alertmanagers: []string{fakeAM3.URL()},
		}
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err := enc.Encode(&ac)
		require.NoError(t, err)

		alertsURL := fmt.Sprintf("http://admin-42:admin-42@%s/api/v1/ngalert/admin_config", grafanaListedAddr)
		resp := postRequest(t, alertsURL, buf.String(), http.StatusCreated) // nolint
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.JSONEq(t, "{\"message\": \"admin configuration updated\"}", string(b))
	}

	// If we get the configuration again, it shows us what we've set.
	{
		alertsURL := fmt.Sprintf("http://admin-42:admin-42@%s/api/v1/ngalert/admin_config", grafanaListedAddr)
		resp := getRequest(t, alertsURL, http.StatusOK) // nolint
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.JSONEq(t, fmt.Sprintf("{\"alertmanagers\":[\"%s\"], \"alertmanagersChoice\": %q}\n", fakeAM3.URL(), ngmodels.AllAlertmanagers), string(b))
	}

	// With the configuration set, we should eventually not discover Alertmanagers.
	{
		alertsURL := fmt.Sprintf("http://admin-42:admin-42@%s/api/v1/ngalert/alertmanagers", grafanaListedAddr)
		require.Eventually(t, func() bool {
			resp := getRequest(t, alertsURL, http.StatusOK) // nolint
			b, err := ioutil.ReadAll(resp.Body)
			require.NoError(t, err)

			var alertmanagers apimodels.GettableAlertmanagers
			require.NoError(t, json.Unmarshal(b, &alertmanagers))

			return len(alertmanagers.Data.Active) == 0
		}, 16*time.Second, 8*time.Second) // the sync interval is 2s so after 8s all alertmanagers (if any) most probably are started
	}
}

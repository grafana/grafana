package alerting

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"testing"
	"time"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/services/ngalert/schedule"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestAdminConfiguration_SendingToExternalAlertmanagers(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles:              []string{"ngalert"},
		DisableAnonymous:                  true,
		NGAlertAdminConfigIntervalSeconds: 2,
	})

	s := testinfra.SetUpDatabase(t, dir)
	// override bus to get the GetSignedInUserQuery handler
	s.Bus = bus.GetBus()
	grafanaListedAddr := testinfra.StartGrafana(t, dir, path, s)

	// Create a user to make authenticated requests
	createUser(t, s, models.CreateUserCommand{
		DefaultOrgRole: string(models.ROLE_ADMIN),
		Login:          "grafana",
		Password:       "password",
	})

	// Create a couple of "fake" Alertmanagers
	fakeAM1 := schedule.NewFakeExternalAlertmanager(t)
	fakeAM2 := schedule.NewFakeExternalAlertmanager(t)

	// Now, let's test the configuration API.
	{
		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/v1/ngalert/admin_config", grafanaListedAddr)
		resp := getRequest(t, alertsURL, http.StatusNotFound) // nolint
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.JSONEq(t, string(b), "{\"message\": \"no admin configuration available\"}")
	}

	// Now, lets re-set external Alertmanagers.
	{
		ac := apimodels.PostableNGalertConfig{
			Alertmanagers: []string{fakeAM1.URL(), fakeAM2.URL()},
		}
		buf := bytes.Buffer{}
		enc := json.NewEncoder(&buf)
		err := enc.Encode(&ac)
		require.NoError(t, err)

		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/v1/ngalert/admin_config", grafanaListedAddr)
		resp := postRequest(t, alertsURL, buf.String(), http.StatusCreated) // nolint
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.JSONEq(t, string(b), "{\"message\": \"admin configuration updated\"}")
	}

	// If we get the configuration again, it shows us what we've set.
	{
		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/v1/ngalert/admin_config", grafanaListedAddr)
		resp := getRequest(t, alertsURL, http.StatusOK) // nolint
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.JSONEq(t, string(b), fmt.Sprintf("{\"alertmanagers\":[\"%s\",\"%s\"]}\n", fakeAM1.URL(), fakeAM2.URL()))
	}

	// With the configuration set, we should eventually discover those Alertmanagers set.
	{
		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/v1/ngalert/alertmanagers", grafanaListedAddr)
		require.Eventually(t, func() bool {
			resp := getRequest(t, alertsURL, http.StatusOK) // nolint
			b, err := ioutil.ReadAll(resp.Body)
			require.NoError(t, err)

			var alertmanagers apimodels.GettableAlertmanagers
			require.NoError(t, json.Unmarshal(b, &alertmanagers))

			return len(alertmanagers.Data.Active) == 2
		}, 80*time.Second, 4*time.Second)
	}

	// Now, let's set an alert that should fire as quickly as possible.
	{
		// create the namespace we'll save our alerts to
		_, err := createFolder(t, s, 0, "default")
		require.NoError(t, err)
		interval, err := model.ParseDuration("10s")
		require.NoError(t, err)

		rules := apimodels.PostableRuleGroupConfig{
			Name:     "arulegroup",
			Interval: interval,
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
}

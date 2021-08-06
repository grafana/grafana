package alerting

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/schedule"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestAdminConfiguration_SendingToExternalAlertmanagers(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{"ngalert"},
		DisableAnonymous:     true,
	})

	s := testinfra.SetUpDatabase(t, dir)
	// override bus to get the GetSignedInUserQuery handler
	s.Bus = bus.GetBus()
	grafanaListedAddr := testinfra.StartGrafana(t, dir, path, s)

	// Create a user to make authenticated requests
	require.NoError(t, createUser(t, s, models.ROLE_ADMIN, "grafana", "password"))

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
		}, 80*time.Second, 10*time.Second)
	}
}

package alerting

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/require"
)

func TestAlertAndGroupsQuery(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{"ngalert"},
	})
	store := setupDB(t, dir)
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

func setupDB(t *testing.T, dir string) *sqlstore.SQLStore {
	store := testinfra.SetUpDatabase(t, dir)
	// Let's make sure we create a default configuration from which we can start.
	err := store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Insert(&models.AlertConfiguration{
			ID:                        1,
			AlertmanagerConfiguration: AMConfigFixture,
			ConfigurationVersion:      "v1",
			CreatedAt:                 time.Now(),
		})
		return err
	})
	require.NoError(t, err)

	return store
}

var AMConfigFixture = `
template_files:
alertmanager_config: |
    global:
        resolve_timeout: 4m
        smtp_require_tls: true
    route:
        receiver: example-email
    templates: []
    receivers:
        - name: example-email
          grafana_managed_receiver_configs:
            - uid: email UID
              name: an email receiver
              type: email
              sendreminder: false
              disableresolvemessage: false
              frequency: 5m
              isdefault: false
              settings:
                addresses: youraddress@example.org
                autoResolve: true
                httpMethod: POST
                severity: critical
                singleEmail: true
                uploadImage: false
              securesettings: {}
              orgid: 0
              result: null
`

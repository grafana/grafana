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
{
  "template_files": {},
  "alertmanager_config": {
    "global": {
      "resolve_timeout": "4m",
      "http_config": {
        "BasicAuth": null,
        "Authorization": null,
        "BearerToken": "",
        "BearerTokenFile": "",
        "ProxyURL": {},
        "TLSConfig": {
          "CAFile": "",
          "CertFile": "",
          "KeyFile": "",
          "ServerName": "",
          "InsecureSkipVerify": false
        },
        "FollowRedirects": true
      },
      "smtp_from": "youraddress@example.org",
      "smtp_hello": "localhost",
      "smtp_smarthost": "localhost:25",
      "smtp_require_tls": true,
      "pagerduty_url": "https://events.pagerduty.com/v2/enqueue",
      "opsgenie_api_url": "https://api.opsgenie.com/",
      "wechat_api_url": "https://qyapi.weixin.qq.com/cgi-bin/",
      "victorops_api_url": "https://alert.victorops.com/integrations/generic/20131114/alert/"
    },
    "route": {
      "receiver": "example-email"
    },
    "templates": [],
    "receivers": [
      {
        "name": "example-email",
        "email_configs": [
          {
            "send_resolved": false,
            "to": "youraddress@example.org",
            "smarthost": "",
            "html": "{{ template \"email.default.html\" . }}",
            "tls_config": {
              "CAFile": "",
              "CertFile": "",
              "KeyFile": "",
              "ServerName": "",
              "InsecureSkipVerify": false
            }
          }
        ]
      }
    ]
  }
}
`

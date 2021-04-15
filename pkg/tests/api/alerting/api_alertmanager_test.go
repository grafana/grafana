package alerting

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/require"
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

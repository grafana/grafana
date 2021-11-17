package dashboards

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDashboardQuota(t *testing.T) {
	// enable quota and set low dashboard quota
	// Setup Grafana and its Database
	dashboardQuota := int64(1)
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous:  true,
		EnableQuota:       true,
		DashboardOrgQuota: &dashboardQuota,
	})
	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)
	// Create user
	createUser(t, store, models.CreateUserCommand{
		DefaultOrgRole: string(models.ROLE_ADMIN),
		Password:       "admin",
		Login:          "admin",
	})

	t.Run("when quota limit doesn't exceed, importing a dashboard should succeed", func(t *testing.T) {
		// Import dashboard
		dashboardDataOne, err := simplejson.NewJson([]byte(`{"title":"just testing"}`))
		require.NoError(t, err)
		buf1 := &bytes.Buffer{}
		err = json.NewEncoder(buf1).Encode(dtos.ImportDashboardCommand{
			Dashboard: dashboardDataOne,
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/dashboards/import", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", buf1)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		dashboardDTO := &plugins.PluginDashboardInfoDTO{}
		err = json.Unmarshal(b, dashboardDTO)
		require.NoError(t, err)
		require.EqualValues(t, 1, dashboardDTO.DashboardId)
	})

	t.Run("when quota limit exceeds importing a dashboard should fail", func(t *testing.T) {
		dashboardDataOne, err := simplejson.NewJson([]byte(`{"title":"just testing"}`))
		require.NoError(t, err)
		buf1 := &bytes.Buffer{}
		err = json.NewEncoder(buf1).Encode(dtos.ImportDashboardCommand{
			Dashboard: dashboardDataOne,
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/dashboards/import", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", buf1)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		require.JSONEq(t, `{"message":"Quota reached"}`, string(b))
	})
}

func createUser(t *testing.T, store *sqlstore.SQLStore, cmd models.CreateUserCommand) int64 {
	t.Helper()
	u, err := store.CreateUser(context.Background(), cmd)
	require.NoError(t, err)
	return u.Id
}

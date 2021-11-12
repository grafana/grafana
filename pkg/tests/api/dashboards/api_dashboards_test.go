package dashboards

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
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
	// test saving dashboard
	t.Run("when quota limit exceeds saving a dashboard should fail", func(t *testing.T) {
		dashboardDataOne, err := simplejson.NewJson([]byte(`{"title":"just testing"}`)) //newjson returns 2 things
		require.NoError(t, err)                                                         //checks if err is empty or not
		dashboardDataTwo, err := simplejson.NewJson([]byte(`{"title":"testing twice"}`))
		require.NoError(t, err)
		buf1 := &bytes.Buffer{} //encode json into golang structure
		buf2 := &bytes.Buffer{}
		err = json.NewEncoder(buf1).Encode(models.SaveDashboardCommand{
			Dashboard: dashboardDataOne,
		}) //check cast to go structure was successful
		require.NoError(t, err)
		err = json.NewEncoder(buf2).Encode(models.SaveDashboardCommand{
			Dashboard: dashboardDataTwo,
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/dashboards/db", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", buf1) //trigger endpoint with url we just created
		require.NoError(t, err)
		resp, err = http.Post(u, "application/json", buf2)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		}) //cleanup is like a destructor; when we go out of scope, itll clean up
		b, err := ioutil.ReadAll(resp.Body) //req body, call endpoint; get resp in json
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		require.JSONEq(t, `{"message":"Quota reached"}`, string(b))
	})
	// test importing dashboard
	// t.Run("when quota limit doesn't exceed, importing a dashboard should succeed", func(t *testing.T) {
	// 	dashboardDataOne, err := simplejson.NewJson([]byte(`{"title":"just testing"}`))
	// 	require.NoError(t, err)
	// })
}
func createUser(t *testing.T, store *sqlstore.SQLStore, cmd models.CreateUserCommand) int64 {
	t.Helper()
	u, err := store.CreateUser(context.Background(), cmd)
	require.NoError(t, err)
	return u.Id
}

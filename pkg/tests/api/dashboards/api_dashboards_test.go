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
	// test importing dashboard
	t.Run("when quota limit doesn't exceed, importing a dashboard should succeed", func(t *testing.T) {
		//create dashboard
		dashboardDataOne, err := simplejson.NewJson([]byte(`{"title":"just testing"}`)) //ida mention simplejson will be deprecated - should we switch to something else?
		require.NoError(t, err)
		buf1 := &bytes.Buffer{}
		err = json.NewEncoder(buf1).Encode(models.SaveDashboardCommand{
			Dashboard: dashboardDataOne,
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/dashboards/db", grafanaListedAddr)
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
		TestBody := &TestDashboard{}
		json.Unmarshal(b, TestBody)
		require.EqualValues(t, 1, TestBody.ID)
		fmt.Println("HERE IS TEST BODY", TestBody)
		// require.JSONEq(t, `{"id":1, "slug":"just-testing", "status":"success", "uid":"smSkHtc7k", "url":"/d/smSkHtc7k/just-testing", "version":1}`, string(b))
	})
	// test saving dashboard
	t.Run("when quota limit exceeds saving a dashboard should fail", func(t *testing.T) {
		dashboardDataOne, err := simplejson.NewJson([]byte(`{"title":"just testing"}`))
		require.NoError(t, err)
		dashboardDataTwo, err := simplejson.NewJson([]byte(`{"title":"testing twice"}`))
		require.NoError(t, err)
		buf1 := &bytes.Buffer{}
		buf2 := &bytes.Buffer{}
		err = json.NewEncoder(buf1).Encode(models.SaveDashboardCommand{
			Dashboard: dashboardDataOne,
		})
		require.NoError(t, err)
		err = json.NewEncoder(buf2).Encode(models.SaveDashboardCommand{
			Dashboard: dashboardDataTwo,
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/dashboards/db", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", buf1)
		require.NoError(t, err)
		resp, err = http.Post(u, "application/json", buf2)
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

type TestDashboard struct {
	ID      int64  `json:"id"`
	Slug    string `json:"slug"`
	Status  string `json:"status"`
	UID     string `json:"uid"`
	URL     string `json:"url"`
	Version int64  `json:"version"`
}

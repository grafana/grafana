package api

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
)

const (
	testOrgID     int64  = 1
	testUserID    int64  = 1
	testUserLogin string = "testUser"
)

func TestDataSourcesProxy_userLoggedIn(t *testing.T) {
	loggedInUserScenario(t, "When calling GET on", "/api/datasources/", func(sc *scenarioContext) {
		// Stubs the database query
		bus.AddHandler("test", func(query *models.GetDataSourcesQuery) error {
			assert.Equal(t, testOrgID, query.OrgId)
			query.Result = []*models.DataSource{
				{Name: "mmm"},
				{Name: "ZZZ"},
				{Name: "BBB"},
				{Name: "aaa"},
			}
			return nil
		})

		// handler func being tested
		hs := &HTTPServer{Bus: bus.GetBus(), Cfg: setting.NewCfg()}
		sc.handlerFunc = hs.GetDataSources
		sc.fakeReq("GET", "/api/datasources").exec()

		respJSON := []map[string]interface{}{}
		err := json.NewDecoder(sc.resp.Body).Decode(&respJSON)
		require.NoError(t, err)

		assert.Equal(t, "aaa", respJSON[0]["name"])
		assert.Equal(t, "BBB", respJSON[1]["name"])
		assert.Equal(t, "mmm", respJSON[2]["name"])
		assert.Equal(t, "ZZZ", respJSON[3]["name"])
	})

	loggedInUserScenario(t, "Should be able to save a data source when calling DELETE on non-existing",
		"/api/datasources/name/12345", func(sc *scenarioContext) {
			sc.handlerFunc = DeleteDataSourceByName
			sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
			assert.Equal(t, 404, sc.resp.Code)
		})
}

// Adding data sources with invalid URLs should lead to an error.
func TestAddDataSource_InvalidURL(t *testing.T) {
	defer bus.ClearBusHandlers()

	sc := setupScenarioContext(t, "/api/datasources")

	sc.m.Post(sc.url, routing.Wrap(func(c *models.ReqContext) response.Response {
		return AddDataSource(c, models.AddDataSourceCommand{
			Name: "Test",
			Url:  "invalid:url",
		})
	}))

	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()

	assert.Equal(t, 400, sc.resp.Code)
}

// Adding data sources with URLs not specifying protocol should work.
func TestAddDataSource_URLWithoutProtocol(t *testing.T) {
	defer bus.ClearBusHandlers()

	const name = "Test"
	const url = "localhost:5432"

	// Stub handler
	bus.AddHandler("sql", func(cmd *models.AddDataSourceCommand) error {
		assert.Equal(t, name, cmd.Name)
		assert.Equal(t, url, cmd.Url)

		cmd.Result = &models.DataSource{}
		return nil
	})

	sc := setupScenarioContext(t, "/api/datasources")

	sc.m.Post(sc.url, routing.Wrap(func(c *models.ReqContext) response.Response {
		return AddDataSource(c, models.AddDataSourceCommand{
			Name: name,
			Url:  url,
		})
	}))

	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()

	assert.Equal(t, 200, sc.resp.Code)
}

// Updating data sources with invalid URLs should lead to an error.
func TestUpdateDataSource_InvalidURL(t *testing.T) {
	defer bus.ClearBusHandlers()

	sc := setupScenarioContext(t, "/api/datasources/1234")

	sc.m.Put(sc.url, routing.Wrap(func(c *models.ReqContext) response.Response {
		return AddDataSource(c, models.AddDataSourceCommand{
			Name: "Test",
			Url:  "invalid:url",
		})
	}))

	sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()

	assert.Equal(t, 400, sc.resp.Code)
}

// Updating data sources with URLs not specifying protocol should work.
func TestUpdateDataSource_URLWithoutProtocol(t *testing.T) {
	defer bus.ClearBusHandlers()

	const name = "Test"
	const url = "localhost:5432"

	// Stub handler
	bus.AddHandler("sql", func(cmd *models.AddDataSourceCommand) error {
		assert.Equal(t, name, cmd.Name)
		assert.Equal(t, url, cmd.Url)

		cmd.Result = &models.DataSource{}
		return nil
	})

	sc := setupScenarioContext(t, "/api/datasources/1234")

	sc.m.Put(sc.url, routing.Wrap(func(c *models.ReqContext) response.Response {
		return AddDataSource(c, models.AddDataSourceCommand{
			Name: name,
			Url:  url,
		})
	}))

	sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()

	assert.Equal(t, 200, sc.resp.Code)
}

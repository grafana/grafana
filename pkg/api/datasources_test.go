package api

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/bus"
	. "github.com/smartystreets/goconvey/convey"
)

const (
	TestOrgID  = 1
	TestUserID = 1
)

func TestDataSourcesProxy(t *testing.T) {
	Convey("Given a user is logged in", t, func() {
		loggedInUserScenario("When calling GET on", "/api/datasources/", func(sc *scenarioContext) {
			// Stubs the database query
			bus.AddHandler("test", func(query *models.GetDataSourcesQuery) error {
				So(query.OrgId, ShouldEqual, TestOrgID)
				query.Result = []*models.DataSource{
					{Name: "mmm"},
					{Name: "ZZZ"},
					{Name: "BBB"},
					{Name: "aaa"},
				}
				return nil
			})

			// handler func being tested
			sc.handlerFunc = GetDataSources
			sc.fakeReq("GET", "/api/datasources").exec()

			respJSON := []map[string]interface{}{}
			err := json.NewDecoder(sc.resp.Body).Decode(&respJSON)
			So(err, ShouldBeNil)

			Convey("should return list of datasources for org sorted alphabetically and case insensitively", func() {
				So(respJSON[0]["name"], ShouldEqual, "aaa")
				So(respJSON[1]["name"], ShouldEqual, "BBB")
				So(respJSON[2]["name"], ShouldEqual, "mmm")
				So(respJSON[3]["name"], ShouldEqual, "ZZZ")
			})
		})

		Convey("Should be able to save a data source", func() {
			loggedInUserScenario("When calling DELETE on non-existing", "/api/datasources/name/12345", func(sc *scenarioContext) {
				sc.handlerFunc = DeleteDataSourceByName
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
				So(sc.resp.Code, ShouldEqual, 404)
			})
		})
	})
}

// Adding data sources with invalid URLs should lead to an error.
func TestAddDataSource_InvalidURL(t *testing.T) {
	defer bus.ClearBusHandlers()

	sc := setupScenarioContext("/api/datasources")
	// TODO: Make this an argument to setupScenarioContext
	sc.t = t

	sc.m.Post(sc.url, Wrap(func(c *models.ReqContext) Response {
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

	sc := setupScenarioContext("/api/datasources")
	// TODO: Make this an argument to setupScenarioContext
	sc.t = t

	sc.m.Post(sc.url, Wrap(func(c *models.ReqContext) Response {
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

	sc := setupScenarioContext("/api/datasources/1234")
	// TODO: Make this an argument to setupScenarioContext
	sc.t = t

	sc.m.Put(sc.url, Wrap(func(c *models.ReqContext) Response {
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

	sc := setupScenarioContext("/api/datasources/1234")
	// TODO: Make this an argument to setupScenarioContext
	sc.t = t

	sc.m.Put(sc.url, Wrap(func(c *models.ReqContext) Response {
		return AddDataSource(c, models.AddDataSourceCommand{
			Name: name,
			Url:  url,
		})
	}))

	sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()

	assert.Equal(t, 200, sc.resp.Code)
}

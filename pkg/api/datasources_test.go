package api

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/models"

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

package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"

	. "github.com/smartystreets/goconvey/convey"
)

func TestTeamApiEndpoint(t *testing.T) {
	Convey("Given two teams", t, func() {
		mockResult := models.SearchTeamQueryResult{
			Teams: []*models.TeamDTO{
				{Name: "team1"},
				{Name: "team2"},
			},
			TotalCount: 2,
		}

		hs := &HTTPServer{
			Cfg: setting.NewCfg(),
		}

		Convey("When searching with no parameters", func() {
			loggedInUserScenario("When calling GET on", "/api/teams/search", func(sc *scenarioContext) {
				var sentLimit int
				var sendPage int
				bus.AddHandler("test", func(query *models.SearchTeamsQuery) error {
					query.Result = mockResult

					sentLimit = query.Limit
					sendPage = query.Page

					return nil
				})

				sc.handlerFunc = hs.SearchTeams
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				So(sentLimit, ShouldEqual, 1000)
				So(sendPage, ShouldEqual, 1)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				So(err, ShouldBeNil)

				So(respJSON.Get("totalCount").MustInt(), ShouldEqual, 2)
				So(len(respJSON.Get("teams").MustArray()), ShouldEqual, 2)
			})
		})

		Convey("When searching with page and perpage parameters", func() {
			loggedInUserScenario("When calling GET on", "/api/teams/search", func(sc *scenarioContext) {
				var sentLimit int
				var sendPage int
				bus.AddHandler("test", func(query *models.SearchTeamsQuery) error {
					query.Result = mockResult

					sentLimit = query.Limit
					sendPage = query.Page

					return nil
				})

				sc.handlerFunc = hs.SearchTeams
				sc.fakeReqWithParams("GET", sc.url, map[string]string{"perpage": "10", "page": "2"}).exec()

				So(sentLimit, ShouldEqual, 10)
				So(sendPage, ShouldEqual, 2)
			})
		})
	})
}

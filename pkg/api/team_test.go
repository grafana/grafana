package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana/pkg/util"
	. "github.com/smartystreets/goconvey/convey"
	"github.com/stretchr/testify/assert"
	"net/http"
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

	t.Run("When creating team with api key", func(t *testing.T) {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext("/api/teams")
		hs := &HTTPServer{
			Cfg: setting.NewCfg(),
			Bus: bus.GetBus(),
		}
		hs.Cfg.EditorsCanAdmin = true

		teamName := "team foo"
		sc.defaultHandler = Wrap(func(w http.ResponseWriter, c *models.ReqContext) Response {
			c.SignedInUser = &models.SignedInUser{IsAnonymous: true}
			c.OrgRole = models.ROLE_EDITOR
			cmd := models.CreateTeamCommand{Name: teamName}
			return hs.CreateTeam(c, cmd)
		})
		sc.m.Post(sc.url, sc.defaultHandler)

		keyhash := util.EncodePassword("v5nAwpMafFP6znaS4urhdWDLS5511M42", "asd")
		bus.AddHandler("test", func(query *models.GetApiKeyByNameQuery) error {
			query.Result = &models.ApiKey{OrgId: 12, Role: models.ROLE_EDITOR, Key: keyhash}
			return nil
		})

		createTeamCalled := 0
		bus.AddHandler("test", func(cmd *models.CreateTeamCommand) error {
			createTeamCalled += 1
			cmd.Result = models.Team{Name: teamName, Id: 42}
			return nil
		})

		addTeamMemberCalled := 0
		bus.AddHandler("test", func(cmd *models.AddTeamMemberCommand) error {
			addTeamMemberCalled += 1
			return nil
		})

		validApiKey := "eyJrIjoidjVuQXdwTWFmRlA2em5hUzR1cmhkV0RMUzU1MTFNNDIiLCJuIjoiYXNkIiwiaWQiOjF9"
		sc.fakeReqNoAssertionsWithApiKey("POST", sc.url, validApiKey).exec()
		assert.Equal(t, sc.resp.Code, 200)

		respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
		assert.Nil(t, err)
		assert.Equal(t, respJSON.Get("teamId").MustInt(), 42)
		assert.Equal(t, createTeamCalled, 1)
		assert.Equal(t, addTeamMemberCalled, 0)
	})
}

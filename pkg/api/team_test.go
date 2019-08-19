package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana/pkg/infra/log"
	. "github.com/smartystreets/goconvey/convey"
	"github.com/stretchr/testify/assert"
	macaron "gopkg.in/macaron.v1"
	"net/http"
)

type testLogger struct {
	log.Logger
	warnCalled  bool
	warnMessage string
}

func (stub *testLogger) Warn(testMessage string, ctx ...interface{}) {
	stub.warnCalled = true
	stub.warnMessage = testMessage
}

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

		hs := &HTTPServer{
			Cfg: setting.NewCfg(),
			Bus: bus.GetBus(),
		}
		hs.Cfg.EditorsCanAdmin = true

		teamName := "team foo"

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

		req, _ := http.NewRequest("POST", "/api/teams", nil)

		t.Run("with no real signed in user", func(t *testing.T) {
			stub := &testLogger{}
			c := &models.ReqContext{
				Context: &macaron.Context{
					Req: macaron.Request{Request: req},
				},
				SignedInUser: &models.SignedInUser{},
				Logger:       stub,
			}
			c.OrgRole = models.ROLE_EDITOR
			cmd := models.CreateTeamCommand{Name: teamName}
			hs.CreateTeam(c, cmd)
			assert.Equal(t, createTeamCalled, 1)
			assert.Equal(t, addTeamMemberCalled, 0)
			assert.True(t, stub.warnCalled)
			assert.Equal(t, stub.warnMessage, "Could not add creator to team because is not a real user.")
		})

		t.Run("with real signed in user", func(t *testing.T) {
			stub := &testLogger{}
			c := &models.ReqContext{
				Context: &macaron.Context{
					Req: macaron.Request{Request: req},
				},
				SignedInUser: &models.SignedInUser{UserId: 42},
				Logger:       stub,
			}
			c.OrgRole = models.ROLE_EDITOR
			cmd := models.CreateTeamCommand{Name: teamName}
			createTeamCalled, addTeamMemberCalled = 0, 0
			hs.CreateTeam(c, cmd)
			assert.Equal(t, createTeamCalled, 1)
			assert.Equal(t, addTeamMemberCalled, 1)
			assert.False(t, stub.warnCalled)
		})
	})
}

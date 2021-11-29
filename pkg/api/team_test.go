package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"

	"net/http"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

func TestTeamAPIEndpoint(t *testing.T) {
	t.Run("Given two teams", func(t *testing.T) {
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

		loggedInUserScenario(t, "When calling GET on", "/api/teams/search", func(sc *scenarioContext) {
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

			assert.Equal(t, 1000, sentLimit)
			assert.Equal(t, 1, sendPage)

			respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
			require.NoError(t, err)

			assert.Equal(t, 2, respJSON.Get("totalCount").MustInt())
			assert.Equal(t, 2, len(respJSON.Get("teams").MustArray()))
		})

		loggedInUserScenario(t, "When calling GET on", "/api/teams/search", func(sc *scenarioContext) {
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

			assert.Equal(t, 10, sentLimit)
			assert.Equal(t, 2, sendPage)
		})
	})

	t.Run("When creating team with API key", func(t *testing.T) {
		defer bus.ClearBusHandlers()

		hs := &HTTPServer{
			Cfg: setting.NewCfg(),
			Bus: bus.GetBus(),
		}
		hs.Cfg.EditorsCanAdmin = true

		teamName := "team foo"

		// TODO: Use a fake SQLStore when it's represented by an interface
		origCreateTeam := createTeam
		origAddTeamMember := addTeamMember
		t.Cleanup(func() {
			createTeam = origCreateTeam
			addTeamMember = origAddTeamMember
		})

		createTeamCalled := 0
		createTeam = func(sqlStore *sqlstore.SQLStore, name, email string, orgID int64) (models.Team, error) {
			createTeamCalled++
			return models.Team{Name: teamName, Id: 42}, nil
		}

		addTeamMemberCalled := 0
		addTeamMember = func(sqlStore *sqlstore.SQLStore, userID, orgID, teamID int64, isExternal bool,
			permission models.PermissionType) error {
			addTeamMemberCalled++
			return nil
		}

		req, err := http.NewRequest("POST", "/api/teams", nil)
		require.NoError(t, err)

		t.Run("with no real signed in user", func(t *testing.T) {
			stub := &testLogger{}
			c := &models.ReqContext{
				Context:      &web.Context{Req: req},
				SignedInUser: &models.SignedInUser{},
				Logger:       stub,
			}
			c.OrgRole = models.ROLE_EDITOR
			c.Req.Body = mockRequestBody(models.CreateTeamCommand{Name: teamName})
			hs.CreateTeam(c)
			assert.Equal(t, createTeamCalled, 1)
			assert.Equal(t, addTeamMemberCalled, 0)
			assert.True(t, stub.warnCalled)
			assert.Equal(t, stub.warnMessage, "Could not add creator to team because is not a real user")
		})

		t.Run("with real signed in user", func(t *testing.T) {
			stub := &testLogger{}
			c := &models.ReqContext{
				Context:      &web.Context{Req: req},
				SignedInUser: &models.SignedInUser{UserId: 42},
				Logger:       stub,
			}
			c.OrgRole = models.ROLE_EDITOR
			c.Req.Body = mockRequestBody(models.CreateTeamCommand{Name: teamName})
			createTeamCalled, addTeamMemberCalled = 0, 0
			hs.CreateTeam(c)
			assert.Equal(t, createTeamCalled, 1)
			assert.Equal(t, addTeamMemberCalled, 1)
			assert.False(t, stub.warnCalled)
		})
	})
}

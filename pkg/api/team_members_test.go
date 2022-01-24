package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setUpGetTeamMembersHandler(t *testing.T, sqlStore *sqlstore.SQLStore) {
	const testOrgID int64 = 1
	var userCmd models.CreateUserCommand
	team, err := sqlStore.CreateTeam("group1 name", "test1@test.com", testOrgID)
	require.NoError(t, err)
	for i := 0; i < 3; i++ {
		userCmd = models.CreateUserCommand{
			Email: fmt.Sprint("user", i, "@test.com"),
			Name:  fmt.Sprint("user", i),
			Login: fmt.Sprint("loginuser", i),
		}
		// user
		user, err := sqlStore.CreateUser(context.Background(), userCmd)
		require.NoError(t, err)
		err = sqlStore.AddTeamMember(user.Id, testOrgID, team.Id, false, 1)
		require.NoError(t, err)
	}
}

func TestTeamMembersAPIEndpoint_userLoggedIn(t *testing.T) {
	settings := setting.NewCfg()
	sqlStore := sqlstore.InitTestDB(t)
	hs := &HTTPServer{
		Cfg:      settings,
		License:  &licensing.OSSLicensingService{},
		SQLStore: sqlStore,
	}

	loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "api/teams/1/members",
		"api/teams/:teamId/members", models.ROLE_ADMIN, func(sc *scenarioContext) {
			setUpGetTeamMembersHandler(t, sqlStore)

			sc.handlerFunc = hs.GetTeamMembers
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

			require.Equal(t, http.StatusOK, sc.resp.Code)

			var resp []models.TeamMemberDTO
			err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
			require.NoError(t, err)
			assert.Len(t, resp, 3)
		})

	t.Run("Given there is two hidden users", func(t *testing.T) {
		settings.HiddenUsers = map[string]struct{}{
			"user1":       {},
			testUserLogin: {},
		}
		t.Cleanup(func() { settings.HiddenUsers = make(map[string]struct{}) })

		loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "api/teams/1/members",
			"api/teams/:teamId/members", models.ROLE_ADMIN, func(sc *scenarioContext) {
				setUpGetTeamMembersHandler(t, sqlStore)

				sc.handlerFunc = hs.GetTeamMembers
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				require.Equal(t, http.StatusOK, sc.resp.Code)

				var resp []models.TeamMemberDTO
				err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
				require.NoError(t, err)
				assert.Len(t, resp, 3)
				assert.Equal(t, "loginuser0", resp[0].Login)
				assert.Equal(t, "loginuser1", resp[1].Login)
				assert.Equal(t, "loginuser2", resp[2].Login)
			})
	})
}

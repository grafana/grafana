package api

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setUpGetOrgUsersHandler() {
	bus.AddHandler("test", func(query *models.GetOrgUsersQuery) error {
		query.Result = []*models.OrgUserDTO{
			{Email: "testUser@grafana.com", Login: testUserLogin},
			{Email: "user1@grafana.com", Login: "user1"},
			{Email: "user2@grafana.com", Login: "user2"},
		}
		return nil
	})
}

func TestOrgUsersAPIEndpoint_userLoggedIn(t *testing.T) {
	settings := setting.NewCfg()
	hs := &HTTPServer{Cfg: settings}

	loggedInUserScenario(t, "When calling GET on", "api/org/users", func(sc *scenarioContext) {
		setUpGetOrgUsersHandler()

		sc.handlerFunc = hs.GetOrgUsersForCurrentOrg
		sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

		require.Equal(t, http.StatusOK, sc.resp.Code)

		var resp []models.OrgUserDTO
		err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Len(t, resp, 3)
	})

	loggedInUserScenario(t, "When calling GET as an editor with no team / folder permissions on",
		"api/org/users/lookup", func(sc *scenarioContext) {
			setUpGetOrgUsersHandler()
			bus.AddHandler("test", func(query *models.HasAdminPermissionInFoldersQuery) error {
				query.Result = false
				return nil
			})
			bus.AddHandler("test", func(query *models.IsAdminOfTeamsQuery) error {
				query.Result = false
				return nil
			})

			sc.handlerFunc = hs.GetOrgUsersForCurrentOrgLookup
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

			assert.Equal(t, http.StatusForbidden, sc.resp.Code)

			var resp struct {
				Message string
			}
			err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
			require.NoError(t, err)

			assert.Equal(t, "Permission denied", resp.Message)
		})

	loggedInUserScenarioWithRole(t, "When calling GET as an admin on", "GET", "api/org/users/lookup",
		"api/org/users/lookup", models.ROLE_ADMIN, func(sc *scenarioContext) {
			setUpGetOrgUsersHandler()

			sc.handlerFunc = hs.GetOrgUsersForCurrentOrgLookup
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

			require.Equal(t, http.StatusOK, sc.resp.Code)

			var resp []dtos.UserLookupDTO
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

		loggedInUserScenario(t, "When calling GET on", "api/org/users", func(sc *scenarioContext) {
			setUpGetOrgUsersHandler()

			sc.handlerFunc = hs.GetOrgUsersForCurrentOrg
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

			require.Equal(t, http.StatusOK, sc.resp.Code)

			var resp []models.OrgUserDTO
			err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
			require.NoError(t, err)
			assert.Len(t, resp, 2)
			assert.Equal(t, testUserLogin, resp[0].Login)
			assert.Equal(t, "user2", resp[1].Login)
		})

		loggedInUserScenarioWithRole(t, "When calling GET as an admin on", "GET", "api/org/users/lookup",
			"api/org/users/lookup", models.ROLE_ADMIN, func(sc *scenarioContext) {
				setUpGetOrgUsersHandler()

				sc.handlerFunc = hs.GetOrgUsersForCurrentOrgLookup
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				require.Equal(t, http.StatusOK, sc.resp.Code)

				var resp []dtos.UserLookupDTO
				err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
				require.NoError(t, err)
				assert.Len(t, resp, 2)
				assert.Equal(t, testUserLogin, resp[0].Login)
				assert.Equal(t, "user2", resp[1].Login)
			})
	})
}

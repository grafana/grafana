package api

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestShortURLAPIEndpoint(t *testing.T) {
	t.Run("Given a correct request for creating a shortUrl", func(t *testing.T) {
		cmd := dtos.CreateShortURLCmd{
			Path: "d/TxKARsmGz/new-dashboard?orgId=1&from=1599389322894&to=1599410922894",
		}

		createShortURLScenario(t, "When calling POST on", "/api/short-urls", "/api/short-urls", cmd,
			func(sc *scenarioContext) {
				callCreateShortURL(sc)

				shortUrl := dtos.ShortURL{}
				err := json.NewDecoder(sc.resp.Body).Decode(&shortUrl)
				require.NoError(t, err)
				require.Equal(t, 200, sc.resp.Code)
				require.Regexp(t, "/goto/(.+)\\?orgId=(.+)", shortUrl.URL)
			})
	})
}

func callCreateShortURL(sc *scenarioContext) {
	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func createShortURLScenario(t *testing.T, desc string, url string, routePattern string, cmd dtos.CreateShortURLCmd, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		defer bus.ClearBusHandlers()

		sqlStore := sqlstore.InitTestDB(t)
		hs := HTTPServer{
			Cfg: setting.NewCfg(),
			ShortURLService: &shorturls.ShortURLService{
				SQLStore: sqlStore,
			},
			log: log.New("test"),
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			sc.context = c
			sc.context.SignedInUser = &models.SignedInUser{OrgId: testOrgID, UserId: testUserID}

			return hs.createShortURL(c, cmd)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

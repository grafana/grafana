package api

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/queryhistory"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestQueryHistoryEndpoint(t *testing.T) {
	t.Run("Given a correct request for adding to query history", func(t *testing.T) {
		queries, _ := simplejson.NewJson([]byte(`{"DatasourceUid": "N1u6L4eGz", query: "test"}`))
		cmd := dtos.AddToQueryHistoryCmd{
			DatasourceUid: "N1u6L4eGz",
			Queries:       queries,
		}

		createResp := &models.QueryHistory{
			Id:            1,
			DatasourceUid: cmd.DatasourceUid,
			OrgId:         testOrgID,
			CreatedBy:     testUserID,
			CreatedAt:     1,
			Comment:       "",
			Queries:       cmd.Queries,
		}

		service := &fakeQueryHistoryService{
			addToQueryHistoryFunc: func(ctx context.Context, user *models.SignedInUser, queries *simplejson.Json, datasourceUid string) (*models.QueryHistory, error) {
				return createResp, nil
			},
		}

		addToQueryHistoryScenario(t, "When calling POST on", "/api/query-history", "/api/query-history", cmd, service,
			func(sc *scenarioContext) {
				callAddToQueryHistory(sc)
				require.Equal(t, 200, sc.resp.Code)
			})
	})
}

func callAddToQueryHistory(sc *scenarioContext) {
	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func addToQueryHistoryScenario(t *testing.T, desc string, url string, routePattern string, cmd dtos.AddToQueryHistoryCmd, queryHistoryService queryhistory.Service, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		defer bus.ClearBusHandlers()

		hs := HTTPServer{
			Cfg:                 setting.NewCfg(),
			QueryHistoryService: queryHistoryService,
			log:                 log.New("test"),
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			sc.context = c
			sc.context.SignedInUser = &models.SignedInUser{OrgId: testOrgID, UserId: testUserID}

			return hs.addToQueryHistory(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

type fakeQueryHistoryService struct {
	addToQueryHistoryFunc func(ctx context.Context, user *models.SignedInUser, queries *simplejson.Json, datasourceUid string) (*models.QueryHistory, error)
}

func (s *fakeQueryHistoryService) AddToQueryHistory(ctx context.Context, user *models.SignedInUser, queries *simplejson.Json, datasourceUid string) (*models.QueryHistory, error) {
	if s.addToQueryHistoryFunc != nil {
		return s.addToQueryHistoryFunc(ctx, user, queries, datasourceUid)
	}

	return nil, nil
}

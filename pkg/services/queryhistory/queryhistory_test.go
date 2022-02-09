package queryhistory

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

var (
	testOrgID  = int64(1)
	testUserID = int64(1)
)

type scenarioContext struct {
	ctx           *web.Context
	service       *QueryHistoryService
	reqContext    *models.ReqContext
	sqlStore      *sqlstore.SQLStore
	initialResult QueryHistoryResponse
}

func testScenario(t *testing.T, desc string, fn func(t *testing.T, sc scenarioContext)) {
	t.Helper()

	t.Run(desc, func(t *testing.T) {
		ctx := web.Context{Req: &http.Request{
			Header: http.Header{},
		}}
		ctx.Req.Header.Add("Content-Type", "application/json")
		sqlStore := sqlstore.InitTestDB(t)
		service := QueryHistoryService{
			Cfg:      setting.NewCfg(),
			SQLStore: sqlStore,
		}

		service.Cfg.QueryHistoryEnabled = true

		user := models.SignedInUser{
			UserId:     testUserID,
			Name:       "Signed In User",
			Login:      "signed_in_user",
			Email:      "signed.in.user@test.com",
			OrgId:      testOrgID,
			OrgRole:    models.ROLE_VIEWER,
			LastSeenAt: time.Now(),
		}

		_, err := sqlStore.CreateUser(context.Background(), models.CreateUserCommand{
			Email: "signed.in.user@test.com",
			Name:  "Signed In User",
			Login: "signed_in_user",
		})
		require.NoError(t, err)

		sc := scenarioContext{
			ctx:      &ctx,
			service:  &service,
			sqlStore: sqlStore,
			reqContext: &models.ReqContext{
				Context:      &ctx,
				SignedInUser: &user,
			},
		}
		fn(t, sc)
	})
}

func testScenarioWithQueryInQueryHistory(t *testing.T, desc string, fn func(t *testing.T, sc scenarioContext)) {
	t.Helper()

	testScenario(t, desc, func(t *testing.T, sc scenarioContext) {
		command := CreateQueryInQueryHistoryCommand{
			DatasourceUID: "NCzh67i",
			Queries: simplejson.NewFromAny(map[string]interface{}{
				"expr": "test",
			}),
		}
		sc.reqContext.Req.Body = mockRequestBody(command)
		resp := sc.service.createHandler(sc.reqContext)
		sc.initialResult = validateAndUnMarshalResponse(t, resp)
		fn(t, sc)
	})
}

func mockRequestBody(v interface{}) io.ReadCloser {
	b, _ := json.Marshal(v)
	return io.NopCloser(bytes.NewReader(b))
}

func validateAndUnMarshalResponse(t *testing.T, resp response.Response) QueryHistoryResponse {
	t.Helper()

	require.Equal(t, 200, resp.Status())

	var result = QueryHistoryResponse{}
	err := json.Unmarshal(resp.Body(), &result)
	require.NoError(t, err)

	return result
}

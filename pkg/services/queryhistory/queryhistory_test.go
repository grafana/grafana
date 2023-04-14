package queryhistory

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var (
	testOrgID  = int64(1)
	testUserID = int64(1)
	testDsUID1 = "NCzh67i"
	testDsUID2 = "ABch1a1"
)

type scenarioContext struct {
	ctx           *web.Context
	service       *QueryHistoryService
	reqContext    *contextmodel.ReqContext
	sqlStore      db.DB
	initialResult QueryHistoryResponse
}

func testScenario(t *testing.T, desc string, fn func(t *testing.T, sc scenarioContext)) {
	t.Helper()

	t.Run(desc, func(t *testing.T) {
		ctx := web.Context{Req: &http.Request{
			Header: http.Header{},
			Form:   url.Values{},
		}}
		ctx.Req.Header.Add("Content-Type", "application/json")
		sqlStore := db.InitTestDB(t)
		service := QueryHistoryService{
			Cfg:   setting.NewCfg(),
			store: sqlStore,
		}
		service.Cfg.QueryHistoryEnabled = true
		quotaService := quotatest.New(false, nil)
		orgSvc, err := orgimpl.ProvideService(sqlStore, sqlStore.Cfg, quotaService)
		require.NoError(t, err)
		usrSvc, err := userimpl.ProvideService(sqlStore, orgSvc, sqlStore.Cfg, nil, nil, quotaService, &usagestats.UsageStatsMock{}, supportbundlestest.NewFakeBundleService())
		require.NoError(t, err)

		usr := user.SignedInUser{
			UserID:     testUserID,
			Name:       "Signed In User",
			Login:      "signed_in_user",
			Email:      "signed.in.user@test.com",
			OrgID:      testOrgID,
			OrgRole:    org.RoleViewer,
			LastSeenAt: time.Now(),
		}

		_, err = usrSvc.Create(context.Background(), &user.CreateUserCommand{
			Email: "signed.in.user@test.com",
			Name:  "Signed In User",
			Login: "signed_in_user",
		})
		require.NoError(t, err)

		sc := scenarioContext{
			ctx:      &ctx,
			service:  &service,
			sqlStore: sqlStore,
			reqContext: &contextmodel.ReqContext{
				Context:      &ctx,
				SignedInUser: &usr,
			},
		}
		fn(t, sc)
	})
}

func testScenarioWithQueryInQueryHistory(t *testing.T, desc string, fn func(t *testing.T, sc scenarioContext)) {
	t.Helper()

	testScenario(t, desc, func(t *testing.T, sc scenarioContext) {
		command := CreateQueryInQueryHistoryCommand{
			DatasourceUID: testDsUID1,
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

func testScenarioWithMultipleQueriesInQueryHistory(t *testing.T, desc string, fn func(t *testing.T, sc scenarioContext)) {
	t.Helper()

	testScenario(t, desc, func(t *testing.T, sc scenarioContext) {
		command1 := CreateQueryInQueryHistoryCommand{
			DatasourceUID: testDsUID1,
			Queries: simplejson.NewFromAny(map[string]interface{}{
				"expr": "test",
			}),
		}
		sc.reqContext.Req.Body = mockRequestBody(command1)
		resp1 := sc.service.createHandler(sc.reqContext)
		sc.initialResult = validateAndUnMarshalResponse(t, resp1)

		// Add comment
		cmd := PatchQueryCommentInQueryHistoryCommand{Comment: "test comment 2"}
		sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
		sc.reqContext.Req.Body = mockRequestBody(cmd)
		sc.service.patchCommentHandler(sc.reqContext)

		time.Sleep(1 * time.Second)
		command2 := CreateQueryInQueryHistoryCommand{
			DatasourceUID: testDsUID1,
			Queries: simplejson.NewFromAny(map[string]interface{}{
				"expr": "test2",
			}),
		}
		sc.reqContext.Req.Body = mockRequestBody(command2)
		resp2 := sc.service.createHandler(sc.reqContext)
		result2 := validateAndUnMarshalResponse(t, resp2)
		sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result2.Result.UID})
		sc.service.starHandler(sc.reqContext)

		time.Sleep(1 * time.Second)
		command3 := CreateQueryInQueryHistoryCommand{
			DatasourceUID: testDsUID2,
			Queries: simplejson.NewFromAny(map[string]interface{}{
				"expr": "test2",
			}),
		}
		sc.reqContext.Req.Body = mockRequestBody(command3)
		resp3 := sc.service.createHandler(sc.reqContext)
		result3 := validateAndUnMarshalResponse(t, resp3)
		sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": result3.Result.UID})
		sc.service.starHandler(sc.reqContext)

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

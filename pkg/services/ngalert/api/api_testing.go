package api

import (
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"time"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/util"
)

type TestingApiSrv struct {
	*AlertingProxy
	Cfg             *setting.Cfg
	DataService     *tsdb.Service
	DatasourceCache datasources.CacheService
	log             log.Logger
}

func (srv TestingApiSrv) RouteTestReceiverConfig(c *models.ReqContext, body apimodels.ExtendedReceiver) response.Response {
	srv.log.Info("RouteTestReceiverConfig: ", "body", body)
	return response.JSON(http.StatusOK, util.DynMap{"message": "success"})
}

func (srv TestingApiSrv) RouteTestRuleConfig(c *models.ReqContext, body apimodels.TestRulePayload) response.Response {
	recipient := c.Params("Recipient")
	if recipient == apimodels.GrafanaBackend.String() {
		if body.Type() != apimodels.GrafanaBackend || body.GrafanaManagedCondition == nil {
			return response.Error(http.StatusBadRequest, "unexpected payload", nil)
		}
		return conditionEval(c, *body.GrafanaManagedCondition, srv.DatasourceCache, srv.DataService, srv.Cfg)
	}

	if body.Type() != apimodels.LoTexRulerBackend {
		return response.Error(http.StatusBadRequest, "unexpected payload", nil)
	}

	var path string
	if datasourceID, err := strconv.ParseInt(recipient, 10, 64); err == nil {
		ds, err := srv.DatasourceCache.GetDatasource(datasourceID, c.SignedInUser, c.SkipCache)
		if err != nil {
			return response.Error(http.StatusInternalServerError, "failed to get datasource", err)
		}

		switch ds.Type {
		case "loki":
			path = "loki/api/v1/query_range"
		case "prometheus":
			path = "api/v1/query_range"
		default:
			return response.Error(http.StatusBadRequest, fmt.Sprintf("unexpected recipient type %s", ds.Type), nil)
		}
	}

	end := timeNow()
	start := end.Add(-time.Hour)
	queryRangeURL, err := url.Parse(path)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to parse url", err)
	}
	params := queryRangeURL.Query()
	params.Set("query", body.Expr)
	params.Set("start", strconv.FormatInt(start.Unix(), 10))
	params.Set("end", strconv.FormatInt(end.Unix(), 10))
	step := int(math.Max(math.Floor(end.Sub(start).Seconds()/250), 1))
	params.Set("step", strconv.Itoa(step))
	queryRangeURL.RawQuery = params.Encode()
	return srv.withReq(
		c,
		http.MethodGet,
		queryRangeURL,
		nil,
		jsonExtractor(nil),
		nil,
	)
}

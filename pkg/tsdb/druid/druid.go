package druid

import (
	"context"
	"fmt"
	"path"
	"strings"

	"golang.org/x/net/context/ctxhttp"

	"encoding/json"
	"net/http"
	"net/url"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"sync"
)

type DruidExecutor struct {
	*models.DataSource
	httpClient     *http.Client
	QueryParser    *DruidQueryParser
	ResponseParser *DruidResponseParser
	mux            sync.Mutex
}

func NewDruidExecutor(datasource *models.DataSource) (tsdb.Executor, error) {
	httpClient, err := datasource.GetHttpClient()

	if err != nil {
		return nil, err
	}

	return &DruidExecutor{
		DataSource:     datasource,
		httpClient:     httpClient,
		QueryParser:    &DruidQueryParser{},
		ResponseParser: &DruidResponseParser{},
	}, nil
}

var (
	plog log.Logger
)

func init() {
	plog = log.New("tsdb.druid")
	tsdb.RegisterExecutor("abhisant-druid-datasource", NewDruidExecutor)
}

func (e *DruidExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, queryContext *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}

	queryModel := queries[0].Model

	if setting.Env == setting.DEV {
		plog.Debug("Druid request", "params", queryModel)
	}

	req, err := e.createRequest(queryModel, queryContext)
	if err != nil {
		result.Error = err
		return result
	}

	res, err := ctxhttp.Do(ctx, e.httpClient, req)
	if err != nil {
		result.Error = err
		return result
	}

	queryResult, err := e.ResponseParser.ParseResponse(res, queryModel)
	if err != nil {
		result.Error = err
		return result
	}

	result.QueryResults = queryResult
	return result
}

func (e *DruidExecutor) createRequest(data *simplejson.Json, queryContext *tsdb.QueryContext) (*http.Request, error) {
	u, _ := url.Parse(e.DataSource.Url)
	u.Path = path.Join(u.Path, "/druid/v2")

	// Preprocessing data to match Druid syntax
	e.QueryParser.ParseQuery(data, queryContext)

	postData, err := json.Marshal(data)

	plog.Debug("Post data is: " + string(postData))
	req, err := http.NewRequest(http.MethodPost, u.String(), strings.NewReader(string(postData)))

	if err != nil {
		plog.Info("Failed to create request", "error", err)
		return nil, fmt.Errorf("Failed to create request. error: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if e.BasicAuth {
		req.SetBasicAuth(e.BasicAuthUser, e.BasicAuthPassword)
	}

	return req, err
}

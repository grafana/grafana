package elasticsearch

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

type ElasticsearchExecutor struct{}

var (
	glog               log.Logger
	intervalCalculator tsdb.IntervalCalculator
)

func NewElasticsearchExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	return &ElasticsearchExecutor{}, nil
}

func init() {
	glog = log.New("tsdb.elasticsearch")
	tsdb.RegisterTsdbQueryEndpoint("elasticsearch", NewElasticsearchExecutor)
	intervalCalculator = tsdb.NewIntervalCalculator(&tsdb.IntervalOptions{MinInterval: time.Millisecond * 1})
}

func (e *ElasticsearchExecutor) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	if len(tsdbQuery.Queries) == 0 {
		return nil, fmt.Errorf("query contains no queries")
	}

	return e.executeTimeSeriesQuery(ctx, dsInfo, tsdbQuery)
}

func (e *ElasticsearchExecutor) createRequest(dsInfo *models.DataSource, query string) (*http.Request, error) {
	u, _ := url.Parse(dsInfo.Url)
	u.Path = path.Join(u.Path, "_msearch")
	req, err := http.NewRequest(http.MethodPost, u.String(), strings.NewReader(query))
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Grafana")
	req.Header.Set("Content-Type", "application/json")

	if dsInfo.BasicAuth {
		req.SetBasicAuth(dsInfo.BasicAuthUser, dsInfo.BasicAuthPassword)
	}

	if !dsInfo.BasicAuth && dsInfo.User != "" {
		req.SetBasicAuth(dsInfo.User, dsInfo.Password)
	}

	glog.Debug("Elasticsearch request", "url", req.URL.String())
	glog.Debug("Elasticsearch request", "body", query)
	return req, nil
}

package opentsdb

import (
	"context"
	"crypto/tls"
	"fmt"
	"path"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/context/ctxhttp"

	"io/ioutil"
	"net/http"
	"net/url"
	"net/http/httputil"
	"encoding/json"

	"gopkg.in/guregu/null.v3"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
)

type OpenTsdbExecutor struct {
	*tsdb.DataSourceInfo
}

func NewOpenTsdbExecutor(dsInfo *tsdb.DataSourceInfo) tsdb.Executor {
	return &OpenTsdbExecutor{dsInfo}
}

var (
	plog       log.Logger
	HttpClient *http.Client
)

func init() {
	plog = log.New("tsdb.opentsdb")
	tsdb.RegisterExecutor("opentsdb", NewOpenTsdbExecutor)

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	HttpClient = &http.Client{
		Timeout:   time.Duration(15 * time.Second),
		Transport: tr,
	}
}

func (e *OpenTsdbExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, queryContext *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}

	var tsdbQuery OpenTsdbQuery

	tsdbQuery.Start = queryContext.TimeRange.GetFromAsMsEpoch()
	tsdbQuery.End = queryContext.TimeRange.GetToAsMsEpoch()
	tsdbQuery.Queries = make([]map[string]interface{}, len(queries))

  for i := 0; i < len(queries); i++ {

		metric := make(map[string]interface{})
		
		metric["metric"] = queries[i].Model.Get("metric").MustString()
		metric["aggregator"] = queries[i].Model.Get("aggregator").MustString()

		disableDownsampling := queries[i].Model.Get("disableDownsampling").MustBool()

		if !disableDownsampling {
			downsampleInterval := queries[i].Model.Get("downsampleInterval").MustString()			
			if downsampleInterval == "" {
				downsampleInterval = "1m"  //default value for blank
			}
			downsample :=  downsampleInterval + "-" + queries[i].Model.Get("downsampleAggregator").MustString()
			if queries[i].Model.Get("downsampleFillPolicy").MustString() != "none" {
				metric["downsample"] = downsample + "-" + queries[i].Model.Get("downsampleFillPolicy").MustString()
			}
		}

		tsdbQuery.Queries[i] = metric
	}

	if setting.Env == setting.DEV {
		plog.Debug("OpenTsdb request", "params", tsdbQuery)
	}

	req, err := e.createRequest(tsdbQuery)
	if err != nil {
		result.Error = err
		return result
	}

	res, err := ctxhttp.Do(ctx, HttpClient, req)
	if err != nil {
		result.Error = err
		return result
	}

	queryResult, err := e.parseResponse(tsdbQuery, res)
	if err != nil {
		return result.WithError(err)
	}

	result.QueryResults = queryResult
	return result
}

func (e *OpenTsdbExecutor) createRequest(data OpenTsdbQuery) (*http.Request, error) {
	u, _ := url.Parse(e.Url)
	u.Path = path.Join(u.Path, "api/query")

	postData, err := json.Marshal(data)

	req, err := http.NewRequest(http.MethodPost, u.String(), strings.NewReader(string(postData)))
	if err != nil {
		plog.Info("Failed to create request", "error", err)
		return nil, fmt.Errorf("Failed to create request. error: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if e.BasicAuth {
		req.SetBasicAuth(e.BasicAuthUser, e.BasicAuthPassword)
	}

	
	  requestDump, err := httputil.DumpRequest(req, true)
	  if err != nil {
	    fmt.Println(err)
	  }
	  fmt.Println(string(requestDump))
	
	return req, err
}

func (e *OpenTsdbExecutor) parseResponse(query OpenTsdbQuery, res *http.Response) (map[string]*tsdb.QueryResult, error) {

	queryResults := make(map[string]*tsdb.QueryResult)
	queryRes := tsdb.NewQueryResult()

	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		return nil, err
	}

	if res.StatusCode/100 != 2 {
		plog.Info("Request failed", "status", res.Status, "body", string(body))
		return nil, fmt.Errorf("Request failed status: %v", res.Status)
	}

	var data []OpenTsdbResponse
	err = json.Unmarshal(body, &data)
	if err != nil {
		plog.Info("Failed to unmarshal opentsdb response", "error", err, "status", res.Status, "body", string(body))
		return nil, err
	}

	for _, val := range data {
		series := tsdb.TimeSeries{
			Name: val.Metric,
		}

		for timeString, value := range val.DataPoints {
			timestamp, err := strconv.ParseFloat(timeString, 64)
			if err != nil {
				plog.Info("Failed to unmarshal opentsdb timestamp", "timestamp", timeString)
				return nil, err
			}
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(value), timestamp))
		}

		queryRes.Series = append(queryRes.Series, &series)
	}

	queryResults["A"] = queryRes
	return queryResults, nil
}

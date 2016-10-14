package opentsdb

import (
  "fmt"
  "path"
  "strings"
  "context"
  "strconv"

  "net/url"
  "net/http"
  "io/ioutil"
  //"net/http/httputil"
  "encoding/json"

  "gopkg.in/guregu/null.v3"

	"github.com/grafana/grafana/pkg/log"
 	"github.com/grafana/grafana/pkg/tsdb"
  "github.com/grafana/grafana/pkg/setting"
)

type OpenTsdbExecutor struct {
	*tsdb.DataSourceInfo
}

func NewOpenTsdbExecutor(dsInfo *tsdb.DataSourceInfo) tsdb.Executor {
	return &OpenTsdbExecutor{dsInfo}
}

var (
	plog       log.Logger
	HttpClient http.Client
)

func init() {
	plog = log.New("tsdb.opentsdb")
	tsdb.RegisterExecutor("opentsdb", NewOpenTsdbExecutor)
}

func (e *OpenTsdbExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, queryContext *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}

  var tsdbQuery OpenTsdbQuery

  tsdbQuery.Start = queryContext.TimeRange.GetFromAsMsEpoch()
  tsdbQuery.End = queryContext.TimeRange.GetToAsMsEpoch()

  for _, query := range queries {
    tsdbQuery.Queries = []OpenTsdbMetric {
      OpenTsdbMetric{
        Metric:      query.Model.Get("metric").MustString(),
        Aggregator:  query.Model.Get("aggregator").MustString(),
      },
    }
  }

  if setting.Env == setting.DEV {
    plog.Debug("OpenTsdb request", "params", tsdbQuery)
  }

  req, err := e.createRequest(tsdbQuery)
  if err != nil {
    result.Error = err
    return result
  }

  res, err := HttpClient.Do(req)
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

  /*
  requestDump, err := httputil.DumpRequest(req, true)
  if err != nil {
    fmt.Println(err)
  }
  fmt.Println(string(requestDump))
  */
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

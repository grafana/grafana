package dashbase

import (
  "net/http"
  "github.com/grafana/grafana/pkg/models"
  "github.com/grafana/grafana/pkg/tsdb"
  "github.com/grafana/grafana/pkg/log"
  "errors"
  "context"
  "golang.org/x/net/context/ctxhttp"
  "net/url"
  "io/ioutil"
  "fmt"
  "path"
  "strings"
  "github.com/grafana/grafana/pkg/components/simplejson"
  "github.com/grafana/grafana/pkg/components/null"
)

type DashbaseExecutor struct {
  *models.DataSource
  HttpClient *http.Client
}

func NewDashbaseExecutor(datasource *models.DataSource) (tsdb.Executor, error) {
  httpClient, err := datasource.GetHttpClient()

  if err != nil {
    return nil, err
  }

  return &DashbaseExecutor{
    DataSource: datasource,
    HttpClient: httpClient,
  }, nil
}

var (
  glog log.Logger
)

func init() {
  glog = log.New("tsdb.dashbase")
  tsdb.RegisterExecutor("dashbase-datasource", NewDashbaseExecutor)
}

func (e *DashbaseExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, context *tsdb.QueryContext) *tsdb.BatchResult {
  result := &tsdb.BatchResult{}
  if len(queries) == 0 {
    err := errors.New("query is empty")
    return result.WithError(err)
  }

  req, err := e.createRequest(queries[0], context.TimeRange.GetFromAsMsEpoch(), context.TimeRange.GetToAsMsEpoch())
  if err != nil {
    result.Error = err
    return result
  }

  if len(queries) > 1 {
    glog.Warn("Dashbase Alert Execute query more than one")
  }

  res, err := ctxhttp.Do(ctx, e.HttpClient, req)
  if err != nil {
    result.Error = err
    return result
  }
  data, err := e.parseResponse(res)
  if err != nil {
    result.Error = err
    return result
  }
  result.QueryResults = make(map[string]*tsdb.QueryResult)
  queryRes := tsdb.NewQueryResult()
  for _, series := range data {
    queryRes.Series = append(queryRes.Series, &tsdb.TimeSeries{
      Name:   series.Target,
      Points: series.DataPoints,
    })
  }

  result.QueryResults["A"] = queryRes
  return result
}

func (e *DashbaseExecutor) createRequest(query *tsdb.Query, timeFrom int64, timeTo int64) (*http.Request, error) {

  u, _ := url.Parse(e.Url)
  u.Path = path.Join(u.Path, "v1/sql")
  req, err := http.NewRequest(http.MethodGet, u.String(), nil)
  if err != nil {
    glog.Info("Failed to create request", "error", err)
    return nil, fmt.Errorf("Failed to create request. error: %v", err)
  }

  sql := ""

  if value, err := query.Model.Get("target").String(); err == nil {
    sql += fmt.Sprintf("SELECT %s ", value)
    if alias, err := query.Model.Get("alias").String(); err == nil {
      sql += fmt.Sprintf("AS \"%s\" ", alias)
    }
  }

  if value, err := query.Model.Get("from").String(); err == nil {
    sql += fmt.Sprintf("FROM %s ", value)
  }

  if value, err := query.Model.Get("query").String(); err == nil {
    sql += fmt.Sprintf("WHERE %s ", value)
  }

  sql += fmt.Sprintf("BEFORE %d AFTER %d ", timeTo / 1000 , timeFrom / 1000)

  if value, err := query.Model.Get("limit").String(); err == nil {
    sql += fmt.Sprintf("LIMIT %s ", value)
  }

  params := req.URL.Query()
  params.Set("sql", sql)
  //
  req.URL.RawQuery = strings.Replace(params.Encode(), "+", "%20", -1)

  req.Header.Set("User-Agent", "Grafana")

  // set Basic Auth
  if e.BasicAuth {
    req.SetBasicAuth(e.BasicAuthUser, e.BasicAuthPassword)
  }
  if !e.BasicAuth && e.User != "" {
    req.SetBasicAuth(e.User, e.Password)
  }

  glog.Debug("Dashbase request", "url", req.URL.String())
  return req, nil
}

func (e *DashbaseExecutor) parseResponse(res *http.Response) ([]DashbaseResponsePoint, error) {
  body, err := ioutil.ReadAll(res.Body)
  defer res.Body.Close()
  if err != nil {
    return nil, err
  }
  if res.StatusCode/100 != 2 {
    glog.Info("Request failed", "status", res.Status, "body", string(body))
    return nil, fmt.Errorf("Request failed status: %v\n%s", res.Status, string(body))
  }
  data, err := simplejson.NewJson(body)
  if err != nil {
    return nil, err
  }
  aggregations, err := data.Get("aggregations").Map()
  if err != nil {
    return nil, err
  }
  var result []DashbaseResponsePoint
  for key:= range aggregations{
    aggregation := data.Get("aggregations").Get(key)
    Type := aggregation.Get("responseType").MustString("")
    if Type == ""{
      glog.Info("parseResponse failed", "status", res.Status, "body", string(body))
      return nil, fmt.Errorf("parseResponse failed :%s", string(body))
    }

    if Type == "tsa" {
      var series tsdb.TimeSeriesPoints

      for _, k := range aggregation.Get("buckets").MustArray() {
        out := simplejson.New()
        out.Set("node", k)
        value := out.Get("node").Get("response").Get("value").MustFloat64(0)
        timestamp := out.Get("node").Get("timeInSec").MustFloat64(0)
        series = append(series, tsdb.NewTimePoint(null.FloatFrom(value), timestamp*1000))
      }
      result = append(result, DashbaseResponsePoint{
        Target: key,
        DataPoints: series,
        //DataPoints: tsdb.NewTimeSeriesPointsFromArgs(out.Get("response").Get("value").MustFloat64(0)),
      })
    }

  }



  return result, nil
  //return data, nil
}

// target = this.response.data.aggregations[Object.keys(this.response.data.aggregations)[0]];
// if (!target) {
//   this.response.data = []; // no aggregation response, likely due to no data within timerange
//   return this.response;
// }
// // NUMERIC RESPONSE
// if (target.responseType == "numeric") {
//   dataArr.push({
//     "target": sentTargets[0].alias,
//     "datapoints": [[target.value, ""]]
//   });
// }
//
// // TS RESPONSE
// if (target.responseType == "ts" && target.histogramBuckets) {
//   let buckets = target.histogramBuckets;
//   dataArr.push({
//     "target": sentTargets[0].alias,
//     "datapoints": _.map(buckets, bucket => {
//       return [bucket.count, bucket.timeInSec * 1000];
//     })
//   });
// }
//
// // NESTED TS AGGREGATION RESPONSE
// if (target.responseType == "tsa" && target.buckets) {
//   let buckets = target.buckets;
//   dataArr.push({
//     "target": sentTargets[0].alias,
//     "datapoints": _.map(buckets, bucket => {
//       let value = bucket.count;
//       if (bucket.hasOwnProperty("response")) {
//         // parse response types
//         value = bucket.response.value;
//       }
//       return [value, bucket.timeInSec * 1000];
//     })
//   });
// }

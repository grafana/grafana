package elasticsearch

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"strconv"
	"strings"
	"time"

	"net/http"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/leibowitz/moment"
)

var (
	eslog log.Logger
)

type ElasticsearchExecutor struct {
	*models.DataSource
	HttpClient *http.Client
}

func NewElasticsearchExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	client, err := dsInfo.GetHttpClient()
	if err != nil {
		return nil, err
	}

	return &ElasticsearchExecutor{
		DataSource: dsInfo,
		HttpClient: client,
	}, nil
}

func init() {
	eslog = log.New("tsdb.elasticsearch")
	tsdb.RegisterTsdbQueryEndpoint("elasticsearch", NewElasticsearchExecutor)
}

func getIndex(pattern string, interval string, timeRange *tsdb.TimeRange) string {
	if interval == "" {
		return pattern
	}

	indexes := []string{}
	indexParts := strings.Split(strings.TrimLeft(pattern, "["), "]")
	indexBase := indexParts[0]
	if len(indexParts) <= 1 {
		return pattern
	}
	indexDateFormat := indexParts[1]

	type TimeOperation struct {
		StartOf   func(*moment.Moment) *moment.Moment
		Operation func(*moment.Moment) *moment.Moment
	}

	operations := map[string]TimeOperation{
		"Hourly": {
			StartOf:   func(m *moment.Moment) *moment.Moment { return m.StartOf("hour") },
			Operation: func(m *moment.Moment) *moment.Moment { return m.AddHours(1) },
		},
		"Daily": {
			StartOf:   func(m *moment.Moment) *moment.Moment { return m.StartOfDay() },
			Operation: func(m *moment.Moment) *moment.Moment { return m.AddDay() },
		},
		"Weekly": {
			StartOf:   func(m *moment.Moment) *moment.Moment { return m.StartOfWeek() },
			Operation: func(m *moment.Moment) *moment.Moment { return m.AddWeeks(1) },
		},
		"Monthly": {
			StartOf:   func(m *moment.Moment) *moment.Moment { return m.StartOfMonth() },
			Operation: func(m *moment.Moment) *moment.Moment { return m.AddMonths(1) },
		},
		"Yearly": {
			StartOf:   func(m *moment.Moment) *moment.Moment { return m.StartOfYear() },
			Operation: func(m *moment.Moment) *moment.Moment { return m.AddYears(1) },
		},
	}

	if _, ok := operations[interval]; !ok {
		eslog.Error("Unknown ElasticSearch Interval: %s", interval)
		return pattern
	}

	start := operations[interval].StartOf(moment.NewMoment(timeRange.MustGetFrom()).UTC())
	end := operations[interval].StartOf(moment.NewMoment(timeRange.MustGetTo()).UTC())

	indexes = append(indexes, fmt.Sprintf("%s%s", indexBase, start.UTC().Format(indexDateFormat)))
	for start.IsBefore(*end) {
		start = operations[interval].Operation(start)
		indexes = append(indexes, fmt.Sprintf("%s%s", indexBase, start.UTC().Format(indexDateFormat)))
	}
	return strings.Join(indexes, ",")
}

func (e *ElasticsearchExecutor) buildRequest(queryInfo *tsdb.Query, timeRange *tsdb.TimeRange) (*http.Request, error) {
	indexInterval, err := queryInfo.DataSource.JsonData.Get("interval").String()
	if err != nil {
		return nil, err
	}
	index := getIndex(queryInfo.DataSource.Database, indexInterval, timeRange)

	esRequestURL := fmt.Sprintf("%s/%s/_search", queryInfo.DataSource.Url, index)

	if queryInfo.Model == nil {
		return nil, fmt.Errorf("Invalid (nil) ES Request Model Provided!")
	}

	esRequestModel := &RequestModel{}
	rawModel, err := queryInfo.Model.MarshalJSON()
	if err != nil {
		return nil, err
	}

	err = json.Unmarshal(rawModel, esRequestModel)
	if err != nil {
		return nil, err
	}

	esRequestJSON, err := esRequestModel.buildQueryJSON(timeRange)
	if err != nil {
		return nil, err
	}

	calculator := tsdb.NewIntervalCalculator(&tsdb.IntervalOptions{})
	interval := calculator.Calculate(timeRange, time.Millisecond*1)

	esRequestJSON = strings.Replace(esRequestJSON, "$interval", interval.Text, 1)
	esRequestJSON = strings.Replace(esRequestJSON, "$__interval_ms", strconv.FormatInt(interval.Value.Nanoseconds()/int64(time.Millisecond), 10), 1)
	esRequestJSON = strings.Replace(esRequestJSON, "$__interval", interval.Text, 1)

	reader := strings.NewReader(esRequestJSON)
	req, err := http.NewRequest("GET", esRequestURL, reader)
	if err != nil {
		return nil, err
	}

	if queryInfo.DataSource.BasicAuth {
		req.SetBasicAuth(queryInfo.DataSource.BasicAuthUser, queryInfo.DataSource.BasicAuthPassword)
	}

	return req, nil
}

func (e *ElasticsearchExecutor) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{}
	result.Results = make(map[string]*tsdb.QueryResult)

	if tsdbQuery == nil {
		return nil, fmt.Errorf("Nil Context provided to ElasticsearchExecutor")
	}

	for _, q := range tsdbQuery.Queries {
		if q.DataSource == nil {
			return nil, fmt.Errorf("Invalid (nil) DataSource Provided")
		}

		if q.DataSource.JsonData == nil {
			return nil, fmt.Errorf("Invalid (nil) JsonData Provided")
		}

		esRequest, err := e.buildRequest(q, tsdbQuery.TimeRange)
		if err != nil {
			return nil, err
		}

		resp, err := e.HttpClient.Do(esRequest)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		rBody, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("Failed to read response body (%s): %s", strconv.Quote(string(rBody)), err)
		}

		if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("Failed to get metrics: %s (%s)", strconv.Quote(string(rBody)), resp.Status)
		}

		result.Results[q.RefId], err = parseQueryResult(rBody, getPreferredNamesForQueries(q), getFilteredMetrics(q))
		if err != nil {
			return nil, err
		}

		result.Results[q.RefId].RefId = q.RefId
	}

	return result, nil
}

func getPreferredNamesForQueries(query *tsdb.Query) NameMap {
	names := NameMap{}
	alias := query.Model.Get("alias").MustString("")

	esRequestModel := &RequestModel{}
	rawModel, err := query.Model.MarshalJSON()
	if err != nil {
		return names
	}

	err = json.Unmarshal(rawModel, esRequestModel)
	if err != nil {
		return names
	}

	for _, metric := range esRequestModel.Metrics {
		if alias != "" {
			names[metric.ID] = Name{
				Value: alias,
			}
		} else {
			names[metric.ID] = metric.GetName()
		}
	}

	return names
}

func getFilteredMetrics(query *tsdb.Query) FilterMap {
	filters := FilterMap{}

	esRequestModel := &RequestModel{}
	rawModel, err := query.Model.MarshalJSON()
	if err != nil {
		return filters
	}

	err = json.Unmarshal(rawModel, esRequestModel)
	if err != nil {
		return filters
	}

	for _, metric := range esRequestModel.Metrics {
		filters[metric.ID] = metric.Hide
	}

	return filters
}

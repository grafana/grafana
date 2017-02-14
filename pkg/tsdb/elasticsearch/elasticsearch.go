package elasticsearch

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"strconv"
	"strings"

	"net/http"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

var (
	eslog log.Logger
)

type ElasticsearchExecutor struct {
	*models.DataSource
	HttpClient *http.Client
}

func NewElasticsearchExecutor(dsInfo *models.DataSource) (tsdb.Executor, error) {
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
	tsdb.RegisterExecutor("elasticsearch", NewElasticsearchExecutor)
}

func getIndex(pattern string, interval string) string {
	if interval == "" {
		return pattern
	}

	return fmt.Sprintf("%s*", strings.Split(strings.TrimLeft(pattern, "["), "]")[0])
}

func (e *ElasticsearchExecutor) buildRequest(queryInfo *tsdb.Query, timeRange *tsdb.TimeRange) (*http.Request, error) {
	interval, err := queryInfo.DataSource.JsonData.Get("interval").String()
	if err != nil {
		return nil, err
	}
	index := getIndex(queryInfo.DataSource.Database, interval)

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

func (e *ElasticsearchExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, context *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}
	result.QueryResults = make(map[string]*tsdb.QueryResult)

	if context == nil {
		return result.WithError(fmt.Errorf("Nil Context provided to ElasticsearchExecutor"))
	}

	for _, q := range context.Queries {
		if q.DataSource == nil {
			return result.WithError(fmt.Errorf("Invalid (nil) DataSource Provided"))
		}

		if q.DataSource.JsonData == nil {
			return result.WithError(fmt.Errorf("Invalid (nil) JsonData Provided"))
		}

		esVersion, err := q.DataSource.JsonData.Get("esVersion").Int()
		if err != nil {
			return result.WithError(err)
		}

		if esVersion != 2 {
			return result.WithError(fmt.Errorf("Elasticsearch v%d not currently supported!", esVersion))
		}

		esRequest, err := e.buildRequest(q, context.TimeRange)
		if err != nil {
			return result.WithError(err)
		}

		resp, err := e.HttpClient.Do(esRequest)
		if err != nil {
			return result.WithError(err)
		}
		defer resp.Body.Close()

		rBody, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			return result.WithError(fmt.Errorf("Failed to read response body (%s): %s", strconv.Quote(string(rBody)), err))
		}

		if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
			return result.WithError(fmt.Errorf("Failed to get metrics: %s (%s)", strconv.Quote(string(rBody)), resp.Status))
		}

		result.QueryResults[q.RefId], err = parseQueryResult(rBody, getPreferredNamesForQueries(q))
		if err != nil {
			return result.WithError(err)
		}

		result.QueryResults[q.RefId].RefId = q.RefId
	}

	return result
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

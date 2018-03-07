package mqe

import (
	"context"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"

	"golang.org/x/net/context/ctxhttp"
)

var (
	MaxWorker int = 4
)

type apiClient struct {
	*models.DataSource
	log            log.Logger
	httpClient     *http.Client
	responseParser *ResponseParser
}

func NewApiClient(httpClient *http.Client, datasource *models.DataSource) *apiClient {
	return &apiClient{
		DataSource:     datasource,
		log:            log.New("tsdb.mqe"),
		httpClient:     httpClient,
		responseParser: NewResponseParser(),
	}
}

func (e *apiClient) PerformRequests(ctx context.Context, queries []QueryToSend) (*tsdb.QueryResult, error) {
	queryResult := &tsdb.QueryResult{}

	queryCount := len(queries)
	jobsChan := make(chan QueryToSend, queryCount)
	resultChan := make(chan []*tsdb.TimeSeries, queryCount)
	errorsChan := make(chan error, 1)
	for w := 1; w <= MaxWorker; w++ {
		go e.spawnWorker(ctx, w, jobsChan, resultChan, errorsChan)
	}

	for _, v := range queries {
		jobsChan <- v
	}
	close(jobsChan)

	resultCounter := 0
	for {
		select {
		case timeseries := <-resultChan:
			queryResult.Series = append(queryResult.Series, timeseries...)
			resultCounter++

			if resultCounter == queryCount {
				close(resultChan)
				return queryResult, nil
			}
		case err := <-errorsChan:
			return nil, err
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
}

func (e *apiClient) spawnWorker(ctx context.Context, id int, jobs chan QueryToSend, results chan []*tsdb.TimeSeries, errors chan error) {
	e.log.Debug("Spawning worker", "id", id)
	for query := range jobs {
		if setting.Env == setting.DEV {
			e.log.Debug("Sending request", "query", query.RawQuery)
		}

		req, err := e.createRequest(query.RawQuery)

		resp, err := ctxhttp.Do(ctx, e.httpClient, req)
		if err != nil {
			errors <- err
			return
		}

		series, err := e.responseParser.Parse(resp, query)
		if err != nil {
			errors <- err
			return
		}

		results <- series
	}
	e.log.Debug("Worker is complete", "id", id)
}

func (e *apiClient) createRequest(query string) (*http.Request, error) {
	u, err := url.Parse(e.Url)
	if err != nil {
		return nil, err
	}

	u.Path = path.Join(u.Path, "query")

	payload := simplejson.New()
	payload.Set("query", query)

	jsonPayload, err := payload.MarshalJSON()
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, u.String(), strings.NewReader(string(jsonPayload)))
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", "Grafana")
	req.Header.Set("Content-Type", "application/json")

	if e.BasicAuth {
		req.SetBasicAuth(e.BasicAuthUser, e.BasicAuthPassword)
	}

	return req, nil
}

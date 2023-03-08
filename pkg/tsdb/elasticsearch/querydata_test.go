package elasticsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/Masterminds/semver"
	"github.com/grafana/grafana-plugin-sdk-go/backend"

	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

type queryDataTestRoundTripper struct {
	requestCallback func(req *http.Request) error
	body            []byte
	statusCode      int
}

// we fake the http-request-call. we return a fixed byte-array (defined by the test snapshot),
// and we also check if the http-request-object has the correct data
func (rt *queryDataTestRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	err := rt.requestCallback(req)
	if err != nil {
		return nil, err
	}

	return &http.Response{
		StatusCode: rt.statusCode,
		Header:     http.Header{},
		Body:       io.NopCloser(bytes.NewReader(rt.body)),
	}, nil
}

// we setup a fake datasource-info
func newFlowTestDsInfo(body []byte, statusCode int, requestCallback func(req *http.Request) error) *es.DatasourceInfo {
	client := http.Client{
		Transport: &queryDataTestRoundTripper{body: body, statusCode: statusCode, requestCallback: requestCallback},
	}

	configuredFields := es.ConfiguredFields{
		TimeField:       "testtime",
		LogMessageField: "line",
		LogLevelField:   "lvl",
	}

	return &es.DatasourceInfo{
		ESVersion:                  semver.MustParse("8.5.0"),
		Interval:                   "Daily",
		Database:                   "[testdb-]YYYY.MM.DD",
		ConfiguredFields:           configuredFields,
		TimeInterval:               "1s",
		URL:                        "http://localhost:9200",
		HTTPClient:                 &client,
		MaxConcurrentShardRequests: 42,
		IncludeFrozen:              false,
		XPack:                      true,
	}
}

type queryDataTestQueryJSON struct {
	IntervalMs    int64
	Interval      time.Duration
	MaxDataPoints int64
	RefID         string
}

// we take an array of json-bytes, that define the elastic queries,
// and create full backend.DataQuery objects from them
func newFlowTestQueries(allJsonBytes []byte) ([]backend.DataQuery, error) {
	timeRange := backend.TimeRange{
		From: time.UnixMilli(1668422437218),
		To:   time.UnixMilli(1668422625668),
	}

	// we will need every separate query-item as a json-byte-array later,
	// so we only decode the "array", and keep the "items" undecoded.
	var jsonBytesArray []json.RawMessage

	err := json.Unmarshal(allJsonBytes, &jsonBytesArray)
	if err != nil {
		return nil, fmt.Errorf("error unmarshaling query-json: %w", err)
	}

	var queries []backend.DataQuery

	for _, jsonBytes := range jsonBytesArray {
		// we need to extract some fields from the json-array
		var jsonInfo queryDataTestQueryJSON
		err = json.Unmarshal(jsonBytes, &jsonInfo)
		if err != nil {
			return nil, err
		}
		// we setup the DataQuery, with values loaded from the json
		query := backend.DataQuery{
			RefID:         jsonInfo.RefID,
			MaxDataPoints: jsonInfo.MaxDataPoints,
			Interval:      jsonInfo.Interval,
			TimeRange:     timeRange,
			JSON:          jsonBytes,
		}
		queries = append(queries, query)
	}
	return queries, nil
}

type queryDataTestResult struct {
	response     *backend.QueryDataResponse
	requestBytes []byte
}

func queryDataTestWithResponseCode(queriesBytes []byte, responseStatusCode int, responseBytes []byte) (queryDataTestResult, error) {
	queries, err := newFlowTestQueries(queriesBytes)
	if err != nil {
		return queryDataTestResult{}, err
	}

	requestBytesStored := false
	var requestBytes []byte

	dsInfo := newFlowTestDsInfo(responseBytes, responseStatusCode, func(req *http.Request) error {
		requestBytes, err = io.ReadAll(req.Body)

		bodyCloseError := req.Body.Close()

		if err != nil {
			return err
		}

		if bodyCloseError != nil {
			return bodyCloseError
		}

		requestBytesStored = true
		return nil
	})

	result, err := queryData(context.Background(), queries, dsInfo)
	if err != nil {
		return queryDataTestResult{}, err
	}

	if !requestBytesStored {
		return queryDataTestResult{}, fmt.Errorf("request-bytes not stored")
	}

	return queryDataTestResult{
		response:     result,
		requestBytes: requestBytes,
	}, nil
}

func queryDataTest(queriesBytes []byte, responseBytes []byte) (queryDataTestResult, error) {
	return queryDataTestWithResponseCode(queriesBytes, 200, responseBytes)
}

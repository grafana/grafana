package resourcegraph

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/errorsource"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/loganalytics"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/macros"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

// AzureResourceGraphResponse is the json response object from the Azure Resource Graph Analytics API.
type AzureResourceGraphResponse struct {
	Data types.AzureResponseTable `json:"data"`
}

// AzureResourceGraphDatasource calls the Azure Resource Graph API's
type AzureResourceGraphDatasource struct {
	Proxy  types.ServiceProxy
	Logger log.Logger
}

// AzureResourceGraphQuery is the query request that is built from the saved values for
// from the UI
type AzureResourceGraphQuery struct {
	RefID             string
	ResultFormat      string
	URL               string
	JSON              json.RawMessage
	InterpolatedQuery string
	TimeRange         backend.TimeRange
	QueryType         string
}

const ArgAPIVersion = "2021-06-01-preview"
const argQueryProviderName = "/providers/Microsoft.ResourceGraph/resources"

func (e *AzureResourceGraphDatasource) ResourceRequest(rw http.ResponseWriter, req *http.Request, cli *http.Client) (http.ResponseWriter, error) {
	return e.Proxy.Do(rw, req, cli)
}

// executeTimeSeriesQuery does the following:
// 1. builds the AzureMonitor url and querystring for each query
// 2. executes each query by calling the Azure Monitor API
// 3. parses the responses for each query into data frames
func (e *AzureResourceGraphDatasource) ExecuteTimeSeriesQuery(ctx context.Context, originalQueries []backend.DataQuery, dsInfo types.DatasourceInfo, client *http.Client, url string, fromAlert bool) (*backend.QueryDataResponse, error) {
	result := &backend.QueryDataResponse{
		Responses: map[string]backend.DataResponse{},
	}

	for _, query := range originalQueries {
		graphQuery, err := e.buildQuery(query, dsInfo)
		if err != nil {
			return nil, err
		}
		res, err := e.executeQuery(ctx, graphQuery, dsInfo, client, url)
		if err != nil {
			errorsource.AddErrorToResponse(query.RefID, result, err)
			continue
		}
		result.Responses[query.RefID] = *res
	}

	return result, nil
}

type argJSONQuery struct {
	AzureResourceGraph struct {
		Query        string `json:"query"`
		ResultFormat string `json:"resultFormat"`
	} `json:"azureResourceGraph"`
}

func (e *AzureResourceGraphDatasource) buildQuery(query backend.DataQuery, dsInfo types.DatasourceInfo) (*AzureResourceGraphQuery, error) {
	queryJSONModel := argJSONQuery{}
	err := json.Unmarshal(query.JSON, &queryJSONModel)
	if err != nil {
		return nil, fmt.Errorf("failed to decode the Azure Resource Graph query object from JSON: %w", err)
	}

	azureResourceGraphTarget := queryJSONModel.AzureResourceGraph

	resultFormat := azureResourceGraphTarget.ResultFormat
	if resultFormat == "" {
		resultFormat = "table"
	}

	interpolatedQuery, err := macros.KqlInterpolate(query, dsInfo, azureResourceGraphTarget.Query)
	if err != nil {
		return nil, err
	}

	return &AzureResourceGraphQuery{
		RefID:             query.RefID,
		ResultFormat:      resultFormat,
		JSON:              query.JSON,
		InterpolatedQuery: interpolatedQuery,
		TimeRange:         query.TimeRange,
		QueryType:         query.QueryType,
	}, nil
}

func (e *AzureResourceGraphDatasource) executeQuery(ctx context.Context, query *AzureResourceGraphQuery, dsInfo types.DatasourceInfo, client *http.Client, dsURL string) (*backend.DataResponse, error) {
	params := url.Values{}
	params.Add("api-version", ArgAPIVersion)

	var model dataquery.AzureMonitorQuery
	err := json.Unmarshal(query.JSON, &model)
	if err != nil {
		return nil, err
	}

	reqBody, err := json.Marshal(map[string]any{
		"subscriptions": model.Subscriptions,
		"query":         query.InterpolatedQuery,
		"options":       map[string]string{"resultFormat": "table"},
	})

	if err != nil {
		return nil, err
	}

	req, err := e.createRequest(ctx, reqBody, dsURL)
	if err != nil {
		return nil, err
	}

	req.URL.Path = path.Join(req.URL.Path, argQueryProviderName)
	req.URL.RawQuery = params.Encode()

	_, span := tracing.DefaultTracer().Start(ctx, "azure resource graph query", trace.WithAttributes(
		attribute.String("interpolated_query", query.InterpolatedQuery),
		attribute.Int64("from", query.TimeRange.From.UnixNano()/int64(time.Millisecond)),
		attribute.Int64("until", query.TimeRange.To.UnixNano()/int64(time.Millisecond)),
		attribute.Int64("datasource_id", dsInfo.DatasourceID),
		attribute.Int64("org_id", dsInfo.OrgID),
	),
	)

	defer span.End()
	e.Logger.Debug("azure resource graph query", "traceID", trace.SpanContextFromContext(ctx).TraceID())

	res, err := client.Do(req)
	if err != nil {
		return nil, errorsource.DownstreamError(err, false)
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			e.Logger.Warn("Failed to close response body", "err", err)
		}
	}()

	argResponse, err := e.unmarshalResponse(res)
	if err != nil {
		return nil, err
	}

	frame, err := loganalytics.ResponseTableToFrame(&argResponse.Data, query.RefID, query.InterpolatedQuery, dataquery.AzureQueryType(query.QueryType), dataquery.ResultFormat(query.ResultFormat), false)
	if err != nil {
		return nil, err
	}
	if frame == nil {
		// empty response
		dataResponse := backend.DataResponse{}
		return &dataResponse, nil
	}

	url := dsInfo.Routes["Azure Portal"].URL + "/#blade/HubsExtension/ArgQueryBlade/query/" + url.PathEscape(query.InterpolatedQuery)
	frameWithLink := loganalytics.AddConfigLinks(*frame, url, nil)
	if frameWithLink.Meta == nil {
		frameWithLink.Meta = &data.FrameMeta{}
	}
	frameWithLink.Meta.ExecutedQueryString = req.URL.RawQuery

	dataResponse := backend.DataResponse{}
	dataResponse.Frames = data.Frames{&frameWithLink}
	return &dataResponse, nil
}

func (e *AzureResourceGraphDatasource) createRequest(ctx context.Context, reqBody []byte, url string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to create request", err)
	}
	req.URL.Path = "/"
	req.Header.Set("Content-Type", "application/json")

	return req, nil
}

func (e *AzureResourceGraphDatasource) unmarshalResponse(res *http.Response) (AzureResourceGraphResponse, error) {
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return AzureResourceGraphResponse{}, err
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			e.Logger.Warn("Failed to close response body", "err", err)
		}
	}()

	if res.StatusCode/100 != 2 {
		return AzureResourceGraphResponse{}, errorsource.SourceError(backend.ErrorSourceFromHTTPStatus(res.StatusCode), fmt.Errorf("%s. Azure Resource Graph error: %s", res.Status, string(body)), false)
	}

	var data AzureResourceGraphResponse
	d := json.NewDecoder(bytes.NewReader(body))
	d.UseNumber()
	err = d.Decode(&data)
	if err != nil {
		return AzureResourceGraphResponse{}, err
	}

	return data, nil
}

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
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/tracing"
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
	Proxy types.ServiceProxy
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
func (e *AzureResourceGraphDatasource) ExecuteTimeSeriesQuery(ctx context.Context, originalQueries []backend.DataQuery, dsInfo types.DatasourceInfo, client *http.Client, url string, tracer tracing.Tracer) (*backend.QueryDataResponse, error) {
	result := &backend.QueryDataResponse{
		Responses: map[string]backend.DataResponse{},
	}

	queries, err := e.buildQueries(originalQueries, dsInfo)
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		res, err := e.executeQuery(ctx, query, dsInfo, client, url, tracer)
		if err != nil {
			result.Responses[query.RefID] = backend.DataResponse{Error: err}
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

func (e *AzureResourceGraphDatasource) buildQueries(queries []backend.DataQuery, dsInfo types.DatasourceInfo) ([]*AzureResourceGraphQuery, error) {
	var azureResourceGraphQueries []*AzureResourceGraphQuery

	for _, query := range queries {
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

		azureResourceGraphQueries = append(azureResourceGraphQueries, &AzureResourceGraphQuery{
			RefID:             query.RefID,
			ResultFormat:      resultFormat,
			JSON:              query.JSON,
			InterpolatedQuery: interpolatedQuery,
			TimeRange:         query.TimeRange,
			QueryType:         query.QueryType,
		})
	}

	return azureResourceGraphQueries, nil
}

func (e *AzureResourceGraphDatasource) executeQuery(ctx context.Context, query *AzureResourceGraphQuery, dsInfo types.DatasourceInfo, client *http.Client,
	dsURL string, tracer tracing.Tracer) (*backend.DataResponse, error) {
	params := url.Values{}
	params.Add("api-version", ArgAPIVersion)

	var model dataquery.AzureMonitorQuery
	err := json.Unmarshal(query.JSON, &model)
	if err != nil {
		return nil, err
	}

	reqBody, err := json.Marshal(map[string]interface{}{
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

	ctx, span := tracer.Start(ctx, "azure resource graph query")
	span.SetAttributes("interpolated_query", query.InterpolatedQuery, attribute.Key("interpolated_query").String(query.InterpolatedQuery))
	span.SetAttributes("from", query.TimeRange.From.UnixNano()/int64(time.Millisecond), attribute.Key("from").Int64(query.TimeRange.From.UnixNano()/int64(time.Millisecond)))
	span.SetAttributes("until", query.TimeRange.To.UnixNano()/int64(time.Millisecond), attribute.Key("until").Int64(query.TimeRange.To.UnixNano()/int64(time.Millisecond)))
	span.SetAttributes("datasource_id", dsInfo.DatasourceID, attribute.Key("datasource_id").Int64(dsInfo.DatasourceID))
	span.SetAttributes("org_id", dsInfo.OrgID, attribute.Key("org_id").Int64(dsInfo.OrgID))

	defer span.End()

	tracer.Inject(ctx, req.Header, span)

	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}

	defer func() {
		err := res.Body.Close()
		backend.Logger.Error("Failed to close response body", "err", err)
	}()

	argResponse, err := e.unmarshalResponse(res)
	if err != nil {
		return nil, err
	}

	frame, err := loganalytics.ResponseTableToFrame(&argResponse.Data, query.RefID, query.InterpolatedQuery, dataquery.AzureQueryType(query.QueryType), dataquery.ResultFormat(query.ResultFormat))
	if err != nil {
		return nil, err
	}
	if frame == nil {
		// empty response
		dataResponse := backend.DataResponse{}
		return &dataResponse, nil
	}

	azurePortalUrl, err := loganalytics.GetAzurePortalUrl(dsInfo.Cloud)
	if err != nil {
		return nil, err
	}

	url := azurePortalUrl + "/#blade/HubsExtension/ArgQueryBlade/query/" + url.PathEscape(query.InterpolatedQuery)
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
		err := res.Body.Close()
		backend.Logger.Error("Failed to close response body", "err", err)
	}()

	if res.StatusCode/100 != 2 {
		return AzureResourceGraphResponse{}, fmt.Errorf("%s. Azure Resource Graph error: %s", res.Status, string(body))
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

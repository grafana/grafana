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

	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
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
}

const ArgAPIVersion = "2021-06-01-preview"
const argQueryProviderName = "/providers/Microsoft.ResourceGraph/resources"

func (e *AzureResourceGraphDatasource) ResourceRequest(rw http.ResponseWriter, req *http.Request, cli *http.Client) {
	e.Proxy.Do(rw, req, cli)
}

// executeTimeSeriesQuery does the following:
// 1. builds the AzureMonitor url and querystring for each query
// 2. executes each query by calling the Azure Monitor API
// 3. parses the responses for each query into data frames
func (e *AzureResourceGraphDatasource) ExecuteTimeSeriesQuery(ctx context.Context, logger log.Logger, originalQueries []backend.DataQuery, dsInfo types.DatasourceInfo, client *http.Client, url string, tracer tracing.Tracer) (*backend.QueryDataResponse, error) {
	result := &backend.QueryDataResponse{
		Responses: map[string]backend.DataResponse{},
	}
	ctxLogger := logger.FromContext(ctx)

	queries, err := e.buildQueries(ctxLogger, originalQueries, dsInfo)
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		result.Responses[query.RefID] = e.executeQuery(ctx, ctxLogger, query, dsInfo, client, url, tracer)
	}

	return result, nil
}

type argJSONQuery struct {
	AzureResourceGraph struct {
		Query        string `json:"query"`
		ResultFormat string `json:"resultFormat"`
	} `json:"azureResourceGraph"`
}

func (e *AzureResourceGraphDatasource) buildQueries(logger log.Logger, queries []backend.DataQuery, dsInfo types.DatasourceInfo) ([]*AzureResourceGraphQuery, error) {
	var azureResourceGraphQueries []*AzureResourceGraphQuery

	for _, query := range queries {
		queryJSONModel := argJSONQuery{}
		err := json.Unmarshal(query.JSON, &queryJSONModel)
		if err != nil {
			return nil, fmt.Errorf("failed to decode the Azure Resource Graph query object from JSON: %w", err)
		}

		azureResourceGraphTarget := queryJSONModel.AzureResourceGraph
		logger.Debug("AzureResourceGraph", "target", azureResourceGraphTarget)

		resultFormat := azureResourceGraphTarget.ResultFormat
		if resultFormat == "" {
			resultFormat = "table"
		}

		interpolatedQuery, err := macros.KqlInterpolate(logger, query, dsInfo, azureResourceGraphTarget.Query)

		if err != nil {
			return nil, err
		}

		azureResourceGraphQueries = append(azureResourceGraphQueries, &AzureResourceGraphQuery{
			RefID:             query.RefID,
			ResultFormat:      resultFormat,
			JSON:              query.JSON,
			InterpolatedQuery: interpolatedQuery,
			TimeRange:         query.TimeRange,
		})
	}

	return azureResourceGraphQueries, nil
}

func (e *AzureResourceGraphDatasource) executeQuery(ctx context.Context, logger log.Logger, query *AzureResourceGraphQuery, dsInfo types.DatasourceInfo, client *http.Client,
	dsURL string, tracer tracing.Tracer) backend.DataResponse {
	dataResponse := backend.DataResponse{}

	params := url.Values{}
	params.Add("api-version", ArgAPIVersion)

	dataResponseErrorWithExecuted := func(err error) backend.DataResponse {
		dataResponse = backend.DataResponse{Error: err}
		frames := data.Frames{
			&data.Frame{
				RefID: query.RefID,
				Meta: &data.FrameMeta{
					ExecutedQueryString: query.InterpolatedQuery,
				},
			},
		}
		dataResponse.Frames = frames
		return dataResponse
	}

	model, err := simplejson.NewJson(query.JSON)
	if err != nil {
		dataResponse.Error = err
		return dataResponse
	}

	reqBody, err := json.Marshal(map[string]interface{}{
		"subscriptions": model.Get("subscriptions").MustStringArray(),
		"query":         query.InterpolatedQuery,
		"options":       map[string]string{"resultFormat": "table"},
	})

	if err != nil {
		dataResponse.Error = err
		return dataResponse
	}

	req, err := e.createRequest(ctx, logger, reqBody, dsURL)

	if err != nil {
		dataResponse.Error = err
		return dataResponse
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

	logger.Debug("AzureResourceGraph", "Request ApiURL", req.URL.String())
	//nolint:bodyclose // fixed in main
	res, err := client.Do(req)
	if err != nil {
		return dataResponseErrorWithExecuted(err)
	}

	argResponse, err := e.unmarshalResponse(logger, res)
	if err != nil {
		return dataResponseErrorWithExecuted(err)
	}

	frame, err := loganalytics.ResponseTableToFrame(&argResponse.Data, query.RefID, query.InterpolatedQuery)
	if err != nil {
		return dataResponseErrorWithExecuted(err)
	}
	if frame == nil {
		// empty response
		return dataResponse
	}

	azurePortalUrl, err := GetAzurePortalUrl(dsInfo.Cloud)
	if err != nil {
		return dataResponseErrorWithExecuted(err)
	}

	url := azurePortalUrl + "/#blade/HubsExtension/ArgQueryBlade/query/" + url.PathEscape(query.InterpolatedQuery)
	frameWithLink := AddConfigLinks(*frame, url)
	if frameWithLink.Meta == nil {
		frameWithLink.Meta = &data.FrameMeta{}
	}
	frameWithLink.Meta.ExecutedQueryString = req.URL.RawQuery

	dataResponse.Frames = data.Frames{&frameWithLink}
	return dataResponse
}

func AddConfigLinks(frame data.Frame, dl string) data.Frame {
	for i := range frame.Fields {
		if frame.Fields[i].Config == nil {
			frame.Fields[i].Config = &data.FieldConfig{}
		}
		deepLink := data.DataLink{
			Title:       "View in Azure Portal",
			TargetBlank: true,
			URL:         dl,
		}
		frame.Fields[i].Config.Links = append(frame.Fields[i].Config.Links, deepLink)
	}
	return frame
}

func (e *AzureResourceGraphDatasource) createRequest(ctx context.Context, logger log.Logger, reqBody []byte, url string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(reqBody))
	if err != nil {
		logger.Debug("Failed to create request", "error", err)
		return nil, fmt.Errorf("%v: %w", "failed to create request", err)
	}
	req.URL.Path = "/"
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))

	return req, nil
}

func (e *AzureResourceGraphDatasource) unmarshalResponse(logger log.Logger, res *http.Response) (AzureResourceGraphResponse, error) {
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return AzureResourceGraphResponse{}, err
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()

	if res.StatusCode/100 != 2 {
		logger.Debug("Request failed", "status", res.Status, "body", string(body))
		return AzureResourceGraphResponse{}, fmt.Errorf("%s. Azure Resource Graph error: %s", res.Status, string(body))
	}

	var data AzureResourceGraphResponse
	d := json.NewDecoder(bytes.NewReader(body))
	d.UseNumber()
	err = d.Decode(&data)
	if err != nil {
		logger.Debug("Failed to unmarshal azure resource graph response", "error", err, "status", res.Status, "body", string(body))
		return AzureResourceGraphResponse{}, err
	}

	return data, nil
}

func GetAzurePortalUrl(azureCloud string) (string, error) {
	switch azureCloud {
	case azsettings.AzurePublic:
		return "https://portal.azure.com", nil
	case azsettings.AzureChina:
		return "https://portal.azure.cn", nil
	case azsettings.AzureUSGovernment:
		return "https://portal.azure.us", nil
	case azsettings.AzureGermany:
		return "https://portal.microsoftazure.de", nil
	default:
		return "", fmt.Errorf("the cloud is not supported")
	}
}

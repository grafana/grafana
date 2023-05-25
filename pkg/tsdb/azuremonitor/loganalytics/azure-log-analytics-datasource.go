package loganalytics

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azlog"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/macros"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

// AzureLogAnalyticsDatasource calls the Azure Log Analytics API's
type AzureLogAnalyticsDatasource struct {
	Proxy types.ServiceProxy
}

// AzureLogAnalyticsQuery is the query request that is built from the saved values for
// from the UI
type AzureLogAnalyticsQuery struct {
	RefID        string
	ResultFormat string
	URL          string
	JSON         json.RawMessage
	Params       url.Values
	Target       string
	TimeRange    backend.TimeRange
}

func (e *AzureLogAnalyticsDatasource) ResourceRequest(rw http.ResponseWriter, req *http.Request, cli *http.Client) {
	e.Proxy.Do(rw, req, cli)
}

// executeTimeSeriesQuery does the following:
// 1. build the AzureMonitor url and querystring for each query
// 2. executes each query by calling the Azure Monitor API
// 3. parses the responses for each query into data frames
func (e *AzureLogAnalyticsDatasource) ExecuteTimeSeriesQuery(ctx context.Context, originalQueries []backend.DataQuery, dsInfo types.DatasourceInfo, client *http.Client,
	url string, tracer tracing.Tracer) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	queries, err := e.buildQueries(originalQueries, dsInfo)
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		result.Responses[query.RefID] = e.executeQuery(ctx, query, dsInfo, client, url, tracer)
	}

	return result, nil
}

func getApiURL(queryJSONModel types.LogJSONQuery) string {
	// Legacy queries only specify a Workspace GUID, which we need to use the old workspace-centric
	// API URL for, and newer queries specifying a resource URI should use resource-centric API.
	// However, legacy workspace queries using a `workspaces()` template variable will be resolved
	// to a resource URI, so they should use the new resource-centric.
	azureLogAnalyticsTarget := queryJSONModel.AzureLogAnalytics
	var resourceOrWorkspace string

	if azureLogAnalyticsTarget.Resource != "" {
		resourceOrWorkspace = azureLogAnalyticsTarget.Resource
	} else {
		resourceOrWorkspace = azureLogAnalyticsTarget.Workspace
	}

	matchesResourceURI, _ := regexp.MatchString("^/subscriptions/", resourceOrWorkspace)

	if matchesResourceURI {
		return fmt.Sprintf("v1%s/query", resourceOrWorkspace)
	} else {
		return fmt.Sprintf("v1/workspaces/%s/query", resourceOrWorkspace)
	}
}

func (e *AzureLogAnalyticsDatasource) buildQueries(queries []backend.DataQuery, dsInfo types.DatasourceInfo) ([]*AzureLogAnalyticsQuery, error) {
	azureLogAnalyticsQueries := []*AzureLogAnalyticsQuery{}

	for _, query := range queries {
		queryJSONModel := types.LogJSONQuery{}
		err := json.Unmarshal(query.JSON, &queryJSONModel)
		if err != nil {
			return nil, fmt.Errorf("failed to decode the Azure Log Analytics query object from JSON: %w", err)
		}

		azureLogAnalyticsTarget := queryJSONModel.AzureLogAnalytics
		azlog.Debug("AzureLogAnalytics", "target", azureLogAnalyticsTarget)

		resultFormat := azureLogAnalyticsTarget.ResultFormat
		if resultFormat == "" {
			resultFormat = types.TimeSeries
		}

		apiURL := getApiURL(queryJSONModel)

		params := url.Values{}
		rawQuery, err := macros.KqlInterpolate(query, dsInfo, azureLogAnalyticsTarget.Query, "TimeGenerated")
		if err != nil {
			return nil, err
		}
		params.Add("query", rawQuery)

		azureLogAnalyticsQueries = append(azureLogAnalyticsQueries, &AzureLogAnalyticsQuery{
			RefID:        query.RefID,
			ResultFormat: resultFormat,
			URL:          apiURL,
			JSON:         query.JSON,
			Params:       params,
			Target:       params.Encode(),
			TimeRange:    query.TimeRange,
		})
	}

	return azureLogAnalyticsQueries, nil
}

func (e *AzureLogAnalyticsDatasource) executeQuery(ctx context.Context, query *AzureLogAnalyticsQuery, dsInfo types.DatasourceInfo, client *http.Client,
	url string, tracer tracing.Tracer) backend.DataResponse {
	dataResponse := backend.DataResponse{}

	dataResponseErrorWithExecuted := func(err error) backend.DataResponse {
		dataResponse.Error = err
		dataResponse.Frames = data.Frames{
			&data.Frame{
				RefID: query.RefID,
				Meta: &data.FrameMeta{
					ExecutedQueryString: query.Params.Get("query"),
				},
			},
		}
		return dataResponse
	}

	// If azureLogAnalyticsSameAs is defined and set to false, return an error
	if sameAs, ok := dsInfo.JSONData["azureLogAnalyticsSameAs"]; ok && !sameAs.(bool) {
		return dataResponseErrorWithExecuted(fmt.Errorf("credentials for Log Analytics are no longer supported. Go to the data source configuration to update Azure Monitor credentials"))
	}

	req, err := e.createRequest(ctx, dsInfo, url)
	if err != nil {
		dataResponse.Error = err
		return dataResponse
	}

	req.URL.Path = path.Join(req.URL.Path, query.URL)
	req.URL.RawQuery = query.Params.Encode()

	ctx, span := tracer.Start(ctx, "azure log analytics query")
	span.SetAttributes("target", query.Target, attribute.Key("target").String(query.Target))
	span.SetAttributes("from", query.TimeRange.From.UnixNano()/int64(time.Millisecond), attribute.Key("from").Int64(query.TimeRange.From.UnixNano()/int64(time.Millisecond)))
	span.SetAttributes("until", query.TimeRange.To.UnixNano()/int64(time.Millisecond), attribute.Key("until").Int64(query.TimeRange.To.UnixNano()/int64(time.Millisecond)))
	span.SetAttributes("datasource_id", dsInfo.DatasourceID, attribute.Key("datasource_id").Int64(dsInfo.DatasourceID))
	span.SetAttributes("org_id", dsInfo.OrgID, attribute.Key("org_id").Int64(dsInfo.OrgID))

	defer span.End()

	tracer.Inject(ctx, req.Header, span)

	azlog.Debug("AzureLogAnalytics", "Request ApiURL", req.URL.String())
	res, err := client.Do(req) //nolint:bodyclose // fixed in main
	if err != nil {
		return dataResponseErrorWithExecuted(err)
	}

	logResponse, err := e.unmarshalResponse(res)
	if err != nil {
		return dataResponseErrorWithExecuted(err)
	}

	t, err := logResponse.GetPrimaryResultTable()
	if err != nil {
		return dataResponseErrorWithExecuted(err)
	}

	frame, err := ResponseTableToFrame(t, query.RefID, query.Params.Get("query"))
	if err != nil {
		return dataResponseErrorWithExecuted(err)
	}
	frame = appendErrorNotice(frame, logResponse.Error)
	if frame == nil {
		return dataResponse
	}

	model, err := simplejson.NewJson(query.JSON)
	if err != nil {
		return dataResponseErrorWithExecuted(err)
	}

	err = setAdditionalFrameMeta(frame,
		query.Params.Get("query"),
		model.Get("subscriptionId").MustString(),
		model.Get("azureLogAnalytics").Get("workspace").MustString())
	if err != nil {
		frame.AppendNotices(data.Notice{Severity: data.NoticeSeverityWarning, Text: "could not add custom metadata: " + err.Error()})
		azlog.Warn("failed to add custom metadata to azure log analytics response", err)
	}

	if query.ResultFormat == types.TimeSeries {
		tsSchema := frame.TimeSeriesSchema()
		if tsSchema.Type == data.TimeSeriesTypeLong {
			wideFrame, err := data.LongToWide(frame, nil)
			if err == nil {
				frame = wideFrame
			} else {
				frame.AppendNotices(data.Notice{Severity: data.NoticeSeverityWarning, Text: "could not convert frame to time series, returning raw table: " + err.Error()})
			}
		}
	}

	dataResponse.Frames = data.Frames{frame}
	return dataResponse
}

func appendErrorNotice(frame *data.Frame, err *AzureLogAnalyticsAPIError) *data.Frame {
	if err == nil {
		return frame
	}
	if frame == nil {
		frame = &data.Frame{}
	}
	frame.AppendNotices(apiErrorToNotice(err))
	return frame
}

func (e *AzureLogAnalyticsDatasource) createRequest(ctx context.Context, dsInfo types.DatasourceInfo, url string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		azlog.Debug("Failed to create request", "error", err)
		return nil, fmt.Errorf("%v: %w", "failed to create request", err)
	}
	req.URL.Path = "/"
	req.Header.Set("Content-Type", "application/json")

	return req, nil
}

// Error definition has been inferred from real data and other model definitions like
// https://github.com/Azure/azure-sdk-for-go/blob/3640559afddbad452d265b54fb1c20b30be0b062/services/preview/virtualmachineimagebuilder/mgmt/2019-05-01-preview/virtualmachineimagebuilder/models.go
type AzureLogAnalyticsAPIError struct {
	Details *[]AzureLogAnalyticsAPIErrorBase `json:"details,omitempty"`
	Code    *string                          `json:"code,omitempty"`
	Message *string                          `json:"message,omitempty"`
}

type AzureLogAnalyticsAPIErrorBase struct {
	Code       *string                      `json:"code,omitempty"`
	Message    *string                      `json:"message,omitempty"`
	Innererror *AzureLogAnalyticsInnerError `json:"innererror,omitempty"`
}

type AzureLogAnalyticsInnerError struct {
	Code         *string `json:"code,omitempty"`
	Message      *string `json:"message,omitempty"`
	Severity     *int    `json:"severity,omitempty"`
	SeverityName *string `json:"severityName,omitempty"`
}

// AzureLogAnalyticsResponse is the json response object from the Azure Log Analytics API.
type AzureLogAnalyticsResponse struct {
	Tables []types.AzureResponseTable `json:"tables"`
	Error  *AzureLogAnalyticsAPIError `json:"error,omitempty"`
}

// GetPrimaryResultTable returns the first table in the response named "PrimaryResult", or an
// error if there is no table by that name.
func (ar *AzureLogAnalyticsResponse) GetPrimaryResultTable() (*types.AzureResponseTable, error) {
	for _, t := range ar.Tables {
		if t.Name == "PrimaryResult" {
			return &t, nil
		}
	}
	return nil, fmt.Errorf("no data as PrimaryResult table is missing from the response")
}

func (e *AzureLogAnalyticsDatasource) unmarshalResponse(res *http.Response) (AzureLogAnalyticsResponse, error) {
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return AzureLogAnalyticsResponse{}, err
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			azlog.Warn("Failed to close response body", "err", err)
		}
	}()

	if res.StatusCode/100 != 2 {
		azlog.Debug("Request failed", "status", res.Status, "body", string(body))
		return AzureLogAnalyticsResponse{}, fmt.Errorf("request failed, status: %s, body: %s", res.Status, string(body))
	}

	var data AzureLogAnalyticsResponse
	d := json.NewDecoder(bytes.NewReader(body))
	d.UseNumber()
	err = d.Decode(&data)
	if err != nil {
		azlog.Debug("Failed to unmarshal Azure Log Analytics response", "error", err, "status", res.Status, "body", string(body))
		return AzureLogAnalyticsResponse{}, err
	}

	return data, nil
}

// LogAnalyticsMeta is a type for the a Frame's Meta's Custom property.
type LogAnalyticsMeta struct {
	ColumnTypes  []string `json:"azureColumnTypes"`
	Subscription string   `json:"subscription"`
	Workspace    string   `json:"workspace"`
	EncodedQuery []byte   `json:"encodedQuery"` // EncodedQuery is used for deep links.
}

func setAdditionalFrameMeta(frame *data.Frame, query, subscriptionID, workspace string) error {
	frame.Meta.ExecutedQueryString = query
	la, ok := frame.Meta.Custom.(*LogAnalyticsMeta)
	if !ok {
		return fmt.Errorf("unexpected type found for frame's custom metadata")
	}
	la.Subscription = subscriptionID
	la.Workspace = workspace
	encodedQuery, err := encodeQuery(query)
	if err == nil {
		la.EncodedQuery = encodedQuery
		return nil
	}
	return fmt.Errorf("failed to encode the query into the encodedQuery property")
}

// encodeQuery encodes the query in gzip so the frontend can build links.
func encodeQuery(rawQuery string) ([]byte, error) {
	var b bytes.Buffer
	gz := gzip.NewWriter(&b)
	if _, err := gz.Write([]byte(rawQuery)); err != nil {
		return nil, err
	}

	if err := gz.Close(); err != nil {
		return nil, err
	}

	return b.Bytes(), nil
}

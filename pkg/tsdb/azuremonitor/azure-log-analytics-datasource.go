package azuremonitor

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"regexp"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/net/context/ctxhttp"
)

// AzureLogAnalyticsDatasource calls the Azure Log Analytics API's
type AzureLogAnalyticsDatasource struct {
	httpClient    *http.Client
	dsInfo        *models.DataSource
	pluginManager plugins.Manager
	cfg           *setting.Cfg
}

// AzureLogAnalyticsQuery is the query request that is built from the saved values for
// from the UI
type AzureLogAnalyticsQuery struct {
	RefID        string
	ResultFormat string
	URL          string
	Model        *simplejson.Json
	Params       url.Values
	Target       string
}

// executeTimeSeriesQuery does the following:
// 1. build the AzureMonitor url and querystring for each query
// 2. executes each query by calling the Azure Monitor API
// 3. parses the responses for each query into the timeseries format
//nolint: staticcheck // plugins.DataPlugin deprecated
func (e *AzureLogAnalyticsDatasource) executeTimeSeriesQuery(ctx context.Context, originalQueries []plugins.DataSubQuery,
	timeRange plugins.DataTimeRange) (plugins.DataResponse, error) {
	result := plugins.DataResponse{
		Results: map[string]plugins.DataQueryResult{},
	}

	queries, err := e.buildQueries(originalQueries, timeRange)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	for _, query := range queries {
		result.Results[query.RefID] = e.executeQuery(ctx, query, originalQueries, timeRange)
	}

	return result, nil
}

func getApiURL(queryJSONModel logJSONQuery) string {
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

func (e *AzureLogAnalyticsDatasource) buildQueries(queries []plugins.DataSubQuery,
	timeRange plugins.DataTimeRange) ([]*AzureLogAnalyticsQuery, error) {
	azureLogAnalyticsQueries := []*AzureLogAnalyticsQuery{}

	for _, query := range queries {
		queryBytes, err := query.Model.Encode()
		if err != nil {
			return nil, fmt.Errorf("failed to re-encode the Azure Log Analytics query into JSON: %w", err)
		}

		queryJSONModel := logJSONQuery{}
		err = json.Unmarshal(queryBytes, &queryJSONModel)
		if err != nil {
			return nil, fmt.Errorf("failed to decode the Azure Log Analytics query object from JSON: %w", err)
		}

		azureLogAnalyticsTarget := queryJSONModel.AzureLogAnalytics
		azlog.Debug("AzureLogAnalytics", "target", azureLogAnalyticsTarget)

		resultFormat := azureLogAnalyticsTarget.ResultFormat
		if resultFormat == "" {
			resultFormat = timeSeries
		}

		apiURL := getApiURL(queryJSONModel)

		params := url.Values{}
		rawQuery, err := KqlInterpolate(query, timeRange, azureLogAnalyticsTarget.Query, "TimeGenerated")
		if err != nil {
			return nil, err
		}
		params.Add("query", rawQuery)

		azureLogAnalyticsQueries = append(azureLogAnalyticsQueries, &AzureLogAnalyticsQuery{
			RefID:        query.RefID,
			ResultFormat: resultFormat,
			URL:          apiURL,
			Model:        query.Model,
			Params:       params,
			Target:       params.Encode(),
		})
	}

	return azureLogAnalyticsQueries, nil
}

//nolint: staticcheck // plugins.DataPlugin deprecated
func (e *AzureLogAnalyticsDatasource) executeQuery(ctx context.Context, query *AzureLogAnalyticsQuery,
	queries []plugins.DataSubQuery, timeRange plugins.DataTimeRange) plugins.DataQueryResult {
	queryResult := plugins.DataQueryResult{RefID: query.RefID}

	queryResultErrorWithExecuted := func(err error) plugins.DataQueryResult {
		queryResult.Error = err
		frames := data.Frames{
			&data.Frame{
				RefID: query.RefID,
				Meta: &data.FrameMeta{
					ExecutedQueryString: query.Params.Get("query"),
				},
			},
		}
		queryResult.Dataframes = plugins.NewDecodedDataFrames(frames)
		return queryResult
	}

	req, err := e.createRequest(ctx, e.dsInfo)
	if err != nil {
		queryResult.Error = err
		return queryResult
	}

	req.URL.Path = path.Join(req.URL.Path, query.URL)
	req.URL.RawQuery = query.Params.Encode()

	span, ctx := opentracing.StartSpanFromContext(ctx, "azure log analytics query")
	span.SetTag("target", query.Target)
	span.SetTag("from", timeRange.From)
	span.SetTag("until", timeRange.To)
	span.SetTag("datasource_id", e.dsInfo.Id)
	span.SetTag("org_id", e.dsInfo.OrgId)

	defer span.Finish()

	if err := opentracing.GlobalTracer().Inject(
		span.Context(),
		opentracing.HTTPHeaders,
		opentracing.HTTPHeadersCarrier(req.Header)); err != nil {
		return queryResultErrorWithExecuted(err)
	}

	azlog.Debug("AzureLogAnalytics", "Request ApiURL", req.URL.String())
	res, err := ctxhttp.Do(ctx, e.httpClient, req)
	if err != nil {
		return queryResultErrorWithExecuted(err)
	}

	logResponse, err := e.unmarshalResponse(res)
	if err != nil {
		return queryResultErrorWithExecuted(err)
	}

	t, err := logResponse.GetPrimaryResultTable()
	if err != nil {
		return queryResultErrorWithExecuted(err)
	}

	frame, err := ResponseTableToFrame(t)
	if err != nil {
		return queryResultErrorWithExecuted(err)
	}

	err = setAdditionalFrameMeta(frame,
		query.Params.Get("query"),
		query.Model.Get("subscriptionId").MustString(),
		query.Model.Get("azureLogAnalytics").Get("workspace").MustString())
	if err != nil {
		frame.AppendNotices(data.Notice{Severity: data.NoticeSeverityWarning, Text: "could not add custom metadata: " + err.Error()})
		azlog.Warn("failed to add custom metadata to azure log analytics response", err)
	}

	if query.ResultFormat == timeSeries {
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
	frames := data.Frames{frame}
	queryResult.Dataframes = plugins.NewDecodedDataFrames(frames)
	return queryResult
}

func (e *AzureLogAnalyticsDatasource) createRequest(ctx context.Context, dsInfo *models.DataSource) (*http.Request, error) {
	u, err := url.Parse(dsInfo.Url)
	if err != nil {
		return nil, err
	}
	u.Path = path.Join(u.Path, "render")

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		azlog.Debug("Failed to create request", "error", err)
		return nil, errutil.Wrap("failed to create request", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// find plugin
	plugin := e.pluginManager.GetDataSource(dsInfo.Type)
	if plugin == nil {
		return nil, errors.New("unable to find datasource plugin Azure Monitor")
	}

	logAnalyticsRoute, routeName, err := e.getPluginRoute(plugin)
	if err != nil {
		return nil, err
	}

	pluginproxy.ApplyRoute(ctx, req, routeName, logAnalyticsRoute, dsInfo, e.cfg)

	return req, nil
}

func (e *AzureLogAnalyticsDatasource) getPluginRoute(plugin *plugins.DataSourcePlugin) (*plugins.AppPluginRoute, string, error) {
	cloud, err := getAzureCloud(e.cfg, e.dsInfo.JsonData)
	if err != nil {
		return nil, "", err
	}

	routeName, err := getLogAnalyticsApiRoute(cloud)
	if err != nil {
		return nil, "", err
	}

	var pluginRoute *plugins.AppPluginRoute
	for _, route := range plugin.Routes {
		if route.Path == routeName {
			pluginRoute = route
			break
		}
	}

	return pluginRoute, routeName, nil
}

// GetPrimaryResultTable returns the first table in the response named "PrimaryResult", or an
// error if there is no table by that name.
func (ar *AzureLogAnalyticsResponse) GetPrimaryResultTable() (*AzureResponseTable, error) {
	for _, t := range ar.Tables {
		if t.Name == "PrimaryResult" {
			return &t, nil
		}
	}
	return nil, fmt.Errorf("no data as PrimaryResult table is missing from the response")
}

func (e *AzureLogAnalyticsDatasource) unmarshalResponse(res *http.Response) (AzureLogAnalyticsResponse, error) {
	body, err := ioutil.ReadAll(res.Body)
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

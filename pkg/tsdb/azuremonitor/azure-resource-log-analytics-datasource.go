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

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/net/context/ctxhttp"
)

// AzureLogAnalyticsDatasource calls the Azure Log Analytics API's
type AzureResourceLogAnalyticsDatasource struct {
	httpClient *http.Client
	dsInfo     *models.DataSource
}

// AzureLogAnalyticsQuery is the query request that is built from the saved values for
// from the UI
type AzureResourceLogAnalyticsQuery struct {
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
func (e *AzureResourceLogAnalyticsDatasource) executeTimeSeriesQuery(ctx context.Context, originalQueries []*tsdb.Query, timeRange *tsdb.TimeRange) (*tsdb.Response, error) {
	result := &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{},
	}

	queries, err := e.buildQueries(originalQueries, timeRange)
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		result.Results[query.RefID] = e.executeQuery(ctx, query, originalQueries, timeRange)
	}

	return result, nil
}

func (e *AzureResourceLogAnalyticsDatasource) buildQueries(queries []*tsdb.Query, timeRange *tsdb.TimeRange) ([]*AzureResourceLogAnalyticsQuery, error) {
	azureResourceLogAnalyticsQueries := []*AzureResourceLogAnalyticsQuery{}

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

		azureResourceLogAnalyticsTarget := queryJSONModel.AzureResourceLogAnalytics
		azlog.Debug("AzureLogAnalytics", "target", azureResourceLogAnalyticsTarget)

		resultFormat := azureResourceLogAnalyticsTarget.ResultFormat
		if resultFormat == "" {
			resultFormat = "time_series"
		}

		urlComponents := map[string]string{}
		urlComponents["resource"] = azureResourceLogAnalyticsTarget.Resource
		apiURL := fmt.Sprintf("%s/query", urlComponents["resource"])

		params := url.Values{}
		rawQuery, err := KqlInterpolate(query, timeRange, azureResourceLogAnalyticsTarget.Query, "TimeGenerated")
		if err != nil {
			return nil, err
		}
		params.Add("query", rawQuery)

		azureResourceLogAnalyticsQueries = append(azureResourceLogAnalyticsQueries, &AzureResourceLogAnalyticsQuery{
			RefID:        query.RefId,
			ResultFormat: resultFormat,
			URL:          apiURL,
			Model:        query.Model,
			Params:       params,
			Target:       params.Encode(),
		})
	}

	return azureResourceLogAnalyticsQueries, nil
}

func (e *AzureResourceLogAnalyticsDatasource) executeQuery(ctx context.Context, query *AzureResourceLogAnalyticsQuery, queries []*tsdb.Query, timeRange *tsdb.TimeRange) *tsdb.QueryResult {
	queryResult := &tsdb.QueryResult{RefId: query.RefID}

	queryResultErrorWithExecuted := func(err error) *tsdb.QueryResult {
		queryResult.Error = err
		frames := data.Frames{
			&data.Frame{
				RefID: query.RefID,
				Meta: &data.FrameMeta{
					ExecutedQueryString: query.Params.Get("query"),
				},
			},
		}
		queryResult.Dataframes = tsdb.NewDecodedDataFrames(frames)
		return queryResult
	}

	req, err := e.createRequest(ctx, e.dsInfo, query)
	if err != nil {
		queryResult.Error = err
		return queryResult
	}

	req.URL.Path = path.Join(req.URL.Path, query.URL)
	req.URL.RawQuery = query.Params.Encode()

	span, ctx := opentracing.StartSpanFromContext(ctx, "azure resource log analytics query")
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

	azlog.Debug("AzureResourceLogAnalytics", "Request ApiURL", req.URL.String())
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

	frame, err := LogTableToFrame(t)
	if err != nil {
		return queryResultErrorWithExecuted(err)
	}

	err = setAdditionalResourceFrameMeta(frame,
		query.Params.Get("query"),
		query.Model.Get("subscriptionId").MustString(),
		query.Model.Get("azureResourceLogAnalytics").Get("resource").MustString())
	if err != nil {
		frame.AppendNotices(data.Notice{Severity: data.NoticeSeverityWarning, Text: "could not add custom metadata: " + err.Error()})
		azlog.Warn("failed to add custom metadata to azure log analytics response", err)
	}

	if query.ResultFormat == "time_series" {
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
	queryResult.Dataframes = tsdb.NewDecodedDataFrames(frames)
	return queryResult
}

func (e *AzureResourceLogAnalyticsDatasource) createRequest(ctx context.Context, dsInfo *models.DataSource, query *AzureResourceLogAnalyticsQuery) (*http.Request, error) {
	u, err := url.Parse(dsInfo.Url)
	if err != nil {
		return nil, err
	}
	u.Path = path.Join(u.Path, "render")
	values := map[string]string{"query": query.Params.Get("query")}
	jsonStr, _ := json.Marshal(values)

	req, err := http.NewRequest(http.MethodPost, u.String(), bytes.NewBuffer(jsonStr))
	if err != nil {
		azlog.Debug("Failed to create request", "error", err)
		return nil, errutil.Wrap("failed to create request", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))

	// find plugin
	plugin, ok := plugins.DataSources[dsInfo.Type]
	if !ok {
		return nil, errors.New("unable to find datasource plugin Azure Monitor")
	}
	cloudName := dsInfo.JsonData.Get("cloudName").MustString("azuremonitor")

	logAnalyticsRoute, proxypass, err := e.getPluginRoute(plugin, cloudName)
	if err != nil {
		return nil, err
	}
	pluginproxy.ApplyRoute(ctx, req, proxypass, logAnalyticsRoute, dsInfo)

	return req, nil
}

func (e *AzureResourceLogAnalyticsDatasource) getPluginRoute(plugin *plugins.DataSourcePlugin, cloudName string) (*plugins.AppPluginRoute, string, error) {
	pluginRouteName := "resourceloganalyticsazure"

	switch cloudName {
	case "chinaazuremonitor":
		pluginRouteName = "chinaresourceloganalyticsazure"
	case "govazuremonitor":
		pluginRouteName = "govresourceloganalyticsazure"
	}

	var logAnalyticsRoute *plugins.AppPluginRoute

	for _, route := range plugin.Routes {
		if route.Path == pluginRouteName {
			logAnalyticsRoute = route
			break
		}
	}

	return logAnalyticsRoute, pluginRouteName, nil
}

func (e *AzureResourceLogAnalyticsDatasource) unmarshalResponse(res *http.Response) (AzureLogAnalyticsResponse, error) {
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

func setAdditionalResourceFrameMeta(frame *data.Frame, query, subscriptionID, resource string) error {
	frame.Meta.ExecutedQueryString = query
	la, ok := frame.Meta.Custom.(*LogAnalyticsMeta)
	if !ok {
		return fmt.Errorf("unexpected type found for frame's custom metadata")
	}
	la.Subscription = subscriptionID
	la.Resource = resource
	encodedQuery, err := encodeResourceQuery(query)
	if err == nil {
		la.EncodedQuery = encodedQuery
		return nil
	}
	return fmt.Errorf("failed to encode the query into the encodedQuery property")
}

// encodeResourceQuery encodes the query in gzip so the frontend can build links.
func encodeResourceQuery(rawQuery string) ([]byte, error) {
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

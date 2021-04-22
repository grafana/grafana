package azuremonitor

import (
	"bytes"
	"strings"

	// "compress/gzip"
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
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/net/context/ctxhttp"
)

// AzureResourceGraphDatasource calls the Azure Resource Graph API's
type AzureResourceGraphDatasource struct {
	httpClient    *http.Client
	dsInfo        *models.DataSource
	pluginManager plugins.Manager
}

// AzureResourceGraphQuery is the query request that is built from the saved values for
// from the UI
type AzureResourceGraphQuery struct {
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
func (e *AzureResourceGraphDatasource) executeTimeSeriesQuery(ctx context.Context, originalQueries []plugins.DataSubQuery,
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

func (e *AzureResourceGraphDatasource) buildQueries(queries []plugins.DataSubQuery,
	timeRange plugins.DataTimeRange) ([]*AzureResourceGraphQuery, error) {
	azureResourceGraphQueries := []*AzureResourceGraphQuery{}

	for _, query := range queries {
		queryBytes, err := query.Model.Encode()
		if err != nil {
			return nil, fmt.Errorf("failed to re-encode the Azure Resource Graph query into JSON: %w", err)
		}

		queryJSONModel := argJSONQuery{}
		err = json.Unmarshal(queryBytes, &queryJSONModel)
		if err != nil {
			return nil, fmt.Errorf("failed to decode the Azure Resource Graph query object from JSON: %w", err)
		}

		azureResourceGraphTarget := queryJSONModel.AzureResourceGraph
		azlog.Debug("AzureResourceGraph", "target", azureResourceGraphTarget)

		resultFormat := azureResourceGraphTarget.ResultFormat
		if resultFormat == "" {
			resultFormat = "time_series"
		}

		params := url.Values{}
		rawQuery, err := KqlInterpolate(query, timeRange, azureResourceGraphTarget.Query, "TimeGenerated")
		if err != nil {
			return nil, err
		}
		params.Add("query", rawQuery)

		azureResourceGraphQueries = append(azureResourceGraphQueries, &AzureResourceGraphQuery{
			RefID:        query.RefID,
			ResultFormat: resultFormat,
			Model:        query.Model,
			Params:       params,
			Target:       params.Encode(),
		})
	}

	return azureResourceGraphQueries, nil
}

func (e *AzureResourceGraphDatasource) executeQuery(ctx context.Context, query *AzureResourceGraphQuery,
	queries []plugins.DataSubQuery, timeRange plugins.DataTimeRange) plugins.DataQueryResult {
	queryResult := plugins.DataQueryResult{RefID: query.RefID}

	query.Params.Add("api-version", "2018-09-01-preview")

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

	reqBody := fmt.Sprintf("{'subscriptions':['%s'], 'query':'%s'}",
		strings.Join(query.Model.Get("azureResourceGraph").Get("subscriptions").MustStringArray(), "','"),
		query.Model.Get("azureResourceGraph").Get("query").MustString())
	req, err := e.createRequest(ctx, e.dsInfo, reqBody)

	if err != nil {
		queryResult.Error = err
		return queryResult
	}

	req.URL.Path = path.Join(req.URL.Path, "/providers/Microsoft.ResourceGraph/resources")
	req.URL.RawQuery = query.Params.Encode()

	span, ctx := opentracing.StartSpanFromContext(ctx, "azure resource graph query")
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

	azlog.Debug("AzureResourceGraph", "Request ApiURL", req.URL.String())
	res, err := ctxhttp.Do(ctx, e.httpClient, req)
	if err != nil {
		return queryResultErrorWithExecuted(err)
	}

	argResponse, err := e.unmarshalResponse(res)
	if err != nil {
		return queryResultErrorWithExecuted(err)
	}

	frame, err := LogTableToFrame(&argResponse.Data)
	if err != nil {
		return queryResultErrorWithExecuted(err)
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
	queryResult.Dataframes = plugins.NewDecodedDataFrames(frames)
	return queryResult
}

func (e *AzureResourceGraphDatasource) createRequest(ctx context.Context, dsInfo *models.DataSource, reqBody string) (*http.Request, error) {
	u, err := url.Parse(dsInfo.Url)
	if err != nil {
		return nil, err
	}
	u.Path = path.Join(u.Path, "render")
	req, err := http.NewRequest(http.MethodPost, u.String(), bytes.NewBuffer([]byte(reqBody)))
	if err != nil {
		azlog.Debug("Failed to create request", "error", err)
		return nil, errutil.Wrap("failed to create request", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))

	// find plugin
	plugin := e.pluginManager.GetDataSource(dsInfo.Type)
	if plugin == nil {
		return nil, errors.New("unable to find datasource plugin Azure Monitor")
	}
	cloudName := dsInfo.JsonData.Get("cloudName").MustString("azuremonitor")

	argRoute, proxypass, err := e.getPluginRoute(plugin, cloudName)
	if err != nil {
		return nil, err
	}
	pluginproxy.ApplyRoute(ctx, req, proxypass, argRoute, dsInfo)

	return req, nil
}

func (e *AzureResourceGraphDatasource) getPluginRoute(plugin *plugins.DataSourcePlugin, cloudName string) (
	*plugins.AppPluginRoute, string, error) {
	pluginRouteName := "azureresourcegraph"

	// TODO figure out how is cloud soverign supported in ARG
	// switch cloudName {
	// case "chinaazuremonitor":
	// 	pluginRouteName = "chinaloganalyticsazure"
	// case "govazuremonitor":
	// 	pluginRouteName = "govloganalyticsazure"
	// }

	var argRoute *plugins.AppPluginRoute
	for _, route := range plugin.Routes {
		if route.Path == pluginRouteName {
			argRoute = route
			break
		}
	}

	return argRoute, pluginRouteName, nil
}

func (e *AzureResourceGraphDatasource) unmarshalResponse(res *http.Response) (AzureResourceGraphResponse, error) {
	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return AzureResourceGraphResponse{}, err
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			azlog.Warn("Failed to close response body", "err", err)
		}
	}()

	if res.StatusCode/100 != 2 {
		azlog.Debug("Request failed", "status", res.Status, "body", string(body))
		return AzureResourceGraphResponse{}, fmt.Errorf("request failed, status: %s, body: %s", res.Status, string(body))
	}

	var data AzureResourceGraphResponse
	d := json.NewDecoder(bytes.NewReader(body))
	d.UseNumber()
	err = d.Decode(&data)
	if err != nil {
		azlog.Debug("Failed to unmarshal azure resource graph response", "error", err, "status", res.Status, "body", string(body))
		return AzureResourceGraphResponse{}, err
	}

	return data, nil
}

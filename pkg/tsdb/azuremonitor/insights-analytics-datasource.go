package azuremonitor

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/net/context/ctxhttp"
)

type InsightsAnalyticsDatasource struct {
	pluginManager plugins.Manager
	cfg           *setting.Cfg
}

type InsightsAnalyticsQuery struct {
	RefID string

	RawQuery          string
	InterpolatedQuery string

	ResultFormat string

	Params url.Values
	Target string
}

func (e *InsightsAnalyticsDatasource) executeTimeSeriesQuery(ctx context.Context,
	originalQueries []backend.DataQuery, dsInfo datasourceInfo) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	queries, err := e.buildQueries(originalQueries, dsInfo)
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		result.Responses[query.RefID] = e.executeQuery(ctx, query, dsInfo)
	}

	return result, nil
}

func (e *InsightsAnalyticsDatasource) buildQueries(queries []backend.DataQuery, dsInfo datasourceInfo) ([]*InsightsAnalyticsQuery, error) {
	iaQueries := []*InsightsAnalyticsQuery{}

	for _, query := range queries {
		qm := InsightsAnalyticsQuery{}
		queryJSONModel := insightsAnalyticsJSONQuery{}
		err := json.Unmarshal(query.JSON, &queryJSONModel)
		if err != nil {
			return nil, fmt.Errorf("failed to decode the Azure Application Insights Analytics query object from JSON: %w", err)
		}

		qm.RawQuery = queryJSONModel.InsightsAnalytics.Query
		qm.ResultFormat = queryJSONModel.InsightsAnalytics.ResultFormat
		qm.RefID = query.RefID

		if qm.RawQuery == "" {
			return nil, fmt.Errorf("query is missing query string property")
		}

		qm.InterpolatedQuery, err = KqlInterpolate(query, dsInfo, qm.RawQuery)
		if err != nil {
			return nil, err
		}
		qm.Params = url.Values{}
		qm.Params.Add("query", qm.InterpolatedQuery)

		qm.Target = qm.Params.Encode()
		iaQueries = append(iaQueries, &qm)
	}

	return iaQueries, nil
}

func (e *InsightsAnalyticsDatasource) executeQuery(ctx context.Context, query *InsightsAnalyticsQuery, dsInfo datasourceInfo) backend.DataResponse {
	dataResponse := backend.DataResponse{}

	dataResponseError := func(err error) backend.DataResponse {
		dataResponse.Error = err
		return dataResponse
	}

	req, err := e.createRequest(ctx, dsInfo)
	if err != nil {
		return dataResponseError(err)
	}
	req.URL.Path = path.Join(req.URL.Path, "query")
	req.URL.RawQuery = query.Params.Encode()

	span, ctx := opentracing.StartSpanFromContext(ctx, "application insights analytics query")
	span.SetTag("target", query.Target)
	span.SetTag("datasource_id", dsInfo.DatasourceID)
	span.SetTag("org_id", dsInfo.OrgID)

	defer span.Finish()

	err = opentracing.GlobalTracer().Inject(
		span.Context(),
		opentracing.HTTPHeaders,
		opentracing.HTTPHeadersCarrier(req.Header))

	if err != nil {
		azlog.Warn("failed to inject global tracer")
	}

	azlog.Debug("ApplicationInsights", "Request URL", req.URL.String())
	res, err := ctxhttp.Do(ctx, dsInfo.HTTPClient, req)
	if err != nil {
		return dataResponseError(err)
	}

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return dataResponseError(err)
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			azlog.Warn("Failed to close response body", "err", err)
		}
	}()

	if res.StatusCode/100 != 2 {
		azlog.Debug("Request failed", "status", res.Status, "body", string(body))
		return dataResponseError(fmt.Errorf("request failed, status: %s, body: %s", res.Status, body))
	}
	var logResponse AzureLogAnalyticsResponse
	d := json.NewDecoder(bytes.NewReader(body))
	d.UseNumber()
	err = d.Decode(&logResponse)
	if err != nil {
		return dataResponseError(err)
	}

	t, err := logResponse.GetPrimaryResultTable()
	if err != nil {
		return dataResponseError(err)
	}

	frame, err := ResponseTableToFrame(t)
	if err != nil {
		return dataResponseError(err)
	}

	if query.ResultFormat == timeSeries {
		tsSchema := frame.TimeSeriesSchema()
		if tsSchema.Type == data.TimeSeriesTypeLong {
			wideFrame, err := data.LongToWide(frame, nil)
			if err == nil {
				frame = wideFrame
			} else {
				frame.AppendNotices(data.Notice{
					Severity: data.NoticeSeverityWarning,
					Text:     "could not convert frame to time series, returning raw table: " + err.Error(),
				})
			}
		}
	}
	dataResponse.Frames = data.Frames{frame}

	return dataResponse
}

func (e *InsightsAnalyticsDatasource) createRequest(ctx context.Context, dsInfo datasourceInfo) (*http.Request, error) {
	// find plugin
	plugin := e.pluginManager.GetDataSource(dsName)
	if plugin == nil {
		return nil, errors.New("unable to find datasource plugin Azure Application Insights")
	}

	appInsightsRoute, routeName, err := e.getPluginRoute(plugin, dsInfo)
	if err != nil {
		return nil, err
	}

	appInsightsAppID := dsInfo.Settings.AppInsightsAppId

	u, err := url.Parse(dsInfo.URL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse url for Application Insights Analytics datasource: %w", err)
	}
	u.Path = path.Join(u.Path, fmt.Sprintf("/v1/apps/%s", appInsightsAppID))

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		azlog.Debug("Failed to create request", "error", err)
		return nil, errutil.Wrap("Failed to create request", err)
	}

	// TODO: Use backend authentication instead
	proxyPass := fmt.Sprintf("%s/v1/apps/%s", routeName, appInsightsAppID)
	pluginproxy.ApplyRoute(ctx, req, proxyPass, appInsightsRoute, &models.DataSource{
		JsonData:       simplejson.NewFromAny(dsInfo.JSONData),
		SecureJsonData: securejsondata.GetEncryptedJsonData(dsInfo.DecryptedSecureJSONData),
	}, e.cfg)

	return req, nil
}

func (e *InsightsAnalyticsDatasource) getPluginRoute(plugin *plugins.DataSourcePlugin, dsInfo datasourceInfo) (*plugins.AppPluginRoute, string, error) {
	cloud, err := getAzureCloud(e.cfg, dsInfo)
	if err != nil {
		return nil, "", err
	}

	routeName, err := getAppInsightsApiRoute(cloud)
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

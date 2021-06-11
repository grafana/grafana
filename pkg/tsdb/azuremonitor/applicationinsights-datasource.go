package azuremonitor

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/net/context/ctxhttp"
)

// ApplicationInsightsDatasource calls the application insights query API.
type ApplicationInsightsDatasource struct{}

// ApplicationInsightsQuery is the model that holds the information
// needed to make a metrics query to Application Insights, and the information
// used to parse the response.
type ApplicationInsightsQuery struct {
	RefID     string
	TimeRange backend.TimeRange

	// Text based raw query options.
	ApiURL string
	Params url.Values
	Alias  string
	Target string

	// These fields are used when parsing the response.
	metricName  string
	dimensions  []string
	aggregation string
}

func (e *ApplicationInsightsDatasource) executeTimeSeriesQuery(ctx context.Context,
	originalQueries []backend.DataQuery, dsInfo datasourceInfo) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	queries, err := e.buildQueries(originalQueries)
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		queryRes, err := e.executeQuery(ctx, query, dsInfo)
		if err != nil {
			return nil, err
		}
		result.Responses[query.RefID] = queryRes
	}

	return result, nil
}

func (e *ApplicationInsightsDatasource) buildQueries(queries []backend.DataQuery) ([]*ApplicationInsightsQuery, error) {
	applicationInsightsQueries := []*ApplicationInsightsQuery{}

	for _, query := range queries {
		queryBytes, err := query.JSON.MarshalJSON()
		if err != nil {
			return nil, fmt.Errorf("failed to re-encode the Azure Application Insights query into JSON: %w", err)
		}
		queryJSONModel := insightsJSONQuery{}
		err = json.Unmarshal(queryBytes, &queryJSONModel)
		if err != nil {
			return nil, fmt.Errorf("failed to decode the Azure Application Insights query object from JSON: %w", err)
		}

		insightsJSONModel := queryJSONModel.AppInsights
		azlog.Debug("Application Insights", "target", insightsJSONModel)

		azureURL := fmt.Sprintf("metrics/%s", insightsJSONModel.MetricName)
		timeGrain := insightsJSONModel.TimeGrain
		timeGrains := insightsJSONModel.AllowedTimeGrainsMs

		// Previous versions of the query model don't specify a time grain, so we
		// need to fallback to a default value
		if timeGrain == "auto" || timeGrain == "" {
			timeGrain, err = setAutoTimeGrain(query.Interval.Milliseconds(), timeGrains)
			if err != nil {
				return nil, err
			}
		}

		params := url.Values{}
		params.Add("timespan", fmt.Sprintf("%v/%v", query.TimeRange.From.UTC().Format(time.RFC3339), query.TimeRange.To.UTC().Format(time.RFC3339)))
		if timeGrain != "none" {
			params.Add("interval", timeGrain)
		}
		params.Add("aggregation", insightsJSONModel.Aggregation)

		dimensionFilter := strings.TrimSpace(insightsJSONModel.DimensionFilter)
		if dimensionFilter != "" {
			params.Add("filter", dimensionFilter)
		}

		if len(insightsJSONModel.Dimensions) != 0 {
			params.Add("segment", strings.Join(insightsJSONModel.Dimensions, ","))
		}
		applicationInsightsQueries = append(applicationInsightsQueries, &ApplicationInsightsQuery{
			RefID:       query.RefID,
			TimeRange:   query.TimeRange,
			ApiURL:      azureURL,
			Params:      params,
			Alias:       insightsJSONModel.Alias,
			Target:      params.Encode(),
			metricName:  insightsJSONModel.MetricName,
			aggregation: insightsJSONModel.Aggregation,
			dimensions:  insightsJSONModel.Dimensions,
		})
	}

	return applicationInsightsQueries, nil
}

func (e *ApplicationInsightsDatasource) executeQuery(ctx context.Context, query *ApplicationInsightsQuery, dsInfo datasourceInfo) (
	backend.DataResponse, error) {
	dataResponse := backend.DataResponse{}

	req, err := e.createRequest(ctx, dsInfo)
	if err != nil {
		dataResponse.Error = err
		return dataResponse, nil
	}

	req.URL.Path = path.Join(req.URL.Path, query.ApiURL)
	req.URL.RawQuery = query.Params.Encode()

	span, ctx := opentracing.StartSpanFromContext(ctx, "application insights query")
	span.SetTag("target", query.Target)
	span.SetTag("from", query.TimeRange.From.UnixNano()/int64(time.Millisecond))
	span.SetTag("until", query.TimeRange.To.UnixNano()/int64(time.Millisecond))
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
	res, err := ctxhttp.Do(ctx, dsInfo.Services[appInsights].HTTPClient, req)
	if err != nil {
		dataResponse.Error = err
		return dataResponse, nil
	}

	body, err := ioutil.ReadAll(res.Body)
	defer func() {
		if err := res.Body.Close(); err != nil {
			azlog.Warn("Failed to close response body", "err", err)
		}
	}()
	if err != nil {
		return backend.DataResponse{}, err
	}

	if res.StatusCode/100 != 2 {
		azlog.Debug("Request failed", "status", res.Status, "body", string(body))
		return backend.DataResponse{}, fmt.Errorf("request failed, status: %s", res.Status)
	}

	mr := MetricsResult{}
	err = json.Unmarshal(body, &mr)
	if err != nil {
		return backend.DataResponse{}, err
	}

	frame, err := InsightsMetricsResultToFrame(mr, query.metricName, query.aggregation, query.dimensions)
	if err != nil {
		dataResponse.Error = err
		return dataResponse, nil
	}

	applyInsightsMetricAlias(frame, query.Alias)

	dataResponse.Frames = data.Frames{frame}
	return dataResponse, nil
}

func (e *ApplicationInsightsDatasource) createRequest(ctx context.Context, dsInfo datasourceInfo) (*http.Request, error) {
	appInsightsAppID := dsInfo.Settings.AppInsightsAppId

	req, err := http.NewRequest(http.MethodGet, dsInfo.Services[appInsights].URL, nil)
	if err != nil {
		azlog.Debug("Failed to create request", "error", err)
		return nil, errutil.Wrap("Failed to create request", err)
	}
	req.Header.Set("X-API-Key", dsInfo.DecryptedSecureJSONData["appInsightsApiKey"])

	req.URL.Path = fmt.Sprintf("/v1/apps/%s", appInsightsAppID)

	return req, nil
}

// formatApplicationInsightsLegendKey builds the legend key or timeseries name
// Alias patterns like {{metric}} are replaced with the appropriate data values.
func formatApplicationInsightsLegendKey(alias string, metricName string, labels data.Labels) string {
	// Could be a collision problem if there were two keys that varied only in case, but I don't think that would happen in azure.
	lowerLabels := data.Labels{}
	for k, v := range labels {
		lowerLabels[strings.ToLower(k)] = v
	}
	keys := make([]string, 0, len(labels))
	for k := range lowerLabels {
		keys = append(keys, k)
	}
	keys = sort.StringSlice(keys)

	result := legendKeyFormat.ReplaceAllFunc([]byte(alias), func(in []byte) []byte {
		metaPartName := strings.Replace(string(in), "{{", "", 1)
		metaPartName = strings.Replace(metaPartName, "}}", "", 1)
		metaPartName = strings.ToLower(strings.TrimSpace(metaPartName))

		switch metaPartName {
		case "metric":
			return []byte(metricName)
		case "dimensionname", "groupbyname":
			return []byte(keys[0])
		case "dimensionvalue", "groupbyvalue":
			return []byte(lowerLabels[keys[0]])
		}

		if v, ok := lowerLabels[metaPartName]; ok {
			return []byte(v)
		}

		return in
	})

	return string(result)
}

func applyInsightsMetricAlias(frame *data.Frame, alias string) {
	if alias == "" {
		return
	}

	for _, field := range frame.Fields {
		if field.Type() == data.FieldTypeTime || field.Type() == data.FieldTypeNullableTime {
			continue
		}

		displayName := formatApplicationInsightsLegendKey(alias, field.Name, field.Labels)

		if field.Config == nil {
			field.Config = &data.FieldConfig{}
		}

		field.Config.DisplayName = displayName
	}
}

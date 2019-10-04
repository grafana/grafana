package azuremonitor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/net/context/ctxhttp"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

// ApplicationInsightsDatasource calls the application insights query API's
type ApplicationInsightsDatasource struct {
	httpClient *http.Client
	dsInfo     *models.DataSource
}

type ApplicationInsightsQuery struct {
	RefID string

	IsRaw bool

	// Text based raw query options
	ApiURL            string
	Params            url.Values
	Alias             string
	Target            string
	TimeColumnName    string
	ValueColumnName   string
	SegmentColumnName string
}

func (e *ApplicationInsightsDatasource) executeTimeSeriesQuery(ctx context.Context, originalQueries []*tsdb.Query, timeRange *tsdb.TimeRange) (*tsdb.Response, error) {
	result := &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{},
	}

	queries, err := e.buildQueries(originalQueries, timeRange)
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		queryRes, err := e.executeQuery(ctx, query)
		if err != nil {
			return nil, err
		}
		result.Results[query.RefID] = queryRes
	}

	return result, nil
}

func (e *ApplicationInsightsDatasource) buildQueries(queries []*tsdb.Query, timeRange *tsdb.TimeRange) ([]*ApplicationInsightsQuery, error) {
	applicationInsightsQueries := []*ApplicationInsightsQuery{}
	startTime, err := timeRange.ParseFrom()
	if err != nil {
		return nil, err
	}

	endTime, err := timeRange.ParseTo()
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		applicationInsightsTarget := query.Model.Get("appInsights").MustMap()
		azlog.Debug("Application Insights", "target", applicationInsightsTarget)

		rawQuery := false
		if asInterface, ok := applicationInsightsTarget["rawQuery"]; ok {
			if asBool, ok := asInterface.(bool); ok {
				rawQuery = asBool
			} else {
				return nil, errors.New("'rawQuery' should be a boolean")
			}
		} else {
			return nil, errors.New("missing 'rawQuery' property")
		}

		if rawQuery {
			var rawQueryString string
			if asInterface, ok := applicationInsightsTarget["rawQueryString"]; ok {
				if asString, ok := asInterface.(string); ok {
					rawQueryString = asString
				}
			}
			if rawQueryString == "" {
				return nil, errors.New("rawQuery requires rawQueryString")
			}

			rawQueryString, err := KqlInterpolate(query, timeRange, fmt.Sprintf("%v", rawQueryString))
			if err != nil {
				return nil, err
			}

			params := url.Values{}
			params.Add("query", rawQueryString)

			applicationInsightsQueries = append(applicationInsightsQueries, &ApplicationInsightsQuery{
				RefID:             query.RefId,
				IsRaw:             true,
				ApiURL:            "query",
				Params:            params,
				TimeColumnName:    fmt.Sprintf("%v", applicationInsightsTarget["timeColumn"]),
				ValueColumnName:   fmt.Sprintf("%v", applicationInsightsTarget["valueColumn"]),
				SegmentColumnName: fmt.Sprintf("%v", applicationInsightsTarget["segmentColumn"]),
				Target:            params.Encode(),
			})
		} else {
			alias := ""
			if val, ok := applicationInsightsTarget["alias"]; ok {
				alias = fmt.Sprintf("%v", val)
			}

			azureURL := fmt.Sprintf("metrics/%s", fmt.Sprintf("%v", applicationInsightsTarget["metricName"]))
			timeGrain := fmt.Sprintf("%v", applicationInsightsTarget["timeGrain"])
			timeGrains := applicationInsightsTarget["allowedTimeGrainsMs"]
			if timeGrain == "auto" {
				timeGrain, err = setAutoTimeGrain(query.IntervalMs, timeGrains)
				if err != nil {
					return nil, err
				}
			}

			params := url.Values{}
			params.Add("timespan", fmt.Sprintf("%v/%v", startTime.UTC().Format(time.RFC3339), endTime.UTC().Format(time.RFC3339)))
			if timeGrain != "none" {
				params.Add("interval", timeGrain)
			}
			params.Add("aggregation", fmt.Sprintf("%v", applicationInsightsTarget["aggregation"]))

			dimension := strings.TrimSpace(fmt.Sprintf("%v", applicationInsightsTarget["dimension"]))
			if applicationInsightsTarget["dimension"] != nil && len(dimension) > 0 && !strings.EqualFold(dimension, "none") {
				params.Add("segment", dimension)
			}

			dimensionFilter := strings.TrimSpace(fmt.Sprintf("%v", applicationInsightsTarget["dimensionFilter"]))
			if applicationInsightsTarget["dimensionFilter"] != nil && len(dimensionFilter) > 0 {
				params.Add("filter", fmt.Sprintf("%v", dimensionFilter))
			}

			applicationInsightsQueries = append(applicationInsightsQueries, &ApplicationInsightsQuery{
				RefID:  query.RefId,
				IsRaw:  false,
				ApiURL: azureURL,
				Params: params,
				Alias:  alias,
				Target: params.Encode(),
			})
		}
	}

	return applicationInsightsQueries, nil
}

func (e *ApplicationInsightsDatasource) executeQuery(ctx context.Context, query *ApplicationInsightsQuery) (*tsdb.QueryResult, error) {
	queryResult := &tsdb.QueryResult{Meta: simplejson.New(), RefId: query.RefID}

	req, err := e.createRequest(ctx, e.dsInfo)
	if err != nil {
		queryResult.Error = err
		return queryResult, nil
	}

	req.URL.Path = path.Join(req.URL.Path, query.ApiURL)
	req.URL.RawQuery = query.Params.Encode()

	span, ctx := opentracing.StartSpanFromContext(ctx, "application insights query")
	span.SetTag("target", query.Target)
	span.SetTag("datasource_id", e.dsInfo.Id)
	span.SetTag("org_id", e.dsInfo.OrgId)

	defer span.Finish()

	err = opentracing.GlobalTracer().Inject(
		span.Context(),
		opentracing.HTTPHeaders,
		opentracing.HTTPHeadersCarrier(req.Header))

	if err != nil {
		azlog.Warn("failed to inject global tracer")
	}

	azlog.Debug("ApplicationInsights", "Request URL", req.URL.String())
	res, err := ctxhttp.Do(ctx, e.httpClient, req)
	if err != nil {
		queryResult.Error = err
		return queryResult, nil
	}

	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		return nil, err
	}

	if res.StatusCode/100 != 2 {
		azlog.Error("Request failed", "status", res.Status, "body", string(body))
		return nil, fmt.Errorf(string(body))
	}

	if query.IsRaw {
		queryResult.Series, queryResult.Meta, err = e.parseTimeSeriesFromQuery(body, query)
		if err != nil {
			queryResult.Error = err
			return queryResult, nil
		}
	} else {
		queryResult.Series, err = e.parseTimeSeriesFromMetrics(body, query)
		if err != nil {
			queryResult.Error = err
			return queryResult, nil
		}
	}

	return queryResult, nil
}

func (e *ApplicationInsightsDatasource) createRequest(ctx context.Context, dsInfo *models.DataSource) (*http.Request, error) {
	// find plugin
	plugin, ok := plugins.DataSources[dsInfo.Type]
	if !ok {
		return nil, errors.New("Unable to find datasource plugin Azure Application Insights")
	}

	var appInsightsRoute *plugins.AppPluginRoute
	for _, route := range plugin.Routes {
		if route.Path == "appinsights" {
			appInsightsRoute = route
			break
		}
	}

	appInsightsAppId := dsInfo.JsonData.Get("appInsightsAppId").MustString()
	proxyPass := fmt.Sprintf("appinsights/v1/apps/%s", appInsightsAppId)

	u, _ := url.Parse(dsInfo.Url)
	u.Path = path.Join(u.Path, fmt.Sprintf("/v1/apps/%s", appInsightsAppId))

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		azlog.Error("Failed to create request", "error", err)
		return nil, fmt.Errorf("Failed to create request. error: %v", err)
	}

	req.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))

	pluginproxy.ApplyRoute(ctx, req, proxyPass, appInsightsRoute, dsInfo)

	return req, nil
}

func (e *ApplicationInsightsDatasource) parseTimeSeriesFromQuery(body []byte, query *ApplicationInsightsQuery) (tsdb.TimeSeriesSlice, *simplejson.Json, error) {
	var data ApplicationInsightsQueryResponse
	err := json.Unmarshal(body, &data)
	if err != nil {
		azlog.Error("Failed to unmarshal Application Insights response", "error", err, "body", string(body))
		return nil, nil, err
	}

	type Metadata struct {
		Columns []string `json:"columns"`
	}

	meta := Metadata{}

	for _, t := range data.Tables {
		if t.Name == "PrimaryResult" {
			timeIndex, valueIndex, segmentIndex := -1, -1, -1
			meta.Columns = make([]string, 0)
			for i, v := range t.Columns {
				meta.Columns = append(meta.Columns, v.Name)
				switch v.Name {
				case query.TimeColumnName:
					timeIndex = i
				case query.ValueColumnName:
					valueIndex = i
				case query.SegmentColumnName:
					segmentIndex = i
				}
			}

			if timeIndex == -1 {
				azlog.Info("no time column specified, returning existing columns, no data")
				return nil, simplejson.NewFromAny(meta), nil
			}

			if valueIndex == -1 {
				azlog.Info("no value column specified, returning existing columns, no data")
				return nil, simplejson.NewFromAny(meta), nil
			}

			var getPoints func([]interface{}) *tsdb.TimeSeriesPoints
			slice := tsdb.TimeSeriesSlice{}
			if segmentIndex == -1 {
				legend := formatApplicationInsightsLegendKey(query.Alias, query.ValueColumnName, "", "")
				series := tsdb.NewTimeSeries(legend, []tsdb.TimePoint{})
				slice = append(slice, series)
				getPoints = func(row []interface{}) *tsdb.TimeSeriesPoints {
					return &series.Points
				}
			} else {
				mapping := map[string]*tsdb.TimeSeriesPoints{}
				getPoints = func(row []interface{}) *tsdb.TimeSeriesPoints {
					segment := fmt.Sprintf("%v", row[segmentIndex])
					if points, ok := mapping[segment]; ok {
						return points
					}
					legend := formatApplicationInsightsLegendKey(query.Alias, query.ValueColumnName, query.SegmentColumnName, segment)
					series := tsdb.NewTimeSeries(legend, []tsdb.TimePoint{})
					slice = append(slice, series)
					mapping[segment] = &series.Points
					return &series.Points
				}
			}

			for _, r := range t.Rows {
				timeStr, ok := r[timeIndex].(string)
				if !ok {
					return nil, simplejson.NewFromAny(meta), errors.New("invalid time value")
				}
				timeValue, err := time.Parse(time.RFC3339Nano, timeStr)
				if err != nil {
					return nil, simplejson.NewFromAny(meta), err
				}

				var value float64
				if value, err = getFloat(r[valueIndex]); err != nil {
					return nil, simplejson.NewFromAny(meta), err
				}

				points := getPoints(r)
				*points = append(*points, tsdb.NewTimePoint(null.FloatFrom(value), float64(timeValue.Unix()*1000)))
			}

			return slice, simplejson.NewFromAny(meta), nil
		}
	}

	return nil, nil, errors.New("could not find table")
}

func (e *ApplicationInsightsDatasource) parseTimeSeriesFromMetrics(body []byte, query *ApplicationInsightsQuery) (tsdb.TimeSeriesSlice, error) {
	doc, err := simplejson.NewJson(body)
	if err != nil {
		return nil, err
	}

	value := doc.Get("value").MustMap()

	if value == nil {
		return nil, errors.New("could not find value element")
	}

	endStr, ok := value["end"].(string)
	if !ok {
		return nil, errors.New("missing 'end' value in response")
	}
	endTime, err := time.Parse(time.RFC3339Nano, endStr)
	if err != nil {
		return nil, fmt.Errorf("bad 'end' value: %v", err)
	}

	for k, v := range value {
		switch k {
		case "start":
		case "end":
		case "interval":
		case "segments":
			// we have segments!
			return parseSegmentedValueTimeSeries(query, endTime, v)
		default:
			return parseSingleValueTimeSeries(query, k, endTime, v)
		}
	}

	azlog.Error("Bad response from application insights/metrics", "body", string(body))
	return nil, errors.New("could not find expected values in response")
}

func parseSegmentedValueTimeSeries(query *ApplicationInsightsQuery, endTime time.Time, segmentsJson interface{}) (tsdb.TimeSeriesSlice, error) {
	segments, ok := segmentsJson.([]interface{})
	if !ok {
		return nil, errors.New("bad segments value")
	}

	slice := tsdb.TimeSeriesSlice{}
	seriesMap := map[string]*tsdb.TimeSeriesPoints{}

	for _, segment := range segments {
		segmentMap, ok := segment.(map[string]interface{})
		if !ok {
			return nil, errors.New("bad segments value")
		}
		err := processSegment(&slice, segmentMap, query, endTime, seriesMap)
		if err != nil {
			return nil, err
		}
	}

	return slice, nil
}

func processSegment(slice *tsdb.TimeSeriesSlice, segment map[string]interface{}, query *ApplicationInsightsQuery, endTime time.Time, pointMap map[string]*tsdb.TimeSeriesPoints) error {
	var segmentName string
	var segmentValue string
	var childSegments []interface{}
	hasChildren := false
	var value float64
	var valueName string
	var ok bool
	var err error
	for k, v := range segment {
		switch k {
		case "start":
		case "end":
			endStr, ok := v.(string)
			if !ok {
				return errors.New("missing 'end' value in response")
			}
			endTime, err = time.Parse(time.RFC3339Nano, endStr)
			if err != nil {
				return fmt.Errorf("bad 'end' value: %v", err)
			}
		case "segments":
			childSegments, ok = v.([]interface{})
			if !ok {
				return errors.New("invalid format segments")
			}
			hasChildren = true
		default:
			mapping, hasValues := v.(map[string]interface{})
			if hasValues {
				valueName = k
				value, err = getAggregatedValue(mapping, valueName)
				if err != nil {
					return err
				}
			} else {
				segmentValue, ok = v.(string)
				if !ok {
					return fmt.Errorf("invalid mapping for key %v", k)
				}
				segmentName = k
			}
		}
	}

	if hasChildren {
		for _, s := range childSegments {
			segmentMap, ok := s.(map[string]interface{})
			if !ok {
				return errors.New("invalid format segments")
			}
			if err := processSegment(slice, segmentMap, query, endTime, pointMap); err != nil {
				return err
			}
		}
	} else {

		aliased := formatApplicationInsightsLegendKey(query.Alias, valueName, segmentName, segmentValue)

		if segmentValue == "" {
			segmentValue = valueName
		}

		points, ok := pointMap[segmentValue]

		if !ok {
			series := tsdb.NewTimeSeries(aliased, tsdb.TimeSeriesPoints{})
			points = &series.Points
			*slice = append(*slice, series)
			pointMap[segmentValue] = points
		}

		*points = append(*points, tsdb.NewTimePoint(null.FloatFrom(value), float64(endTime.Unix()*1000)))
	}

	return nil
}

func parseSingleValueTimeSeries(query *ApplicationInsightsQuery, metricName string, endTime time.Time, valueJson interface{}) (tsdb.TimeSeriesSlice, error) {
	legend := formatApplicationInsightsLegendKey(query.Alias, metricName, "", "")

	valueMap, ok := valueJson.(map[string]interface{})
	if !ok {
		return nil, errors.New("bad value aggregation")
	}

	metricValue, err := getAggregatedValue(valueMap, metricName)
	if err != nil {
		return nil, err
	}

	return []*tsdb.TimeSeries{
		tsdb.NewTimeSeries(
			legend,
			tsdb.TimeSeriesPoints{
				tsdb.NewTimePoint(
					null.FloatFrom(metricValue),
					float64(endTime.Unix()*1000)),
			},
		),
	}, nil
}

func getAggregatedValue(valueMap map[string]interface{}, valueName string) (float64, error) {

	aggValue := ""
	var metricValue float64
	var err error
	for k, v := range valueMap {
		if aggValue != "" {
			return 0, fmt.Errorf("found multiple aggregations, %v, %v", aggValue, k)
		}
		if k == "" {
			return 0, errors.New("found no aggregation name")
		}
		aggValue = k
		metricValue, err = getFloat(v)

		if err != nil {
			return 0, fmt.Errorf("bad value: %v", err)
		}
	}

	if aggValue == "" {
		return 0, fmt.Errorf("no aggregation value found for %v", valueName)
	}

	return metricValue, nil
}

func getFloat(in interface{}) (float64, error) {
	if out, ok := in.(float32); ok {
		return float64(out), nil
	} else if out, ok := in.(int32); ok {
		return float64(out), nil
	} else if out, ok := in.(json.Number); ok {
		return out.Float64()
	} else if out, ok := in.(int64); ok {
		return float64(out), nil
	} else if out, ok := in.(float64); ok {
		return out, nil
	}

	return 0, fmt.Errorf("cannot convert '%v' to float32", in)
}

// formatApplicationInsightsLegendKey builds the legend key or timeseries name
// Alias patterns like {{resourcename}} are replaced with the appropriate data values.
func formatApplicationInsightsLegendKey(alias string, metricName string, dimensionName string, dimensionValue string) string {
	if alias == "" {
		if len(dimensionName) > 0 {
			return fmt.Sprintf("{%s=%s}.%s", dimensionName, dimensionValue, metricName)
		}
		return metricName
	}

	result := legendKeyFormat.ReplaceAllFunc([]byte(alias), func(in []byte) []byte {
		metaPartName := strings.Replace(string(in), "{{", "", 1)
		metaPartName = strings.Replace(metaPartName, "}}", "", 1)
		metaPartName = strings.ToLower(strings.TrimSpace(metaPartName))

		switch metaPartName {
		case "metric":
			return []byte(metricName)
		case "dimensionname", "groupbyname":
			return []byte(dimensionName)
		case "dimensionvalue", "groupbyvalue":
			return []byte(dimensionValue)
		}

		return in
	})

	return string(result)
}

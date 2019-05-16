package stackdriver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"math"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/context/ctxhttp"
	"golang.org/x/oauth2/google"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/opentracing/opentracing-go"
)

var (
	slog             log.Logger
	legendKeyFormat  *regexp.Regexp
	metricNameFormat *regexp.Regexp
)

const (
	gceAuthentication string = "gce"
	jwtAuthentication string = "jwt"
)

// StackdriverExecutor executes queries for the Stackdriver datasource
type StackdriverExecutor struct {
	httpClient *http.Client
	dsInfo     *models.DataSource
}

// NewStackdriverExecutor initializes a http client
func NewStackdriverExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	httpClient, err := dsInfo.GetHttpClient()
	if err != nil {
		return nil, err
	}

	return &StackdriverExecutor{
		httpClient: httpClient,
		dsInfo:     dsInfo,
	}, nil
}

func init() {
	slog = log.New("tsdb.stackdriver")
	tsdb.RegisterTsdbQueryEndpoint("stackdriver", NewStackdriverExecutor)
	legendKeyFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
	metricNameFormat = regexp.MustCompile(`([\w\d_]+)\.googleapis\.com/(.+)`)
}

// Query takes in the frontend queries, parses them into the Stackdriver query format
// executes the queries against the Stackdriver API and parses the response into
// the time series or table format
func (e *StackdriverExecutor) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	var result *tsdb.Response
	var err error
	queryType := tsdbQuery.Queries[0].Model.Get("type").MustString("")

	switch queryType {
	case "annotationQuery":
		result, err = e.executeAnnotationQuery(ctx, tsdbQuery)
	case "ensureDefaultProjectQuery":
		result, err = e.ensureDefaultProject(ctx, tsdbQuery)
	case "timeSeriesQuery":
		fallthrough
	default:
		result, err = e.executeTimeSeriesQuery(ctx, tsdbQuery)
	}

	return result, err
}

func (e *StackdriverExecutor) executeTimeSeriesQuery(ctx context.Context, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}

	authenticationType := e.dsInfo.JsonData.Get("authenticationType").MustString(jwtAuthentication)
	if authenticationType == gceAuthentication {
		defaultProject, err := e.getDefaultProject(ctx)
		if err != nil {
			return nil, fmt.Errorf("Failed to retrieve default project from GCE metadata server. error: %v", err)
		}

		e.dsInfo.JsonData.Set("defaultProject", defaultProject)
	}

	queries, err := e.buildQueries(tsdbQuery)
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		queryRes, resp, err := e.executeQuery(ctx, query, tsdbQuery)
		if err != nil {
			return nil, err
		}
		err = e.parseResponse(queryRes, resp, query)
		if err != nil {
			queryRes.Error = err
		}
		result.Results[query.RefID] = queryRes
	}

	return result, nil
}

func (e *StackdriverExecutor) buildQueries(tsdbQuery *tsdb.TsdbQuery) ([]*StackdriverQuery, error) {
	stackdriverQueries := []*StackdriverQuery{}

	startTime, err := tsdbQuery.TimeRange.ParseFrom()
	if err != nil {
		return nil, err
	}

	endTime, err := tsdbQuery.TimeRange.ParseTo()
	if err != nil {
		return nil, err
	}

	durationSeconds := int(endTime.Sub(startTime).Seconds())

	for _, query := range tsdbQuery.Queries {
		var target string

		metricType := query.Model.Get("metricType").MustString()
		filterParts := query.Model.Get("filters").MustArray()

		params := url.Values{}
		params.Add("interval.startTime", startTime.UTC().Format(time.RFC3339))
		params.Add("interval.endTime", endTime.UTC().Format(time.RFC3339))
		params.Add("filter", buildFilterString(metricType, filterParts))
		params.Add("view", query.Model.Get("view").MustString("FULL"))
		setAggParams(&params, query, durationSeconds)

		target = params.Encode()

		if setting.Env == setting.DEV {
			slog.Debug("Stackdriver request", "params", params)
		}

		groupBys := query.Model.Get("groupBys").MustArray()
		groupBysAsStrings := make([]string, 0)
		for _, groupBy := range groupBys {
			groupBysAsStrings = append(groupBysAsStrings, groupBy.(string))
		}

		aliasBy := query.Model.Get("aliasBy").MustString()

		stackdriverQueries = append(stackdriverQueries, &StackdriverQuery{
			Target:   target,
			Params:   params,
			RefID:    query.RefId,
			GroupBys: groupBysAsStrings,
			AliasBy:  aliasBy,
		})
	}

	return stackdriverQueries, nil
}

func reverse(s string) string {
	chars := []rune(s)
	for i, j := 0, len(chars)-1; i < j; i, j = i+1, j-1 {
		chars[i], chars[j] = chars[j], chars[i]
	}
	return string(chars)
}

func interpolateFilterWildcards(value string) string {
	matches := strings.Count(value, "*")
	if matches == 2 && strings.HasSuffix(value, "*") && strings.HasPrefix(value, "*") {
		value = strings.Replace(value, "*", "", -1)
		value = fmt.Sprintf(`has_substring("%s")`, value)
	} else if matches == 1 && strings.HasPrefix(value, "*") {
		value = strings.Replace(value, "*", "", 1)
		value = fmt.Sprintf(`ends_with("%s")`, value)
	} else if matches == 1 && strings.HasSuffix(value, "*") {
		value = reverse(strings.Replace(reverse(value), "*", "", 1))
		value = fmt.Sprintf(`starts_with("%s")`, value)
	} else if matches != 0 {
		re := regexp.MustCompile(`[-\/^$+?.()|[\]{}]`)
		value = string(re.ReplaceAllFunc([]byte(value), func(in []byte) []byte {
			return []byte(strings.Replace(string(in), string(in), `\\`+string(in), 1))
		}))
		value = strings.Replace(value, "*", ".*", -1)
		value = strings.Replace(value, `"`, `\\"`, -1)
		value = fmt.Sprintf(`monitoring.regex.full_match("^%s$")`, value)
	}

	return value
}

func buildFilterString(metricType string, filterParts []interface{}) string {
	filterString := ""
	for i, part := range filterParts {
		mod := i % 4
		if part == "AND" {
			filterString += " "
		} else if mod == 2 {
			operator := filterParts[i-1]
			if operator == "=~" || operator == "!=~" {
				filterString = reverse(strings.Replace(reverse(filterString), "~", "", 1))
				filterString += fmt.Sprintf(`monitoring.regex.full_match("%s")`, part)
			} else if strings.Contains(part.(string), "*") {
				filterString += interpolateFilterWildcards(part.(string))
			} else {
				filterString += fmt.Sprintf(`"%s"`, part)
			}
		} else {
			filterString += part.(string)
		}
	}
	return strings.Trim(fmt.Sprintf(`metric.type="%s" %s`, metricType, filterString), " ")
}

func setAggParams(params *url.Values, query *tsdb.Query, durationSeconds int) {
	crossSeriesReducer := query.Model.Get("crossSeriesReducer").MustString()
	perSeriesAligner := query.Model.Get("perSeriesAligner").MustString()
	alignmentPeriod := query.Model.Get("alignmentPeriod").MustString()

	if crossSeriesReducer == "" {
		crossSeriesReducer = "REDUCE_NONE"
	}

	if perSeriesAligner == "" {
		perSeriesAligner = "ALIGN_MEAN"
	}

	if alignmentPeriod == "grafana-auto" || alignmentPeriod == "" {
		alignmentPeriodValue := int(math.Max(float64(query.IntervalMs)/1000, 60.0))
		alignmentPeriod = "+" + strconv.Itoa(alignmentPeriodValue) + "s"
	}

	if alignmentPeriod == "stackdriver-auto" {
		alignmentPeriodValue := int(math.Max(float64(durationSeconds), 60.0))
		if alignmentPeriodValue < 60*60*23 {
			alignmentPeriod = "+60s"
		} else if alignmentPeriodValue < 60*60*24*6 {
			alignmentPeriod = "+300s"
		} else {
			alignmentPeriod = "+3600s"
		}
	}

	re := regexp.MustCompile("[0-9]+")
	seconds, err := strconv.ParseInt(re.FindString(alignmentPeriod), 10, 64)
	if err != nil || seconds > 3600 {
		alignmentPeriod = "+3600s"
	}

	params.Add("aggregation.crossSeriesReducer", crossSeriesReducer)
	params.Add("aggregation.perSeriesAligner", perSeriesAligner)
	params.Add("aggregation.alignmentPeriod", alignmentPeriod)

	groupBys := query.Model.Get("groupBys").MustArray()
	if len(groupBys) > 0 {
		for i := 0; i < len(groupBys); i++ {
			params.Add("aggregation.groupByFields", groupBys[i].(string))
		}
	}
}

func (e *StackdriverExecutor) executeQuery(ctx context.Context, query *StackdriverQuery, tsdbQuery *tsdb.TsdbQuery) (*tsdb.QueryResult, StackdriverResponse, error) {
	queryResult := &tsdb.QueryResult{Meta: simplejson.New(), RefId: query.RefID}

	req, err := e.createRequest(ctx, e.dsInfo)
	if err != nil {
		queryResult.Error = err
		return queryResult, StackdriverResponse{}, nil
	}

	req.URL.RawQuery = query.Params.Encode()
	queryResult.Meta.Set("rawQuery", req.URL.RawQuery)
	alignmentPeriod, ok := req.URL.Query()["aggregation.alignmentPeriod"]

	if ok {
		re := regexp.MustCompile("[0-9]+")
		seconds, err := strconv.ParseInt(re.FindString(alignmentPeriod[0]), 10, 64)
		if err == nil {
			queryResult.Meta.Set("alignmentPeriod", seconds)
		}
	}

	span, ctx := opentracing.StartSpanFromContext(ctx, "stackdriver query")
	span.SetTag("target", query.Target)
	span.SetTag("from", tsdbQuery.TimeRange.From)
	span.SetTag("until", tsdbQuery.TimeRange.To)
	span.SetTag("datasource_id", e.dsInfo.Id)
	span.SetTag("org_id", e.dsInfo.OrgId)

	defer span.Finish()

	opentracing.GlobalTracer().Inject(
		span.Context(),
		opentracing.HTTPHeaders,
		opentracing.HTTPHeadersCarrier(req.Header))

	res, err := ctxhttp.Do(ctx, e.httpClient, req)
	if err != nil {
		queryResult.Error = err
		return queryResult, StackdriverResponse{}, nil
	}

	data, err := e.unmarshalResponse(res)
	if err != nil {
		queryResult.Error = err
		return queryResult, StackdriverResponse{}, nil
	}

	return queryResult, data, nil
}

func (e *StackdriverExecutor) unmarshalResponse(res *http.Response) (StackdriverResponse, error) {
	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		return StackdriverResponse{}, err
	}

	// slog.Info("stackdriver", "response", string(body))

	if res.StatusCode/100 != 2 {
		slog.Error("Request failed", "status", res.Status, "body", string(body))
		return StackdriverResponse{}, fmt.Errorf(string(body))
	}

	var data StackdriverResponse
	err = json.Unmarshal(body, &data)
	if err != nil {
		slog.Error("Failed to unmarshal Stackdriver response", "error", err, "status", res.Status, "body", string(body))
		return StackdriverResponse{}, err
	}

	return data, nil
}

func (e *StackdriverExecutor) parseResponse(queryRes *tsdb.QueryResult, data StackdriverResponse, query *StackdriverQuery) error {
	metricLabels := make(map[string][]string)
	resourceLabels := make(map[string][]string)
	var resourceTypes []string

	for _, series := range data.TimeSeries {
		if !containsLabel(resourceTypes, series.Resource.Type) {
			resourceTypes = append(resourceTypes, series.Resource.Type)
		}
	}

	for _, series := range data.TimeSeries {
		points := make([]tsdb.TimePoint, 0)

		defaultMetricName := series.Metric.Type
		if len(resourceTypes) > 1 {
			defaultMetricName += " " + series.Resource.Type
		}

		for key, value := range series.Metric.Labels {
			if !containsLabel(metricLabels[key], value) {
				metricLabels[key] = append(metricLabels[key], value)
			}
			if len(query.GroupBys) == 0 || containsLabel(query.GroupBys, "metric.label."+key) {
				defaultMetricName += " " + value
			}
		}

		for key, value := range series.Resource.Labels {
			if !containsLabel(resourceLabels[key], value) {
				resourceLabels[key] = append(resourceLabels[key], value)
			}
			if containsLabel(query.GroupBys, "resource.label."+key) {
				defaultMetricName += " " + value
			}
		}

		// reverse the order to be ascending
		if series.ValueType != "DISTRIBUTION" {
			for i := len(series.Points) - 1; i >= 0; i-- {
				point := series.Points[i]
				value := point.Value.DoubleValue

				if series.ValueType == "INT64" {
					parsedValue, err := strconv.ParseFloat(point.Value.IntValue, 64)
					if err == nil {
						value = parsedValue
					}
				}

				if series.ValueType == "BOOL" {
					if point.Value.BoolValue {
						value = 1
					} else {
						value = 0
					}
				}

				points = append(points, tsdb.NewTimePoint(null.FloatFrom(value), float64((point.Interval.EndTime).Unix())*1000))
			}

			metricName := formatLegendKeys(series.Metric.Type, defaultMetricName, series.Resource.Type, series.Metric.Labels, series.Resource.Labels, make(map[string]string), query)

			queryRes.Series = append(queryRes.Series, &tsdb.TimeSeries{
				Name:   metricName,
				Points: points,
			})
		} else {
			buckets := make(map[int]*tsdb.TimeSeries)

			for i := len(series.Points) - 1; i >= 0; i-- {
				point := series.Points[i]
				if len(point.Value.DistributionValue.BucketCounts) == 0 {
					continue
				}
				maxKey := 0
				for i := 0; i < len(point.Value.DistributionValue.BucketCounts); i++ {
					value, err := strconv.ParseFloat(point.Value.DistributionValue.BucketCounts[i], 64)
					if err != nil {
						continue
					}
					if _, ok := buckets[i]; !ok {
						// set lower bounds
						// https://cloud.google.com/monitoring/api/ref_v3/rest/v3/TimeSeries#Distribution
						bucketBound := calcBucketBound(point.Value.DistributionValue.BucketOptions, i)
						additionalLabels := map[string]string{"bucket": bucketBound}
						buckets[i] = &tsdb.TimeSeries{
							Name:   formatLegendKeys(series.Metric.Type, defaultMetricName, series.Resource.Type, series.Metric.Labels, series.Resource.Labels, additionalLabels, query),
							Points: make([]tsdb.TimePoint, 0),
						}
						if maxKey < i {
							maxKey = i
						}
					}
					buckets[i].Points = append(buckets[i].Points, tsdb.NewTimePoint(null.FloatFrom(value), float64((point.Interval.EndTime).Unix())*1000))
				}

				// fill empty bucket
				for i := 0; i < maxKey; i++ {
					if _, ok := buckets[i]; !ok {
						bucketBound := calcBucketBound(point.Value.DistributionValue.BucketOptions, i)
						additionalLabels := map[string]string{"bucket": bucketBound}
						buckets[i] = &tsdb.TimeSeries{
							Name:   formatLegendKeys(series.Metric.Type, defaultMetricName, series.Resource.Type, series.Metric.Labels, series.Resource.Labels, additionalLabels, query),
							Points: make([]tsdb.TimePoint, 0),
						}
					}
				}
			}
			for i := 0; i < len(buckets); i++ {
				queryRes.Series = append(queryRes.Series, buckets[i])
			}
		}
	}

	queryRes.Meta.Set("resourceLabels", resourceLabels)
	queryRes.Meta.Set("metricLabels", metricLabels)
	queryRes.Meta.Set("groupBys", query.GroupBys)
	queryRes.Meta.Set("resourceTypes", resourceTypes)

	return nil
}

func containsLabel(labels []string, newLabel string) bool {
	for _, val := range labels {
		if val == newLabel {
			return true
		}
	}
	return false
}

func formatLegendKeys(metricType string, defaultMetricName string, resourceType string, metricLabels map[string]string, resourceLabels map[string]string, additionalLabels map[string]string, query *StackdriverQuery) string {
	if query.AliasBy == "" {
		return defaultMetricName
	}

	result := legendKeyFormat.ReplaceAllFunc([]byte(query.AliasBy), func(in []byte) []byte {
		metaPartName := strings.Replace(string(in), "{{", "", 1)
		metaPartName = strings.Replace(metaPartName, "}}", "", 1)
		metaPartName = strings.TrimSpace(metaPartName)

		if metaPartName == "metric.type" {
			return []byte(metricType)
		}

		if metaPartName == "resource.type" && resourceType != "" {
			return []byte(resourceType)
		}

		metricPart := replaceWithMetricPart(metaPartName, metricType)

		if metricPart != nil {
			return metricPart
		}

		metaPartName = strings.Replace(metaPartName, "metric.label.", "", 1)

		if val, exists := metricLabels[metaPartName]; exists {
			return []byte(val)
		}

		metaPartName = strings.Replace(metaPartName, "resource.label.", "", 1)

		if val, exists := resourceLabels[metaPartName]; exists {
			return []byte(val)
		}

		if val, exists := additionalLabels[metaPartName]; exists {
			return []byte(val)
		}

		return in
	})

	return string(result)
}

func replaceWithMetricPart(metaPartName string, metricType string) []byte {
	// https://cloud.google.com/monitoring/api/v3/metrics-details#label_names
	shortMatches := metricNameFormat.FindStringSubmatch(metricType)

	if metaPartName == "metric.name" {
		if len(shortMatches) > 0 {
			return []byte(shortMatches[2])
		}
	}

	if metaPartName == "metric.service" {
		if len(shortMatches) > 0 {
			return []byte(shortMatches[1])
		}
	}

	return nil
}

func calcBucketBound(bucketOptions StackdriverBucketOptions, n int) string {
	bucketBound := "0"
	if n == 0 {
		return bucketBound
	}

	if bucketOptions.LinearBuckets != nil {
		bucketBound = strconv.FormatInt(bucketOptions.LinearBuckets.Offset+(bucketOptions.LinearBuckets.Width*int64(n-1)), 10)
	} else if bucketOptions.ExponentialBuckets != nil {
		bucketBound = strconv.FormatInt(int64(bucketOptions.ExponentialBuckets.Scale*math.Pow(bucketOptions.ExponentialBuckets.GrowthFactor, float64(n-1))), 10)
	} else if bucketOptions.ExplicitBuckets != nil {
		bucketBound = fmt.Sprintf("%g", bucketOptions.ExplicitBuckets.Bounds[n])
	}
	return bucketBound
}

func (e *StackdriverExecutor) createRequest(ctx context.Context, dsInfo *models.DataSource) (*http.Request, error) {
	u, _ := url.Parse(dsInfo.Url)
	u.Path = path.Join(u.Path, "render")

	req, err := http.NewRequest(http.MethodGet, "https://monitoring.googleapis.com/", nil)
	if err != nil {
		slog.Error("Failed to create request", "error", err)
		return nil, fmt.Errorf("Failed to create request. error: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))

	// find plugin
	plugin, ok := plugins.DataSources[dsInfo.Type]
	if !ok {
		return nil, errors.New("Unable to find datasource plugin Stackdriver")
	}

	var stackdriverRoute *plugins.AppPluginRoute
	for _, route := range plugin.Routes {
		if route.Path == "stackdriver" {
			stackdriverRoute = route
			break
		}
	}

	projectName := dsInfo.JsonData.Get("defaultProject").MustString()
	proxyPass := fmt.Sprintf("stackdriver%s", "v3/projects/"+projectName+"/timeSeries")

	pluginproxy.ApplyRoute(ctx, req, proxyPass, stackdriverRoute, dsInfo)

	return req, nil
}

func (e *StackdriverExecutor) getDefaultProject(ctx context.Context) (string, error) {
	authenticationType := e.dsInfo.JsonData.Get("authenticationType").MustString(jwtAuthentication)
	if authenticationType == gceAuthentication {
		defaultCredentials, err := google.FindDefaultCredentials(ctx, "https://www.googleapis.com/auth/monitoring.read")
		if err != nil {
			return "", fmt.Errorf("Failed to retrieve default project from GCE metadata server. error: %v", err)
		}
		return defaultCredentials.ProjectID, nil
	}
	return e.dsInfo.JsonData.Get("defaultProject").MustString(), nil
}

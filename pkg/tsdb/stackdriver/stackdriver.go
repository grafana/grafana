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

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/net/context/ctxhttp"
	"golang.org/x/oauth2/google"
)

var (
	slog log.Logger
)

var (
	matchAllCap       = regexp.MustCompile("(.)([A-Z][a-z]*)")
	legendKeyFormat   = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
	metricNameFormat  = regexp.MustCompile(`([\w\d_]+)\.(googleapis\.com|io)/(.+)`)
	wildcardRegexRe   = regexp.MustCompile(`[-\/^$+?.()|[\]{}]`)
	alignmentPeriodRe = regexp.MustCompile("[0-9]+")
)

const (
	gceAuthentication string = "gce"
	jwtAuthentication string = "jwt"
	metricQueryType   string = "metrics"
	sloQueryType      string = "slo"
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
	case "getGCEDefaultProject":
		result, err = e.getGCEDefaultProject(ctx, tsdbQuery)
	case "timeSeriesQuery":
		fallthrough
	default:
		result, err = e.executeTimeSeriesQuery(ctx, tsdbQuery)
	}

	return result, err
}

func (e *StackdriverExecutor) getGCEDefaultProject(ctx context.Context, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}
	refId := tsdbQuery.Queries[0].RefId
	queryResult := &tsdb.QueryResult{Meta: simplejson.New(), RefId: refId}

	gceDefaultProject, err := e.getDefaultProject(ctx)
	if err != nil {
		return nil, fmt.Errorf("Failed to retrieve default project from GCE metadata server. error: %v", err)
	}

	queryResult.Meta.Set("defaultProject", gceDefaultProject)
	result.Results[refId] = queryResult

	return result, nil
}

func (e *StackdriverExecutor) executeTimeSeriesQuery(ctx context.Context, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
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

func (e *StackdriverExecutor) buildQueries(tsdbQuery *tsdb.TsdbQuery) ([]*stackdriverQuery, error) {
	stackdriverQueries := []*stackdriverQuery{}

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
		migrateLegacyQueryModel(query)
		q := grafanaQuery{}
		model, _ := query.Model.MarshalJSON()
		if err := json.Unmarshal(model, &q); err != nil {
			return nil, fmt.Errorf("could not unmarshal StackdriverQuery json: %w", err)
		}
		var target string
		params := url.Values{}
		params.Add("interval.startTime", startTime.UTC().Format(time.RFC3339))
		params.Add("interval.endTime", endTime.UTC().Format(time.RFC3339))

		sq := &stackdriverQuery{
			RefID:    query.RefId,
			GroupBys: []string{},
		}

		if q.QueryType == metricQueryType {
			sq.AliasBy = q.MetricQuery.AliasBy
			sq.GroupBys = append(sq.GroupBys, q.MetricQuery.GroupBys...)
			sq.ProjectName = q.MetricQuery.ProjectName
			if q.MetricQuery.View == "" {
				q.MetricQuery.View = "FULL"
			}
			params.Add("filter", buildFilterString(q.MetricQuery.MetricType, q.MetricQuery.Filters))
			params.Add("view", q.MetricQuery.View)
			setMetricAggParams(&params, &q.MetricQuery, durationSeconds, query.IntervalMs)
		} else if q.QueryType == sloQueryType {
			sq.AliasBy = q.SloQuery.AliasBy
			sq.ProjectName = q.SloQuery.ProjectName
			sq.Selector = q.SloQuery.SelectorName
			sq.Service = q.SloQuery.ServiceId
			sq.Slo = q.SloQuery.SloId
			params.Add("filter", buildSLOFilterExpression(q.SloQuery))
			setSloAggParams(&params, &q.SloQuery, durationSeconds, query.IntervalMs)
		}

		target = params.Encode()
		sq.Target = target
		sq.Params = params

		if setting.Env == setting.DEV {
			slog.Debug("Stackdriver request", "params", params)
		}

		stackdriverQueries = append(stackdriverQueries, sq)
	}

	return stackdriverQueries, nil
}

func migrateLegacyQueryModel(query *tsdb.Query) {
	mq := query.Model.Get("metricQuery").MustMap()
	if mq == nil {
		migratedModel := simplejson.NewFromAny(map[string]interface{}{
			"queryType":   metricQueryType,
			"metricQuery": query.Model,
		})
		query.Model = migratedModel
	}
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
		value = string(wildcardRegexRe.ReplaceAllFunc([]byte(value), func(in []byte) []byte {
			return []byte(strings.Replace(string(in), string(in), `\\`+string(in), 1))
		}))
		value = strings.Replace(value, "*", ".*", -1)
		value = strings.Replace(value, `"`, `\\"`, -1)
		value = fmt.Sprintf(`monitoring.regex.full_match("^%s$")`, value)
	}

	return value
}

func buildFilterString(metricType string, filterParts []string) string {
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
			} else if strings.Contains(part, "*") {
				filterString += interpolateFilterWildcards(part)
			} else {
				filterString += fmt.Sprintf(`"%s"`, part)
			}
		} else {
			filterString += part
		}
	}

	return strings.Trim(fmt.Sprintf(`metric.type="%s" %s`, metricType, filterString), " ")
}

func buildSLOFilterExpression(q sloQuery) string {
	return fmt.Sprintf(`%s("projects/%s/services/%s/serviceLevelObjectives/%s")`, q.SelectorName, q.ProjectName, q.ServiceId, q.SloId)
}

func setMetricAggParams(params *url.Values, query *metricQuery, durationSeconds int, intervalMs int64) {
	if query.CrossSeriesReducer == "" {
		query.CrossSeriesReducer = "REDUCE_NONE"
	}

	if query.PerSeriesAligner == "" {
		query.PerSeriesAligner = "ALIGN_MEAN"
	}

	params.Add("aggregation.crossSeriesReducer", query.CrossSeriesReducer)
	params.Add("aggregation.perSeriesAligner", query.PerSeriesAligner)
	params.Add("aggregation.alignmentPeriod", calculateAlignmentPeriod(query.AlignmentPeriod, intervalMs, durationSeconds))

	for _, groupBy := range query.GroupBys {
		params.Add("aggregation.groupByFields", groupBy)
	}
}

func setSloAggParams(params *url.Values, query *sloQuery, durationSeconds int, intervalMs int64) {
	params.Add("aggregation.alignmentPeriod", calculateAlignmentPeriod(query.AlignmentPeriod, intervalMs, durationSeconds))
	if query.SelectorName == "select_slo_health" {
		params.Add("aggregation.perSeriesAligner", "ALIGN_MEAN")
	} else {
		params.Add("aggregation.perSeriesAligner", "ALIGN_NEXT_OLDER")
	}
}

func calculateAlignmentPeriod(alignmentPeriod string, intervalMs int64, durationSeconds int) string {
	if alignmentPeriod == "grafana-auto" || alignmentPeriod == "" {
		alignmentPeriodValue := int(math.Max(float64(intervalMs)/1000, 60.0))
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

	return alignmentPeriod
}

func (e *StackdriverExecutor) executeQuery(ctx context.Context, query *stackdriverQuery, tsdbQuery *tsdb.TsdbQuery) (*tsdb.QueryResult, stackdriverResponse, error) {
	queryResult := &tsdb.QueryResult{Meta: simplejson.New(), RefId: query.RefID}
	projectName := query.ProjectName
	if projectName == "" {
		defaultProject, err := e.getDefaultProject(ctx)
		if err != nil {
			queryResult.Error = err
			return queryResult, stackdriverResponse{}, nil
		}
		projectName = defaultProject
		slog.Info("No project name set on query, using project name from datasource", "projectName", projectName)
	}

	req, err := e.createRequest(ctx, e.dsInfo, query, fmt.Sprintf("stackdriver%s", "v3/projects/"+projectName+"/timeSeries"))
	if err != nil {
		queryResult.Error = err
		return queryResult, stackdriverResponse{}, nil
	}

	req.URL.RawQuery = query.Params.Encode()
	queryResult.Meta.Set("rawQuery", req.URL.RawQuery)
	alignmentPeriod, ok := req.URL.Query()["aggregation.alignmentPeriod"]

	if ok {
		seconds, err := strconv.ParseInt(alignmentPeriodRe.FindString(alignmentPeriod[0]), 10, 64)
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

	if err := opentracing.GlobalTracer().Inject(
		span.Context(),
		opentracing.HTTPHeaders,
		opentracing.HTTPHeadersCarrier(req.Header)); err != nil {
		queryResult.Error = err
		return queryResult, stackdriverResponse{}, nil
	}

	res, err := ctxhttp.Do(ctx, e.httpClient, req)
	if err != nil {
		queryResult.Error = err
		return queryResult, stackdriverResponse{}, nil
	}

	data, err := e.unmarshalResponse(res)
	if err != nil {
		queryResult.Error = err
		return queryResult, stackdriverResponse{}, nil
	}

	return queryResult, data, nil
}

func (e *StackdriverExecutor) unmarshalResponse(res *http.Response) (stackdriverResponse, error) {
	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		return stackdriverResponse{}, err
	}

	if res.StatusCode/100 != 2 {
		slog.Error("Request failed", "status", res.Status, "body", string(body))
		return stackdriverResponse{}, fmt.Errorf(string(body))
	}

	var data stackdriverResponse
	err = json.Unmarshal(body, &data)
	if err != nil {
		slog.Error("Failed to unmarshal Stackdriver response", "error", err, "status", res.Status, "body", string(body))
		return stackdriverResponse{}, err
	}

	return data, nil
}

func (e *StackdriverExecutor) parseResponse(queryRes *tsdb.QueryResult, data stackdriverResponse, query *stackdriverQuery) error {
	labels := make(map[string]map[string]bool)

	for _, series := range data.TimeSeries {
		points := make([]tsdb.TimePoint, 0)
		seriesLabels := make(map[string]string)
		defaultMetricName := series.Metric.Type
		labels["resource.type"] = map[string]bool{series.Resource.Type: true}
		seriesLabels["resource.type"] = series.Resource.Type

		for key, value := range series.Metric.Labels {
			if _, ok := labels["metric.label."+key]; !ok {
				labels["metric.label."+key] = map[string]bool{}
			}
			labels["metric.label."+key][value] = true
			seriesLabels["metric.label."+key] = value

			if len(query.GroupBys) == 0 || containsLabel(query.GroupBys, "metric.label."+key) {
				defaultMetricName += " " + value
			}
		}

		for key, value := range series.Resource.Labels {
			if _, ok := labels["resource.label."+key]; !ok {
				labels["resource.label."+key] = map[string]bool{}
			}
			labels["resource.label."+key][value] = true
			seriesLabels["resource.label."+key] = value

			if containsLabel(query.GroupBys, "resource.label."+key) {
				defaultMetricName += " " + value
			}
		}

		for labelType, labelTypeValues := range series.MetaData {
			for labelKey, labelValue := range labelTypeValues {
				key := toSnakeCase(fmt.Sprintf("metadata.%s.%s", labelType, labelKey))
				if _, ok := labels[key]; !ok {
					labels[key] = map[string]bool{}
				}

				switch v := labelValue.(type) {
				case string:
					labels[key][v] = true
					seriesLabels[key] = v
				case bool:
					strVal := strconv.FormatBool(v)
					labels[key][strVal] = true
					seriesLabels[key] = strVal
				case []interface{}:
					for _, v := range v {
						strVal := v.(string)
						labels[key][strVal] = true
						if len(seriesLabels[key]) > 0 {
							strVal = fmt.Sprintf("%s, %s", seriesLabels[key], strVal)
						}
						seriesLabels[key] = strVal
					}
				}
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

			metricName := formatLegendKeys(series.Metric.Type, defaultMetricName, seriesLabels, nil, query)

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
							Name:   formatLegendKeys(series.Metric.Type, defaultMetricName, nil, additionalLabels, query),
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
							Name:   formatLegendKeys(series.Metric.Type, defaultMetricName, seriesLabels, additionalLabels, query),
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

	labelsByKey := make(map[string][]string)
	for key, values := range labels {
		for value := range values {
			labelsByKey[key] = append(labelsByKey[key], value)
		}
	}

	queryRes.Meta.Set("labels", labelsByKey)
	queryRes.Meta.Set("groupBys", query.GroupBys)

	return nil
}

func toSnakeCase(str string) string {
	return strings.ToLower(matchAllCap.ReplaceAllString(str, "${1}_${2}"))
}

func containsLabel(labels []string, newLabel string) bool {
	for _, val := range labels {
		if val == newLabel {
			return true
		}
	}
	return false
}

func formatLegendKeys(metricType string, defaultMetricName string, labels map[string]string, additionalLabels map[string]string, query *stackdriverQuery) string {
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

		metricPart := replaceWithMetricPart(metaPartName, metricType)

		if metricPart != nil {
			return metricPart
		}

		if val, exists := labels[metaPartName]; exists {
			return []byte(val)
		}

		if val, exists := additionalLabels[metaPartName]; exists {
			return []byte(val)
		}

		if metaPartName == "project" && query.ProjectName != "" {
			return []byte(query.ProjectName)
		}

		if metaPartName == "service" && query.Service != "" {
			return []byte(query.Service)
		}

		if metaPartName == "slo" && query.Slo != "" {
			return []byte(query.Slo)
		}

		if metaPartName == "selector" && query.Selector != "" {
			return []byte(query.Selector)
		}

		return in
	})

	return string(result)
}

func replaceWithMetricPart(metaPartName string, metricType string) []byte {
	// https://cloud.google.com/monitoring/api/v3/metrics-details#label_names
	shortMatches := metricNameFormat.FindStringSubmatch(metricType)

	if metaPartName == "metric.name" {
		if len(shortMatches) > 2 {
			return []byte(shortMatches[3])
		}
	}

	if metaPartName == "metric.service" {
		if len(shortMatches) > 0 {
			return []byte(shortMatches[1])
		}
	}

	return nil
}

func calcBucketBound(bucketOptions stackdriverBucketOptions, n int) string {
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

func (e *StackdriverExecutor) createRequest(ctx context.Context, dsInfo *models.DataSource, query *stackdriverQuery, proxyPass string) (*http.Request, error) {
	u, err := url.Parse(dsInfo.Url)
	if err != nil {
		return nil, err
	}
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
		token, err := defaultCredentials.TokenSource.Token()
		if err != nil {
			return "", fmt.Errorf("Failed to retrieve GCP credential token. error: %v", err)
		}
		if !token.Valid() {
			return "", errors.New("Failed to validate GCP credentials")
		}

		return defaultCredentials.ProjectID, nil
	}
	return e.dsInfo.JsonData.Get("defaultProject").MustString(), nil
}

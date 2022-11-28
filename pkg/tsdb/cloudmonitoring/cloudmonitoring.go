package cloudmonitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-google-sdk-go/pkg/utils"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	slog = log.New("tsdb.cloudMonitoring")
)

var (
	matchAllCap                 = regexp.MustCompile("(.)([A-Z][a-z]*)")
	legendKeyFormat             = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
	metricNameFormat            = regexp.MustCompile(`([\w\d_]+)\.(googleapis\.com|io)/(.+)`)
	wildcardRegexRe             = regexp.MustCompile(`[-\/^$+?.()|[\]{}]`)
	alignmentPeriodRe           = regexp.MustCompile("[0-9]+")
	cloudMonitoringUnitMappings = map[string]string{
		"bit":     "bits",
		"By":      "bytes",
		"s":       "s",
		"min":     "m",
		"h":       "h",
		"d":       "d",
		"us":      "µs",
		"ms":      "ms",
		"ns":      "ns",
		"%":       "percent",
		"percent": "percent",
		"MiBy":    "mbytes",
		"By/s":    "Bps",
		"GBy":     "decgbytes",
	}
)

const (
	gceAuthentication         = "gce"
	jwtAuthentication         = "jwt"
	annotationQueryType       = "annotation"
	metricQueryType           = "metrics"
	sloQueryType              = "slo"
	crossSeriesReducerDefault = "REDUCE_NONE"
	perSeriesAlignerDefault   = "ALIGN_MEAN"
)

func ProvideService(httpClientProvider httpclient.Provider, tracer tracing.Tracer) *Service {
	s := &Service{
		tracer:             tracer,
		httpClientProvider: httpClientProvider,
		im:                 datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),

		gceDefaultProjectGetter: utils.GCEDefaultProject,
	}

	s.resourceHandler = httpadapter.New(s.newResourceMux())

	return s
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return s.resourceHandler.CallResource(ctx, req, sender)
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return nil, err
	}

	defaultProject, err := s.getDefaultProject(ctx, *dsInfo)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: err.Error(),
		}, nil
	}

	url := fmt.Sprintf("%v/v3/projects/%v/metricDescriptors", dsInfo.services[cloudMonitor].url, defaultProject)
	request, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	res, err := dsInfo.services[cloudMonitor].client.Do(request)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			slog.Warn("Failed to close response body", "err", err)
		}
	}()

	status := backend.HealthStatusOk
	message := "Successfully queried the Google Cloud Monitoring API."
	if res.StatusCode != 200 {
		status = backend.HealthStatusError
		message = res.Status
	}
	return &backend.CheckHealthResult{
		Status:  status,
		Message: message,
	}, nil
}

type Service struct {
	httpClientProvider httpclient.Provider
	im                 instancemgmt.InstanceManager
	tracer             tracing.Tracer

	resourceHandler backend.CallResourceHandler

	// mocked in tests
	gceDefaultProjectGetter func(ctx context.Context) (string, error)
}

type datasourceInfo struct {
	id                 int64
	updated            time.Time
	url                string
	authenticationType string
	defaultProject     string
	clientEmail        string
	tokenUri           string
	services           map[string]datasourceService

	decryptedSecureJSONData map[string]string
}

type datasourceJSONData struct {
	AuthenticationType string `json:"authenticationType"`
	DefaultProject     string `json:"defaultProject"`
	ClientEmail        string `json:"clientEmail"`
	TokenURI           string `json:"tokenUri"`
}

type datasourceService struct {
	url    string
	client *http.Client
}

func newInstanceSettings(httpClientProvider httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		var jsonData datasourceJSONData
		err := json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		if jsonData.AuthenticationType == "" {
			jsonData.AuthenticationType = jwtAuthentication
		}

		dsInfo := &datasourceInfo{
			id:                      settings.ID,
			updated:                 settings.Updated,
			url:                     settings.URL,
			authenticationType:      jsonData.AuthenticationType,
			defaultProject:          jsonData.DefaultProject,
			clientEmail:             jsonData.ClientEmail,
			tokenUri:                jsonData.TokenURI,
			decryptedSecureJSONData: settings.DecryptedSecureJSONData,
			services:                map[string]datasourceService{},
		}

		opts, err := settings.HTTPClientOptions()
		if err != nil {
			return nil, err
		}

		for name, info := range routes {
			client, err := newHTTPClient(dsInfo, opts, httpClientProvider, name)
			if err != nil {
				return nil, err
			}
			dsInfo.services[name] = datasourceService{
				url:    info.url,
				client: client,
			}
		}

		return dsInfo, nil
	}
}

func migrateRequest(req *backend.QueryDataRequest) error {
	for i, q := range req.Queries {
		var rawQuery map[string]interface{}
		err := json.Unmarshal(q.JSON, &rawQuery)
		if err != nil {
			return err
		}

		if rawQuery["metricQuery"] == nil {
			// migrate legacy query
			var mq timeSeriesList
			err = json.Unmarshal(q.JSON, &mq)
			if err != nil {
				return err
			}
			q.QueryType = metricQueryType
			gq := grafanaQuery{
				TimeSeriesList: &mq,
			}
			if rawQuery["aliasBy"] != nil {
				gq.AliasBy = rawQuery["aliasBy"].(string)
			}

			b, err := json.Marshal(gq)
			if err != nil {
				return err
			}
			q.JSON = b
		}

		// Migrate type to queryType, which is only used for annotations
		if rawQuery["type"] != nil && rawQuery["type"].(string) == "annotationQuery" {
			q.QueryType = annotationQueryType
		}
		if rawQuery["queryType"] != nil {
			q.QueryType = rawQuery["queryType"].(string)
		}

		// Metric query was divided between timeSeriesList and timeSeriesQuery API calls
		if rawQuery["metricQuery"] != nil {
			metricQuery := rawQuery["metricQuery"].(map[string]interface{})

			if metricQuery["editorMode"] != nil && toString(metricQuery["editorMode"]) == "mql" {
				rawQuery["timeSeriesQuery"] = &timeSeriesQuery{
					ProjectName: toString(metricQuery["projectName"]),
					Query:       toString(metricQuery["query"]),
					GraphPeriod: toString(metricQuery["graphPeriod"]),
				}
			} else {
				rawQuery["timeSeriesList"] = metricQuery
			}
			if metricQuery["aliasBy"] != nil {
				rawQuery["aliasBy"] = metricQuery["aliasBy"]
			}
			b, err := json.Marshal(rawQuery)
			if err != nil {
				return err
			}
			if q.QueryType == "" {
				q.QueryType = metricQueryType
			}
			q.JSON = b
		}

		// SloQuery was merged into timeSeriesList
		if rawQuery["sloQuery"] != nil {
			if rawQuery["timeSeriesList"] == nil {
				rawQuery["timeSeriesList"] = map[string]interface{}{}
			}
			tsl := rawQuery["timeSeriesList"].(map[string]interface{})
			sloq := rawQuery["sloQuery"].(map[string]interface{})
			if sloq["projectName"] != nil {
				tsl["projectName"] = sloq["projectName"]
			}
			if sloq["alignmentPeriod"] != nil {
				tsl["alignmentPeriod"] = sloq["alignmentPeriod"]
			}
			if sloq["perSeriesAligner"] != nil {
				tsl["perSeriesAligner"] = sloq["perSeriesAligner"]
			}
			rawQuery["timeSeriesList"] = tsl
			b, err := json.Marshal(rawQuery)
			if err != nil {
				return err
			}
			if q.QueryType == "" {
				q.QueryType = sloQueryType
			}
			q.JSON = b
		}

		req.Queries[i] = q
	}

	return nil
}

// QueryData takes in the frontend queries, parses them into the CloudMonitoring query format
// executes the queries against the CloudMonitoring API and parses the response into data frames
func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	logger := slog.FromContext(ctx)
	if len(req.Queries) == 0 {
		return nil, fmt.Errorf("query contains no queries")
	}

	err := migrateRequest(req)
	if err != nil {
		return nil, err
	}

	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return nil, err
	}

	queries, err := s.buildQueryExecutors(logger, req)
	if err != nil {
		return nil, err
	}

	switch req.Queries[0].QueryType {
	case annotationQueryType:
		return s.executeAnnotationQuery(ctx, req, *dsInfo, queries)
	default:
		return s.executeTimeSeriesQuery(ctx, req, *dsInfo, queries)
	}
}

func (s *Service) executeTimeSeriesQuery(ctx context.Context, req *backend.QueryDataRequest, dsInfo datasourceInfo, queries []cloudMonitoringQueryExecutor) (
	*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()
	for _, queryExecutor := range queries {
		queryRes, dr, executedQueryString, err := queryExecutor.run(ctx, req, s, dsInfo, s.tracer)
		if err != nil {
			return resp, err
		}
		err = queryExecutor.parseResponse(queryRes, dr, executedQueryString)
		if err != nil {
			queryRes.Error = err
		}

		resp.Responses[queryExecutor.getRefID()] = *queryRes
	}

	return resp, nil
}

func queryModel(query backend.DataQuery) (grafanaQuery, error) {
	var q grafanaQuery
	err := json.Unmarshal(query.JSON, &q)
	if err != nil {
		return grafanaQuery{}, err
	}
	return q, nil
}

func (s *Service) buildQueryExecutors(logger log.Logger, req *backend.QueryDataRequest) ([]cloudMonitoringQueryExecutor, error) {
	var cloudMonitoringQueryExecutors []cloudMonitoringQueryExecutor
	startTime := req.Queries[0].TimeRange.From
	endTime := req.Queries[0].TimeRange.To
	durationSeconds := int(endTime.Sub(startTime).Seconds())

	for _, query := range req.Queries {
		q, err := queryModel(query)
		if err != nil {
			return nil, fmt.Errorf("could not unmarshal CloudMonitoringQuery json: %w", err)
		}

		params := url.Values{}
		params.Add("interval.startTime", startTime.UTC().Format(time.RFC3339))
		params.Add("interval.endTime", endTime.UTC().Format(time.RFC3339))

		var queryInterface cloudMonitoringQueryExecutor
		cmtsf := &cloudMonitoringTimeSeriesList{
			refID:   query.RefID,
			logger:  logger,
			aliasBy: q.AliasBy,
		}
		switch query.QueryType {
		case metricQueryType, annotationQueryType:
			if q.TimeSeriesQuery != nil {
				queryInterface = &cloudMonitoringTimeSeriesQuery{
					refID:      query.RefID,
					aliasBy:    q.AliasBy,
					parameters: q.TimeSeriesQuery,
					IntervalMS: query.Interval.Milliseconds(),
					timeRange:  req.Queries[0].TimeRange,
				}
			} else if q.TimeSeriesList != nil {
				if q.TimeSeriesList.View == "" {
					q.TimeSeriesList.View = "FULL"
				}
				cmtsf.parameters = q.TimeSeriesList
				params.Add("filter", buildFilterString(q.TimeSeriesList.MetricType, q.TimeSeriesList.Filters))
				params.Add("view", q.TimeSeriesList.View)
				setMetricAggParams(&params, q.TimeSeriesList, durationSeconds, query.Interval.Milliseconds())
				queryInterface = cmtsf
			} else {
				return nil, fmt.Errorf("missing query info")
			}
		case sloQueryType:
			cmtsf.sloQ = q.SloQuery
			cmtsf.parameters = q.TimeSeriesList
			params.Add("filter", buildSLOFilterExpression(q.TimeSeriesList.ProjectName, q.SloQuery))
			setSloAggParams(&params, q.SloQuery, q.TimeSeriesList.AlignmentPeriod, durationSeconds, query.Interval.Milliseconds())
			queryInterface = cmtsf
		default:
			return nil, fmt.Errorf("unrecognized query type %q", query.QueryType)
		}

		cmtsf.params = params

		if setting.Env == setting.Dev {
			logger.Debug("CloudMonitoring request", "params", params)
		}

		cloudMonitoringQueryExecutors = append(cloudMonitoringQueryExecutors, queryInterface)
	}

	return cloudMonitoringQueryExecutors, nil
}

func interpolateFilterWildcards(value string) string {
	matches := strings.Count(value, "*")
	switch {
	case matches == 2 && strings.HasSuffix(value, "*") && strings.HasPrefix(value, "*"):
		value = strings.ReplaceAll(value, "*", "")
		value = fmt.Sprintf(`has_substring("%s")`, value)
	case matches == 1 && strings.HasPrefix(value, "*"):
		value = strings.Replace(value, "*", "", 1)
		value = fmt.Sprintf(`ends_with("%s")`, value)
	case matches == 1 && strings.HasSuffix(value, "*"):
		value = reverse(strings.Replace(reverse(value), "*", "", 1))
		value = fmt.Sprintf(`starts_with("%s")`, value)
	case matches != 0:
		value = string(wildcardRegexRe.ReplaceAllFunc([]byte(value), func(in []byte) []byte {
			return []byte(strings.Replace(string(in), string(in), `\\`+string(in), 1))
		}))
		value = strings.ReplaceAll(value, "*", ".*")
		value = strings.ReplaceAll(value, `"`, `\\"`)
		value = fmt.Sprintf(`monitoring.regex.full_match("^%s$")`, value)
	}

	return value
}

func buildFilterString(metricType string, filterParts []string) string {
	filterString := ""
	for i, part := range filterParts {
		mod := i % 4
		switch {
		case part == "AND":
			filterString += " "
		case mod == 2:
			operator := filterParts[i-1]
			switch {
			case operator == "=~" || operator == "!=~":
				filterString = reverse(strings.Replace(reverse(filterString), "~", "", 1))
				filterString += fmt.Sprintf(`monitoring.regex.full_match("%s")`, part)
			case strings.Contains(part, "*"):
				filterString += interpolateFilterWildcards(part)
			default:
				filterString += fmt.Sprintf(`"%s"`, part)
			}
		default:
			filterString += part
		}
	}

	return strings.Trim(fmt.Sprintf(`metric.type="%s" %s`, metricType, filterString), " ")
}

func buildSLOFilterExpression(projectName string, q *sloQuery) string {
	sloName := fmt.Sprintf("projects/%s/services/%s/serviceLevelObjectives/%s", projectName, q.ServiceId, q.SloId)

	if q.SelectorName == "select_slo_burn_rate" {
		return fmt.Sprintf(`%s("%s", "%s")`, q.SelectorName, sloName, q.LookbackPeriod)
	} else {
		return fmt.Sprintf(`%s("%s")`, q.SelectorName, sloName)
	}
}

func setMetricAggParams(params *url.Values, query *timeSeriesList, durationSeconds int, intervalMs int64) {
	if query.CrossSeriesReducer == "" {
		query.CrossSeriesReducer = crossSeriesReducerDefault
	}

	if query.PerSeriesAligner == "" {
		query.PerSeriesAligner = perSeriesAlignerDefault
	}

	alignmentPeriod := calculateAlignmentPeriod(query.AlignmentPeriod, intervalMs, durationSeconds)

	// In case a preprocessor is defined, the preprocessor becomes the primary aggregation
	// and the aggregation that is specified in the UI becomes the secondary aggregation
	// Rules are specified in this issue: https://github.com/grafana/grafana/issues/30866
	t := toPreprocessorType(query.Preprocessor)
	if t != PreprocessorTypeNone {
		params.Add("secondaryAggregation.alignmentPeriod", alignmentPeriod)
		params.Add("secondaryAggregation.crossSeriesReducer", query.CrossSeriesReducer)
		params.Add("secondaryAggregation.perSeriesAligner", query.PerSeriesAligner)

		primaryCrossSeriesReducer := crossSeriesReducerDefault
		if len(query.GroupBys) > 0 {
			primaryCrossSeriesReducer = query.CrossSeriesReducer
		}
		params.Add("aggregation.crossSeriesReducer", primaryCrossSeriesReducer)

		aligner := "ALIGN_RATE"
		if t == PreprocessorTypeDelta {
			aligner = "ALIGN_DELTA"
		}
		params.Add("aggregation.perSeriesAligner", aligner)

		for _, groupBy := range query.GroupBys {
			params.Add("secondaryAggregation.groupByFields", groupBy)
		}
	} else {
		params.Add("aggregation.crossSeriesReducer", query.CrossSeriesReducer)
		params.Add("aggregation.perSeriesAligner", query.PerSeriesAligner)
	}

	params.Add("aggregation.alignmentPeriod", alignmentPeriod)

	for _, groupBy := range query.GroupBys {
		params.Add("aggregation.groupByFields", groupBy)
	}
}

func setSloAggParams(params *url.Values, query *sloQuery, alignmentPeriod string, durationSeconds int, intervalMs int64) {
	params.Add("aggregation.alignmentPeriod", calculateAlignmentPeriod(alignmentPeriod, intervalMs, durationSeconds))
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

	if alignmentPeriod == "cloud-monitoring-auto" || alignmentPeriod == "stackdriver-auto" { // legacy
		alignmentPeriodValue := int(math.Max(float64(durationSeconds), 60.0))
		switch {
		case alignmentPeriodValue < 60*60*23:
			alignmentPeriod = "+60s"
		case alignmentPeriodValue < 60*60*24*6:
			alignmentPeriod = "+300s"
		default:
			alignmentPeriod = "+3600s"
		}
	}

	return alignmentPeriod
}

func formatLegendKeys(metricType string, defaultMetricName string, labels map[string]string,
	additionalLabels map[string]string, query *cloudMonitoringTimeSeriesList) string {
	if query.aliasBy == "" {
		return defaultMetricName
	}

	result := legendKeyFormat.ReplaceAllFunc([]byte(query.aliasBy), func(in []byte) []byte {
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

		if metaPartName == "project" && query.parameters.ProjectName != "" {
			return []byte(query.parameters.ProjectName)
		}

		if metaPartName == "service" && query.sloQ.ServiceId != "" {
			return []byte(query.sloQ.ServiceId)
		}

		if metaPartName == "slo" && query.sloQ.SloId != "" {
			return []byte(query.sloQ.SloId)
		}

		if metaPartName == "selector" && query.sloQ.SelectorName != "" {
			return []byte(query.sloQ.SelectorName)
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

func calcBucketBound(bucketOptions cloudMonitoringBucketOptions, n int) string {
	bucketBound := "0"
	if n == 0 {
		return bucketBound
	}

	switch {
	case bucketOptions.LinearBuckets != nil:
		bucketBound = strconv.FormatInt(bucketOptions.LinearBuckets.Offset+(bucketOptions.LinearBuckets.Width*int64(n-1)), 10)
	case bucketOptions.ExponentialBuckets != nil:
		bucketBound = strconv.FormatInt(int64(bucketOptions.ExponentialBuckets.Scale*math.Pow(bucketOptions.ExponentialBuckets.GrowthFactor, float64(n-1))), 10)
	case bucketOptions.ExplicitBuckets != nil:
		if n < len(bucketOptions.ExplicitBuckets.Bounds) {
			bucketBound = fmt.Sprintf("%g", bucketOptions.ExplicitBuckets.Bounds[n])
		} else {
			lastBound := bucketOptions.ExplicitBuckets.Bounds[len(bucketOptions.ExplicitBuckets.Bounds)-1]
			bucketBound = fmt.Sprintf("%g+", lastBound)
		}
	}
	return bucketBound
}

func (s *Service) createRequest(logger log.Logger, dsInfo *datasourceInfo, proxyPass string, body io.Reader) (*http.Request, error) {
	u, err := url.Parse(dsInfo.url)
	if err != nil {
		return nil, err
	}
	u.Path = path.Join(u.Path, "render")

	method := http.MethodGet
	if body != nil {
		method = http.MethodPost
	}
	req, err := http.NewRequest(method, dsInfo.services[cloudMonitor].url, body)
	if err != nil {
		logger.Error("Failed to create request", "error", err)
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.URL.Path = proxyPass

	return req, nil
}

func (s *Service) getDefaultProject(ctx context.Context, dsInfo datasourceInfo) (string, error) {
	if dsInfo.authenticationType == gceAuthentication {
		return s.gceDefaultProjectGetter(ctx)
	}
	return dsInfo.defaultProject, nil
}

func unmarshalResponse(logger log.Logger, res *http.Response) (cloudMonitoringResponse, error) {
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return cloudMonitoringResponse{}, err
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()

	if res.StatusCode/100 != 2 {
		logger.Error("Request failed", "status", res.Status, "body", string(body))
		return cloudMonitoringResponse{}, fmt.Errorf("query failed: %s", string(body))
	}

	var data cloudMonitoringResponse
	err = json.Unmarshal(body, &data)
	if err != nil {
		logger.Error("Failed to unmarshal CloudMonitoring response", "error", err, "status", res.Status, "body", string(body))
		return cloudMonitoringResponse{}, fmt.Errorf("failed to unmarshal query response: %w", err)
	}

	return data, nil
}

func addConfigData(frames data.Frames, dl string, unit string, period string) data.Frames {
	for i := range frames {
		if frames[i].Fields[1].Config == nil {
			frames[i].Fields[1].Config = &data.FieldConfig{}
		}
		if len(dl) > 0 {
			deepLink := data.DataLink{
				Title:       "View in Metrics Explorer",
				TargetBlank: true,
				URL:         dl,
			}
			frames[i].Fields[1].Config.Links = append(frames[i].Fields[1].Config.Links, deepLink)
		}
		if len(unit) > 0 {
			if val, ok := cloudMonitoringUnitMappings[unit]; ok {
				frames[i].Fields[1].Config.Unit = val
			}
		}
		if frames[i].Fields[0].Config == nil {
			frames[i].Fields[0].Config = &data.FieldConfig{}
		}
		if period != "" {
			err := addInterval(period, frames[i].Fields[0])
			if err != nil {
				slog.Error("Failed to add interval", "error", err)
			}
		}
	}
	return frames
}

func (s *Service) getDSInfo(pluginCtx backend.PluginContext) (*datasourceInfo, error) {
	i, err := s.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}

	instance, ok := i.(*datasourceInfo)
	if !ok {
		return nil, fmt.Errorf("failed to cast datsource info")
	}

	return instance, nil
}

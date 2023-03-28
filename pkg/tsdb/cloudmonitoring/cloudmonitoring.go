package cloudmonitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-google-sdk-go/pkg/utils"
	"github.com/huandu/xstrings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

var (
	slog = log.New("tsdb.cloudMonitoring")
)

var (
	legendKeyFormat             = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
	metricNameFormat            = regexp.MustCompile(`([\w\d_]+)\.(googleapis\.com|io)/(.+)`)
	wildcardRegexRe             = regexp.MustCompile(`[-\/^$+?.()|[\]{}]`)
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
	timeSeriesListQueryType   = "timeSeriesList"
	timeSeriesQueryQueryType  = "timeSeriesQuery"
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

func migrateMetricTypeFilter(metricTypeFilter string, prevFilters interface{}) []string {
	metricTypeFilterArray := []string{"metric.type", "=", metricTypeFilter}
	if prevFilters != nil {
		filtersIface := prevFilters.([]interface{})
		filters := []string{}
		for _, f := range filtersIface {
			filters = append(filters, f.(string))
		}
		metricTypeFilterArray = append([]string{"AND"}, metricTypeFilterArray...)
		return append(filters, metricTypeFilterArray...)
	}
	return metricTypeFilterArray
}

func migrateRequest(req *backend.QueryDataRequest) error {
	for i, q := range req.Queries {
		var rawQuery map[string]interface{}
		err := json.Unmarshal(q.JSON, &rawQuery)
		if err != nil {
			return err
		}

		if rawQuery["metricQuery"] == nil &&
			rawQuery["timeSeriesQuery"] == nil &&
			rawQuery["timeSeriesList"] == nil &&
			rawQuery["sloQuery"] == nil {
			// migrate legacy query
			var mq timeSeriesList
			err = json.Unmarshal(q.JSON, &mq)
			if err != nil {
				return err
			}
			q.QueryType = timeSeriesListQueryType
			gq := grafanaQuery{
				TimeSeriesList: &mq,
			}
			if rawQuery["aliasBy"] != nil {
				gq.AliasBy = rawQuery["aliasBy"].(string)
			}
			if rawQuery["metricType"] != nil {
				// metricType should be a filter
				gq.TimeSeriesList.Filters = migrateMetricTypeFilter(rawQuery["metricType"].(string), rawQuery["filters"])
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
		if rawQuery["metricQuery"] != nil && q.QueryType == "metrics" {
			metricQuery := rawQuery["metricQuery"].(map[string]interface{})

			if metricQuery["editorMode"] != nil && toString(metricQuery["editorMode"]) == "mql" {
				rawQuery["timeSeriesQuery"] = &timeSeriesQuery{
					ProjectName: toString(metricQuery["projectName"]),
					Query:       toString(metricQuery["query"]),
					GraphPeriod: toString(metricQuery["graphPeriod"]),
				}
				q.QueryType = timeSeriesQueryQueryType
			} else {
				tslb, err := json.Marshal(metricQuery)
				if err != nil {
					return err
				}
				tsl := &timeSeriesList{}
				err = json.Unmarshal(tslb, tsl)
				if err != nil {
					return err
				}
				if metricQuery["metricType"] != nil {
					// metricType should be a filter
					tsl.Filters = migrateMetricTypeFilter(metricQuery["metricType"].(string), metricQuery["filters"])
				}
				rawQuery["timeSeriesList"] = tsl
				q.QueryType = timeSeriesListQueryType
			}
			// AliasBy is now a top level property
			if metricQuery["aliasBy"] != nil {
				rawQuery["aliasBy"] = metricQuery["aliasBy"]
			}
			b, err := json.Marshal(rawQuery)
			if err != nil {
				return err
			}
			q.JSON = b
		}

		if rawQuery["sloQuery"] != nil && q.QueryType == sloQueryType {
			sloQuery := rawQuery["sloQuery"].(map[string]interface{})
			// AliasBy is now a top level property
			if sloQuery["aliasBy"] != nil {
				rawQuery["aliasBy"] = sloQuery["aliasBy"]
				b, err := json.Marshal(rawQuery)
				if err != nil {
					return err
				}
				q.JSON = b
			}
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
	cloudMonitoringQueryExecutors := make([]cloudMonitoringQueryExecutor, 0, len(req.Queries))
	startTime := req.Queries[0].TimeRange.From
	endTime := req.Queries[0].TimeRange.To
	durationSeconds := int(endTime.Sub(startTime).Seconds())

	for _, query := range req.Queries {
		q, err := queryModel(query)
		if err != nil {
			return nil, fmt.Errorf("could not unmarshal CloudMonitoringQuery json: %w", err)
		}

		var queryInterface cloudMonitoringQueryExecutor
		switch query.QueryType {
		case timeSeriesListQueryType, annotationQueryType:
			cmtsf := &cloudMonitoringTimeSeriesList{
				refID:   query.RefID,
				logger:  logger,
				aliasBy: q.AliasBy,
			}
			if q.TimeSeriesList.View == "" {
				q.TimeSeriesList.View = "FULL"
			}
			cmtsf.parameters = q.TimeSeriesList
			cmtsf.setParams(startTime, endTime, durationSeconds, query.Interval.Milliseconds())
			queryInterface = cmtsf
		case timeSeriesQueryQueryType:
			queryInterface = &cloudMonitoringTimeSeriesQuery{
				refID:      query.RefID,
				aliasBy:    q.AliasBy,
				parameters: q.TimeSeriesQuery,
				IntervalMS: query.Interval.Milliseconds(),
				timeRange:  req.Queries[0].TimeRange,
				logger:     logger,
			}
		case sloQueryType:
			cmslo := &cloudMonitoringSLO{
				refID:      query.RefID,
				logger:     logger,
				aliasBy:    q.AliasBy,
				parameters: q.SloQuery,
			}
			cmslo.setParams(startTime, endTime, durationSeconds, query.Interval.Milliseconds())
			queryInterface = cmslo
		default:
			return nil, fmt.Errorf("unrecognized query type %q", query.QueryType)
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
		value = xstrings.Reverse(strings.Replace(xstrings.Reverse(value), "*", "", 1))
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
	additionalLabels map[string]string, query cloudMonitoringQueryExecutor) string {
	if query.getAliasBy() == "" {
		if defaultMetricName != "" {
			return defaultMetricName
		}

		return metricType
	}

	result := legendKeyFormat.ReplaceAllFunc([]byte(query.getAliasBy()), func(in []byte) []byte {
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

		if query.getParameter(metaPartName) != "" {
			return []byte(query.getParameter(metaPartName))
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
		bucketBound = strconv.FormatFloat(bucketOptions.LinearBuckets.Offset+(bucketOptions.LinearBuckets.Width*float64(n-1)), 'f', 2, 64)
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

func (s *Service) ensureProject(ctx context.Context, dsInfo datasourceInfo, projectName string) (string, error) {
	if projectName != "" {
		return projectName, nil
	}
	return s.getDefaultProject(ctx, dsInfo)
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

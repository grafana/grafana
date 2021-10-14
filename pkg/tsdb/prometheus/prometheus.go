package prometheus

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/api"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

var (
	plog         = log.New("tsdb.prometheus")
	legendFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
	safeRes      = 11000
)

type Service struct {
	intervalCalculator intervalv2.Calculator
	im                 instancemgmt.InstanceManager
}

func ProvideService(httpClientProvider httpclient.Provider, backendPluginManager backendplugin.Manager) (*Service, error) {
	plog.Debug("initializing")
	im := datasource.NewInstanceManager(newInstanceSettings(httpClientProvider))

	s := &Service{
		intervalCalculator: intervalv2.NewCalculator(),
		im:                 im,
	}

	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler: s,
	})
	if err := backendPluginManager.Register("prometheus", factory); err != nil {
		plog.Error("Failed to register plugin", "error", err)
		return nil, err
	}

	return s, nil
}

func newInstanceSettings(httpClientProvider httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		jsonData := map[string]interface{}{}
		err := json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}
		httpCliOpts, err := settings.HTTPClientOptions()
		if err != nil {
			return nil, fmt.Errorf("error getting http options: %w", err)
		}

		// Set SigV4 service namespace
		if httpCliOpts.SigV4 != nil {
			httpCliOpts.SigV4.Service = "aps"
		}

		// timeInterval can be a string or can be missing.
		// if it is missing, we set it to empty-string
		timeInterval := ""

		timeIntervalJson := jsonData["timeInterval"]
		if timeIntervalJson != nil {
			// if it is not nil, it must be a string
			var ok bool
			timeInterval, ok = timeIntervalJson.(string)
			if !ok {
				return nil, errors.New("invalid time-interval provided")
			}
		}

		client, err := createClient(settings.URL, httpCliOpts, httpClientProvider)
		if err != nil {
			return nil, err
		}

		mdl := DatasourceInfo{
			ID:           settings.ID,
			URL:          settings.URL,
			TimeInterval: timeInterval,
			promClient:   client,
		}

		return mdl, nil
	}
}

//nolint: staticcheck // plugins.DataResponse deprecated
func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if len(req.Queries) == 0 {
		return &backend.QueryDataResponse{}, fmt.Errorf("query contains no queries")
	}

	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return nil, err
	}

	client := dsInfo.promClient

	result := backend.QueryDataResponse{
		Responses: backend.Responses{},
	}

	queries, err := s.parseQuery(req, dsInfo)
	if err != nil {
		return &result, err
	}

	for _, query := range queries {
		plog.Debug("Sending query", "start", query.Start, "end", query.End, "step", query.Step, "query", query.Expr)

		span, ctx := opentracing.StartSpanFromContext(ctx, "datasource.prometheus")
		span.SetTag("expr", query.Expr)
		span.SetTag("start_unixnano", query.Start.UnixNano())
		span.SetTag("stop_unixnano", query.End.UnixNano())
		defer span.Finish()

		response := make(map[PrometheusQueryType]interface{})

		timeRange := apiv1.Range{
			Step: query.Step,
			// Align query range to step. It rounds start and end down to a multiple of step.
			Start: time.Unix(int64(math.Floor((float64(query.Start.Unix()+query.UtcOffsetSec)/query.Step.Seconds()))*query.Step.Seconds()-float64(query.UtcOffsetSec)), 0),
			End:   time.Unix(int64(math.Floor((float64(query.End.Unix()+query.UtcOffsetSec)/query.Step.Seconds()))*query.Step.Seconds()-float64(query.UtcOffsetSec)), 0),
		}

		if query.RangeQuery {
			rangeResponse, _, err := client.QueryRange(ctx, query.Expr, timeRange)
			if err != nil {
				return &result, fmt.Errorf("query: %s failed with: %v", query.Expr, err)
			}
			response[Range] = rangeResponse
		}

		if query.InstantQuery {
			instantResponse, _, err := client.Query(ctx, query.Expr, query.End)
			if err != nil {
				return &result, fmt.Errorf("query: %s failed with: %v", query.Expr, err)
			}
			response[Instant] = instantResponse
		}
		// For now, we ignore exemplar errors and continue with processing of other results
		if query.ExemplarQuery {
			exemplarResponse, err := client.QueryExemplars(ctx, query.Expr, timeRange.Start, timeRange.End)
			if err != nil {
				exemplarResponse = nil
				plog.Error("Exemplar query", query.Expr, "failed with", err)
			}
			response[Exemplar] = exemplarResponse
		}

		frames, err := parseResponse(response, query)
		if err != nil {
			return &result, err
		}

		result.Responses[query.RefId] = backend.DataResponse{
			Frames: frames,
		}
	}

	return &result, nil
}

func createClient(url string, httpOpts sdkhttpclient.Options, clientProvider httpclient.Provider) (apiv1.API, error) {
	customMiddlewares := customQueryParametersMiddleware(plog)
	httpOpts.Middlewares = []sdkhttpclient.Middleware{customMiddlewares}

	roundTripper, err := clientProvider.GetTransport(httpOpts)
	if err != nil {
		return nil, err
	}

	cfg := api.Config{
		Address:      url,
		RoundTripper: roundTripper,
	}

	client, err := api.NewClient(cfg)
	if err != nil {
		return nil, err
	}

	return apiv1.NewAPI(client), nil
}

func (s *Service) getDSInfo(pluginCtx backend.PluginContext) (*DatasourceInfo, error) {
	i, err := s.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}

	instance := i.(DatasourceInfo)

	return &instance, nil
}

func formatLegend(metric model.Metric, query *PrometheusQuery) string {
	var legend string

	if query.LegendFormat == "" {
		legend = metric.String()
	} else {
		result := legendFormat.ReplaceAllFunc([]byte(query.LegendFormat), func(in []byte) []byte {
			labelName := strings.Replace(string(in), "{{", "", 1)
			labelName = strings.Replace(labelName, "}}", "", 1)
			labelName = strings.TrimSpace(labelName)
			if val, exists := metric[model.LabelName(labelName)]; exists {
				return []byte(val)
			}
			return []byte{}
		})
		legend = string(result)
	}

	// If legend is empty brackets, use query expression
	if legend == "{}" {
		legend = query.Expr
	}

	return legend
}

func (s *Service) parseQuery(queryContext *backend.QueryDataRequest, dsInfo *DatasourceInfo) ([]*PrometheusQuery, error) {
	qs := []*PrometheusQuery{}
	for _, query := range queryContext.Queries {
		model := &QueryModel{}
		err := json.Unmarshal(query.JSON, model)
		if err != nil {
			return nil, err
		}

		//Calculate interval
		queryInterval := model.Interval
		//If we are using variable or interval/step, we will replace it with calculated interval
		if queryInterval == "$__interval" || queryInterval == "$__interval_ms" {
			queryInterval = ""
		}
		minInterval, err := intervalv2.GetIntervalFrom(dsInfo.TimeInterval, queryInterval, model.IntervalMS, 15*time.Second)
		if err != nil {
			return nil, err
		}

		calculatedInterval := s.intervalCalculator.Calculate(query.TimeRange, minInterval, query.MaxDataPoints)
		safeInterval := s.intervalCalculator.CalculateSafeInterval(query.TimeRange, int64(safeRes))

		adjustedInterval := safeInterval.Value
		if calculatedInterval.Value > safeInterval.Value {
			adjustedInterval = calculatedInterval.Value
		}

		intervalFactor := model.IntervalFactor
		if intervalFactor == 0 {
			intervalFactor = 1
		}

		interval := time.Duration(int64(adjustedInterval) * intervalFactor)
		intervalMs := int64(interval / time.Millisecond)
		rangeS := query.TimeRange.To.Unix() - query.TimeRange.From.Unix()

		// Interpolate variables in expr
		expr := model.Expr
		expr = strings.ReplaceAll(expr, "$__interval_ms", strconv.FormatInt(intervalMs, 10))
		expr = strings.ReplaceAll(expr, "$__interval", intervalv2.FormatDuration(interval))
		expr = strings.ReplaceAll(expr, "$__range_ms", strconv.FormatInt(rangeS*1000, 10))
		expr = strings.ReplaceAll(expr, "$__range_s", strconv.FormatInt(rangeS, 10))
		expr = strings.ReplaceAll(expr, "$__range", strconv.FormatInt(rangeS, 10)+"s")
		expr = strings.ReplaceAll(expr, "$__rate_interval", intervalv2.FormatDuration(calculateRateInterval(interval, dsInfo.TimeInterval, s.intervalCalculator)))

		rangeQuery := model.RangeQuery
		if !model.InstantQuery && !model.RangeQuery {
			// In older dashboards, we were not setting range query param and !range && !instant was run as range query
			rangeQuery = true
		}

		qs = append(qs, &PrometheusQuery{
			Expr:          expr,
			Step:          interval,
			LegendFormat:  model.LegendFormat,
			Start:         query.TimeRange.From,
			End:           query.TimeRange.To,
			RefId:         query.RefID,
			InstantQuery:  model.InstantQuery,
			RangeQuery:    rangeQuery,
			ExemplarQuery: model.ExemplarQuery,
			UtcOffsetSec:  model.UtcOffsetSec,
		})
	}
	return qs, nil
}

func parseResponse(value map[PrometheusQueryType]interface{}, query *PrometheusQuery) (data.Frames, error) {
	frames := data.Frames{}

	for _, value := range value {
		matrix, ok := value.(model.Matrix)
		if ok {
			matrixFrames := matrixToDataFrames(matrix, query)
			frames = append(frames, matrixFrames...)
			continue
		}

		vector, ok := value.(model.Vector)
		if ok {
			vectorFrames := vectorToDataFrames(vector, query)
			frames = append(frames, vectorFrames...)
			continue
		}

		scalar, ok := value.(*model.Scalar)
		if ok {
			scalarFrames := scalarToDataFrames(scalar, query)
			frames = append(frames, scalarFrames...)
			continue
		}

		exemplar, ok := value.([]apiv1.ExemplarQueryResult)
		if ok {
			exemplarFrames := exemplarToDataFrames(exemplar, query)
			frames = append(frames, exemplarFrames...)
			continue
		}
	}
	return frames, nil
}

// IsAPIError returns whether err is or wraps a Prometheus error.
func IsAPIError(err error) bool {
	// Check if the right error type is in err's chain.
	var e *apiv1.Error
	return errors.As(err, &e)
}

func ConvertAPIError(err error) error {
	var e *apiv1.Error
	if errors.As(err, &e) {
		return fmt.Errorf("%s: %s", e.Msg, e.Detail)
	}
	return err
}

func calculateRateInterval(interval time.Duration, scrapeInterval string, intervalCalculator intervalv2.Calculator) time.Duration {
	scrape := scrapeInterval
	if scrape == "" {
		scrape = "15s"
	}

	scrapeIntervalDuration, err := intervalv2.ParseIntervalStringToTimeDuration(scrape)
	if err != nil {
		return time.Duration(0)
	}

	rateInterval := time.Duration(int(math.Max(float64(interval+scrapeIntervalDuration), float64(4)*float64(scrapeIntervalDuration))))
	return rateInterval
}

func matrixToDataFrames(matrix model.Matrix, query *PrometheusQuery) data.Frames {
	frames := data.Frames{}

	for _, v := range matrix {
		tags := make(map[string]string, len(v.Metric))
		timeVector := make([]time.Time, 0, len(v.Values))
		values := make([]float64, 0, len(v.Values))
		for k, v := range v.Metric {
			tags[string(k)] = string(v)
		}
		for _, k := range v.Values {
			timeVector = append(timeVector, time.Unix(k.Timestamp.Unix(), 0).UTC())
			values = append(values, float64(k.Value))
		}
		name := formatLegend(v.Metric, query)
		frame := data.NewFrame(name,
			data.NewField("Time", nil, timeVector),
			data.NewField("Value", tags, values).SetConfig(&data.FieldConfig{DisplayNameFromDS: name}))
		frame.Meta = &data.FrameMeta{
			Custom: map[string]string{
				"resultType": "matrix",
			},
		}
		frames = append(frames, frame)
	}
	return frames
}

func scalarToDataFrames(scalar *model.Scalar, query *PrometheusQuery) data.Frames {
	timeVector := []time.Time{time.Unix(scalar.Timestamp.Unix(), 0).UTC()}
	values := []float64{float64(scalar.Value)}
	name := fmt.Sprintf("%g", values[0])
	frame := data.NewFrame(name,
		data.NewField("Time", nil, timeVector),
		data.NewField("Value", nil, values).SetConfig(&data.FieldConfig{DisplayNameFromDS: name}))
	frame.Meta = &data.FrameMeta{
		Custom: map[string]string{
			"resultType": "scalar",
		},
	}

	frames := data.Frames{frame}
	return frames
}

func vectorToDataFrames(vector model.Vector, query *PrometheusQuery) data.Frames {
	frames := data.Frames{}
	for _, v := range vector {
		name := formatLegend(v.Metric, query)
		tags := make(map[string]string, len(v.Metric))
		timeVector := []time.Time{time.Unix(v.Timestamp.Unix(), 0).UTC()}
		values := []float64{float64(v.Value)}
		for k, v := range v.Metric {
			tags[string(k)] = string(v)
		}
		frame := data.NewFrame(name,
			data.NewField("Time", nil, timeVector),
			data.NewField("Value", tags, values).SetConfig(&data.FieldConfig{DisplayNameFromDS: name}))
		frame.Meta = &data.FrameMeta{
			Custom: map[string]string{
				"resultType": "vector",
			},
		}
		frames = append(frames, frame)
	}

	return frames
}

func exemplarToDataFrames(response []apiv1.ExemplarQueryResult, query *PrometheusQuery) data.Frames {
	frames := data.Frames{}
	events := make([]ExemplarEvent, 0)
	for _, exemplarData := range response {
		for _, exemplar := range exemplarData.Exemplars {
			event := ExemplarEvent{}
			exemplarTime := time.Unix(exemplar.Timestamp.Unix(), 0).UTC()
			event.Time = exemplarTime
			event.Value = float64(exemplar.Value)
			event.Labels = make(map[string]string)
			for label, value := range exemplar.Labels {
				event.Labels[string(label)] = string(value)
			}
			for seriesLabel, seriesValue := range exemplarData.SeriesLabels {
				event.Labels[string(seriesLabel)] = string(seriesValue)
			}

			events = append(events, event)
		}
	}

	//Sampling of exemplars
	bucketedExemplars := make(map[string][]ExemplarEvent)
	values := make([]float64, 0)

	//Create bucketed exemplars based on aligned timestamp
	for _, event := range events {
		alignedTs := fmt.Sprintf("%.0f", math.Floor(float64(event.Time.Unix())/query.Step.Seconds())*query.Step.Seconds())
		_, ok := bucketedExemplars[alignedTs]
		if !ok {
			bucketedExemplars[alignedTs] = make([]ExemplarEvent, 0)
		}

		bucketedExemplars[alignedTs] = append(bucketedExemplars[alignedTs], event)
		values = append(values, event.Value)
	}

	//Calculate standard deviation
	standardDeviation := deviation(values)

	//Create slice with all of the bucketed exemplars
	sampledBuckets := make([]string, len(bucketedExemplars))
	for bucketTimes := range bucketedExemplars {
		sampledBuckets = append(sampledBuckets, bucketTimes)
	}
	sort.Strings(sampledBuckets)

	//Sample exemplars based ona value, so we are not showing too many of them
	sampleExemplars := make([]ExemplarEvent, 0)
	for _, bucket := range sampledBuckets {
		exemplarsInBucket := bucketedExemplars[bucket]
		if len(exemplarsInBucket) == 1 {
			sampleExemplars = append(sampleExemplars, exemplarsInBucket[0])
		} else {
			bucketValues := make([]float64, len(exemplarsInBucket))
			for _, exemplar := range exemplarsInBucket {
				bucketValues = append(bucketValues, exemplar.Value)
			}
			sort.Slice(bucketValues, func(i, j int) bool {
				return bucketValues[i] > bucketValues[j]
			})

			sampledBucketValues := make([]float64, 0)
			for _, value := range bucketValues {
				if len(sampledBucketValues) == 0 {
					sampledBucketValues = append(sampledBucketValues, value)
				} else {
					// Then take values only when at least 2 standard deviation distance to previously taken value
					prev := sampledBucketValues[len(sampledBucketValues)-1]
					if standardDeviation != 0 && prev-value >= float64(2)*standardDeviation {
						sampledBucketValues = append(sampledBucketValues, value)
					}
				}
			}
			for _, valueBucket := range sampledBucketValues {
				for _, exemplar := range exemplarsInBucket {
					if exemplar.Value == valueBucket {
						sampleExemplars = append(sampleExemplars, exemplar)
					}
				}
			}
		}
	}

	// Create DF from sampled exemplars
	timeVector := make([]time.Time, 0, len(sampleExemplars))
	valuesVector := make([]float64, 0, len(sampleExemplars))
	labelsVector := make(map[string][]string, len(sampleExemplars))

	for _, exemplar := range sampleExemplars {
		timeVector = append(timeVector, exemplar.Time)
		valuesVector = append(valuesVector, exemplar.Value)

		for label, value := range exemplar.Labels {
			if labelsVector[label] == nil {
				labelsVector[label] = make([]string, 0)
			}

			labelsVector[label] = append(labelsVector[label], value)
		}
	}

	frame := data.NewFrame("exemplar",
		data.NewField("Time", nil, timeVector),
		data.NewField("Value", nil, valuesVector))

	for label, vector := range labelsVector {
		frame.Fields = append(frame.Fields, data.NewField(label, nil, vector))
	}

	frame.Meta = &data.FrameMeta{
		Custom: map[string]PrometheusQueryType{
			"resultType": "exemplar",
		},
	}

	frames = append(frames, frame)
	return frames
}

func deviation(values []float64) float64 {
	var sum, mean, sd float64
	valuesLen := float64(len(values))
	for _, value := range values {
		sum += value
	}
	mean = sum / valuesLen
	for j := 0; j < len(values); j++ {
		sd += math.Pow(values[j]-mean, 2)
	}
	return math.Sqrt(sd / (valuesLen - 1))
}

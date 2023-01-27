package querydata

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/client"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/models"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/querydata/exemplar"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/utils"
	"github.com/grafana/grafana/pkg/util/maputil"
)

const legendFormatAuto = "__auto"

var legendFormatRegexp = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)

type ExemplarEvent struct {
	Time   time.Time
	Value  float64
	Labels map[string]string
}

// QueryData handles querying but different from buffered package uses a custom client instead of default Go Prom
// client.
type QueryData struct {
	intervalCalculator intervalv2.Calculator
	tracer             tracing.Tracer
	client             *client.Client
	log                log.Logger
	ID                 int64
	URL                string
	TimeInterval       string
	enableWideSeries   bool
	exemplarSampler    func() exemplar.Sampler
}

func New(
	httpClient *http.Client,
	features featuremgmt.FeatureToggles,
	tracer tracing.Tracer,
	settings backend.DataSourceInstanceSettings,
	plog log.Logger,
) (*QueryData, error) {
	jsonData, err := utils.GetJsonData(settings)
	if err != nil {
		return nil, err
	}
	httpMethod, _ := maputil.GetStringOptional(jsonData, "httpMethod")

	timeInterval, err := maputil.GetStringOptional(jsonData, "timeInterval")
	if err != nil {
		return nil, err
	}

	promClient := client.NewClient(httpClient, httpMethod, settings.URL)

	// standard deviation sampler is the default for backwards compatibility
	exemplarSampler := exemplar.NewStandardDeviationSampler

	if features.IsEnabled(featuremgmt.FlagDisablePrometheusExemplarSampling) {
		exemplarSampler = exemplar.NewNoOpSampler
	}

	return &QueryData{
		intervalCalculator: intervalv2.NewCalculator(),
		tracer:             tracer,
		log:                plog,
		client:             promClient,
		TimeInterval:       timeInterval,
		ID:                 settings.ID,
		URL:                settings.URL,
		enableWideSeries:   features.IsEnabled(featuremgmt.FlagPrometheusWideSeries),
		exemplarSampler:    exemplarSampler,
	}, nil
}

func (s *QueryData) Execute(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	fromAlert := req.Headers["FromAlert"] == "true"
	result := backend.QueryDataResponse{
		Responses: backend.Responses{},
	}

	for _, q := range req.Queries {
		query, err := models.Parse(q, s.TimeInterval, s.intervalCalculator, fromAlert)
		if err != nil {
			return &result, err
		}
		r, err := s.fetch(ctx, s.client, query, req.Headers)
		if err != nil {
			return &result, err
		}
		if r == nil {
			s.log.FromContext(ctx).Debug("Received nilresponse from runQuery", "query", query.Expr)
			continue
		}
		result.Responses[q.RefID] = *r
	}

	return &result, nil
}

func (s *QueryData) fetch(ctx context.Context, client *client.Client, q *models.Query, headers map[string]string) (*backend.DataResponse, error) {
	traceCtx, end := s.trace(ctx, q)
	defer end()

	logger := s.log.FromContext(traceCtx)
	logger.Debug("Sending query", "start", q.Start, "end", q.End, "step", q.Step, "query", q.Expr)

	response := &backend.DataResponse{
		Frames: data.Frames{},
		Error:  nil,
	}

	if q.InstantQuery {
		res, err := s.instantQuery(traceCtx, client, q, headers)
		response.Error = err
		response.Frames = res.Frames
	}

	if q.RangeQuery {
		res, err := s.rangeQuery(traceCtx, client, q, headers)
		if err != nil {
			if response.Error == nil {
				response.Error = err
			} else {
				response.Error = fmt.Errorf("%v %w", response.Error, err)
			}
		}
		response.Frames = append(response.Frames, res.Frames...)
	}

	if q.ExemplarQuery {
		res, err := s.exemplarQuery(traceCtx, client, q, headers)
		if err != nil {
			// If exemplar query returns error, we want to only log it and
			// continue with other results processing
			logger.Error("Exemplar query failed", "query", q.Expr, "err", err)
		}
		response.Frames = append(response.Frames, res.Frames...)
	}

	return response, nil
}

func (s *QueryData) rangeQuery(ctx context.Context, c *client.Client, q *models.Query, headers map[string]string) (backend.DataResponse, error) {
	res, err := c.QueryRange(ctx, q)
	if err != nil {
		return backend.DataResponse{}, err
	}
	return s.parseResponse(ctx, q, res)
}

func (s *QueryData) instantQuery(ctx context.Context, c *client.Client, q *models.Query, headers map[string]string) (backend.DataResponse, error) {
	res, err := c.QueryInstant(ctx, q)
	if err != nil {
		return backend.DataResponse{}, err
	}
	return s.parseResponse(ctx, q, res)
}

func (s *QueryData) exemplarQuery(ctx context.Context, c *client.Client, q *models.Query, headers map[string]string) (backend.DataResponse, error) {
	res, err := c.QueryExemplars(ctx, q)
	if err != nil {
		return backend.DataResponse{}, err
	}
	return s.parseResponse(ctx, q, res)
}

func (s *QueryData) trace(ctx context.Context, q *models.Query) (context.Context, func()) {
	return utils.StartTrace(ctx, s.tracer, "datasource.prometheus", []utils.Attribute{
		{Key: "expr", Value: q.Expr, Kv: attribute.Key("expr").String(q.Expr)},
		{Key: "start_unixnano", Value: q.Start, Kv: attribute.Key("start_unixnano").Int64(q.Start.UnixNano())},
		{Key: "stop_unixnano", Value: q.End, Kv: attribute.Key("stop_unixnano").Int64(q.End.UnixNano())},
	})
}

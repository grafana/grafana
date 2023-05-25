package querydata

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/client"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/models"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/utils"
	"github.com/grafana/grafana/pkg/util/maputil"
	"go.opentelemetry.io/otel/attribute"
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

	return &QueryData{
		intervalCalculator: intervalv2.NewCalculator(),
		tracer:             tracer,
		log:                plog,
		client:             promClient,
		TimeInterval:       timeInterval,
		ID:                 settings.ID,
		URL:                settings.URL,
		enableWideSeries:   features.IsEnabled(featuremgmt.FlagPrometheusWideSeries),
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
			s.log.Debug("Received nilresponse from runQuery", "query", query.Expr)
			continue
		}
		result.Responses[q.RefID] = *r
	}

	return &result, nil
}

func (s *QueryData) fetch(ctx context.Context, client *client.Client, q *models.Query, headers map[string]string) (*backend.DataResponse, error) {
	s.log.Debug("Sending query", "start", q.Start, "end", q.End, "step", q.Step, "query", q.Expr)

	traceCtx, end := s.trace(ctx, q)
	defer end()

	response := &backend.DataResponse{
		Frames: data.Frames{},
		Error:  nil,
	}

	if q.InstantQuery {
		res, err := s.instantQuery(traceCtx, client, q, headers)
		if err != nil {
			return nil, err
		}
		response.Error = res.Error
		response.Frames = res.Frames
	}

	if q.RangeQuery {
		res, err := s.rangeQuery(traceCtx, client, q, headers)
		if err != nil {
			return nil, err
		}
		if res.Error != nil {
			if response.Error == nil {
				response.Error = res.Error
			} else {
				response.Error = fmt.Errorf("%v %w", response.Error, res.Error) // lovely
			}
		}
		response.Frames = append(response.Frames, res.Frames...)
	}

	if q.ExemplarQuery {
		res, err := s.exemplarQuery(traceCtx, client, q, headers)
		if err != nil {
			// If exemplar query returns error, we want to only log it and
			// continue with other results processing
			s.log.Error("Exemplar query failed", "query", q.Expr, "err", err)
		}
		if res != nil {
			response.Frames = append(response.Frames, res.Frames...)
		}
	}

	return response, nil
}

func (s *QueryData) rangeQuery(ctx context.Context, c *client.Client, q *models.Query, headers map[string]string) (*backend.DataResponse, error) {
	//nolint:bodyclose // fixed in main
	res, err := c.QueryRange(ctx, q, sdkHeaderToHttpHeader(headers))
	if err != nil {
		return nil, err
	}
	return s.parseResponse(ctx, q, res)
}

func (s *QueryData) instantQuery(ctx context.Context, c *client.Client, q *models.Query, headers map[string]string) (*backend.DataResponse, error) {
	//nolint:bodyclose // fixed in main
	res, err := c.QueryInstant(ctx, q, sdkHeaderToHttpHeader(headers))
	if err != nil {
		return nil, err
	}
	return s.parseResponse(ctx, q, res)
}

func (s *QueryData) exemplarQuery(ctx context.Context, c *client.Client, q *models.Query, headers map[string]string) (*backend.DataResponse, error) {
	//nolint:bodyclose // fixed in main
	res, err := c.QueryExemplars(ctx, q, sdkHeaderToHttpHeader(headers))
	if err != nil {
		return nil, err
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

func sdkHeaderToHttpHeader(headers map[string]string) http.Header {
	httpHeader := make(http.Header)
	for key, val := range headers {
		httpHeader[key] = []string{val}
	}
	return httpHeader
}

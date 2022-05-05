package streaming

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/models"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/streaming/client"
	"github.com/grafana/grafana/pkg/util/converter"
	"github.com/grafana/grafana/pkg/util/maputil"
	jsoniter "github.com/json-iterator/go"
	"go.opentelemetry.io/otel/attribute"
)

const legendFormatAuto = "__auto"

var legendFormatRegexp = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)

type clientGetter func(map[string]string) (*client.Client, error)

type ExemplarEvent struct {
	Time   time.Time
	Value  float64
	Labels map[string]string
}

type Streaming struct {
	intervalCalculator intervalv2.Calculator
	tracer             tracing.Tracer
	getClient          clientGetter
	log                log.Logger
	ID                 int64
	URL                string
	TimeInterval       string
}

func New(
	httpClientProvider httpclient.Provider,
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	tracer tracing.Tracer,
	settings backend.DataSourceInstanceSettings,
	plog log.Logger,
) (*Streaming, error) {
	var jsonData map[string]interface{}
	if err := json.Unmarshal(settings.JSONData, &jsonData); err != nil {
		return nil, fmt.Errorf("error reading settings: %w", err)
	}

	timeInterval, err := maputil.GetStringOptional(jsonData, "timeInterval")
	if err != nil {
		return nil, err
	}

	p := client.NewProvider(settings, jsonData, httpClientProvider, cfg, features, plog)
	pc, err := client.NewProviderCache(p)
	if err != nil {
		return nil, err
	}

	return &Streaming{
		intervalCalculator: intervalv2.NewCalculator(),
		tracer:             tracer,
		log:                plog,
		getClient:          pc.GetClient,
		TimeInterval:       timeInterval,
		ID:                 settings.ID,
		URL:                settings.URL,
	}, nil
}

func (s *Streaming) ExecuteTimeSeriesQuery(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	fromAlert := req.Headers["FromAlert"] == "true"
	result := backend.QueryDataResponse{
		Responses: backend.Responses{},
	}

	client, err := s.getClient(req.Headers)
	if err != nil {
		return &result, err
	}

	for _, q := range req.Queries {
		query, err := models.Parse(q, s.TimeInterval, s.intervalCalculator, fromAlert)
		if err != nil {
			return &result, err
		}
		r, err := s.runQuery(ctx, client, query)
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

func (s *Streaming) runQuery(ctx context.Context, client *client.Client, q *models.Query) (*backend.DataResponse, error) {
	s.log.Debug("Sending query", "start", q.Start, "end", q.End, "step", q.Step, "query", q.Expr)

	traceCtx, span := s.trace(ctx, q)
	defer span.End()

	response := &backend.DataResponse{
		Frames: data.Frames{},
		Error:  nil,
	}

	if q.RangeQuery {
		res, err := s.rangeQuery(traceCtx, client, q)
		if err != nil {
			return nil, err
		}
		response.Frames = res.Frames
	}

	if q.InstantQuery {
		res, err := s.instantQuery(traceCtx, client, q)
		if err != nil {
			return nil, err
		}
		response.Frames = append(response.Frames, res.Frames...)
	}

	if q.ExemplarQuery {
		res, err := s.exemplarQuery(traceCtx, client, q)
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

func (s *Streaming) rangeQuery(ctx context.Context, c *client.Client, q *models.Query) (*backend.DataResponse, error) {
	res, err := c.QueryRange(ctx, q)
	if err != nil {
		return nil, err
	}
	return s.parseResponse(ctx, q, res, models.RangeQueryType)
}

func (s *Streaming) instantQuery(ctx context.Context, c *client.Client, q *models.Query) (*backend.DataResponse, error) {
	res, err := c.QueryInstant(ctx, q)
	if err != nil {
		return nil, err
	}
	return s.parseResponse(ctx, q, res, models.InstantQueryType)
}

func (s *Streaming) exemplarQuery(ctx context.Context, c *client.Client, q *models.Query) (*backend.DataResponse, error) {
	res, err := c.QueryExemplars(ctx, q)
	if err != nil {
		return nil, err
	}
	return s.parseResponse(ctx, q, res, models.InstantQueryType)
}

func (s *Streaming) parseResponse(ctx context.Context, q *models.Query, res *http.Response, t models.TimeSeriesQueryType) (*backend.DataResponse, error) {
	defer res.Body.Close()

	iter := jsoniter.Parse(jsoniter.ConfigDefault, res.Body, 1024)
	r := converter.ReadPrometheusStyleResult(iter)
	if r == nil {
		return nil, fmt.Errorf("received empty response from prometheus")
	}

	// The ExecutedQueryString can be viewed in QueryInspector in UI
	for _, frame := range r.Frames {
		addMetadataToFrame(q, frame, t)
	}

	return r, nil
}

func (s *Streaming) trace(ctx context.Context, q *models.Query) (context.Context, tracing.Span) {
	traceCtx, span := s.tracer.Start(ctx, "datasource.prometheus")
	span.SetAttributes("expr", q.Expr, attribute.Key("expr").String(q.Expr))
	span.SetAttributes("start_unixnano", q.Start, attribute.Key("start_unixnano").Int64(q.Start.UnixNano()))
	span.SetAttributes("stop_unixnano", q.End, attribute.Key("stop_unixnano").Int64(q.End.UnixNano()))
	return traceCtx, span
}

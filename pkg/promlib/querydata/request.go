package querydata

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"sync"
	"time"

	"github.com/grafana/dskit/concurrency"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/utils/maputil"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/promlib/client"
	"github.com/grafana/grafana/pkg/promlib/intervalv2"
	"github.com/grafana/grafana/pkg/promlib/models"
	"github.com/grafana/grafana/pkg/promlib/querydata/exemplar"
	"github.com/grafana/grafana/pkg/promlib/utils"
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
	tracer             trace.Tracer
	client             *client.Client
	log                log.Logger
	ID                 int64
	URL                string
	TimeInterval       string
	exemplarSampler    func() exemplar.Sampler
}

func New(
	httpClient *http.Client,
	settings backend.DataSourceInstanceSettings,
	plog log.Logger,
) (*QueryData, error) {
	jsonData, err := utils.GetJsonData(settings)
	if err != nil {
		return nil, err
	}
	httpMethod, _ := maputil.GetStringOptional(jsonData, "httpMethod")
	if httpMethod == "" {
		httpMethod = http.MethodPost
	}

	timeInterval, err := maputil.GetStringOptional(jsonData, "timeInterval")
	if err != nil {
		return nil, err
	}

	promClient := client.NewClient(httpClient, httpMethod, settings.URL, "2m")

	// standard deviation sampler is the default for backwards compatibility
	exemplarSampler := exemplar.NewStandardDeviationSampler

	return &QueryData{
		intervalCalculator: intervalv2.NewCalculator(),
		tracer:             tracing.DefaultTracer(),
		log:                plog,
		client:             promClient,
		TimeInterval:       timeInterval,
		ID:                 settings.ID,
		URL:                settings.URL,
		exemplarSampler:    exemplarSampler,
	}, nil
}

func (s *QueryData) Execute(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	fromAlert := req.Headers["FromAlert"] == "true"
	logger := s.log.FromContext(ctx)
	logger.Debug("Begin query execution", "fromAlert", fromAlert)
	result := backend.QueryDataResponse{
		Responses: backend.Responses{},
	}

	var (
		cfg                               = backend.GrafanaConfigFromContext(ctx)
		hasPromQLScopeFeatureFlag         = cfg.FeatureToggles().IsEnabled("promQLScope")
		hasPrometheusDataplaneFeatureFlag = cfg.FeatureToggles().IsEnabled("prometheusDataplane")
		hasPrometheusRunQueriesInParallel = cfg.FeatureToggles().IsEnabled("prometheusRunQueriesInParallel")
	)

	if hasPrometheusRunQueriesInParallel {
		var (
			m sync.Mutex
		)

		concurrentQueryCount, err := req.PluginContext.GrafanaConfig.ConcurrentQueryCount()
		if err != nil {
			logger.Debug(fmt.Sprintf("Concurrent Query Count read/parse error: %v", err), "prometheusRunQueriesInParallel")
			concurrentQueryCount = 10
		}

		_ = concurrency.ForEachJob(ctx, len(req.Queries), concurrentQueryCount, func(ctx context.Context, idx int) error {
			query := req.Queries[idx]
			r := s.handleQuery(ctx, query, fromAlert, hasPromQLScopeFeatureFlag, hasPrometheusDataplaneFeatureFlag, true)
			if r != nil {
				m.Lock()
				result.Responses[query.RefID] = *r
				m.Unlock()
			}
			return nil
		})
	} else {
		for _, q := range req.Queries {
			r := s.handleQuery(ctx, q, fromAlert, hasPromQLScopeFeatureFlag, hasPrometheusDataplaneFeatureFlag, false)
			if r != nil {
				result.Responses[q.RefID] = *r
			}
		}
	}

	return &result, nil
}

func (s *QueryData) handleQuery(ctx context.Context, bq backend.DataQuery, fromAlert,
	hasPromQLScopeFeatureFlag, hasPrometheusDataplaneFeatureFlag, hasPrometheusRunQueriesInParallel bool) *backend.DataResponse {
	traceCtx, span := s.tracer.Start(ctx, "datasource.prometheus")
	defer span.End()
	query, err := models.Parse(span, bq, s.TimeInterval, s.intervalCalculator, fromAlert, hasPromQLScopeFeatureFlag)
	if err != nil {
		return &backend.DataResponse{
			Error: err,
		}
	}

	r := s.fetch(traceCtx, s.client, query, hasPrometheusDataplaneFeatureFlag, hasPrometheusRunQueriesInParallel)
	if r == nil {
		s.log.FromContext(ctx).Debug("Received nil response from runQuery", "query", query.Expr)
	}
	return r
}

func (s *QueryData) fetch(traceCtx context.Context, client *client.Client, q *models.Query,
	enablePrometheusDataplane, hasPrometheusRunQueriesInParallel bool) *backend.DataResponse {
	logger := s.log.FromContext(traceCtx)
	logger.Debug("Sending query", "start", q.Start, "end", q.End, "step", q.Step, "query", q.Expr /*, "queryTimeout", s.QueryTimeout*/)

	dr := &backend.DataResponse{
		Frames: data.Frames{},
		Error:  nil,
	}

	var (
		wg sync.WaitGroup
		m  sync.Mutex
	)

	if q.InstantQuery {
		if hasPrometheusRunQueriesInParallel {
			wg.Add(1)
			go func() {
				defer wg.Done()
				res := s.instantQuery(traceCtx, client, q, enablePrometheusDataplane)
				m.Lock()
				addDataResponse(&res, dr)
				m.Unlock()
			}()
		} else {
			res := s.instantQuery(traceCtx, client, q, enablePrometheusDataplane)
			addDataResponse(&res, dr)
		}
	}

	if q.RangeQuery {
		if hasPrometheusRunQueriesInParallel {
			wg.Add(1)
			go func() {
				defer wg.Done()
				res := s.rangeQuery(traceCtx, client, q, enablePrometheusDataplane)
				m.Lock()
				addDataResponse(&res, dr)
				m.Unlock()
			}()
		} else {
			res := s.rangeQuery(traceCtx, client, q, enablePrometheusDataplane)
			addDataResponse(&res, dr)
		}
	}

	if q.ExemplarQuery {
		if hasPrometheusRunQueriesInParallel {
			wg.Add(1)
			go func() {
				defer wg.Done()
				res := s.exemplarQuery(traceCtx, client, q, enablePrometheusDataplane)
				m.Lock()
				if res.Error != nil {
					// If exemplar query returns error, we want to only log it and
					// continue with other results processing
					logger.Error("Exemplar query failed", "query", q.Expr, "err", res.Error)
				}
				dr.Frames = append(dr.Frames, res.Frames...)
				m.Unlock()
			}()
		} else {
			res := s.exemplarQuery(traceCtx, client, q, enablePrometheusDataplane)
			if res.Error != nil {
				// If exemplar query returns error, we want to only log it and
				// continue with other results processing
				logger.Error("Exemplar query failed", "query", q.Expr, "err", res.Error)
			}
			dr.Frames = append(dr.Frames, res.Frames...)
		}
	}
	wg.Wait()

	return dr
}

func (s *QueryData) rangeQuery(ctx context.Context, c *client.Client, q *models.Query, enablePrometheusDataplaneFlag bool) backend.DataResponse {
	res, err := c.QueryRange(ctx, q)
	if err != nil {
		return backend.DataResponse{
			Error:  err,
			Status: backend.StatusBadGateway,
		}
	}

	defer func() {
		err := res.Body.Close()
		if err != nil {
			s.log.Warn("Failed to close query range response body", "error", err)
		}
	}()

	return s.parseResponse(ctx, q, res)
}

func (s *QueryData) instantQuery(ctx context.Context, c *client.Client, q *models.Query, enablePrometheusDataplaneFlag bool) backend.DataResponse {
	res, err := c.QueryInstant(ctx, q)
	if err != nil {
		return backend.DataResponse{
			Error:  err,
			Status: backend.StatusBadGateway,
		}
	}

	// This is only for health check fall back scenario
	if res.StatusCode != 200 && q.RefId == "__healthcheck__" {
		return backend.DataResponse{
			Error: errors.New(res.Status),
		}
	}

	defer func() {
		err := res.Body.Close()
		if err != nil {
			s.log.Warn("Failed to close response body", "error", err)
		}
	}()

	return s.parseResponse(ctx, q, res)
}

func (s *QueryData) exemplarQuery(ctx context.Context, c *client.Client, q *models.Query, enablePrometheusDataplaneFlag bool) backend.DataResponse {
	res, err := c.QueryExemplars(ctx, q)
	if err != nil {
		return backend.DataResponse{
			Error: err,
		}
	}

	defer func() {
		err := res.Body.Close()
		if err != nil {
			s.log.Warn("Failed to close response body", "error", err)
		}
	}()
	return s.parseResponse(ctx, q, res)
}

func addDataResponse(res *backend.DataResponse, dr *backend.DataResponse) {
	if res.Error != nil {
		if dr.Error == nil {
			dr.Error = res.Error
		} else {
			dr.Error = fmt.Errorf("%v %w", dr.Error, res.Error)
		}
		dr.Status = res.Status
	}
	dr.Frames = append(dr.Frames, res.Frames...)
}

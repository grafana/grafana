package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	expressionsQuerySummary *prometheus.SummaryVec
)

func init() {
	expressionsQuerySummary = prometheus.NewSummaryVec(
		prometheus.SummaryOpts{
			Name:       "expressions_queries_duration_milliseconds",
			Help:       "Expressions query summary",
			Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
		},
		[]string{"status"},
	)

	prometheus.MustRegister(expressionsQuerySummary)
}

// Service is service representation for expression handling.
type Service struct {
	cfg               *setting.Cfg
	dataService       backend.QueryDataHandler
	dataSourceService datasources.DataSourceService
}

func ProvideService(cfg *setting.Cfg, pluginClient plugins.Client, dataSourceService datasources.DataSourceService) *Service {
	return &Service{
		cfg:               cfg,
		dataService:       pluginClient,
		dataSourceService: dataSourceService,
	}
}

func (s *Service) isDisabled() bool {
	if s.cfg == nil {
		return true
	}
	return !s.cfg.ExpressionsEnabled
}

// BuildPipeline builds a pipeline from a request.
func (s *Service) BuildPipeline(req *expr.Request) (expr.DataPipeline, error) {
	return s.buildPipeline(req)
}

// ExecutePipeline executes an expression pipeline and returns all the results.
func (s *Service) ExecutePipeline(ctx context.Context, now time.Time, pipeline expr.DataPipeline) (*backend.QueryDataResponse, error) {
	intPipeline, ok := pipeline.(DataPipeline)
	if !ok {
		return nil, fmt.Errorf("failed to cast expr.DataPipeline to service.DataPipeline")
	}

	res := backend.NewQueryDataResponse()
	vars, err := intPipeline.execute(ctx, now, s)
	if err != nil {
		return nil, err
	}
	for refID, val := range vars {
		res.Responses[refID] = backend.DataResponse{
			Frames: val.Values.AsDataFrames(refID),
		}
	}
	return res, nil
}

// TransformData takes Queries which are either expressions nodes
// or are datasource requests.
func (s *Service) TransformData(ctx context.Context, now time.Time, req *expr.Request) (r *backend.QueryDataResponse, err error) {
	if s.isDisabled() {
		return nil, fmt.Errorf("server side expressions are disabled")
	}

	start := time.Now()
	defer func() {
		var respStatus string
		switch {
		case err == nil:
			respStatus = "success"
		default:
			respStatus = "failure"
		}
		duration := float64(time.Since(start).Nanoseconds()) / float64(time.Millisecond)
		expressionsQuerySummary.WithLabelValues(respStatus).Observe(duration)
	}()

	// Build the pipeline from the request, checking for ordering issues (e.g. loops)
	// and parsing graph nodes from the queries.
	pipeline, err := s.BuildPipeline(req)
	if err != nil {
		return nil, err
	}

	// Execute the pipeline
	responses, err := s.ExecutePipeline(ctx, now, pipeline)
	if err != nil {
		return nil, err
	}

	// Get which queries have the Hide property so they those queries' results
	// can be excluded from the response.
	hidden, err := hiddenRefIDs(req.Queries)
	if err != nil {
		return nil, err
	}

	if len(hidden) != 0 {
		filteredRes := backend.NewQueryDataResponse()
		for refID, res := range responses.Responses {
			if _, ok := hidden[refID]; !ok {
				filteredRes.Responses[refID] = res
			}
		}
		responses = filteredRes
	}

	return responses, nil
}

func hiddenRefIDs(queries []expr.Query) (map[string]struct{}, error) {
	hidden := make(map[string]struct{})

	for _, query := range queries {
		hide := struct {
			Hide bool `json:"hide"`
		}{}

		if err := json.Unmarshal(query.JSON, &hide); err != nil {
			return nil, err
		}

		if hide.Hide {
			hidden[query.RefID] = struct{}{}
		}
	}
	return hidden, nil
}

func (s *Service) decryptSecureJsonDataFn(ctx context.Context) func(ds *datasources.DataSource) (map[string]string, error) {
	return func(ds *datasources.DataSource) (map[string]string, error) {
		return s.dataSourceService.DecryptedValues(ctx, ds)
	}
}

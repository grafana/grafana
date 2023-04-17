package expr

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/services/datasources"
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

// Request is similar to plugins.DataQuery but with the Time Ranges is per Query.
type Request struct {
	Headers map[string]string
	Debug   bool
	OrgId   int64
	Queries []Query
	User    *backend.User
}

// Query is like plugins.DataSubQuery, but with a a time range, and only the UID
// for the data source. Also interval is a time.Duration.
type Query struct {
	RefID         string
	TimeRange     TimeRange
	DataSource    *datasources.DataSource `json:"datasource"`
	JSON          json.RawMessage
	Interval      time.Duration
	QueryType     string
	MaxDataPoints int64
}

// TimeRange is a time.Time based TimeRange.
type TimeRange interface {
	AbsoluteTime(now time.Time) backend.TimeRange
}

type AbsoluteTimeRange struct {
	From time.Time
	To   time.Time
}

func (r AbsoluteTimeRange) AbsoluteTime(_ time.Time) backend.TimeRange {
	return backend.TimeRange{
		From: r.From,
		To:   r.To,
	}
}

// RelativeTimeRange is a time range relative to some absolute time.
type RelativeTimeRange struct {
	From time.Duration
	To   time.Duration
}

func (r RelativeTimeRange) AbsoluteTime(t time.Time) backend.TimeRange {
	return backend.TimeRange{
		From: t.Add(r.From),
		To:   t.Add(r.To),
	}
}

// TransformData takes Queries which are either expressions nodes
// or are datasource requests.
func (s *Service) TransformData(ctx context.Context, now time.Time, req *Request) (r *backend.QueryDataResponse, err error) {
	if s.isDisabled() {
		return nil, fmt.Errorf("server side expressions are disabled")
	}

	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "SSE.TransformData")
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

		span.End()
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

func hiddenRefIDs(queries []Query) (map[string]struct{}, error) {
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

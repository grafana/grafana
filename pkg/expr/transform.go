package expr

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/adapters"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/net/context"
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

// WrapTransformData creates and executes transform requests
func (s *Service) WrapTransformData(ctx context.Context, query legacydata.DataQuery) (*backend.QueryDataResponse, error) {
	req := Request{
		OrgId:   query.User.OrgId,
		Queries: []Query{},
	}

	for _, q := range query.Queries {
		if q.DataSource == nil {
			return nil, fmt.Errorf("mising datasource info: " + q.RefID)
		}
		modelJSON, err := q.Model.MarshalJSON()
		if err != nil {
			return nil, err
		}
		req.Queries = append(req.Queries, Query{
			JSON:          modelJSON,
			Interval:      time.Duration(q.IntervalMS) * time.Millisecond,
			RefID:         q.RefID,
			MaxDataPoints: q.MaxDataPoints,
			QueryType:     q.QueryType,
			Datasource: DataSourceRef{
				Type: q.DataSource.Type,
				UID:  q.DataSource.Uid,
			},
			TimeRange: TimeRange{
				From: query.TimeRange.GetFromAsTimeUTC(),
				To:   query.TimeRange.GetToAsTimeUTC(),
			},
		})
	}
	return s.TransformData(ctx, &req)
}

// Request is similar to plugins.DataQuery but with the Time Ranges is per Query.
type Request struct {
	Headers map[string]string
	Debug   bool
	OrgId   int64
	Queries []Query
}

// Query is like plugins.DataSubQuery, but with a a time range, and only the UID
// for the data source. Also interval is a time.Duration.
type Query struct {
	RefID         string
	TimeRange     TimeRange
	DatasourceUID string        // deprecated, value -100 when expressions
	Datasource    DataSourceRef `json:"datasource"`
	JSON          json.RawMessage
	Interval      time.Duration
	QueryType     string
	MaxDataPoints int64
}

type DataSourceRef struct {
	Type string `json:"type"` // value should be __expr__
	UID  string `json:"uid"`  // value should be __expr__
}

func (q *Query) GetDatasourceUID() string {
	if q.DatasourceUID != "" {
		return q.DatasourceUID // backwards compatibility gets precedence
	}

	if q.Datasource.UID != "" {
		return q.Datasource.UID
	}
	return ""
}

// TimeRange is a time.Time based TimeRange.
type TimeRange struct {
	From time.Time
	To   time.Time
}

// TransformData takes Queries which are either expressions nodes
// or are datasource requests.
func (s *Service) TransformData(ctx context.Context, req *Request) (r *backend.QueryDataResponse, err error) {
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
	responses, err := s.ExecutePipeline(ctx, pipeline)
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

// queryData is called used to query datasources that are not expression commands, but are used
// alongside expressions and/or are the input of an expression command.
func (s *Service) queryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if len(req.Queries) == 0 {
		return nil, fmt.Errorf("zero queries found in datasource request")
	}

	datasourceID := int64(0)
	var datasourceUID string

	if req.PluginContext.DataSourceInstanceSettings != nil {
		datasourceID = req.PluginContext.DataSourceInstanceSettings.ID
		datasourceUID = req.PluginContext.DataSourceInstanceSettings.UID
	}

	getDsInfo := &models.GetDataSourceQuery{
		OrgId: req.PluginContext.OrgID,
		Id:    datasourceID,
		Uid:   datasourceUID,
	}

	if err := bus.DispatchCtx(ctx, getDsInfo); err != nil {
		return nil, fmt.Errorf("could not find datasource: %w", err)
	}

	dsInstanceSettings, err := adapters.ModelToInstanceSettings(getDsInfo.Result, s.decryptSecureJsonDataFn(ctx))
	if err != nil {
		return nil, errutil.Wrap("failed to convert datasource instance settings", err)
	}

	req.PluginContext.DataSourceInstanceSettings = dsInstanceSettings
	req.PluginContext.PluginID = getDsInfo.Result.Type

	return s.dataService.QueryData(ctx, req)
}

func (s *Service) decryptSecureJsonDataFn(ctx context.Context) func(map[string][]byte) map[string]string {
	return func(m map[string][]byte) map[string]string {
		decryptedJsonData, err := s.secretsService.DecryptJsonData(ctx, m)
		if err != nil {
			logger.Error("Failed to decrypt secure json data", "error", err)
		}
		return decryptedJsonData
	}
}

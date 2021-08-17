package prometheus

import (
	"encoding/json"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb"
)

type QueryModel struct {
	Expr           string `json:"expr"`
	LegendFormat   string `json:"legendFormat"`
	Interval       string `json:"interval"`
	IntervalMS     int    `json:"intervalMS"`
	StepMode       string `json:"stepMode"`
	RangeQuery     bool   `json:"range"`
	InstantQuery   bool   `json:"instant"`
	IntervalFactor int    `json:"intervalFactor"`
}

func (s *Service) parseQuery(dsInfo *DatasourceInfo, queryContext *backend.QueryDataRequest) (
	[]*PrometheusQuery, error) {
	qs := []*PrometheusQuery{}
	for _, query := range queryContext.Queries {
		model := &QueryModel{}
		err := json.Unmarshal(query.JSON, model)
		if err != nil {
			return nil, err
		}

		step, err := s.createStep(dsInfo, model, query)
		if err != nil {
			return nil, err
		}

		if model.InstantQuery == model.RangeQuery {
			qs = append(qs, createInstantQuery(model, step, query), createRangeQuery(model, step, query))

		} else {
			qs = append(qs, &PrometheusQuery{
				Expr:         model.Expr,
				Step:         step,
				LegendFormat: model.LegendFormat,
				Start:        query.TimeRange.From,
				End:          query.TimeRange.To,
				RefId:        query.RefID,
				InstantQuery: model.InstantQuery,
				RangeQuery:   model.RangeQuery,
			})
		}
	}
	return qs, nil
}

func createRangeQuery(model *QueryModel, step time.Duration, query backend.DataQuery) *PrometheusQuery {
	queryModel := PrometheusQuery{
		Expr:         model.Expr,
		Step:         step,
		LegendFormat: model.LegendFormat,
		Start:        query.TimeRange.From,
		End:          query.TimeRange.To,
		RefId:        query.RefID,
		InstantQuery: false,
		RangeQuery:   true,
	}
	return &queryModel
}

func createInstantQuery(model *QueryModel, step time.Duration, query backend.DataQuery) *PrometheusQuery {
	queryModel := PrometheusQuery{
		Expr:         model.Expr,
		Step:         step,
		LegendFormat: model.LegendFormat,
		Start:        query.TimeRange.From,
		End:          query.TimeRange.To,
		RefId:        query.RefID + "_instant",
		InstantQuery: true,
		RangeQuery:   false,
	}
	return &queryModel
}

func (s *Service) createStep(dsInfo *DatasourceInfo, model *QueryModel, query backend.DataQuery) (time.Duration, error) {
	intervalMode := "min"
	hasQueryInterval := model.Interval != ""

	foundInterval, err := tsdb.GetIntervalFrom(dsInfo.TimeInterval, model.Interval, int64(model.IntervalMS), 15*time.Second)
	if err != nil {
		return time.Duration(0), err
	}

	if hasQueryInterval {
		intervalMode = model.StepMode
	}
	// Calculate interval value from query or data source settings or use default value
	calculatedInterval, err := s.intervalCalculator.Calculate(query.TimeRange, foundInterval, tsdb.IntervalMode(intervalMode))
	if err != nil {
		return time.Duration(0), err
	}
	safeInterval := s.intervalCalculator.CalculateSafeInterval(query.TimeRange, int64(safeRes))

	var adjustedInterval time.Duration
	if calculatedInterval.Value > safeInterval.Value {
		adjustedInterval = calculatedInterval.Value
	} else {
		adjustedInterval = safeInterval.Value
	}
	intervalFactor := model.IntervalFactor
	if intervalFactor == 0 {
		intervalFactor = 1
	}
	step := time.Duration(int64(adjustedInterval) * int64(intervalFactor))

	return step, nil
}

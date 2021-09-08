package prometheus

import (
	"encoding/json"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
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
	StepMS         int    `json:"stepMS"`
}

func (s *Service) parseQuery(dsInfo *DatasourceInfo, queryContext *backend.QueryDataRequest) (
	[]PrometheusQuery, error) {
	qs := []PrometheusQuery{}
	for _, query := range queryContext.Queries {
		model := &QueryModel{}
		err := json.Unmarshal(query.JSON, model)
		if err != nil {
			return nil, err
		}

		step := time.Duration(model.StepMS) * time.Millisecond
		if model.StepMS == 0 {
			stepFromInterval, err := createStep(dsInfo, model, query, s.intervalCalculator)
			if err != nil {
				return nil, err
			}
			step = stepFromInterval
		}

		qs = append(qs, createQuery(model, step, query))
	}
	return qs, nil
}

func createQuery(model *QueryModel, step time.Duration, query backend.DataQuery) PrometheusQuery {
	queryType := Range
	if model.InstantQuery {
		queryType = Instant
	}

	queryModel := PrometheusQuery{
		Expr:         model.Expr,
		Step:         step,
		LegendFormat: model.LegendFormat,
		Start:        query.TimeRange.From,
		End:          query.TimeRange.To,
		RefId:        query.RefID,
		QueryType:    queryType,
	}
	return queryModel
}

func createStep(dsInfo *DatasourceInfo, model *QueryModel, query backend.DataQuery, intervalCalculator intervalv2.Calculator) (time.Duration, error) {
	foundInterval, err := intervalv2.GetIntervalFrom(dsInfo.TimeInterval, model.Interval, int64(model.IntervalMS), 15*time.Second)
	if err != nil {
		return time.Duration(0), err
	}

	calculatedInterval := intervalCalculator.Calculate(query.TimeRange, foundInterval)
	safeInterval := intervalCalculator.CalculateSafeInterval(query.TimeRange, int64(safeRes))

	adjustedInterval := safeInterval.Value
	if calculatedInterval.Value > safeInterval.Value {
		adjustedInterval = calculatedInterval.Value
	}

	intervalFactor := model.IntervalFactor
	if intervalFactor == 0 {
		intervalFactor = 1
	}
	step := time.Duration(int64(adjustedInterval) * int64(intervalFactor))

	return step, nil
}

package testdata

import (
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"
)

type ScenarioHandler func(query *tsdb.Query, context *tsdb.QueryContext) *tsdb.QueryResult

type Scenario struct {
	Id          string          `json:"id"`
	Name        string          `json:"name"`
	StringInput string          `json:"stringOption"`
	Description string          `json:"description"`
	Handler     ScenarioHandler `json:"-"`
}

var ScenarioRegistry map[string]*Scenario

func init() {
	ScenarioRegistry = make(map[string]*Scenario)
	logger := log.New("tsdb.testdata")

	logger.Debug("Initializing TestData Scenario")

	registerScenario(&Scenario{
		Id:   "random_walk",
		Name: "Random Walk",

		Handler: func(query *tsdb.Query, context *tsdb.QueryContext) *tsdb.QueryResult {
			timeWalkerMs := context.TimeRange.GetFromAsMsEpoch()
			to := context.TimeRange.GetToAsMsEpoch()

			series := newSeriesForQuery(query)

			points := make(tsdb.TimeSeriesPoints, 0)
			walker := rand.Float64() * 100

			for i := int64(0); i < 10000 && timeWalkerMs < to; i++ {
				points = append(points, tsdb.NewTimePoint(null.FloatFrom(walker), float64(timeWalkerMs)))

				walker += rand.Float64() - 0.5
				timeWalkerMs += query.IntervalMs
			}

			series.Points = points

			queryRes := tsdb.NewQueryResult()
			queryRes.Series = append(queryRes.Series, series)
			return queryRes
		},
	})

	registerScenario(&Scenario{
		Id:   "no_data_points",
		Name: "No Data Points",
		Handler: func(query *tsdb.Query, context *tsdb.QueryContext) *tsdb.QueryResult {
			return tsdb.NewQueryResult()
		},
	})

	registerScenario(&Scenario{
		Id:   "datapoints_outside_range",
		Name: "Datapoints Outside Range",
		Handler: func(query *tsdb.Query, context *tsdb.QueryContext) *tsdb.QueryResult {
			queryRes := tsdb.NewQueryResult()

			series := newSeriesForQuery(query)
			outsideTime := context.TimeRange.MustGetFrom().Add(-1*time.Hour).Unix() * 1000

			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(10), float64(outsideTime)))
			queryRes.Series = append(queryRes.Series, series)

			return queryRes
		},
	})

	registerScenario(&Scenario{
		Id:          "csv_metric_values",
		Name:        "CSV Metric Values",
		StringInput: "1,20,90,30,5,0",
		Handler: func(query *tsdb.Query, context *tsdb.QueryContext) *tsdb.QueryResult {
			queryRes := tsdb.NewQueryResult()

			stringInput := query.Model.Get("stringInput").MustString()
			stringInput = strings.Replace(stringInput, " ", "", -1)

			values := []null.Float{}
			for _, strVal := range strings.Split(stringInput, ",") {
				if strVal == "null" {
					values = append(values, null.FloatFromPtr(nil))
				}
				if val, err := strconv.ParseFloat(strVal, 64); err == nil {
					values = append(values, null.FloatFrom(val))
				}
			}

			if len(values) == 0 {
				return queryRes
			}

			series := newSeriesForQuery(query)
			startTime := context.TimeRange.GetFromAsMsEpoch()
			endTime := context.TimeRange.GetToAsMsEpoch()
			step := (endTime - startTime) / int64(len(values)-1)

			for _, val := range values {
				series.Points = append(series.Points, tsdb.TimePoint{val, null.FloatFrom(float64(startTime))})
				startTime += step
			}

			queryRes.Series = append(queryRes.Series, series)

			return queryRes
		},
	})
}

func registerScenario(scenario *Scenario) {
	ScenarioRegistry[scenario.Id] = scenario
}

func newSeriesForQuery(query *tsdb.Query) *tsdb.TimeSeries {
	alias := query.Model.Get("alias").MustString("")
	if alias == "" {
		alias = query.RefId + "-series"
	}

	return &tsdb.TimeSeries{Name: alias}
}

package testdata

import (
	"math/rand"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"
)

type ScenarioHandler func(query *tsdb.Query, context *tsdb.QueryContext) *tsdb.QueryResult

type Scenario struct {
	Id          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Handler     ScenarioHandler `json:"-"`
}

var ScenarioRegistry map[string]*Scenario

func init() {
	ScenarioRegistry = make(map[string]*Scenario)
	logger := log.New("tsdb.testdata")

	registerScenario(&Scenario{
		Id:   "random_walk",
		Name: "Random Walk",

		Handler: func(query *tsdb.Query, context *tsdb.QueryContext) *tsdb.QueryResult {
			timeWalkerMs := context.TimeRange.MustGetFrom().Unix() * 1000
			to := context.TimeRange.MustGetTo().Unix() * 1000

			series := newSeriesForQuery(query)

			points := make([][2]*float64, 0)
			walker := rand.Float64() * 100

			for i := int64(0); i < 10000 && timeWalkerMs < to; i++ {
				timestamp := float64(timeWalkerMs)
				val := float64(walker)
				points = append(points, [2]*float64{&val, &timestamp})

				walker += rand.Float64() - 0.5
				timeWalkerMs += query.IntervalMs
			}

			series.Points = points

			queryRes := &tsdb.QueryResult{}
			queryRes.Series = append(queryRes.Series, series)
			return queryRes
		},
	})

	registerScenario(&Scenario{
		Id:   "no_data_points",
		Name: "No Data Points",
		Handler: func(query *tsdb.Query, context *tsdb.QueryContext) *tsdb.QueryResult {
			return &tsdb.QueryResult{
				Series: make(tsdb.TimeSeriesSlice, 0),
			}
		},
	})

	registerScenario(&Scenario{
		Id:   "datapoints_outside_range",
		Name: "Datapoints Outside Range",
		Handler: func(query *tsdb.Query, context *tsdb.QueryContext) *tsdb.QueryResult {
			queryRes := &tsdb.QueryResult{}

			series := newSeriesForQuery(query)
			outsideTime := context.TimeRange.MustGetFrom().Add(-1*time.Hour).Unix() * 1000

			timestamp := float64(outsideTime)
			logger.Info("time", "from", timestamp)
			val := float64(10)

			series.Points = append(series.Points, [2]*float64{&val, &timestamp})
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

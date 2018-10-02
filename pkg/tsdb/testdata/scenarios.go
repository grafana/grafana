package testdata

import (
	"encoding/json"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"
)

type ScenarioHandler func(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult

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
		Id:   "exponential_heatmap_bucket_data",
		Name: "Exponential heatmap bucket data",

		Handler: func(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult {
			to := context.TimeRange.GetToAsMsEpoch()

			var series []*tsdb.TimeSeries
			start := 1
			factor := 2
			for i := 0; i < 10; i++ {
				timeWalkerMs := context.TimeRange.GetFromAsMsEpoch()
				serie := &tsdb.TimeSeries{Name: strconv.Itoa(start)}
				start *= factor

				points := make(tsdb.TimeSeriesPoints, 0)
				for j := int64(0); j < 100 && timeWalkerMs < to; j++ {
					v := float64(rand.Int63n(100))
					points = append(points, tsdb.NewTimePoint(null.FloatFrom(v), float64(timeWalkerMs)))
					timeWalkerMs += query.IntervalMs * 50
				}

				serie.Points = points
				series = append(series, serie)
			}

			queryRes := tsdb.NewQueryResult()
			queryRes.Series = append(queryRes.Series, series...)
			return queryRes
		},
	})

	registerScenario(&Scenario{
		Id:   "linear_heatmap_bucket_data",
		Name: "Linear heatmap bucket data",

		Handler: func(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult {
			to := context.TimeRange.GetToAsMsEpoch()

			var series []*tsdb.TimeSeries
			for i := 0; i < 10; i++ {
				timeWalkerMs := context.TimeRange.GetFromAsMsEpoch()
				serie := &tsdb.TimeSeries{Name: strconv.Itoa(i * 10)}

				points := make(tsdb.TimeSeriesPoints, 0)
				for j := int64(0); j < 100 && timeWalkerMs < to; j++ {
					v := float64(rand.Int63n(100))
					points = append(points, tsdb.NewTimePoint(null.FloatFrom(v), float64(timeWalkerMs)))
					timeWalkerMs += query.IntervalMs * 50
				}

				serie.Points = points
				series = append(series, serie)
			}

			queryRes := tsdb.NewQueryResult()
			queryRes.Series = append(queryRes.Series, series...)
			return queryRes
		},
	})

	registerScenario(&Scenario{
		Id:   "random_walk",
		Name: "Random Walk",

		Handler: func(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult {
			return getRandomWalk(query, context)
		},
	})

	registerScenario(&Scenario{
		Id:          "slow_query",
		Name:        "Slow Query",
		StringInput: "5s",
		Handler: func(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult {
			stringInput := query.Model.Get("stringInput").MustString()
			parsedInterval, _ := time.ParseDuration(stringInput)
			time.Sleep(parsedInterval)
			return getRandomWalk(query, context)
		},
	})

	registerScenario(&Scenario{
		Id:   "no_data_points",
		Name: "No Data Points",
		Handler: func(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult {
			return tsdb.NewQueryResult()
		},
	})

	registerScenario(&Scenario{
		Id:   "datapoints_outside_range",
		Name: "Datapoints Outside Range",
		Handler: func(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult {
			queryRes := tsdb.NewQueryResult()

			series := newSeriesForQuery(query)
			outsideTime := context.TimeRange.MustGetFrom().Add(-1*time.Hour).Unix() * 1000

			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(10), float64(outsideTime)))
			queryRes.Series = append(queryRes.Series, series)

			return queryRes
		},
	})

	registerScenario(&Scenario{
		Id:   "manual_entry",
		Name: "Manual Entry",
		Handler: func(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult {
			queryRes := tsdb.NewQueryResult()

			points := query.Model.Get("points").MustArray()

			series := newSeriesForQuery(query)
			startTime := context.TimeRange.GetFromAsMsEpoch()
			endTime := context.TimeRange.GetToAsMsEpoch()

			for _, val := range points {
				pointValues := val.([]interface{})

				var value null.Float
				var time int64

				if valueFloat, err := strconv.ParseFloat(string(pointValues[0].(json.Number)), 64); err == nil {
					value = null.FloatFrom(valueFloat)
				}

				if timeInt, err := strconv.ParseInt(string(pointValues[1].(json.Number)), 10, 64); err != nil {
					continue
				} else {
					time = timeInt
				}

				if time >= startTime && time <= endTime {
					series.Points = append(series.Points, tsdb.NewTimePoint(value, float64(time)))
				}
			}

			queryRes.Series = append(queryRes.Series, series)

			return queryRes
		},
	})

	registerScenario(&Scenario{
		Id:          "csv_metric_values",
		Name:        "CSV Metric Values",
		StringInput: "1,20,90,30,5,0",
		Handler: func(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult {
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

	registerScenario(&Scenario{
		Id:   "table_static",
		Name: "Table Static",

		Handler: func(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult {
			timeWalkerMs := context.TimeRange.GetFromAsMsEpoch()
			to := context.TimeRange.GetToAsMsEpoch()

			table := tsdb.Table{
				Columns: []tsdb.TableColumn{
					{Text: "Time"},
					{Text: "Message"},
					{Text: "Description"},
					{Text: "Value"},
				},
				Rows: []tsdb.RowValues{},
			}
			for i := int64(0); i < 10 && timeWalkerMs < to; i++ {
				table.Rows = append(table.Rows, tsdb.RowValues{float64(timeWalkerMs), "This is a message", "Description", 23.1})
				timeWalkerMs += query.IntervalMs
			}

			queryRes := tsdb.NewQueryResult()
			queryRes.Tables = append(queryRes.Tables, &table)
			return queryRes
		},
	})
}

func getRandomWalk(query *tsdb.Query, tsdbQuery *tsdb.TsdbQuery) *tsdb.QueryResult {
	timeWalkerMs := tsdbQuery.TimeRange.GetFromAsMsEpoch()
	to := tsdbQuery.TimeRange.GetToAsMsEpoch()

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

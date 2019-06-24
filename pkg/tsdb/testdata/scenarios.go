package testdata

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/infra/log"
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
		Id:   "random_walk_table",
		Name: "Random Walk Table",

		Handler: func(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult {
			return getRandomWalkTable(query, context)
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
		Id:   "streaming_client",
		Name: "Streaming Client",
		Handler: func(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult {
			// Real work is in javascript client
			return tsdb.NewQueryResult()
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

	registerScenario(&Scenario{
		Id:   "logs",
		Name: "Logs",

		Handler: func(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult {
			from := context.TimeRange.GetFromAsMsEpoch()
			to := context.TimeRange.GetToAsMsEpoch()
			lines := query.Model.Get("lines").MustInt64(10)
			includeLevelColumn := query.Model.Get("levelColumn").MustBool(false)

			logLevelGenerator := newRandomStringProvider([]string{
				"emerg",
				"alert",
				"crit",
				"critical",
				"warn",
				"warning",
				"err",
				"eror",
				"error",
				"info",
				"notice",
				"dbug",
				"debug",
				"trace",
				"",
			})
			containerIDGenerator := newRandomStringProvider([]string{
				"f36a9eaa6d34310686f2b851655212023a216de955cbcc764210cefa71179b1a",
				"5a354a630364f3742c602f315132e16def594fe68b1e4a195b2fce628e24c97a",
			})
			hostnameGenerator := newRandomStringProvider([]string{
				"srv-001",
				"srv-002",
			})

			table := tsdb.Table{
				Columns: []tsdb.TableColumn{
					{Text: "time"},
					{Text: "message"},
					{Text: "container_id"},
					{Text: "hostname"},
				},
				Rows: []tsdb.RowValues{},
			}

			if includeLevelColumn {
				table.Columns = append(table.Columns, tsdb.TableColumn{Text: "level"})
			}

			for i := int64(0); i < lines && to > from; i++ {
				row := tsdb.RowValues{float64(to)}

				logLevel := logLevelGenerator.Next()
				timeFormatted := time.Unix(to/1000, 0).Format(time.RFC3339)
				lvlString := ""
				if !includeLevelColumn {
					lvlString = fmt.Sprintf("lvl=%s ", logLevel)
				}

				row = append(row, fmt.Sprintf("t=%s %smsg=\"Request Completed\" logger=context userId=1 orgId=1 uname=admin method=GET path=/api/datasources/proxy/152/api/prom/label status=502 remote_addr=[::1] time_ms=1 size=0 referer=\"http://localhost:3000/explore?left=%%5B%%22now-6h%%22,%%22now%%22,%%22Prometheus%%202.x%%22,%%7B%%7D,%%7B%%22ui%%22:%%5Btrue,true,true,%%22none%%22%%5D%%7D%%5D\"", timeFormatted, lvlString))
				row = append(row, containerIDGenerator.Next())
				row = append(row, hostnameGenerator.Next())

				if includeLevelColumn {
					row = append(row, logLevel)
				}

				table.Rows = append(table.Rows, row)
				to -= query.IntervalMs
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
	walker := query.Model.Get("startValue").MustFloat64(rand.Float64() * 100)

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

func getRandomWalkTable(query *tsdb.Query, tsdbQuery *tsdb.TsdbQuery) *tsdb.QueryResult {
	timeWalkerMs := tsdbQuery.TimeRange.GetFromAsMsEpoch()
	to := tsdbQuery.TimeRange.GetToAsMsEpoch()

	table := tsdb.Table{
		Columns: []tsdb.TableColumn{
			{Text: "Time"},
			{Text: "Value"},
			{Text: "Min"},
			{Text: "Max"},
			{Text: "Info"},
		},
		Rows: []tsdb.RowValues{},
	}

	withNil := query.Model.Get("withNil").MustBool(false)
	walker := query.Model.Get("startValue").MustFloat64(rand.Float64() * 100)
	spread := 2.5
	var info strings.Builder

	for i := int64(0); i < query.MaxDataPoints && timeWalkerMs < to; i++ {
		delta := rand.Float64() - 0.5
		walker += delta

		info.Reset()
		if delta > 0 {
			info.WriteString("up")
		} else {
			info.WriteString("down")
		}
		if math.Abs(delta) > .4 {
			info.WriteString(" fast")
		}
		row := tsdb.RowValues{
			float64(timeWalkerMs),
			walker,
			walker - ((rand.Float64() * spread) + 0.01), // Min
			walker + ((rand.Float64() * spread) + 0.01), // Max
			info.String(),
		}

		// Add some random null values
		if withNil && rand.Float64() > 0.8 {
			for i := 1; i < 4; i++ {
				if rand.Float64() > .2 {
					row[i] = nil
				}
			}
		}

		table.Rows = append(table.Rows, row)
		timeWalkerMs += query.IntervalMs
	}
	queryRes := tsdb.NewQueryResult()
	queryRes.Tables = append(queryRes.Tables, &table)
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

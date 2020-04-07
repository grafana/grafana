package testdatasource

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/util/errutil"

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
			queryRes := tsdb.NewQueryResult()

			seriesCount := query.Model.Get("seriesCount").MustInt(1)

			for i := 0; i < seriesCount; i++ {
				queryRes.Series = append(queryRes.Series, getRandomWalk(query, context, i))
			}

			return queryRes
		},
	})

	registerScenario(&Scenario{
		Id:   "predictable_pulse",
		Name: "Predictable Pulse",
		Handler: func(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult {
			return getPredictablePulse(query, context)
		},
		Description: PredictablePulseDesc,
	})

	registerScenario(&Scenario{
		Id:   "predictable_csv_wave",
		Name: "Predictable CSV Wave",
		Handler: func(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult {
			return getPredictableCSVWave(query, context)
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

			queryRes := tsdb.NewQueryResult()
			queryRes.Series = append(queryRes.Series, getRandomWalk(query, context, 0))
			return queryRes
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

			series := newSeriesForQuery(query, 0)
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

			series := newSeriesForQuery(query, 0)
			startTime := context.TimeRange.GetFromAsMsEpoch()
			endTime := context.TimeRange.GetToAsMsEpoch()

			for _, val := range points {
				pointValues := val.([]interface{})

				var value null.Float
				var time int64

				if valueFloat, err := strconv.ParseFloat(string(pointValues[0].(json.Number)), 64); err == nil {
					value = null.FloatFrom(valueFloat)
				}

				timeInt, err := strconv.ParseInt(string(pointValues[1].(json.Number)), 10, 64)
				if err != nil {
					continue
				}
				time = timeInt

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

			series := newSeriesForQuery(query, 0)
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
		Id:   "random_walk_with_error",
		Name: "Random Walk (with error)",

		Handler: func(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult {
			queryRes := tsdb.NewQueryResult()
			queryRes.Series = append(queryRes.Series, getRandomWalk(query, context, 0))
			queryRes.ErrorString = "This is an error.  It can include URLs http://grafana.com/"
			return queryRes
		},
	})

	registerScenario(&Scenario{
		Id:   "server_error_500",
		Name: "Server Error (500)",

		Handler: func(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult {
			panic("Test Data Panic!")
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

// PredictablePulseDesc is the description for the Predictable Pulse scenerio.
const PredictablePulseDesc = `Predictable Pulse returns a pulse wave where there is a datapoint every timeStepSeconds.
The wave cycles at timeStepSeconds*(onCount+offCount).
The cycle of the wave is based off of absolute time (from the epoch) which makes it predictable.
Timestamps will line up evenly on timeStepSeconds (For example, 60 seconds means times will all end in :00 seconds).`

func getPredictablePulse(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult {
	queryRes := tsdb.NewQueryResult()

	// Process Input
	var timeStep int64
	var onCount int64
	var offCount int64
	var onValue null.Float
	var offValue null.Float

	options := query.Model.Get("pulseWave")

	var err error
	if timeStep, err = options.Get("timeStep").Int64(); err != nil {
		queryRes.Error = fmt.Errorf("failed to parse timeStep value '%v' into integer: %v", options.Get("timeStep"), err)
		return queryRes
	}
	if onCount, err = options.Get("onCount").Int64(); err != nil {
		queryRes.Error = fmt.Errorf("failed to parse onCount value '%v' into integer: %v", options.Get("onCount"), err)
		return queryRes
	}
	if offCount, err = options.Get("offCount").Int64(); err != nil {
		queryRes.Error = fmt.Errorf("failed to parse offCount value '%v' into integer: %v", options.Get("offCount"), err)
		return queryRes
	}

	onValue, err = fromStringOrNumber(options.Get("onValue"))
	if err != nil {
		queryRes.Error = fmt.Errorf("failed to parse onValue value '%v' into float: %v", options.Get("onValue"), err)
		return queryRes
	}
	offValue, err = fromStringOrNumber(options.Get("offValue"))
	if err != nil {
		queryRes.Error = fmt.Errorf("failed to parse offValue value '%v' into float: %v", options.Get("offValue"), err)
		return queryRes
	}

	timeStep = timeStep * 1000                     // Seconds to Milliseconds
	onFor := func(mod int64) (null.Float, error) { // How many items in the cycle should get the on value
		var i int64
		for i = 0; i < onCount; i++ {
			if mod == i*timeStep {
				return onValue, nil
			}
		}
		return offValue, nil
	}
	points, err := predictableSeries(context.TimeRange, timeStep, onCount+offCount, onFor)
	if err != nil {
		queryRes.Error = err
		return queryRes
	}

	series := newSeriesForQuery(query, 0)
	series.Points = *points
	series.Tags = parseLabels(query)

	queryRes.Series = append(queryRes.Series, series)
	return queryRes
}

func getPredictableCSVWave(query *tsdb.Query, context *tsdb.TsdbQuery) *tsdb.QueryResult {
	queryRes := tsdb.NewQueryResult()

	// Process Input
	var timeStep int64

	options := query.Model.Get("csvWave")

	var err error
	if timeStep, err = options.Get("timeStep").Int64(); err != nil {
		queryRes.Error = fmt.Errorf("failed to parse timeStep value '%v' into integer: %v", options.Get("timeStep"), err)
		return queryRes
	}
	rawValues := options.Get("valuesCSV").MustString()
	rawValues = strings.TrimRight(strings.TrimSpace(rawValues), ",") // Strip Trailing Comma
	rawValesCSV := strings.Split(rawValues, ",")
	values := make([]null.Float, len(rawValesCSV))
	for i, rawValue := range rawValesCSV {
		val, err := null.FloatFromString(strings.TrimSpace(rawValue), "null")
		if err != nil {
			queryRes.Error = errutil.Wrapf(err, "failed to parse value '%v' into nullable float", rawValue)
			return queryRes
		}
		values[i] = val
	}

	timeStep = timeStep * 1000 // Seconds to Milliseconds
	valuesLen := int64(len(values))
	getValue := func(mod int64) (null.Float, error) {
		var i int64
		for i = 0; i < valuesLen; i++ {
			if mod == i*timeStep {
				return values[i], nil
			}
		}
		return null.Float{}, fmt.Errorf("did not get value at point in waveform - should not be here")
	}
	points, err := predictableSeries(context.TimeRange, timeStep, valuesLen, getValue)
	if err != nil {
		queryRes.Error = err
		return queryRes
	}

	series := newSeriesForQuery(query, 0)
	series.Points = *points
	series.Tags = parseLabels(query)

	queryRes.Series = append(queryRes.Series, series)
	return queryRes
}

func predictableSeries(timeRange *tsdb.TimeRange, timeStep, length int64, getValue func(mod int64) (null.Float, error)) (*tsdb.TimeSeriesPoints, error) {
	points := make(tsdb.TimeSeriesPoints, 0)

	from := timeRange.GetFromAsMsEpoch()
	to := timeRange.GetToAsMsEpoch()

	timeCursor := from - (from % timeStep) // Truncate Start
	wavePeriod := timeStep * length
	maxPoints := 10000 // Don't return too many points

	for i := 0; i < maxPoints && timeCursor < to; i++ {
		val, err := getValue(timeCursor % wavePeriod)
		if err != nil {
			return &points, err
		}
		point := tsdb.NewTimePoint(val, float64(timeCursor))
		points = append(points, point)
		timeCursor += timeStep
	}
	return &points, nil
}

func getRandomWalk(query *tsdb.Query, tsdbQuery *tsdb.TsdbQuery, index int) *tsdb.TimeSeries {
	timeWalkerMs := tsdbQuery.TimeRange.GetFromAsMsEpoch()
	to := tsdbQuery.TimeRange.GetToAsMsEpoch()
	series := newSeriesForQuery(query, index)

	startValue := query.Model.Get("startValue").MustFloat64(rand.Float64() * 100)
	spread := query.Model.Get("spread").MustFloat64(1)
	noise := query.Model.Get("noise").MustFloat64(0)

	min, err := query.Model.Get("min").Float64()
	hasMin := err == nil
	max, err := query.Model.Get("max").Float64()
	hasMax := err == nil

	points := make(tsdb.TimeSeriesPoints, 0)
	walker := startValue

	for i := int64(0); i < 10000 && timeWalkerMs < to; i++ {
		nextValue := walker + (rand.Float64() * noise)

		if hasMin && nextValue < min {
			nextValue = min
			walker = min
		}

		if hasMax && nextValue > max {
			nextValue = max
			walker = max
		}

		points = append(points, tsdb.NewTimePoint(null.FloatFrom(nextValue), float64(timeWalkerMs)))

		walker += (rand.Float64() - 0.5) * spread
		timeWalkerMs += query.IntervalMs
	}

	series.Points = points
	series.Tags = parseLabels(query)
	return series
}

/**
 * Looks for a labels request and adds them as tags
 *
 * '{job="foo", instance="bar"} => {job: "foo", instance: "bar"}`
 */
func parseLabels(query *tsdb.Query) map[string]string {
	tags := map[string]string{}

	labelText := query.Model.Get("labels").MustString("")
	if labelText == "" {
		return map[string]string{}
	}

	text := strings.Trim(labelText, `{}`)
	if len(text) < 2 {
		return tags
	}

	tags = make(map[string]string)

	for _, keyval := range strings.Split(text, ",") {
		idx := strings.Index(keyval, "=")
		key := strings.TrimSpace(keyval[:idx])
		val := strings.TrimSpace(keyval[idx+1:])
		val = strings.Trim(val, "\"")
		tags[key] = val
	}

	return tags
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

func newSeriesForQuery(query *tsdb.Query, index int) *tsdb.TimeSeries {
	alias := query.Model.Get("alias").MustString("")
	suffix := ""

	if index > 0 {
		suffix = strconv.Itoa(index)
	}

	if alias == "" {
		alias = fmt.Sprintf("%s-series%s", query.RefId, suffix)
	}

	if alias == "__server_names" && len(serverNames) > index {
		alias = serverNames[index]
	}

	if alias == "__house_locations" && len(houseLocations) > index {
		alias = houseLocations[index]
	}

	return &tsdb.TimeSeries{Name: alias}
}

func fromStringOrNumber(val *simplejson.Json) (null.Float, error) {
	switch v := val.Interface().(type) {
	case json.Number:
		fV, err := v.Float64()
		if err != nil {
			return null.Float{}, err
		}
		return null.FloatFrom(fV), nil
	case string:
		return null.FloatFromString(v, "null")
	default:
		return null.Float{}, fmt.Errorf("failed to extract value")
	}
}

var serverNames = []string{
	"Backend-ops-01",
	"Backend-ops-02",
	"Backend-ops-03",
	"Backend-ops-04",
	"Frontend-web-01",
	"Frontend-web-02",
	"Frontend-web-03",
	"Frontend-web-04",
	"MySQL-01",
	"MySQL-02",
	"MySQL-03",
	"MySQL-04",
	"Postgres-01",
	"Postgres-02",
	"Postgres-03",
	"Postgres-04",
	"DB-01",
	"DB-02",
	"SAN-01",
	"SAN-02",
	"SAN-02",
	"SAN-04",
	"Kaftka-01",
	"Kaftka-02",
	"Kaftka-03",
	"Zookeeper-01",
	"Zookeeper-02",
	"Zookeeper-03",
	"Zookeeper-04",
}

var houseLocations = []string{
	"Cellar",
	"Living room",
	"Porch",
	"Bedroom",
	"Guest room",
	"Kitchen",
	"Playroom",
	"Bathroom",
	"Outside",
	"Roof",
	"Terrace",
}

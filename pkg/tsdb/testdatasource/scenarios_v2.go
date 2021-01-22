package testdatasource

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var scenarioRegistryV2 map[string]backend.QueryDataHandlerFunc

func (p *testDataPlugin) registerScenarioQueryHandlers(mux *datasource.QueryTypeMux) {
	scenarioRegistryV2 = map[string]backend.QueryDataHandlerFunc{}
	scenarioRegistryV2[string(randomWalkQuery)] = p.handleRandomWalkScenario
	scenarioRegistryV2[string(randomWalkSlowQuery)] = p.handleRandomWalkSlowScenario
	scenarioRegistryV2[string(randomWalkWithErrorQuery)] = p.handleRandomWalkWithErrorScenario
	scenarioRegistryV2[string(randowWalkTableQuery)] = p.handleRandomWalkTableScenario
	scenarioRegistryV2[string(predictableCSVWaveQuery)] = p.handlePredictableCSVWaveScenario
	scenarioRegistryV2[string(serverError500Query)] = p.handleServerError500Scenario
	scenarioRegistryV2[string(noDataPointsQuery)] = p.handleNoDataPointsScenario
	scenarioRegistryV2[string(exponentialHeatmapBucketDataQuery)] = p.handleExponentialHeatmapBucketDataScenario
	scenarioRegistryV2[string(linearHeatmapBucketDataQuery)] = p.handleLinearHeatmapBucketDataScenario
	scenarioRegistryV2[string(predictablePulseQuery)] = p.handlePredictablePulseScenario
	scenarioRegistryV2[string(datapointsOutsideRangeQuery)] = p.handleDatapointsOutsideRangeQueryScenario
	scenarioRegistryV2[string(manualEntryQuery)] = p.handleManualEntryScenario
	scenarioRegistryV2[string(csvMetricValuesQuery)] = p.handleCSVMetricValuesScenario
	scenarioRegistryV2[string(streamingClientQuery)] = p.handleStreamingClientQueryScenario
	scenarioRegistryV2[string(liveQuery)] = p.handleGrafanaLiveQueryScenario
	scenarioRegistryV2[string(grafanaAPIQuery)] = p.handleGrafanaAPIQueryScenario
	scenarioRegistryV2[string(arrowQuery)] = p.handleArrowQueryScenario
	scenarioRegistryV2[string(annotationsQuery)] = p.handleAnnotationsQueryScenario
	scenarioRegistryV2[string(tableStaticQuery)] = p.handleTableStaticQueryScenario
	scenarioRegistryV2[string(logsQuery)] = p.handleLogsQueryScenario

	for scenarioID, handler := range scenarioRegistryV2 {
		mux.HandleFunc(scenarioID, handler)
	}

	mux.HandleFunc("", p.handleFallbackScenario)
}

func (p *testDataPlugin) handleFallbackScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()
	scenarioQueries := map[string][]backend.DataQuery{}

	for _, q := range req.Queries {
		model, err := simplejson.NewJson(q.JSON)
		if err != nil {
			p.logger.Error("Failed to unmarschal query model to JSON", "error", err)
			continue
		}

		scenarioID := model.Get("scenarioId").MustString(string(randomWalkQuery))
		if _, exist := scenarioRegistryV2[scenarioID]; exist {
			if _, ok := scenarioQueries[scenarioID]; !ok {
				scenarioQueries[scenarioID] = []backend.DataQuery{}
			}

			scenarioQueries[scenarioID] = append(scenarioQueries[scenarioID], q)
		} else {
			p.logger.Error("Scenario not found", "scenarioId", scenarioID)
		}
	}

	for scenarioID, queries := range scenarioQueries {
		if scenarioHandler, exist := scenarioRegistryV2[scenarioID]; exist {
			sReq := &backend.QueryDataRequest{
				PluginContext: req.PluginContext,
				Headers:       req.Headers,
				Queries:       queries,
			}
			if sResp, err := scenarioHandler(ctx, sReq); err != nil {
				p.logger.Error("Failed to handle scenario", "scenarioId", scenarioID, "error", err)
			} else {
				for refID, dr := range sResp.Responses {
					resp.Responses[refID] = dr
				}
			}
		}
	}

	return resp, nil
}

func (p *testDataPlugin) handleRandomWalkScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := simplejson.NewJson(q.JSON)
		if err != nil {
			continue
		}
		seriesCount := model.Get("seriesCount").MustInt(1)

		for i := 0; i < seriesCount; i++ {
			respD := resp.Responses[q.RefID]
			respD.Frames = append(respD.Frames, getRandomWalkV2(q, model, i))
			resp.Responses[q.RefID] = respD
		}
	}

	return resp, nil
}

func (p *testDataPlugin) handleDatapointsOutsideRangeQueryScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := simplejson.NewJson(q.JSON)
		if err != nil {
			continue
		}

		frame := newSeriesForQueryV2(q, model, 0)
		outsideTime := q.TimeRange.From.Add(-1 * time.Hour)
		frame.Fields = data.Fields{
			data.NewField("time", nil, []time.Time{outsideTime}),
			data.NewField("value", nil, []float64{10}),
		}

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (p *testDataPlugin) handleManualEntryScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := simplejson.NewJson(q.JSON)
		if err != nil {
			continue
		}
		points := model.Get("points").MustArray()

		frame := newSeriesForQueryV2(q, model, 0)
		startTime := q.TimeRange.From.UnixNano() / int64(time.Millisecond)
		endTime := q.TimeRange.To.UnixNano() / int64(time.Millisecond)

		timeVec := make([]*int64, 0)
		floatVec := make([]*float64, 0)

		for _, val := range points {
			pointValues := val.([]interface{})

			var value float64
			var time int64

			if valueFloat, err := strconv.ParseFloat(string(pointValues[0].(json.Number)), 64); err == nil {
				value = valueFloat
			}

			timeInt, err := strconv.ParseInt(string(pointValues[1].(json.Number)), 10, 64)
			if err != nil {
				continue
			}
			time = timeInt

			if time >= startTime && time <= endTime {
				timeVec = append(timeVec, &time)
				floatVec = append(floatVec, &value)
			}
		}

		frame.Fields = data.Fields{
			data.NewField("time", nil, timeVec),
			data.NewField("value", nil, floatVec),
		}

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (p *testDataPlugin) handleCSVMetricValuesScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := simplejson.NewJson(q.JSON)
		if err != nil {
			continue
		}

		stringInput := model.Get("stringInput").MustString()
		stringInput = strings.ReplaceAll(stringInput, " ", "")

		var values []*float64
		for _, strVal := range strings.Split(stringInput, ",") {
			if strVal == "null" {
				values = append(values, nil)
			}
			if val, err := strconv.ParseFloat(strVal, 64); err == nil {
				values = append(values, &val)
			}
		}

		if len(values) == 0 {
			return resp, nil
		}

		frame := data.NewFrame("",
			data.NewField("time", nil, []*time.Time{}),
			data.NewField(frameNameForQuery(q, model, 0), nil, []*float64{}))
		startTime := q.TimeRange.From.UnixNano() / int64(time.Millisecond)
		endTime := q.TimeRange.To.UnixNano() / int64(time.Millisecond)
		var step int64 = 0
		if len(values) > 1 {
			step = (endTime - startTime) / int64(len(values)-1)
		}

		for _, val := range values {
			t := time.Unix(startTime/int64(1e+3), (startTime%int64(1e+3))*int64(1e+6))
			frame.AppendRow(&t, val)
			startTime += step
		}

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (p *testDataPlugin) handleRandomWalkWithErrorScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := simplejson.NewJson(q.JSON)
		if err != nil {
			continue
		}

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, getRandomWalkV2(q, model, 0))
		respD.Error = fmt.Errorf("this is an error and it can include URLs http://grafana.com/")
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (p *testDataPlugin) handleRandomWalkSlowScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := simplejson.NewJson(q.JSON)
		if err != nil {
			continue
		}

		stringInput := model.Get("stringInput").MustString()
		parsedInterval, _ := time.ParseDuration(stringInput)
		time.Sleep(parsedInterval)

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, getRandomWalkV2(q, model, 0))
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (p *testDataPlugin) handleRandomWalkTableScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := simplejson.NewJson(q.JSON)
		if err != nil {
			continue
		}

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, getRandomWalkTableV2(q, model))
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (p *testDataPlugin) handlePredictableCSVWaveScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := simplejson.NewJson(q.JSON)
		if err != nil {
			continue
		}

		respD := resp.Responses[q.RefID]
		frame, err := getPredictableCSVWaveV2(q, model)
		if err != nil {
			continue
		}
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (p *testDataPlugin) handlePredictablePulseScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := simplejson.NewJson(q.JSON)
		if err != nil {
			continue
		}

		respD := resp.Responses[q.RefID]
		frame, err := getPredictablePulseV2(q, model)
		if err != nil {
			continue
		}
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (p *testDataPlugin) handleServerError500Scenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	panic("Test Data Panic!")
}

func (p *testDataPlugin) handleNoDataPointsScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return backend.NewQueryDataResponse(), nil
}

func (p *testDataPlugin) handleStreamingClientQueryScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return backend.NewQueryDataResponse(), nil
}

func (p *testDataPlugin) handleGrafanaLiveQueryScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return backend.NewQueryDataResponse(), nil
}

func (p *testDataPlugin) handleGrafanaAPIQueryScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return backend.NewQueryDataResponse(), nil
}

func (p *testDataPlugin) handleArrowQueryScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return backend.NewQueryDataResponse(), nil
}

func (p *testDataPlugin) handleAnnotationsQueryScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return backend.NewQueryDataResponse(), nil
}

func (p *testDataPlugin) handleExponentialHeatmapBucketDataScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		respD := resp.Responses[q.RefID]
		frame := getRandomHeatmapData(q, func(index int) float64 {
			return math.Exp2(float64(index))
		})
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (p *testDataPlugin) handleLinearHeatmapBucketDataScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		respD := resp.Responses[q.RefID]
		frame := getRandomHeatmapData(q, func(index int) float64 {
			return float64(index * 10)
		})
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (p *testDataPlugin) handleTableStaticQueryScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		timeWalkerMs := q.TimeRange.From.UnixNano() / int64(time.Millisecond)
		to := q.TimeRange.To.UnixNano() / int64(time.Millisecond)
		step := q.Interval.Milliseconds()

		frame := data.NewFrame(q.RefID,
			data.NewField("Time", nil, []float64{}),
			data.NewField("Message", nil, []string{}),
			data.NewField("Description", nil, []string{}),
			data.NewField("Value", nil, []float64{}),
		)

		for i := int64(0); i < 10 && timeWalkerMs < to; i++ {
			frame.AppendRow(float64(timeWalkerMs), "This is a message", "Description", 23.1)
			timeWalkerMs += step
		}

		resp := backend.NewQueryDataResponse()
		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, frame)

		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (p *testDataPlugin) handleLogsQueryScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		from := q.TimeRange.From.UnixNano() / int64(time.Millisecond)
		to := q.TimeRange.To.UnixNano() / int64(time.Millisecond)

		model, err := simplejson.NewJson(q.JSON)
		if err != nil {
			continue
		}

		lines := model.Get("lines").MustInt64(10)
		includeLevelColumn := model.Get("levelColumn").MustBool(false)

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

		frame := data.NewFrame(q.RefID,
			data.NewField("time", nil, []float64{}),
			data.NewField("message", nil, []string{}),
			data.NewField("container_id", nil, []string{}),
			data.NewField("hostname", nil, []string{}),
		)

		if includeLevelColumn {
			frame.Fields = append(frame.Fields, data.NewField("level", nil, []string{}))
		}

		for i := int64(0); i < lines && to > from; i++ {
			logLevel := logLevelGenerator.Next()
			timeFormatted := time.Unix(to/1000, 0).Format(time.RFC3339)
			lvlString := ""
			if !includeLevelColumn {
				lvlString = fmt.Sprintf("lvl=%s ", logLevel)
			}

			message := fmt.Sprintf("t=%s %smsg=\"Request Completed\" logger=context userId=1 orgId=1 uname=admin method=GET path=/api/datasources/proxy/152/api/prom/label status=502 remote_addr=[::1] time_ms=1 size=0 referer=\"http://localhost:3000/explore?left=%%5B%%22now-6h%%22,%%22now%%22,%%22Prometheus%%202.x%%22,%%7B%%7D,%%7B%%22ui%%22:%%5Btrue,true,true,%%22none%%22%%5D%%7D%%5D\"", timeFormatted, lvlString)
			containerID := containerIDGenerator.Next()
			hostname := hostnameGenerator.Next()

			if includeLevelColumn {
				frame.AppendRow(float64(to), message, containerID, hostname, logLevel)
			} else {
				frame.AppendRow(float64(to), message, containerID, hostname)
			}

			to -= q.Interval.Milliseconds()
		}

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func getRandomWalkV2(query backend.DataQuery, model *simplejson.Json, index int) *data.Frame {
	timeWalkerMs := query.TimeRange.From.UnixNano() / int64(time.Millisecond)
	to := query.TimeRange.To.UnixNano() / int64(time.Millisecond)
	startValue := model.Get("startValue").MustFloat64(rand.Float64() * 100)
	spread := model.Get("spread").MustFloat64(1)
	noise := model.Get("noise").MustFloat64(0)

	min, err := model.Get("min").Float64()
	hasMin := err == nil
	max, err := model.Get("max").Float64()
	hasMax := err == nil

	timeVec := make([]*time.Time, 0)
	floatVec := make([]*float64, 0)

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

		t := time.Unix(timeWalkerMs/int64(1e+3), (timeWalkerMs%int64(1e+3))*int64(1e+6))
		timeVec = append(timeVec, &t)
		floatVec = append(floatVec, &nextValue)

		walker += (rand.Float64() - 0.5) * spread
		timeWalkerMs += query.Interval.Milliseconds()
	}

	return data.NewFrame("",
		data.NewField("time", nil, timeVec),
		data.NewField(frameNameForQuery(query, model, 0), parseLabelsV2(model), floatVec),
	)
}

func getRandomWalkTableV2(query backend.DataQuery, model *simplejson.Json) *data.Frame {
	timeWalkerMs := query.TimeRange.From.UnixNano() / int64(time.Millisecond)
	to := query.TimeRange.To.UnixNano() / int64(time.Millisecond)
	withNil := model.Get("withNil").MustBool(false)
	walker := model.Get("startValue").MustFloat64(rand.Float64() * 100)
	spread := 2.5

	// Name of the frame?
	frame := data.NewFrame(query.RefID,
		data.NewField("Time", nil, []*time.Time{}),
		data.NewField("Value", nil, []*float64{}),
		data.NewField("Min", nil, []*float64{}),
		data.NewField("Max", nil, []*float64{}),
		data.NewField("Info", nil, []*string{}),
	)

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

		t := time.Unix(timeWalkerMs/int64(1e+3), (timeWalkerMs%int64(1e+3))*int64(1e+6))
		val := walker
		min := walker - ((rand.Float64() * spread) + 0.01)
		max := walker + ((rand.Float64() * spread) + 0.01)
		infoString := info.String()

		vals := []*float64{&val, &min, &max}
		// Add some random null values
		if withNil && rand.Float64() > 0.8 {
			for i := range vals {
				if rand.Float64() > .2 {
					vals[i] = nil
				}
			}
		}

		frame.AppendRow(&t, vals[0], vals[1], vals[2], &infoString)

		timeWalkerMs += query.Interval.Milliseconds()
	}

	return frame
}

func getPredictableCSVWaveV2(query backend.DataQuery, model *simplejson.Json) (*data.Frame, error) {
	// Process Input
	var timeStep int64

	options := model.Get("csvWave")

	var err error
	if timeStep, err = options.Get("timeStep").Int64(); err != nil {
		return nil, fmt.Errorf("failed to parse timeStep value '%v' into integer: %v", options.Get("timeStep"), err)
	}
	rawValues := options.Get("valuesCSV").MustString()
	rawValues = strings.TrimRight(strings.TrimSpace(rawValues), ",") // Strip Trailing Comma
	rawValesCSV := strings.Split(rawValues, ",")
	values := make([]null.Float, len(rawValesCSV))
	for i, rawValue := range rawValesCSV {
		val, err := null.FloatFromString(strings.TrimSpace(rawValue), "null")
		if err != nil {
			return nil, errutil.Wrapf(err, "failed to parse value '%v' into nullable float", rawValue)
		}
		values[i] = val
	}

	timeStep *= 1000 // Seconds to Milliseconds
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
	fields, err := predictableSeriesV2(query.TimeRange, timeStep, valuesLen, getValue)
	if err != nil {
		return nil, err
	}

	frame := newSeriesForQueryV2(query, model, 0)
	frame.Fields = fields
	frame.Fields[1].Labels = parseLabelsV2(model)

	return frame, nil
}

func predictableSeriesV2(timeRange backend.TimeRange, timeStep, length int64, getValue func(mod int64) (null.Float, error)) (data.Fields, error) {
	from := timeRange.From.UnixNano() / int64(time.Millisecond)
	to := timeRange.To.UnixNano() / int64(time.Millisecond)

	timeCursor := from - (from % timeStep) // Truncate Start
	wavePeriod := timeStep * length
	maxPoints := 10000 // Don't return too many points

	timeVec := make([]*time.Time, 0)
	floatVec := make([]*float64, 0)

	for i := 0; i < maxPoints && timeCursor < to; i++ {
		val, err := getValue(timeCursor % wavePeriod)
		if err != nil {
			return nil, err
		}

		t := time.Unix(timeCursor/int64(1e+3), (timeCursor%int64(1e+3))*int64(1e+6))
		timeVec = append(timeVec, &t)
		floatVec = append(floatVec, &val.Float64)

		timeCursor += timeStep
	}

	return data.Fields{
		data.NewField("time", nil, timeVec),
		data.NewField("value", nil, floatVec),
	}, nil
}

func getPredictablePulseV2(query backend.DataQuery, model *simplejson.Json) (*data.Frame, error) {
	// Process Input
	var timeStep int64
	var onCount int64
	var offCount int64
	var onValue null.Float
	var offValue null.Float

	options := model.Get("pulseWave")

	var err error
	if timeStep, err = options.Get("timeStep").Int64(); err != nil {
		return nil, fmt.Errorf("failed to parse timeStep value '%v' into integer: %v", options.Get("timeStep"), err)
	}
	if onCount, err = options.Get("onCount").Int64(); err != nil {
		return nil, fmt.Errorf("failed to parse onCount value '%v' into integer: %v", options.Get("onCount"), err)
	}
	if offCount, err = options.Get("offCount").Int64(); err != nil {
		return nil, fmt.Errorf("failed to parse offCount value '%v' into integer: %v", options.Get("offCount"), err)
	}

	onValue, err = fromStringOrNumber(options.Get("onValue"))
	if err != nil {
		return nil, fmt.Errorf("failed to parse onValue value '%v' into float: %v", options.Get("onValue"), err)
	}
	offValue, err = fromStringOrNumber(options.Get("offValue"))
	if err != nil {
		return nil, fmt.Errorf("failed to parse offValue value '%v' into float: %v", options.Get("offValue"), err)
	}

	timeStep *= 1000                               // Seconds to Milliseconds
	onFor := func(mod int64) (null.Float, error) { // How many items in the cycle should get the on value
		var i int64
		for i = 0; i < onCount; i++ {
			if mod == i*timeStep {
				return onValue, nil
			}
		}
		return offValue, nil
	}
	fields, err := predictableSeriesV2(query.TimeRange, timeStep, onCount+offCount, onFor)
	if err != nil {
		return nil, err
	}

	frame := newSeriesForQueryV2(query, model, 0)
	frame.Fields = fields
	frame.Fields[1].Labels = parseLabelsV2(model)

	return frame, nil
}

func getRandomHeatmapData(query backend.DataQuery, fnBucketGen func(index int) float64) *data.Frame {
	frame := data.NewFrame("data", data.NewField("time", nil, []*time.Time{}))
	for i := 0; i < 10; i++ {
		frame.Fields = append(frame.Fields, data.NewField(strconv.FormatInt(int64(fnBucketGen(i)), 10), nil, []*float64{}))
	}

	timeWalkerMs := query.TimeRange.From.UnixNano() / int64(time.Millisecond)
	to := query.TimeRange.To.UnixNano() / int64(time.Millisecond)

	for j := int64(0); j < 100 && timeWalkerMs < to; j++ {
		t := time.Unix(timeWalkerMs/int64(1e+3), (timeWalkerMs%int64(1e+3))*int64(1e+6))
		vals := []interface{}{&t}
		for n := 1; n < len(frame.Fields); n++ {
			v := float64(rand.Int63n(100))
			vals = append(vals, &v)
		}
		frame.AppendRow(vals...)
		timeWalkerMs += query.Interval.Milliseconds() * 50
	}

	return frame
}

func newSeriesForQueryV2(query backend.DataQuery, model *simplejson.Json, index int) *data.Frame {
	alias := model.Get("alias").MustString("")
	suffix := ""

	if index > 0 {
		suffix = strconv.Itoa(index)
	}

	if alias == "" {
		alias = fmt.Sprintf("%s-series%s", query.RefID, suffix)
	}

	if alias == "__server_names" && len(serverNames) > index {
		alias = serverNames[index]
	}

	if alias == "__house_locations" && len(houseLocations) > index {
		alias = houseLocations[index]
	}

	return data.NewFrame(alias)
}

/**
 * Looks for a labels request and adds them as tags
 *
 * '{job="foo", instance="bar"} => {job: "foo", instance: "bar"}`
 */
func parseLabelsV2(model *simplejson.Json) data.Labels {
	tags := data.Labels{}

	labelText := model.Get("labels").MustString("")
	if labelText == "" {
		return data.Labels{}
	}

	text := strings.Trim(labelText, `{}`)
	if len(text) < 2 {
		return tags
	}

	tags = make(data.Labels)

	for _, keyval := range strings.Split(text, ",") {
		idx := strings.Index(keyval, "=")
		key := strings.TrimSpace(keyval[:idx])
		val := strings.TrimSpace(keyval[idx+1:])
		val = strings.Trim(val, "\"")
		tags[key] = val
	}

	return tags
}

func frameNameForQuery(query backend.DataQuery, model *simplejson.Json, index int) string {
	name := model.Get("alias").MustString("")
	suffix := ""

	if index > 0 {
		suffix = strconv.Itoa(index)
	}

	if name == "" {
		name = fmt.Sprintf("%s-series%s", query.RefID, suffix)
	}

	if name == "__server_names" && len(serverNames) > index {
		name = serverNames[index]
	}

	if name == "__house_locations" && len(houseLocations) > index {
		name = houseLocations[index]
	}

	return name
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

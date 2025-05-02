package testdatasource

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource/kinds"
)

type Scenario struct {
	ID kinds.TestDataQueryType `json:"id"`

	Name        string `json:"name"`
	StringInput string `json:"stringInput"`
	Description string `json:"description"`
	handler     backend.QueryDataHandlerFunc
}

func (s *Service) registerScenarios() {
	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeExponentialHeatmapBucketData,
		Name:    "Exponential heatmap bucket data",
		handler: s.handleExponentialHeatmapBucketDataScenario,
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeLinearHeatmapBucketData,
		Name:    "Linear heatmap bucket data",
		handler: s.handleLinearHeatmapBucketDataScenario,
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeRandomWalk,
		Name:    "Random Walk",
		handler: s.handleRandomWalkScenario,
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypePredictablePulse,
		Name:    "Predictable Pulse",
		handler: s.handlePredictablePulseScenario,
		Description: `Predictable Pulse returns a pulse wave where there is a datapoint every timeStepSeconds.
The wave cycles at timeStepSeconds*(onCount+offCount).
The cycle of the wave is based off of absolute time (from the epoch) which makes it predictable.
Timestamps will line up evenly on timeStepSeconds (For example, 60 seconds means times will all end in :00 seconds).`,
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypePredictableCsvWave,
		Name:    "Predictable CSV Wave",
		handler: s.handlePredictableCSVWaveScenario,
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeRandomWalkTable,
		Name:    "Random Walk Table",
		handler: s.handleRandomWalkTableScenario,
	})

	s.registerScenario(&Scenario{
		ID:          kinds.TestDataQueryTypeSlowQuery,
		Name:        "Slow Query",
		StringInput: "5s",
		handler:     s.handleRandomWalkSlowScenario,
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeNoDataPoints,
		Name:    "No Data Points",
		handler: s.handleClientSideScenario,
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeDatapointsOutsideRange,
		Name:    "Datapoints Outside Range",
		handler: s.handleDatapointsOutsideRangeScenario,
	})

	s.registerScenario(&Scenario{
		ID:          kinds.TestDataQueryTypeCsvMetricValues,
		Name:        "CSV Metric Values",
		StringInput: "1,20,90,30,5,0",
		handler:     s.handleCSVMetricValuesScenario,
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeStreamingClient,
		Name:    "Streaming Client",
		handler: s.handleClientSideScenario,
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeLive,
		Name:    "Grafana Live",
		handler: s.handleClientSideScenario,
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeSteps,
		Name:    "Steps",
		handler: s.handleClientSideScenario,
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeSimulation,
		Name:    "Simulation",
		handler: s.sims.QueryData,
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeUsa,
		Name:    "USA generated data",
		handler: s.handleUSAScenario,
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeGrafanaApi,
		Name:    "Grafana API",
		handler: s.handleClientSideScenario,
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeArrow,
		Name:    "Load Apache Arrow Data",
		handler: s.handleArrowScenario,
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeAnnotations,
		Name:    "Annotations",
		handler: s.handleClientSideScenario,
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeTableStatic,
		Name:    "Table Static",
		handler: s.handleTableStaticScenario,
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeRandomWalkWithError,
		Name:    "Random Walk (with error)",
		handler: s.handleRandomWalkWithErrorScenario,
	})

	s.registerScenario(&Scenario{
		// Is no longer strictly a _server_ error scenario, but ID is kept for legacy :)
		ID:          kinds.TestDataQueryTypeServerError500,
		Name:        "Conditional Error",
		handler:     s.handleServerError500Scenario,
		StringInput: "1,20,90,30,5,0",
		Description: "Returns an error when the String Input field is empty",
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeLogs,
		Name:    "Logs",
		handler: s.handleLogsScenario,
	})

	s.registerScenario(&Scenario{
		ID:   kinds.TestDataQueryTypeNodeGraph,
		Name: "Node Graph",
	})

	s.registerScenario(&Scenario{
		ID:   kinds.TestDataQueryTypeFlameGraph,
		Name: "Flame Graph",
	})

	s.registerScenario(&Scenario{
		ID:   kinds.TestDataQueryTypeRawFrame,
		Name: "Raw Frames",
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeCsvFile,
		Name:    "CSV File",
		handler: s.handleCsvFileScenario,
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeCsvContent,
		Name:    "CSV Content",
		handler: s.handleCsvContentScenario,
	})

	s.registerScenario(&Scenario{
		ID:   kinds.TestDataQueryTypeTrace,
		Name: "Trace",
	})

	s.registerScenario(&Scenario{
		ID:      kinds.TestDataQueryTypeErrorWithSource,
		Name:    "Error with source",
		handler: s.handleErrorWithSourceScenario,
	})

	s.queryMux.HandleFunc("", s.handleFallbackScenario)
}

func (s *Service) registerScenario(scenario *Scenario) {
	s.scenarios[scenario.ID] = scenario
	s.queryMux.HandleFunc(string(scenario.ID), instrumentScenarioHandler(s.logger, scenario.ID, scenario.handler))
}

func instrumentScenarioHandler(logger log.Logger, scenario kinds.TestDataQueryType, fn backend.QueryDataHandlerFunc) backend.QueryDataHandlerFunc {
	return backend.QueryDataHandlerFunc(func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
		ctx, span := tracing.DefaultTracer().Start(ctx, "testdatasource.queryData",
			trace.WithAttributes(
				attribute.String("scenario", string(scenario)),
			))
		defer span.End()

		ctxLogger := logger.FromContext(ctx)
		ctxLogger.Debug(string(backend.EndpointQueryData), "scenario", scenario)

		return fn(ctx, req)
	})
}

func GetJSONModel(j json.RawMessage) (kinds.TestDataQuery, error) {
	model := kinds.TestDataQuery{
		// Default values
		ScenarioId:  kinds.TestDataQueryTypeRandomWalk,
		SeriesCount: 1,
		Lines:       10,
		StartValue:  rand.Float64() * 100,
		Spread:      1,
	}
	if len(j) > 0 {
		// csvWave has saved values that are single values, not arrays
		_ = json.Unmarshal(j, &model)
	}
	return model, nil
}

// handleFallbackScenario handles the scenario where queryType is not set and fallbacks to scenarioId.
func (s *Service) handleFallbackScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	ctxLogger := s.logger.FromContext(ctx)
	scenarioQueries := map[kinds.TestDataQueryType][]backend.DataQuery{}

	for _, q := range req.Queries {
		model, err := GetJSONModel(q.JSON)
		if err != nil {
			ctxLogger.Error("Failed to unmarshal query model to JSON", "error", err)
			continue
		}

		scenarioID := model.ScenarioId
		if _, exist := s.scenarios[scenarioID]; exist {
			if _, ok := scenarioQueries[scenarioID]; !ok {
				scenarioQueries[scenarioID] = []backend.DataQuery{}
			}

			scenarioQueries[scenarioID] = append(scenarioQueries[scenarioID], q)
		} else {
			ctxLogger.Error("Scenario not found", "scenarioId", scenarioID)
		}
	}

	resp := backend.NewQueryDataResponse()
	for scenarioID, queries := range scenarioQueries {
		if scenario, exist := s.scenarios[scenarioID]; exist {
			sReq := &backend.QueryDataRequest{
				PluginContext: req.PluginContext,
				Headers:       req.Headers,
				Queries:       queries,
			}
			handler := instrumentScenarioHandler(s.logger, scenarioID, scenario.handler)
			if sResp, err := handler(ctx, sReq); err != nil {
				ctxLogger.Error("Failed to handle scenario", "scenarioId", scenarioID, "error", err)
			} else {
				for refID, dr := range sResp.Responses {
					resp.Responses[refID] = dr
				}
			}
		}
	}

	return resp, nil
}

func (s *Service) handleRandomWalkScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := GetJSONModel(q.JSON)
		if err != nil {
			continue
		}
		seriesCount := model.SeriesCount

		for i := 0; i < seriesCount; i++ {
			respD := resp.Responses[q.RefID]
			respD.Frames = append(respD.Frames, RandomWalk(q, model, i))
			resp.Responses[q.RefID] = respD
		}
	}

	return resp, nil
}

func (s *Service) handleDatapointsOutsideRangeScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := GetJSONModel(q.JSON)
		if err != nil {
			continue
		}

		frame := newSeriesForQuery(q, model, 0)
		outsideTime := q.TimeRange.From.Add(-1 * time.Hour)
		frame.Fields = data.Fields{
			data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{outsideTime}),
			data.NewField(data.TimeSeriesValueFieldName, nil, []float64{10}),
		}

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (s *Service) handleCSVMetricValuesScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := GetJSONModel(q.JSON)
		if err != nil {
			continue
		}

		stringInput := model.StringInput
		if strings.TrimSpace(stringInput) == "" {
			qr := resp.Responses[q.RefID]
			qr.Frames = data.Frames{
				data.NewFrame("").SetMeta(&data.FrameMeta{ExecutedQueryString: stringInput}),
			}
			return resp, nil
		}
		valueField, err := csvLineToField(stringInput)
		if err != nil {
			return nil, err
		}
		valueField.Name = frameNameForQuery(q, model, 0)

		timeField := data.NewFieldFromFieldType(data.FieldTypeTime, valueField.Len())
		timeField.Name = "time"

		startTime := q.TimeRange.From.UnixNano() / int64(time.Millisecond)
		endTime := q.TimeRange.To.UnixNano() / int64(time.Millisecond)
		count := valueField.Len()
		var step int64 = 0
		if count > 1 {
			step = (endTime - startTime) / int64(count-1)
		}

		for i := 0; i < count; i++ {
			t := time.Unix(startTime/int64(1e+3), (startTime%int64(1e+3))*int64(1e+6))
			timeField.Set(i, t)
			startTime += step
		}

		frame := data.NewFrame("", timeField, valueField)

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (s *Service) handleRandomWalkWithErrorScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := GetJSONModel(q.JSON)
		if err != nil {
			continue
		}

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, RandomWalk(q, model, 0))
		respD.Error = fmt.Errorf("this is an error and it can include URLs http://grafana.com/")
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (s *Service) handleRandomWalkSlowScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := GetJSONModel(q.JSON)
		if err != nil {
			continue
		}

		stringInput := model.StringInput
		parsedInterval, _ := time.ParseDuration(stringInput)
		time.Sleep(parsedInterval)

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, RandomWalk(q, model, 0))
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (s *Service) handleRandomWalkTableScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := GetJSONModel(q.JSON)
		if err != nil {
			continue
		}

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, randomWalkTable(q, model))
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (s *Service) handlePredictableCSVWaveScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := GetJSONModel(q.JSON)
		if err != nil {
			return nil, err
		}

		respD := resp.Responses[q.RefID]
		frames, err := predictableCSVWave(q, model)
		if err != nil {
			return nil, err
		}
		respD.Frames = append(respD.Frames, frames...)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (s *Service) handlePredictablePulseScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := GetJSONModel(q.JSON)
		if err != nil {
			continue
		}

		respD := resp.Responses[q.RefID]
		frame, err := predictablePulse(q, model)
		if err != nil {
			continue
		}
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (s *Service) handleServerError500Scenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	for _, q := range req.Queries {
		model, err := GetJSONModel(q.JSON)
		if err != nil {
			continue
		}

		stringInput := model.StringInput
		if stringInput == "" {
			panic("Test Data Panic!")
		}
	}

	return s.handleCSVMetricValuesScenario(ctx, req)
}

func (s *Service) handleClientSideScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return backend.NewQueryDataResponse(), nil
}

func (s *Service) handleArrowScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := GetJSONModel(q.JSON)
		if err != nil {
			return nil, err
		}

		respD := resp.Responses[q.RefID]
		frame, err := doArrowQuery(q, model)
		if err != nil {
			return nil, err
		}
		if frame == nil {
			continue
		}
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (s *Service) handleExponentialHeatmapBucketDataScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		respD := resp.Responses[q.RefID]
		frame := randomHeatmapData(q, func(index int) float64 {
			return math.Exp2(float64(index))
		})
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (s *Service) handleLinearHeatmapBucketDataScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		respD := resp.Responses[q.RefID]
		frame := randomHeatmapData(q, func(index int) float64 {
			return float64(index * 10)
		})
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (s *Service) handleTableStaticScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		timeWalkerMs := q.TimeRange.From.UnixNano() / int64(time.Millisecond)
		to := q.TimeRange.To.UnixNano() / int64(time.Millisecond)
		step := q.Interval.Milliseconds()

		frame := data.NewFrame(q.RefID,
			data.NewField("Time", nil, []time.Time{}),
			data.NewField("Message", nil, []string{}),
			data.NewField("Description", nil, []string{}),
			data.NewField("Value", nil, []float64{}),
		)

		for i := int64(0); i < 10 && timeWalkerMs < to; i++ {
			t := time.Unix(timeWalkerMs/int64(1e+3), (timeWalkerMs%int64(1e+3))*int64(1e+6))
			frame.AppendRow(t, "This is a message", "Description", 23.1)
			timeWalkerMs += step
		}

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (s *Service) handleLogsScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		from := q.TimeRange.From.UnixNano() / int64(time.Millisecond)
		to := q.TimeRange.To.UnixNano() / int64(time.Millisecond)

		model, err := GetJSONModel(q.JSON)
		if err != nil {
			continue
		}

		lines := model.Lines
		includeLevelColumn := model.LevelColumn

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
			data.NewField("time", nil, []time.Time{}),
			data.NewField("message", nil, []string{}),
			data.NewField("container_id", nil, []string{}),
			data.NewField("hostname", nil, []string{}),
		).SetMeta(&data.FrameMeta{
			PreferredVisualization: "logs",
		})

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

			t := time.Unix(to/int64(1e+3), (to%int64(1e+3))*int64(1e+6))

			if includeLevelColumn {
				frame.AppendRow(t, message, containerID, hostname, logLevel)
			} else {
				frame.AppendRow(t, message, containerID, hostname)
			}

			to -= q.Interval.Milliseconds()
		}

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (s *Service) handleErrorWithSourceScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	anErr := errors.New("error")
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := GetJSONModel(q.JSON)
		if err != nil {
			continue
		}

		respD := resp.Responses[q.RefID]
		respD.Error = anErr

		if model.ErrorSource == kinds.ErrorSourceDownstream {
			respD.Error = backend.DownstreamError(respD.Error)
		}

		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func RandomWalk(query backend.DataQuery, model kinds.TestDataQuery, index int) *data.Frame {
	rand := rand.New(rand.NewSource(time.Now().UnixNano() + int64(index)))
	timeWalkerMs := query.TimeRange.From.UnixNano() / int64(time.Millisecond)
	to := query.TimeRange.To.UnixNano() / int64(time.Millisecond)
	startValue := model.StartValue
	spread := model.Spread
	noise := model.Noise
	drop := model.DropPercent / 100.0 // value is 0-100

	min := float64(0)
	hasMin := false
	if model.Min != nil {
		hasMin = true
		min = *model.Min
	}
	max := float64(0)
	hasMax := false
	if model.Max != nil {
		hasMax = true
		max = *model.Max
	}

	timeVec := make([]time.Time, 0)
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

		if drop > 0 && rand.Float64() < drop {
			// skip value
		} else {
			t := time.Unix(timeWalkerMs/int64(1e+3), (timeWalkerMs%int64(1e+3))*int64(1e+6))
			timeVec = append(timeVec, t)
			floatVec = append(floatVec, &nextValue)
		}

		walker += (rand.Float64() - 0.5) * spread
		timeWalkerMs += query.Interval.Milliseconds()
	}

	frame := data.NewFrame("",
		data.NewField("time", nil, timeVec).
			SetConfig(&data.FieldConfig{
				Interval: float64(query.Interval.Milliseconds()),
			}),
		data.NewField(frameNameForQuery(query, model, index), parseLabels(model, index), floatVec),
	)

	frame.SetMeta(&data.FrameMeta{
		Custom: map[string]interface{}{
			"customStat": 10,
		},
	})
	frame.Meta.Type = data.FrameTypeTimeSeriesMulti

	return frame
}

func randomWalkTable(query backend.DataQuery, model kinds.TestDataQuery) *data.Frame {
	rand := rand.New(rand.NewSource(time.Now().UnixNano()))
	timeWalkerMs := query.TimeRange.From.UnixNano() / int64(time.Millisecond)
	to := query.TimeRange.To.UnixNano() / int64(time.Millisecond)
	withNil := model.WithNil
	walker := model.StartValue
	spread := 2.5

	stateField := data.NewFieldFromFieldType(data.FieldTypeEnum, 0)
	stateField.Name = "State"
	stateField.Config = &data.FieldConfig{
		TypeConfig: &data.FieldTypeConfig{
			Enum: &data.EnumFieldConfig{
				Text: []string{
					"Unknown", "Up", "Down", // 0,1,2
				},
			},
		},
	}

	frame := data.NewFrame(query.RefID,
		data.NewField("Time", nil, []*time.Time{}),
		data.NewField("Value", nil, []*float64{}),
		data.NewField("Min", nil, []*float64{}),
		data.NewField("Max", nil, []*float64{}),
		data.NewField("Info", nil, []*string{}),
		stateField,
	)

	var info strings.Builder
	state := data.EnumItemIndex(0)

	for i := int64(0); i < query.MaxDataPoints && timeWalkerMs < to; i++ {
		delta := rand.Float64() - 0.5
		walker += delta

		info.Reset()
		if delta > 0 {
			info.WriteString("up")
			state = 1
		} else {
			info.WriteString("down")
			state = 2
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
					state = 0
				}
			}
		}

		frame.AppendRow(&t, vals[0], vals[1], vals[2], &infoString, state)

		timeWalkerMs += query.Interval.Milliseconds()
	}

	return frame
}

func predictableCSVWave(query backend.DataQuery, model kinds.TestDataQuery) ([]*data.Frame, error) {
	queries := model.CsvWave

	frames := make([]*data.Frame, 0, len(queries))

	for _, subQ := range queries {
		var err error

		rawValues := strings.TrimRight(strings.TrimSpace(subQ.ValuesCSV), ",") // Strip Trailing Comma
		rawValesCSV := strings.Split(rawValues, ",")
		values := make([]*float64, len(rawValesCSV))

		for i, rawValue := range rawValesCSV {
			var val *float64
			rawValue = strings.TrimSpace(rawValue)

			switch rawValue {
			case "null":
				// val stays nil
			case "nan":
				f := math.NaN()
				val = &f
			default:
				f, err := strconv.ParseFloat(rawValue, 64)
				if err != nil {
					return nil, fmt.Errorf("failed to parse value '%v' into nullable float: %w", rawValue, err)
				}
				val = &f
			}
			values[i] = val
		}

		subQ.TimeStep *= 1000 // Seconds to Milliseconds
		valuesLen := int64(len(values))
		getValue := func(mod int64) (*float64, error) {
			var i int64
			for i = 0; i < valuesLen; i++ {
				if mod == i*subQ.TimeStep {
					return values[i], nil
				}
			}
			return nil, fmt.Errorf("did not get value at point in waveform - should not be here")
		}
		fields, err := predictableSeries(query.TimeRange, subQ.TimeStep, valuesLen, getValue)
		if err != nil {
			return nil, err
		}

		frame := newSeriesForQuery(query, model, 0)
		frame.Fields = fields
		frame.Fields[1].Labels = parseLabelsString(subQ.Labels, 0)
		if subQ.Name != "" {
			frame.Name = subQ.Name
		}
		frames = append(frames, frame)
	}
	return frames, nil
}

func predictableSeries(timeRange backend.TimeRange, timeStep, length int64, getValue func(mod int64) (*float64, error)) (data.Fields, error) {
	from := timeRange.From.UnixNano() / int64(time.Millisecond)
	to := timeRange.To.UnixNano() / int64(time.Millisecond)

	timeCursor := from - (from % timeStep) // Truncate Start
	wavePeriod := timeStep * length
	maxPoints := 10000 // Don't return too many points

	timeVec := make([]time.Time, 0)
	floatVec := make([]*float64, 0)

	for i := 0; i < maxPoints && timeCursor < to; i++ {
		val, err := getValue(timeCursor % wavePeriod)
		if err != nil {
			return nil, err
		}

		t := time.Unix(timeCursor/int64(1e+3), (timeCursor%int64(1e+3))*int64(1e+6))
		timeVec = append(timeVec, t)
		floatVec = append(floatVec, val)

		timeCursor += timeStep
	}

	return data.Fields{
		data.NewField(data.TimeSeriesTimeFieldName, nil, timeVec),
		data.NewField(data.TimeSeriesValueFieldName, nil, floatVec),
	}, nil
}

func predictablePulse(query backend.DataQuery, model kinds.TestDataQuery) (*data.Frame, error) {
	// Process Input
	var timeStep int64
	var onCount int64
	var offCount int64
	var onValue *float64
	var offValue *float64

	options := model.PulseWave

	var err error
	timeStep = options.TimeStep
	onCount = options.OnCount
	offCount = options.OffCount

	onValue, err = fromStringOrNumber(options.OnValue)
	if err != nil {
		return nil, fmt.Errorf("failed to parse onValue value '%v' into float: %v", options.OnValue, err)
	}
	offValue, err = fromStringOrNumber(options.OffValue)
	if err != nil {
		return nil, fmt.Errorf("failed to parse offValue value '%v' into float: %v", options.OffValue, err)
	}

	timeStep *= 1000                             // Seconds to Milliseconds
	onFor := func(mod int64) (*float64, error) { // How many items in the cycle should get the on value
		var i int64
		for i = 0; i < onCount; i++ {
			if mod == i*timeStep {
				return onValue, nil
			}
		}
		return offValue, nil
	}
	fields, err := predictableSeries(query.TimeRange, timeStep, onCount+offCount, onFor)
	if err != nil {
		return nil, err
	}

	frame := newSeriesForQuery(query, model, 0)
	frame.Fields = fields
	frame.Fields[1].Labels = parseLabels(model, 0)

	return frame, nil
}

func randomHeatmapData(query backend.DataQuery, fnBucketGen func(index int) float64) *data.Frame {
	rand := rand.New(rand.NewSource(time.Now().UnixNano()))
	frame := data.NewFrame("data", data.NewField("time", nil, []*time.Time{}))
	for i := 0; i < 10; i++ {
		frame.Fields = append(frame.Fields, data.NewField(strconv.FormatInt(int64(fnBucketGen(i)), 10), nil, []*float64{}))
	}

	timeWalkerMs := query.TimeRange.From.UnixNano() / int64(time.Millisecond)
	to := query.TimeRange.To.UnixNano() / int64(time.Millisecond)

	for j := int64(0); j < 100 && timeWalkerMs < to; j++ {
		t := time.Unix(timeWalkerMs/int64(1e+3), (timeWalkerMs%int64(1e+3))*int64(1e+6))
		vals := []any{&t}
		for n := 1; n < len(frame.Fields); n++ {
			v := float64(rand.Int63n(100))
			vals = append(vals, &v)
		}
		frame.AppendRow(vals...)
		timeWalkerMs += query.Interval.Milliseconds() * 50
	}

	return frame
}

func doArrowQuery(query backend.DataQuery, model kinds.TestDataQuery) (*data.Frame, error) {
	encoded := model.StringInput
	if encoded == "" {
		return nil, nil
	}
	arrow, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, err
	}
	return data.UnmarshalArrowFrame(arrow)
}

func newSeriesForQuery(query backend.DataQuery, model kinds.TestDataQuery, index int) *data.Frame {
	alias := model.Alias
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
func parseLabels(model kinds.TestDataQuery, seriesIndex int) data.Labels {
	return parseLabelsString(model.Labels, seriesIndex)
}

func parseLabelsString(labelText string, seriesIndex int) data.Labels {
	if labelText == "" {
		return data.Labels{}
	}

	text := strings.Trim(labelText, `{}`)
	if len(text) < 2 {
		return data.Labels{}
	}

	tags := make(data.Labels)

	for _, keyval := range strings.Split(text, ",") {
		idx := strings.Index(keyval, "=")
		key := strings.TrimSpace(keyval[:idx])
		val := strings.TrimSpace(keyval[idx+1:])
		val = strings.Trim(val, "\"")
		val = strings.ReplaceAll(val, "$seriesIndex", strconv.Itoa(seriesIndex))
		tags[key] = val
	}

	return tags
}

func frameNameForQuery(query backend.DataQuery, model kinds.TestDataQuery, index int) string {
	name := model.Alias
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

func fromStringOrNumber(val any) (*float64, error) {
	switch v := val.(type) {
	case float64:
		fV := val.(float64)
		return &fV, nil
	case string:
		switch v {
		case "null":
			return nil, nil
		case "nan":
			v := math.NaN()
			return &v, nil
		default:
			return nil, fmt.Errorf("failed to extract value from %v", v)
		}
	default:
		return nil, fmt.Errorf("failed to extract value")
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

package tempo

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/grafana/tempo/pkg/tempopb"
)

// SearchResponse represents the response from Tempo's search API.
// Note: We cannot use tempopb.SearchResponse directly because the Tempo API
// returns some numeric fields as strings in JSON (e.g., startTimeUnixNano as "1234567890")
// while the tempopb types expect uint64.
type SearchResponse struct {
	Traces []*TraceSearchMetadata `json:"traces,omitempty"`
}

type TraceSearchMetadata struct {
	TraceID           string                           `json:"traceID,omitempty"`
	RootServiceName   string                           `json:"rootServiceName,omitempty"`
	RootTraceName     string                           `json:"rootTraceName,omitempty"`
	StartTimeUnixNano string                           `json:"startTimeUnixNano,omitempty"`
	DurationMs        uint32                           `json:"durationMs,omitempty"`
	SpanSet           *SpanSet                         `json:"spanSet,omitempty"`
	SpanSets          []*SpanSet                       `json:"spanSets,omitempty"`
	ServiceStats      map[string]*tempopb.ServiceStats `json:"serviceStats,omitempty"`
}

type SpanSet struct {
	Spans      []*Span     `json:"spans,omitempty"`
	Matched    uint32      `json:"matched,omitempty"`
	Attributes []Attribute `json:"attributes,omitempty"`
}

type Span struct {
	SpanID            string      `json:"spanID,omitempty"`
	Name              string      `json:"name,omitempty"`
	StartTimeUnixNano string      `json:"startTimeUnixNano,omitempty"`
	DurationNanos     string      `json:"durationNanos,omitempty"`
	Attributes        []Attribute `json:"attributes,omitempty"`
}

type Attribute struct {
	Key   string         `json:"key,omitempty"`
	Value AttributeValue `json:"value,omitempty"`
}

type AttributeValue struct {
	StringValue string  `json:"stringValue,omitempty"`
	IntValue    string  `json:"intValue,omitempty"`
	DoubleValue float64 `json:"doubleValue,omitempty"`
	BoolValue   bool    `json:"boolValue,omitempty"`
	BytesValue  string  `json:"bytesValue,omitempty"`
}

type Field struct {
	Name   string
	Type   interface{}
	Config data.FieldConfig
}

type TraceTableData struct {
	traceIdHidden string
	spanID        string
	time          time.Time
	name          string
	duration      float64
	attributes    map[string]interface{}
}

func (s *Service) Search(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery) (*backend.DataResponse, error) {
	ctxLogger := s.logger.FromContext(ctx)
	model := &dataquery.TempoQuery{}
	result := &backend.DataResponse{}

	dsInfo, err := s.getDSInfo(ctx, pCtx)
	if err != nil {
		ctxLogger.Error("Failed to get datasource information", "error", err, "function", logEntrypoint())
		return nil, err
	}

	err = json.Unmarshal(query.JSON, model)
	if err != nil {
		ctxLogger.Error("Failed to unmarshall Tempo query model", "error", err, "function", logEntrypoint())
		return nil, err
	}

	req, err := createSearchRequest(ctx, dsInfo, model, query.TimeRange.From.Unix(), query.TimeRange.To.Unix())
	if err != nil {
		ctxLogger.Error("Failed to create search request", "error", err, "function", logEntrypoint())
		return nil, err
	}

	resp, err := dsInfo.HTTPClient.Do(req)
	if err != nil {
		ctxLogger.Error("Failed to send request to Tempo", "error", err, "function", logEntrypoint())
		return nil, err
	}

	defer func() {
		if resp != nil && resp.Body != nil {
			if err := resp.Body.Close(); err != nil {
				ctxLogger.Error("Failed to close response body", "error", err, "function", logEntrypoint())
			}
		}
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		ctxLogger.Error("Failed to read response body", "error", err, "function", logEntrypoint())
		return nil, err
	}

	var response SearchResponse
	err = json.Unmarshal(body, &response)
	if err != nil {
		ctxLogger.Error("Failed to unmarshal response to SearchResponse", "error", err, "function", logEntrypoint())
		return nil, err
	}

	if *model.TableType == dataquery.SearchTableTypeTraces {
		frames, err := transformTraceSearchResponse(pCtx, &response)
		if err != nil {
			ctxLogger.Error("Failed to convert SearchResponse to frames", "error", err, "function", logEntrypoint())
			return nil, err
		}
		result.Frames = frames
		return result, nil
	}

	if *model.TableType == dataquery.SearchTableTypeSpans {
		frames, err := transformSpanSearchResponse(pCtx, &response)
		if err != nil {
			ctxLogger.Error("Failed to convert SearchResponse to frames", "error", err, "function", logEntrypoint())
			return nil, err
		}
		result.Frames = frames
		return result, nil
	}

	if *model.TableType == dataquery.SearchTableTypeRaw {
		frames, err := transformRawSearchResponse(&response)
		if err != nil {
			ctxLogger.Error("Failed to convert SearchResponse to frames", "error", err, "function", logEntrypoint())
			return nil, err
		}
		result.Frames = frames
		return result, nil
	}

	return result, nil
}

func createSearchRequest(ctx context.Context, dsInfo *DatasourceInfo, model *dataquery.TempoQuery, start int64, end int64) (*http.Request, error) {
	baseURL, err := url.Parse(dsInfo.URL)
	if err != nil {
		return nil, fmt.Errorf("invalid base URL: %w", err)
	}

	searchURL, err := url.JoinPath(baseURL.String(), "api", "search")
	if err != nil {
		return nil, fmt.Errorf("failed to join URL path: %w", err)
	}

	parsedURL, err := url.Parse(searchURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse search URL: %w", err)
	}

	query := parsedURL.Query()

	if model.Query != nil && *model.Query != "" {
		query.Set("q", *model.Query)
	}

	if model.Limit != nil && *model.Limit > 0 {
		query.Set("limit", fmt.Sprintf("%d", *model.Limit))
	}

	if model.Spss != nil && *model.Spss > 0 {
		query.Set("spss", fmt.Sprintf("%d", *model.Spss))
	}

	if start != 0 && end != 0 {
		query.Set("start", fmt.Sprintf("%d", start))
		query.Set("end", fmt.Sprintf("%d", end))
	}

	parsedURL.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, "GET", parsedURL.String(), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
	return req, nil
}

func transformTraceSearchResponse(pCtx backend.PluginContext, response *SearchResponse) ([]*data.Frame, error) {
	tracesFrame := data.NewFrame("Traces")
	tracesFrame.Fields = append(tracesFrame.Fields, data.NewField("traceID", nil, []string{}).SetConfig(&data.FieldConfig{
		DisplayNameFromDS: "Trace ID",
		Links: []data.DataLink{
			{
				Title: "Trace: ${__value.raw}",
				URL:   "",
				Internal: &data.InternalDataLink{
					DatasourceUID:  pCtx.DataSourceInstanceSettings.UID,
					DatasourceName: pCtx.DataSourceInstanceSettings.Name,
					Query: map[string]interface{}{
						"query":     "${__value.raw}",
						"queryType": "traceql",
					},
				},
			},
		},
	}))
	tracesFrame.Fields = append(tracesFrame.Fields, data.NewField("startTime", nil, []time.Time{}).SetConfig(&data.FieldConfig{
		DisplayNameFromDS: "Start time",
	}))
	tracesFrame.Fields = append(tracesFrame.Fields, data.NewField("traceService", nil, []string{}).SetConfig(&data.FieldConfig{
		DisplayNameFromDS: "Service",
	}))
	tracesFrame.Fields = append(tracesFrame.Fields, data.NewField("traceName", nil, []string{}).SetConfig(&data.FieldConfig{
		DisplayNameFromDS: "Name",
	}))
	tracesFrame.Fields = append(tracesFrame.Fields, data.NewField("traceDuration", nil, []*float64{}).SetConfig(&data.FieldConfig{
		DisplayNameFromDS: "Duration",
		Unit:              "ms",
		NoValue:           "<1 ms",
	}))
	tracesFrame.Fields = append(tracesFrame.Fields, data.NewField("nested", nil, []json.RawMessage{}))

	tracesFrame.Meta = &data.FrameMeta{
		PreferredVisualization: data.VisTypeTable,
		UniqueRowIDFields:      []int{0},
	}

	if response == nil {
		return []*data.Frame{tracesFrame}, nil
	}

	if len(response.Traces) == 0 {
		return []*data.Frame{tracesFrame}, nil
	}

	traces := make([]*TraceSearchMetadata, len(response.Traces))
	copy(traces, response.Traces)

	for i := 0; i < len(traces)-1; i++ {
		for j := i + 1; j < len(traces); j++ {
			if traces[i].StartTimeUnixNano < traces[j].StartTimeUnixNano {
				traces[i], traces[j] = traces[j], traces[i]
			}
		}
	}

	for _, trace := range traces {
		startTimeUnixNano, err := strconv.ParseInt(trace.StartTimeUnixNano, 10, 64)
		if err != nil {
			tracesFrame.Fields[1].Append(time.Time{})
		} else {
			tracesFrame.Fields[1].Append(time.Unix(0, startTimeUnixNano))
		}

		var traceDurationMs *float64
		if trace.DurationMs >= 1 {
			val := float64(trace.DurationMs)
			traceDurationMs = &val
		} else {
			traceDurationMs = nil
		}

		nestedFrames := []json.RawMessage{}

		if trace.SpanSet != nil {
			subFrame := transformTraceSearchResponseSubFrame(trace, trace.SpanSet, pCtx)
			subFrameJSON, err := json.Marshal(subFrame)
			if err != nil {
				backend.Logger.Error("Failed to marshal subFrame", "error", err)
				nestedFrames = append(nestedFrames, json.RawMessage("{}"))
			} else {
				nestedFrames = append(nestedFrames, json.RawMessage(subFrameJSON))
			}
		} else if len(trace.SpanSets) > 0 {
			for _, spanSet := range trace.SpanSets {
				subFrame := transformTraceSearchResponseSubFrame(trace, spanSet, pCtx)
				subFrameJSON, err := json.Marshal(subFrame)
				if err != nil {
					backend.Logger.Error("Failed to marshal subFrame", "error", err)
					nestedFrames = append(nestedFrames, json.RawMessage("{}"))
				} else {
					nestedFrames = append(nestedFrames, json.RawMessage(subFrameJSON))
				}
			}
		}

		nestedFramesBytes, _ := json.Marshal(nestedFrames)
		nestedFramesJSON := json.RawMessage(nestedFramesBytes)
		tracesFrame.Fields[5].Append(nestedFramesJSON)

		tracesFrame.Fields[0].Append(trace.TraceID)
		tracesFrame.Fields[2].Append(trace.RootServiceName)
		tracesFrame.Fields[3].Append(trace.RootTraceName)
		tracesFrame.Fields[4].Append(traceDurationMs)
	}

	return []*data.Frame{tracesFrame}, nil
}

func transformTraceSearchResponseSubFrame(trace *TraceSearchMetadata, spanSet *SpanSet, pCtx backend.PluginContext) *data.Frame {
	spanDynamicAttributes := make(map[string]*Field)
	hasNameAttribute := false

	for _, attribute := range spanSet.Attributes {
		spanDynamicAttributes[attribute.Key] = &Field{
			Name:   attribute.Key,
			Type:   []string{},
			Config: data.FieldConfig{DisplayNameFromDS: attribute.Key},
		}
	}

	for _, span := range spanSet.Spans {
		if span.Name != "" {
			hasNameAttribute = true
		}
		for _, attribute := range span.Attributes {
			spanDynamicAttributes[attribute.Key] = &Field{
				Name:   attribute.Key,
				Type:   []string{},
				Config: data.FieldConfig{DisplayNameFromDS: attribute.Key},
			}
		}
	}

	spanAttributeNames := make([]string, 0, len(spanDynamicAttributes))
	for name := range spanDynamicAttributes {
		spanAttributeNames = append(spanAttributeNames, name)
	}
	sort.Strings(spanAttributeNames)

	frame := data.NewFrame("Spans")
	panelsState := data.ExplorePanelsState(map[string]interface{}{"trace": map[string]interface{}{"spanId": "${__value.raw}"}})
	frame.Fields = append(frame.Fields, data.NewField("traceIdHidden", nil, []string{}).SetConfig(&data.FieldConfig{
		Custom: map[string]interface{}{"hidden": true},
	}))
	frame.Fields = append(frame.Fields, data.NewField("spanID", nil, []string{}).SetConfig(&data.FieldConfig{
		DisplayNameFromDS: "Span ID",
		Unit:              "string",
		Custom:            map[string]interface{}{"width": 200},
		Links: []data.DataLink{
			{
				Title: "Span: ${__value.raw}",
				URL:   "",
				Internal: &data.InternalDataLink{
					DatasourceUID:  pCtx.DataSourceInstanceSettings.UID,
					DatasourceName: pCtx.DataSourceInstanceSettings.Name,
					Query: map[string]interface{}{
						"query":     "${__data.fields.traceIdHidden}",
						"queryType": "traceql",
					},
					ExplorePanelsState: &panelsState,
				},
			},
		},
	}))
	frame.Fields = append(frame.Fields, data.NewField("time", nil, []time.Time{}).SetConfig(&data.FieldConfig{
		DisplayNameFromDS: "Start time",
		Custom:            map[string]interface{}{"width": 200},
	}))
	frame.Fields = append(frame.Fields, data.NewField("name", nil, []string{}).SetConfig(&data.FieldConfig{
		DisplayNameFromDS: "Name",
		Custom:            map[string]interface{}{"hidden": !hasNameAttribute},
	}))
	for _, attributeName := range spanAttributeNames {
		field := spanDynamicAttributes[attributeName]
		frame.Fields = append(frame.Fields, data.NewField(field.Name, nil, field.Type).SetConfig(&field.Config))
	}
	frame.Fields = append(frame.Fields, data.NewField("duration", nil, []float64{}).SetConfig(&data.FieldConfig{
		DisplayNameFromDS: "Duration",
		Unit:              "ns",
		Custom:            map[string]interface{}{"width": 120},
	}))

	frame.Meta = &data.FrameMeta{
		PreferredVisualization: data.VisTypeTable,
	}

	for _, span := range spanSet.Spans {
		traceData := transformSpanToTraceData(span, spanSet, trace)
		frame.Fields[0].Append(traceData.traceIdHidden)
		frame.Fields[1].Append(traceData.spanID)
		frame.Fields[2].Append(traceData.time)
		frame.Fields[3].Append(traceData.name)
		attributeIndex := 4
		for _, attributeName := range spanAttributeNames {
			if attribute, ok := traceData.attributes[attributeName]; ok {
				frame.Fields[attributeIndex].Append(attribute)
			} else {
				frame.Fields[attributeIndex].Append("")
			}
			attributeIndex++
		}
		frame.Fields[attributeIndex].Append(traceData.duration)
	}

	return frame
}

func transformSpanSearchResponse(pCtx backend.PluginContext, response *SearchResponse) ([]*data.Frame, error) {
	spanDynamicAttributes := make(map[string]*Field)
	hasNameAttribute := false

	for _, trace := range response.Traces {
		for _, spanSet := range trace.SpanSets {
			for _, attribute := range spanSet.Attributes {
				spanDynamicAttributes[attribute.Key] = &Field{
					Name:   attribute.Key,
					Type:   []string{},
					Config: data.FieldConfig{DisplayNameFromDS: attribute.Key},
				}
			}
			for _, span := range spanSet.Spans {
				if span.Name != "" {
					hasNameAttribute = true
				}
				for _, attribute := range span.Attributes {
					spanDynamicAttributes[attribute.Key] = &Field{
						Name:   attribute.Key,
						Type:   []string{},
						Config: data.FieldConfig{DisplayNameFromDS: attribute.Key},
					}
				}
			}
		}
	}

	spanAttributeNames := make([]string, 0, len(spanDynamicAttributes))
	for name := range spanDynamicAttributes {
		spanAttributeNames = append(spanAttributeNames, name)
	}
	sort.Strings(spanAttributeNames)

	spansFrame := data.NewFrame("Spans")
	panelsState := data.ExplorePanelsState(map[string]interface{}{"trace": map[string]interface{}{"spanId": "${__value.raw}"}})
	spansFrame.Fields = append(spansFrame.Fields, data.NewField("traceIdHidden", nil, []string{}).SetConfig(&data.FieldConfig{
		Custom: map[string]interface{}{"hidden": false},
	}))
	spansFrame.Fields = append(spansFrame.Fields, data.NewField("traceService", nil, []string{}).SetConfig(&data.FieldConfig{
		DisplayNameFromDS: "Trace Service",
		Custom:            map[string]interface{}{"width": 200},
	}))
	spansFrame.Fields = append(spansFrame.Fields, data.NewField("traceName", nil, []string{}).SetConfig(&data.FieldConfig{
		DisplayNameFromDS: "Trace Name",
		Custom:            map[string]interface{}{"width": 200},
	}))
	spansFrame.Fields = append(spansFrame.Fields, data.NewField("spanID", nil, []string{}).SetConfig(&data.FieldConfig{
		DisplayNameFromDS: "Span ID",
		Unit:              "string",
		Custom:            map[string]interface{}{"width": 200},
		Links: []data.DataLink{
			{
				Title: "Span: ${__value.raw}",
				URL:   "",
				Internal: &data.InternalDataLink{
					DatasourceUID:  pCtx.DataSourceInstanceSettings.UID,
					DatasourceName: pCtx.DataSourceInstanceSettings.Name,
					Query: map[string]interface{}{
						"query":     "${__data.fields.traceIdHidden}",
						"queryType": "traceql",
					},
					ExplorePanelsState: &panelsState,
				},
			},
		},
	}))
	spansFrame.Fields = append(spansFrame.Fields, data.NewField("time", nil, []time.Time{}).SetConfig(&data.FieldConfig{
		DisplayNameFromDS: "Start time",
	}))
	spansFrame.Fields = append(spansFrame.Fields, data.NewField("name", nil, []string{}).SetConfig(&data.FieldConfig{
		DisplayNameFromDS: "Name",
		Custom:            map[string]interface{}{"hidden": !hasNameAttribute},
	}))
	for _, attributeName := range spanAttributeNames {
		field := spanDynamicAttributes[attributeName]
		spansFrame.Fields = append(spansFrame.Fields, data.NewField(field.Name, nil, field.Type).SetConfig(&field.Config))
	}
	spansFrame.Fields = append(spansFrame.Fields, data.NewField("duration", nil, []float64{}).SetConfig(&data.FieldConfig{
		DisplayNameFromDS: "Duration",
		Unit:              "ns",
		Custom:            map[string]interface{}{"width": 120},
	}))

	spansFrame.Meta = &data.FrameMeta{
		PreferredVisualization: data.VisTypeTable,
	}

	if response == nil {
		return []*data.Frame{spansFrame}, nil
	}

	if len(response.Traces) == 0 {
		return []*data.Frame{spansFrame}, nil
	}

	traces := make([]*TraceSearchMetadata, len(response.Traces))
	copy(traces, response.Traces)

	for i := 0; i < len(traces)-1; i++ {
		for j := i + 1; j < len(traces); j++ {
			if traces[i].StartTimeUnixNano < traces[j].StartTimeUnixNano {
				traces[i], traces[j] = traces[j], traces[i]
			}
		}
	}

	for _, trace := range traces {
		for _, spanSet := range trace.SpanSets {
			for _, span := range spanSet.Spans {
				traceData := transformSpanToTraceData(span, spanSet, trace)
				spansFrame.Fields[0].Append(traceData.traceIdHidden)
				spansFrame.Fields[1].Append(trace.RootServiceName)
				spansFrame.Fields[2].Append(trace.RootTraceName)
				spansFrame.Fields[3].Append(traceData.spanID)
				spansFrame.Fields[4].Append(traceData.time)
				spansFrame.Fields[5].Append(traceData.name)
				attributeIndex := 6
				for _, attributeName := range spanAttributeNames {
					if attribute, ok := traceData.attributes[attributeName]; ok {
						spansFrame.Fields[attributeIndex].Append(attribute)
					} else {
						spansFrame.Fields[attributeIndex].Append("")
					}
					attributeIndex++
				}
				spansFrame.Fields[attributeIndex].Append(traceData.duration)
			}
		}
	}

	return []*data.Frame{spansFrame}, nil
}

func transformRawSearchResponse(response *SearchResponse) ([]*data.Frame, error) {
	rawFrame := data.NewFrame("Raw response")
	rawFrame.Fields = append(rawFrame.Fields, data.NewField("response", nil, []string{}))

	raw, err := json.MarshalIndent(response, "", "  ")
	if err != nil {
		return nil, err
	}

	rawFrame.Fields[0].Append(string(raw))
	return []*data.Frame{rawFrame}, nil
}

func transformSpanToTraceData(span *Span, spanSet *SpanSet, trace *TraceSearchMetadata) *TraceTableData {
	spanStartTimeUnixNano, err := strconv.ParseInt(span.StartTimeUnixNano, 10, 64)
	var spanStartTime time.Time
	if err != nil {
		spanStartTime = time.Time{}
	} else {
		spanStartTime = time.Unix(0, spanStartTimeUnixNano)
	}

	spanDuration, err := strconv.ParseInt(span.DurationNanos, 10, 64)
	var duration float64
	if err != nil {
		duration = 0
	} else {
		duration = float64(spanDuration)
	}

	attributes := make(map[string]interface{})
	allAttributes := make([]Attribute, 0, len(spanSet.Attributes)+len(span.Attributes))

	if spanSet.Attributes != nil {
		allAttributes = append(allAttributes, spanSet.Attributes...)
	}

	if span.Attributes != nil {
		allAttributes = append(allAttributes, span.Attributes...)
	}

	for _, attribute := range allAttributes {
		if attribute.Value.StringValue != "" {
			attributes[attribute.Key] = attribute.Value.StringValue
		} else if attribute.Value.IntValue != "" {
			attributes[attribute.Key] = attribute.Value.IntValue
		} else if attribute.Value.DoubleValue != 0 {
			attributes[attribute.Key] = attribute.Value.DoubleValue
		} else if attribute.Value.BoolValue {
			attributes[attribute.Key] = attribute.Value.BoolValue
		} else if attribute.Value.BytesValue != "" {
			attributes[attribute.Key] = attribute.Value.BytesValue
		}
	}

	return &TraceTableData{
		traceIdHidden: trace.TraceID,
		spanID:        span.SpanID,
		time:          spanStartTime,
		name:          span.Name,
		duration:      duration,
		attributes:    attributes,
	}
}

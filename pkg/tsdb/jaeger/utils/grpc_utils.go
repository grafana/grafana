package utils

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/jaeger/types"
)

func TransformGrpcSearchResponse(response types.GrpcTracesResult, dsUID string, dsName string, limit int) *data.Frame {
	// Create a frame for the traces
	frame := data.NewFrame("traces",
		data.NewField("traceID", nil, []string{}).SetConfig(&data.FieldConfig{
			DisplayName: "Trace ID",
			Links: []data.DataLink{
				{
					Title: "Trace: ${__value.raw}",
					URL:   "",
					Internal: &data.InternalDataLink{
						DatasourceUID:  dsUID,
						DatasourceName: dsName,
						Query: map[string]interface{}{
							"query": "${__value.raw}",
						},
					},
				},
			},
		}),
		data.NewField("traceName", nil, []string{}).SetConfig(&data.FieldConfig{
			DisplayName: "Trace name",
		}),
		data.NewField("startTime", nil, []time.Time{}).SetConfig(&data.FieldConfig{
			DisplayName: "Start time",
		}),
		data.NewField("duration", nil, []int64{}).SetConfig(&data.FieldConfig{
			DisplayName: "Duration",
			Unit:        "µs",
		}),
	)

	// Set the visualization type to table
	frame.Meta = &data.FrameMeta{
		PreferredVisualization: "table",
	}

	// Sort traces by start time in descending order (newest first)
	resourceSpans := response.ResourceSpans
	sort.Slice(resourceSpans, func(i, j int) bool {
		rootSpanI := resourceSpans[i].ScopeSpans[0].Spans[0]
		rootSpanJ := resourceSpans[j].ScopeSpans[0].Spans[0]

		for _, scopeSpan := range resourceSpans[i].ScopeSpans {
			for _, span := range scopeSpan.Spans {
				if span.StartTimeUnixNano < rootSpanI.StartTimeUnixNano {
					rootSpanI = span
				}
			}
		}

		for _, scopeSpan := range resourceSpans[j].ScopeSpans {
			for _, span := range scopeSpan.Spans {
				if span.StartTimeUnixNano < rootSpanJ.StartTimeUnixNano {
					rootSpanJ = span
				}
			}
		}

		return rootSpanI.StartTimeUnixNano > rootSpanJ.StartTimeUnixNano
	})

	if limit > 0 {
		resourceSpans = resourceSpans[:limit]
	}
	// process each individual resource
	for _, res := range resourceSpans {
		serviceName := getAttribute(res.Resource.Attributes, "service.name")
		for _, scopeSpan := range res.ScopeSpans {
			if len(scopeSpan.Spans) == 0 {
				continue
			}

			// Get the root span
			rootSpan := scopeSpan.Spans[0]
			for _, span := range scopeSpan.Spans {
				if span.StartTimeUnixNano < rootSpan.StartTimeUnixNano {
					rootSpan = span
				}
			}

			// get trace name
			traceName := fmt.Sprintf("%s: %s", serviceName.StringValue, rootSpan.Name)
			startTimeInt, startErr := strconv.ParseInt(rootSpan.StartTimeUnixNano, 10, 64)
			endTimeInt, endErr := strconv.ParseInt(rootSpan.EndTimeUnixNano, 10, 64)
			duration := int64(0)
			if startErr == nil && endErr == nil {
				duration = (endTimeInt - startTimeInt) / 1000 // convert to microseconds
			}

			frame.AppendRow(
				rootSpan.TraceID,
				traceName,
				time.Unix(0, startTimeInt),
				duration,
			)
		}
	}

	return frame
}

func TransformGrpcTraceResponse(trace types.GrpcResourceSpans, refID string) *data.Frame {
	frame := data.NewFrame(refID,
		data.NewField("traceID", nil, []string{}),
		data.NewField("spanID", nil, []string{}),
		data.NewField("parentSpanID", nil, []*string{}),
		data.NewField("operationName", nil, []string{}),
		data.NewField("serviceName", nil, []string{}),
		data.NewField("serviceTags", nil, []json.RawMessage{}),
		data.NewField("startTime", nil, []float64{}),
		data.NewField("duration", nil, []float64{}),
		data.NewField("tags", nil, []json.RawMessage{}),
	)

	// Set metadata for trace visualization
	frame.Meta = &data.FrameMeta{
		PreferredVisualization: "trace",
		Custom: map[string]interface{}{
			"traceFormat": "jaeger",
		},
	}

	// Process each span in the trace
	scope := trace.ScopeSpans[0]
	for _, span := range scope.Spans {
		parentSpanID := span.ParentSpanID

		// Get service name and tags
		serviceName := getAttribute(trace.Resource.Attributes, "service.name").StringValue
		serviceTags := json.RawMessage{}
		processedResAttributes := processAttributesIntoTags(trace.Resource.Attributes)
		tagsMarshaled, err := json.Marshal(processedResAttributes)
		if err == nil {
			serviceTags = json.RawMessage(tagsMarshaled)
		}

		// Convert tags
		tags := json.RawMessage{}
		processedSpanAttributes := processAttributesIntoTags(span.Attributes)
		// add otel attributes scope name, scope version and span kind
		if scope.Scope.Name != "" {
			processedSpanAttributes = append(processedSpanAttributes, types.KeyValueType{
				Key:   "otel.scope.name",
				Value: scope.Scope.Name,
				Type:  "string",
			})
		}

		if scope.Scope.Version != "" {
			processedSpanAttributes = append(processedSpanAttributes, types.KeyValueType{
				Key:   "otel.scope.version",
				Value: scope.Scope.Version,
				Type:  "string",
			})
		}

		spanKindAtt := getAttribute(span.Attributes, "span.kind")
		if isEmptyAttribute(spanKindAtt) {
			// it may be the case that the span already contains a span.kind att, in that case, honor that attribute
			processedSpanAttributes = append(processedSpanAttributes, types.KeyValueType{
				Key:   "span.kind",
				Value: processSpanKind(span.Kind),
				Type:  "string",
			})
		}
		tagsMarshaled, err = json.Marshal(processedSpanAttributes)
		if err == nil {
			tags = json.RawMessage(tagsMarshaled)
		}

		// convert start time and calculate duration
		startTimeFloat, startErr := strconv.ParseFloat(span.StartTimeUnixNano, 64)
		endTimeFloat, endErr := strconv.ParseFloat(span.EndTimeUnixNano, 64)
		duration := float64(0)
		if startErr == nil && endErr == nil {
			duration = (endTimeFloat - startTimeFloat) / 1000000 // convert to milliseconds
		}

		// Add span to frame
		frame.AppendRow(
			span.TraceID,
			span.SpanID,
			&parentSpanID,
			span.Name,
			serviceName,
			serviceTags,
			startTimeFloat/1000000, // Convert nanoseconds to milliseconds
			duration,
			tags,
		)
	}

	return frame
}

func processAttributesIntoTags(attributes []types.GrpcKeyValue) []types.KeyValueType {
	tags := []types.KeyValueType{}

	for _, att := range attributes {
		if att.Value.StringValue != "" {
			tags = append(tags, types.KeyValueType{
				Key:   att.Key,
				Value: att.Value.StringValue,
				Type:  "string",
			})
			continue
		}

		if att.Value.BoolValue != "" {
			boolVal, err := strconv.ParseBool(att.Value.BoolValue)
			if err != nil {
				continue
			}
			tags = append(tags, types.KeyValueType{
				Key:   att.Key,
				Value: boolVal,
				Type:  "boolean",
			})
			continue
		}

		if att.Value.IntValue != "" {
			intVal, err := strconv.Atoi(att.Value.IntValue)
			if err != nil {
				continue
			}
			tags = append(tags, types.KeyValueType{
				Key:   att.Key,
				Value: int64(intVal),
				Type:  "int64",
			})
			continue
		}

		if att.Value.DoubleValue != "" {
			floatVal, err := strconv.ParseFloat(att.Value.DoubleValue, 64)
			if err != nil {
				continue
			}
			tags = append(tags, types.KeyValueType{
				Key:   att.Key,
				Value: floatVal,
				Type:  "float64",
			})
			continue
		}

		if len(att.Value.ArrayValue.Values) > 0 {
			tags = append(tags, types.KeyValueType{
				Key:   att.Key,
				Value: att.Value.ArrayValue.Values,
			})
			continue
		}

		if len(att.Value.KvListValue.Values) > 0 {
			tags = append(tags, types.KeyValueType{
				Key:   att.Key,
				Value: att.Value.KvListValue.Values,
			})
			continue
		}

		if att.Value.BytesValue != "" {
			tags = append(tags, types.KeyValueType{
				Key:   att.Key,
				Value: att.Value.BytesValue,
				Type:  "bytes",
			})
			continue
		}

	}
	return tags
}

func getAttribute(attributes []types.GrpcKeyValue, attName string) types.GrpcAnyValue {
	var attValue types.GrpcAnyValue
	for _, att := range attributes {
		if att.Key == attName {
			return att.Value
		}
	}

	return attValue
}

func processSpanKind(kind int64) string {
	switch kind {
	case 0:
		return "unspecified"
	case 1:
		return "internal"
	case 2:
		return "server"
	case 3:
		return "client"
	case 4:
		return "producer"
	case 5:
		return "consumer"
	default:
		return "unspecified"
	}
}

func isEmptyAttribute(attribute types.GrpcAnyValue) bool {
	if attribute.StringValue != "" {
		return false
	}

	if attribute.BoolValue != "" {
		return false
	}

	if attribute.IntValue != "" {
		return false
	}

	if attribute.DoubleValue != "" {
		return false
	}

	if len(attribute.ArrayValue.Values) > 0 {
		return false
	}

	if len(attribute.KvListValue.Values) > 0 {
		return false
	}

	if attribute.BytesValue != "" {
		return false
	}
	return true
}

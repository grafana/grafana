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

func TransformGrpcTraceResponse(trace []types.GrpcResourceSpans, refID string) *data.Frame {
	frame := data.NewFrame(refID,
		data.NewField("traceID", nil, []string{}),
		data.NewField("spanID", nil, []string{}),
		data.NewField("parentSpanID", nil, []string{}),
		data.NewField("statusCode", nil, []int64{}),
		data.NewField("statusMessage", nil, []string{}),
		data.NewField("kind", nil, []string{}),
		data.NewField("operationName", nil, []string{}),
		data.NewField("serviceName", nil, []string{}),
		data.NewField("serviceTags", nil, []json.RawMessage{}),
		data.NewField("startTime", nil, []float64{}),
		data.NewField("duration", nil, []float64{}),
		data.NewField("logs", nil, []json.RawMessage{}),
		data.NewField("references", nil, []json.RawMessage{}),
		data.NewField("tags", nil, []json.RawMessage{}),
	)

	// Set metadata for trace visualization
	frame.Meta = &data.FrameMeta{
		PreferredVisualization: "trace",
		Custom: map[string]interface{}{
			"traceFormat": "jaeger",
		},
	}

	// each resource is a difference service name or "process"
	for _, resource := range trace {
		for _, scopeSpan := range resource.ScopeSpans {
			for _, span := range scopeSpan.Spans {
				parentSpanID := span.ParentSpanID
				// Get service name and tags
				serviceName := getAttribute(resource.Resource.Attributes, "service.name").StringValue
				serviceTags := json.RawMessage{}
				processedResAttributes := processAttributes(resource.Resource.Attributes)
				tagsMarshaled, err := json.Marshal(processedResAttributes)
				if err == nil {
					serviceTags = json.RawMessage(tagsMarshaled)
				}

				// Convert tags
				tags := json.RawMessage{}
				processedSpanAttributes := processAttributes(span.Attributes)
				// add otel attributes scope name, scope version and span kind
				if scopeSpan.Scope.Name != "" {
					processedSpanAttributes = append(processedSpanAttributes, types.KeyValueType{
						Key:   "otel.scope.name",
						Value: scopeSpan.Scope.Name,
						Type:  "string",
					})
				}

				if scopeSpan.Scope.Version != "" {
					processedSpanAttributes = append(processedSpanAttributes, types.KeyValueType{
						Key:   "otel.scope.version",
						Value: scopeSpan.Scope.Version,
						Type:  "string",
					})
				}

				tagsMarshaled, err = json.Marshal(processedSpanAttributes)
				if err == nil {
					tags = json.RawMessage(tagsMarshaled)
				}

				// Convert logs
				// In the new API (OTLP based), logs are span events. See:
				// https://github.com/jaegertracing/jaeger-idl/blob/7c7460fc400325ae69435c0aa65697f4cc1ab581/swagger/api_v3/query_service.swagger.json#L630C9-L636C11
				logs := json.RawMessage{}
				processedEvents := convertGrpcEventsToLogs(span.Events)
				logsMarshaled, err := json.Marshal(processedEvents)
				if err == nil {
					logs = json.RawMessage(logsMarshaled)
				}

				// Convert references (excluding parent)
				references := json.RawMessage{}
				filteredLinks := []types.GrpcSpanLink{}
				// in the new API (OTLP based), references are defined as "SpanLinks" see:
				// https://github.com/jaegertracing/jaeger-idl/blob/7c7460fc400325ae69435c0aa65697f4cc1ab581/swagger/api_v3/query_service.swagger.json#L642C8-L648C11
				for _, ref := range span.Links {
					if parentSpanID == "" || ref.SpanID != parentSpanID {
						filteredLinks = append(filteredLinks, ref)
					}
				}
				processedLinks := convertGrpcLinkToReference(filteredLinks)
				refsMarshaled, err := json.Marshal(processedLinks)
				if err == nil {
					references = json.RawMessage(refsMarshaled)
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
					parentSpanID,
					span.Status.Code,
					span.Status.Message,
					processSpanKind(span.Kind),
					span.Name,
					serviceName,
					serviceTags,
					startTimeFloat/1000000, // Convert nanoseconds to milliseconds
					duration,
					logs,
					references,
					tags,
				)
			}
		}
	}

	return frame
}

func processAttributes(attributes []types.GrpcKeyValue) []types.KeyValueType {
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

// This is to help ensure backwards compatibility with the current non OTLP based Jager trace format
// a few fields are different between TraceLogs and GrpcSpanEvents
func convertGrpcEventsToLogs(events []types.GrpcSpanEvent) []types.TraceLog {
	logs := make([]types.TraceLog, 0, len(events))

	for _, event := range events {
		timestamp, err := strconv.Atoi(event.TimeUnixNano)
		if err == nil {
			timestamp = timestamp / 1000 // converting from nanoseconds to milliseconds
		}
		log := types.TraceLog{
			Name:      event.Name,
			Timestamp: int64(timestamp),
			Fields:    processAttributes(event.Attributes),
		}
		logs = append(logs, log)
	}

	return logs
}

// this is to help ensure backwards compatibility between references and links with the current non OTLP based Jaeger trace format
// There is no concept of RefType in the new OTLP based SpanLink, so we are only converting the SpanID and TraceID
func convertGrpcLinkToReference(links []types.GrpcSpanLink) []types.TraceSpanReference {
	references := make([]types.TraceSpanReference, 0, len(links))

	for _, ref := range links {
		references = append(references, types.TraceSpanReference{
			TraceID: ref.TraceID,
			SpanID:  ref.SpanID,
		})
	}

	return references
}

package tempo

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	commonv11 "github.com/grafana/tempo/pkg/tempopb/common/v1"
	v1 "github.com/grafana/tempo/pkg/tempopb/resource/v1"
	tracev11 "github.com/grafana/tempo/pkg/tempopb/trace/v1"
	"go.opentelemetry.io/otel/attribute"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
)

type KeyValue struct {
	Value any    `json:"value"`
	Key   string `json:"key"`
}

type TraceLog struct {
	// Millisecond epoch time
	Timestamp float64     `json:"timestamp"`
	Fields    []*KeyValue `json:"fields"`
	Name      string      `json:"name,omitempty"`
}

type TraceReference struct {
	SpanID  string      `json:"spanID"`
	TraceID string      `json:"traceID"`
	Tags    []*KeyValue `json:"tags"`
}

func TraceToFrame(resourceSpans []*tracev11.ResourceSpans) (*data.Frame, error) {
	// In open telemetry format the spans are grouped first by resource/service they originated in and inside that
	// resource they are grouped by the instrumentation library which created them.

	if len(resourceSpans) == 0 {
		return nil, nil
	}

	frame := &data.Frame{
		Name: "Trace",
		Fields: []*data.Field{
			data.NewField("traceID", nil, []string{}),
			data.NewField("spanID", nil, []string{}),
			data.NewField("parentSpanID", nil, []string{}),
			data.NewField("operationName", nil, []string{}),
			data.NewField("serviceName", nil, []string{}),
			data.NewField("kind", nil, []string{}),
			data.NewField("statusCode", nil, []int64{}),
			data.NewField("statusMessage", nil, []string{}),
			data.NewField("instrumentationLibraryName", nil, []string{}),
			data.NewField("instrumentationLibraryVersion", nil, []string{}),
			data.NewField("traceState", nil, []string{}),
			data.NewField("serviceTags", nil, []json.RawMessage{}),
			data.NewField("startTime", nil, []float64{}),
			data.NewField("duration", nil, []float64{}),
			data.NewField("logs", nil, []json.RawMessage{}),
			data.NewField("references", nil, []json.RawMessage{}),
			data.NewField("tags", nil, []json.RawMessage{}),
		},
		Meta: &data.FrameMeta{
			PreferredVisualization: data.VisTypeTrace,
		},
	}

	for i := 0; i < len(resourceSpans); i++ {
		rs := resourceSpans[i]
		rows, err := resourceSpansToRows(rs)
		if err != nil {
			return nil, err
		}

		for _, row := range rows {
			frame.AppendRow(row...)
		}
	}

	return frame, nil
}

// resourceSpansToRows processes all the spans for a particular resource/service
func resourceSpansToRows(rs *tracev11.ResourceSpans) ([][]any, error) {
	resource := rs.Resource
	ilss := rs.ScopeSpans

	if len(resource.Attributes) == 0 || len(ilss) == 0 {
		return [][]any{}, nil
	}

	// Approximate the number of the spans as the number of the spans in the first
	// instrumentation library info.
	rows := make([][]any, 0, len(ilss[0].Spans))

	for i := 0; i < len(ilss); i++ {
		ils := ilss[i]

		// These are finally the actual spans
		spans := ils.Spans

		for j := 0; j < len(spans); j++ {
			span := spans[j]
			row, err := spanToSpanRow(span, ils.Scope, resource)
			if err != nil {
				return nil, err
			}
			if row != nil {
				rows = append(rows, row)
			}
		}
	}

	return rows, nil
}

func spanToSpanRow(span *tracev11.Span, libraryTags *commonv11.InstrumentationScope, resource *v1.Resource) ([]any, error) {
	// If the id representation changed from hexstring to something else we need to change the transformBase64IDToHexString in the frontend code
	traceID := span.TraceId
	traceIDHex := hex.EncodeToString(traceID[:])
	traceIDHex = strings.TrimPrefix(traceIDHex, strings.Repeat("0", 16))

	spanID := span.SpanId
	spanIDHex := hex.EncodeToString(spanID[:])

	parentSpanID := span.ParentSpanId
	parentSpanIDHex := hex.EncodeToString(parentSpanID[:])

	startTime := float64(span.StartTimeUnixNano) / 1_000_000
	serviceName, serviceTags := resourceToProcess(resource)

	status := span.Status
	statusCode := int64(status.Code)
	statusMessage := status.Message

	libraryName := libraryTags.Name
	libraryVersion := libraryTags.Version
	traceState := span.TraceState

	serviceTagsJson, err := json.Marshal(serviceTags)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal service tags: %w", err)
	}

	// Get both span tags and scope tags and combine them
	spanTagsList := getSpanTags(span)
	scopeTagsList := getScopeTags(libraryTags)
	spanTagsList = append(spanTagsList, scopeTagsList...)

	spanTags, err := json.Marshal(spanTagsList)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal span tags: %w", err)
	}

	logs, err := json.Marshal(spanEventsToLogs(span.Events))
	if err != nil {
		return nil, fmt.Errorf("failed to marshal span logs: %w", err)
	}

	references, err := json.Marshal(spanLinksToReferences(span.Links))

	if err != nil {
		return nil, fmt.Errorf("failed to marshal span links: %w", err)
	}

	// Order matters (look at dataframe order)
	return []any{
		traceIDHex,
		spanIDHex,
		parentSpanIDHex,
		span.Name,
		serviceName,
		getSpanKind(span.Kind),
		statusCode,
		statusMessage,
		libraryName,
		libraryVersion,
		traceState,
		json.RawMessage(serviceTagsJson),
		startTime,
		float64(span.EndTimeUnixNano-span.StartTimeUnixNano) / 1_000_000,
		json.RawMessage(logs),
		json.RawMessage(references),
		json.RawMessage(spanTags),
	}, nil
}

func resourceToProcess(resource *v1.Resource) (string, []*KeyValue) {
	attrs := resource.Attributes
	serviceName := ResourceNoServiceName
	if len(attrs) == 0 {
		return serviceName, nil
	}

	tags := make([]*KeyValue, 0, len(attrs)-1)
	for _, attr := range attrs {
		if attribute.Key(attr.Key) == semconv.ServiceNameKey {
			serviceName = attr.GetValue().GetStringValue()
		}
		val, err := getAttributeVal(attr.Value)
		if err != nil {
			logger.Debug("error transforming resource to process", "err", err)
		}
		tags = append(tags, &KeyValue{Key: attr.Key, Value: val})
	}

	return serviceName, tags
}

func getAttributeVal(attr *commonv11.AnyValue) (any, error) {
	switch attr.GetValue().(type) {
	case *commonv11.AnyValue_StringValue:
		return attr.GetStringValue(), nil
	case *commonv11.AnyValue_IntValue:
		return attr.GetIntValue(), nil
	case *commonv11.AnyValue_BoolValue:
		return attr.GetBoolValue(), nil
	case *commonv11.AnyValue_DoubleValue:
		return attr.GetDoubleValue(), nil
	case *commonv11.AnyValue_KvlistValue:
		return kvListAsString(attr.GetKvlistValue())
	case *commonv11.AnyValue_ArrayValue:
		return arrayAsString(attr.GetArrayValue())
	default:
		return attr.GetStringValue(), nil
	}
}

func arrayAsString(list *commonv11.ArrayValue) (string, error) {
	vals := make([]any, len(list.GetValues()))

	for i, val := range list.GetValues() {
		v, err := getAttributeVal(val)
		if err != nil {
			return "", fmt.Errorf("failed to get attribute value: %w", err)
		}
		vals[i] = v
	}

	res, err := json.Marshal(vals)
	if err != nil {
		return "", fmt.Errorf("failed to marshal array: %w", err)
	}
	return string(res), nil
}

func kvListAsString(list *commonv11.KeyValueList) (string, error) {
	vals := make(map[string]any, len(list.GetValues()))

	for _, val := range list.GetValues() {
		v, err := getAttributeVal(val.GetValue())
		if err != nil {
			return "", fmt.Errorf("failed to get attribute value: %w", err)
		}
		vals[val.GetKey()] = v
	}

	res, err := json.Marshal(vals)
	if err != nil {
		return "", fmt.Errorf("failed to marshal kvlist: %w", err)
	}
	return string(res), nil
}

func getSpanTags(span *tracev11.Span) []*KeyValue {
	tags := make([]*KeyValue, len(span.Attributes))
	for i, attr := range span.Attributes {
		val, err := getAttributeVal(attr.Value)
		if err != nil {
			logger.Debug("error transforming span tags", "err", err)
		}
		tags[i] = &KeyValue{Key: attr.Key, Value: val}
	}
	return tags
}

func getScopeTags(scope *commonv11.InstrumentationScope) []*KeyValue {
	if scope == nil || len(scope.Attributes) == 0 {
		return nil
	}

	tags := make([]*KeyValue, len(scope.Attributes))
	for i, attr := range scope.Attributes {
		val, err := getAttributeVal(attr.Value)
		if err != nil {
			logger.Debug("error transforming scope attributes", "err", err)
		}
		tags[i] = &KeyValue{Key: attr.Key, Value: val}
	}
	return tags
}

func getSpanKind(spanKind tracev11.Span_SpanKind) string {
	var tagStr string
	switch spanKind {
	case tracev11.Span_SPAN_KIND_CLIENT:
		tagStr = string(OpenTracingSpanKindClient)
	case tracev11.Span_SPAN_KIND_SERVER:
		tagStr = string(OpenTracingSpanKindServer)
	case tracev11.Span_SPAN_KIND_PRODUCER:
		tagStr = string(OpenTracingSpanKindProducer)
	case tracev11.Span_SPAN_KIND_CONSUMER:
		tagStr = string(OpenTracingSpanKindConsumer)
	case tracev11.Span_SPAN_KIND_INTERNAL:
		tagStr = string(OpenTracingSpanKindInternal)
	default:
		return ""
	}

	return tagStr
}

func spanEventsToLogs(events []*tracev11.Span_Event) []*TraceLog {
	if len(events) == 0 {
		return nil
	}

	logs := make([]*TraceLog, 0, len(events))
	for i := 0; i < len(events); i++ {
		event := events[i]
		fields := make([]*KeyValue, 0, len(event.Attributes)+1)
		for _, attr := range event.Attributes {
			val, err := getAttributeVal(attr.Value)
			if err != nil {
				logger.Debug("error transforming span events to logs", "err", err)
			}
			fields = append(fields, &KeyValue{Key: attr.Key, Value: val})
		}
		logs = append(logs, &TraceLog{
			Timestamp: float64(event.TimeUnixNano) / 1_000_000,
			Fields:    fields,
			Name:      event.Name,
		})
	}

	return logs
}

func spanLinksToReferences(links []*tracev11.Span_Link) []*TraceReference {
	if len(links) == 0 {
		return nil
	}

	references := make([]*TraceReference, 0, len(links))
	for i := 0; i < len(links); i++ {
		link := links[i]

		traceID := link.TraceId
		traceIDHex := hex.EncodeToString(traceID[:])
		traceIDHex = strings.TrimLeft(traceIDHex, "0")

		spanID := link.SpanId
		spanIDHex := hex.EncodeToString(spanID[:])

		tags := make([]*KeyValue, 0, len(link.Attributes))
		for _, attr := range link.Attributes {
			val, err := getAttributeVal(attr.Value)
			if err != nil {
				logger.Debug("error transforming span links to references", "err", err)
			}
			tags = append(tags, &KeyValue{Key: attr.Key, Value: val})
		}

		references = append(references, &TraceReference{
			TraceID: traceIDHex,
			SpanID:  spanIDHex,
			Tags:    tags,
		})
	}

	return references
}

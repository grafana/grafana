package tempo

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/collector/pdata/pcommon"
	"go.opentelemetry.io/collector/pdata/ptrace"
	semconv "go.opentelemetry.io/otel/semconv/v1.18.0"
)

// Some of the keys used to represent OTLP constructs as tags or annotations in other formats.
const (
	TagMessage = "message"

	TagSpanKind = "span.kind"

	TagStatusCode    = "status.code"
	TagStatusMsg     = "status.message"
	TagError         = "error"
	TagHTTPStatusMsg = "http.status_message"

	TagW3CTraceState = "w3c.tracestate"
)

// Constants used for signifying batch-level attribute values where not supplied by OTLP data but required
// by other protocols.
const (
	ResourceNoServiceName = "OTLPResourceNoServiceName"
)

// OpenTracingSpanKind are possible values for TagSpanKind and match the OpenTracing
// conventions: https://github.com/opentracing/specification/blob/main/semantic_conventions.md
// These values are used for representing span kinds that have no
// equivalents in OpenCensus format. They are stored as values of TagSpanKind
type OpenTracingSpanKind string

const (
	OpenTracingSpanKindUnspecified OpenTracingSpanKind = ""
	OpenTracingSpanKindClient      OpenTracingSpanKind = "client"
	OpenTracingSpanKindServer      OpenTracingSpanKind = "server"
	OpenTracingSpanKindConsumer    OpenTracingSpanKind = "consumer"
	OpenTracingSpanKindProducer    OpenTracingSpanKind = "producer"
	OpenTracingSpanKindInternal    OpenTracingSpanKind = "internal"
)

type KeyValue struct {
	Value interface{} `json:"value"`
	Key   string      `json:"key"`
}

type TraceLog struct {
	// Millisecond epoch time
	Timestamp float64     `json:"timestamp"`
	Fields    []*KeyValue `json:"fields"`
}

type TraceReference struct {
	SpanID  string      `json:"spanID"`
	TraceID string      `json:"traceID"`
	Tags    []*KeyValue `json:"tags"`
}

func TraceToFrame(td ptrace.Traces) (*data.Frame, error) {
	// In open telemetry format the spans are grouped first by resource/service they originated in and inside that
	// resource they are grouped by the instrumentation library which created them.

	resourceSpans := td.ResourceSpans()

	if resourceSpans.Len() == 0 {
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
			data.NewField("serviceTags", nil, []json.RawMessage{}),
			data.NewField("startTime", nil, []float64{}),
			data.NewField("duration", nil, []float64{}),
			data.NewField("logs", nil, []json.RawMessage{}),
			data.NewField("references", nil, []json.RawMessage{}),
			data.NewField("tags", nil, []json.RawMessage{}),
		},
		Meta: &data.FrameMeta{
			// TODO: use constant once available in the SDK
			PreferredVisualization: "trace",
		},
	}

	for i := 0; i < resourceSpans.Len(); i++ {
		rs := resourceSpans.At(i)
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
func resourceSpansToRows(rs ptrace.ResourceSpans) ([][]interface{}, error) {
	resource := rs.Resource()
	ilss := rs.ScopeSpans()

	if resource.Attributes().Len() == 0 || ilss.Len() == 0 {
		return [][]interface{}{}, nil
	}

	// Approximate the number of the spans as the number of the spans in the first
	// instrumentation library info.
	rows := make([][]interface{}, 0, ilss.At(0).Spans().Len())

	for i := 0; i < ilss.Len(); i++ {
		ils := ilss.At(i)

		// These are finally the actual spans
		spans := ils.Spans()

		for j := 0; j < spans.Len(); j++ {
			span := spans.At(j)
			row, err := spanToSpanRow(span, ils.Scope(), resource)
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

func spanToSpanRow(span ptrace.Span, libraryTags pcommon.InstrumentationScope, resource pcommon.Resource) ([]interface{}, error) {
	// If the id representation changed from hexstring to something else we need to change the transformBase64IDToHexString in the frontend code
	traceID := span.TraceID().HexString()
	traceID = strings.TrimPrefix(traceID, strings.Repeat("0", 16))

	spanID := span.SpanID().HexString()

	parentSpanID := span.ParentSpanID().HexString()
	startTime := float64(span.StartTimestamp()) / 1_000_000
	serviceName, serviceTags := resourceToProcess(resource)

	serviceTagsJson, err := json.Marshal(serviceTags)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal service tags: %w", err)
	}

	spanTags, err := json.Marshal(getSpanTags(span, libraryTags))
	if err != nil {
		return nil, fmt.Errorf("failed to marshal span tags: %w", err)
	}

	logs, err := json.Marshal(spanEventsToLogs(span.Events()))
	if err != nil {
		return nil, fmt.Errorf("failed to marshal span logs: %w", err)
	}

	references, err := json.Marshal(spanLinksToReferences(span.Links()))

	if err != nil {
		return nil, fmt.Errorf("failed to marshal span links: %w", err)
	}

	// Order matters (look at dataframe order)
	return []interface{}{
		traceID,
		spanID,
		parentSpanID,
		span.Name(),
		serviceName,
		json.RawMessage(serviceTagsJson),
		startTime,
		float64(span.EndTimestamp()-span.StartTimestamp()) / 1_000_000,
		json.RawMessage(logs),
		json.RawMessage(references),
		json.RawMessage(spanTags),
	}, nil
}

func resourceToProcess(resource pcommon.Resource) (string, []*KeyValue) {
	attrs := resource.Attributes()
	serviceName := ResourceNoServiceName
	if attrs.Len() == 0 {
		return serviceName, nil
	}

	tags := make([]*KeyValue, 0, attrs.Len()-1)
	attrs.Range(func(key string, attr pcommon.Value) bool {
		if key == string(semconv.ServiceNameKey) {
			serviceName = attr.Str()
		}
		tags = append(tags, &KeyValue{Key: key, Value: getAttributeVal(attr)})
		return true
	})

	return serviceName, tags
}

func getAttributeVal(attr pcommon.Value) interface{} {
	switch attr.Type() {
	case pcommon.ValueTypeStr:
		return attr.Str()
	case pcommon.ValueTypeInt:
		return attr.Int()
	case pcommon.ValueTypeBool:
		return attr.Bool()
	case pcommon.ValueTypeDouble:
		return attr.Double()
	case pcommon.ValueTypeMap, pcommon.ValueTypeSlice:
		return attr.AsString()
	default:
		return nil
	}
}

func getSpanTags(span ptrace.Span, instrumentationLibrary pcommon.InstrumentationScope) []*KeyValue {
	var tags []*KeyValue

	libraryTags := getTagsFromInstrumentationLibrary(instrumentationLibrary)
	if libraryTags != nil {
		tags = append(tags, libraryTags...)
	}
	span.Attributes().Range(func(key string, attr pcommon.Value) bool {
		tags = append(tags, &KeyValue{Key: key, Value: getAttributeVal(attr)})
		return true
	})

	status := span.Status()
	possibleNilTags := []*KeyValue{
		getTagFromSpanKind(span.Kind()),
		getTagFromStatusCode(status.Code()),
		getErrorTagFromStatusCode(status.Code()),
		getTagFromStatusMsg(status.Message()),
		getTagFromTraceState(span.TraceState()),
	}

	for _, tag := range possibleNilTags {
		if tag != nil {
			tags = append(tags, tag)
		}
	}
	return tags
}

func getTagsFromInstrumentationLibrary(il pcommon.InstrumentationScope) []*KeyValue {
	var keyValues []*KeyValue
	if ilName := il.Name(); ilName != "" {
		kv := &KeyValue{
			Key:   string(semconv.OTelLibraryNameKey),
			Value: ilName,
		}
		keyValues = append(keyValues, kv)
	}
	if ilVersion := il.Version(); ilVersion != "" {
		kv := &KeyValue{
			Key:   string(semconv.OTelLibraryVersionKey),
			Value: ilVersion,
		}
		keyValues = append(keyValues, kv)
	}

	return keyValues
}

func getTagFromSpanKind(spanKind ptrace.SpanKind) *KeyValue {
	var tagStr string
	switch spanKind {
	case ptrace.SpanKindClient:
		tagStr = string(OpenTracingSpanKindClient)
	case ptrace.SpanKindServer:
		tagStr = string(OpenTracingSpanKindServer)
	case ptrace.SpanKindProducer:
		tagStr = string(OpenTracingSpanKindProducer)
	case ptrace.SpanKindConsumer:
		tagStr = string(OpenTracingSpanKindConsumer)
	case ptrace.SpanKindInternal:
		tagStr = string(OpenTracingSpanKindInternal)
	default:
		return nil
	}

	return &KeyValue{
		Key:   TagSpanKind,
		Value: tagStr,
	}
}

func getTagFromStatusCode(statusCode ptrace.StatusCode) *KeyValue {
	return &KeyValue{
		Key:   TagStatusCode,
		Value: int64(statusCode),
	}
}

func getErrorTagFromStatusCode(statusCode ptrace.StatusCode) *KeyValue {
	if statusCode == ptrace.StatusCodeError {
		return &KeyValue{
			Key:   TagError,
			Value: true,
		}
	}
	return nil
}

func getTagFromStatusMsg(statusMsg string) *KeyValue {
	if statusMsg == "" {
		return nil
	}
	return &KeyValue{
		Key:   TagStatusMsg,
		Value: statusMsg,
	}
}

func getTagFromTraceState(traceState pcommon.TraceState) *KeyValue {
	if traceState != pcommon.NewTraceState() {
		return &KeyValue{
			Key:   TagW3CTraceState,
			Value: traceState,
		}
	}
	return nil
}

func spanEventsToLogs(events ptrace.SpanEventSlice) []*TraceLog {
	if events.Len() == 0 {
		return nil
	}

	logs := make([]*TraceLog, 0, events.Len())
	for i := 0; i < events.Len(); i++ {
		event := events.At(i)
		fields := make([]*KeyValue, 0, event.Attributes().Len()+1)
		if event.Name() != "" {
			fields = append(fields, &KeyValue{
				Key:   TagMessage,
				Value: event.Name(),
			})
		}
		event.Attributes().Range(func(key string, attr pcommon.Value) bool {
			fields = append(fields, &KeyValue{Key: key, Value: getAttributeVal(attr)})
			return true
		})
		logs = append(logs, &TraceLog{
			Timestamp: float64(event.Timestamp()) / 1_000_000,
			Fields:    fields,
		})
	}

	return logs
}

func spanLinksToReferences(links ptrace.SpanLinkSlice) []*TraceReference {
	if links.Len() == 0 {
		return nil
	}

	references := make([]*TraceReference, 0, links.Len())
	for i := 0; i < links.Len(); i++ {
		link := links.At(i)

		traceId := link.TraceID().HexString()
		traceId = strings.TrimLeft(traceId, "0")

		spanId := link.SpanID().HexString()

		tags := make([]*KeyValue, 0, link.Attributes().Len())
		link.Attributes().Range(func(key string, attr pcommon.Value) bool {
			tags = append(tags, &KeyValue{Key: key, Value: getAttributeVal(attr)})
			return true
		})

		references = append(references, &TraceReference{
			TraceID: traceId,
			SpanID:  spanId,
			Tags:    tags,
		})
	}

	return references
}

package tempo

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/collector/pdata/pcommon"
	"go.opentelemetry.io/collector/pdata/ptrace"
	"go.opentelemetry.io/otel/attribute"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"

	"gonum.org/v1/gonum/stat"
)

type KeyValue struct {
	Value any    `json:"value"`
	Key   string `json:"key"`
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

type Children []ChildrenMetrics

type ChildrenMetrics struct {
	Name      string
	Count     int
	Min       int
	Max       int
	Avg       int
	StdDev    int
	MinSpanID pcommon.SpanID
	MaxSpanID pcommon.SpanID
	Durations []float64
}

func TraceToFrame(td ptrace.Traces, limit int) (*data.Frame, error) {
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
			data.NewField("childrenMetrics", nil, []json.RawMessage{}),
		},
		Meta: &data.FrameMeta{
			// TODO: use constant once available in the SDK
			PreferredVisualization: "trace",
		},
	}

	parentToChildrenMetrics := map[uint32]Children{}

	// generate children metrics
	for i := 0; i < resourceSpans.Len(); i++ {
		rs := resourceSpans.At(i)
		ilss := rs.ScopeSpans()
		for j := 0; j < ilss.Len(); j++ {
			ils := ilss.At(j)
			spans := ils.Spans()
			for k := 0; k < spans.Len(); k++ {
				span := spans.At(k)
				spanID := span.SpanID()
				parentSpanID := span.ParentSpanID()
				parentSpanIDKey := tokenForSpanID(parentSpanID[:])
				durationInt := int(span.EndTimestamp() - span.StartTimestamp())
				if len(parentSpanID) == 0 {
					continue
				}

				children, ok := parentToChildrenMetrics[parentSpanIDKey]
				// newly recorded parent
				if ok {
					// update existing parent

					// find the child with the same name
					childIndex := findChildrenByName(children, span.Name())
					// if the child does not exist, create a new one
					if childIndex == -1 {
						child := ChildrenMetrics{
							Name:      span.Name(),
							Count:     1,
							Min:       durationInt,
							Max:       durationInt,
							StdDev:    0,
							MinSpanID: spanID,
							MaxSpanID: spanID,
							Durations: []float64{float64(durationInt)},
						}
						children = append(children, child)
						parentToChildrenMetrics[parentSpanIDKey] = children
					} else {
						// update existing child
						child := children[childIndex]
						child.Count++
						child.Durations = append(child.Durations, float64(durationInt))
						if durationInt < child.Min {
							child.Min = durationInt
							child.MinSpanID = spanID
						}
						if durationInt > child.Max {
							child.Max = durationInt
							child.MaxSpanID = spanID
						}
						children[childIndex] = child
					}
				} else {
					child := ChildrenMetrics{
						Name:      span.Name(),
						Count:     1,
						Min:       durationInt,
						Max:       durationInt,
						MinSpanID: spanID,
						MaxSpanID: spanID,
						Durations: []float64{float64(durationInt)},
					}
					parentToChildrenMetrics[parentSpanIDKey] = Children{child}
				}

			}
		}
	}

	for i := 0; i < resourceSpans.Len(); i++ {
		rs := resourceSpans.At(i)
		rows, err := resourceSpansToRows(rs, limit, parentToChildrenMetrics)
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
func resourceSpansToRows(rs ptrace.ResourceSpans, limit int, parentToChildrenMetrics map[uint32]Children) ([][]any, error) {
	resource := rs.Resource()
	ilss := rs.ScopeSpans()

	if resource.Attributes().Len() == 0 || ilss.Len() == 0 {
		return [][]any{}, nil
	}

	// Approximate the number of the spans as the number of the spans in the first
	// instrumentation library info.
	rows := make([][]any, 0, ilss.At(0).Spans().Len())

	for i := 0; i < ilss.Len(); i++ {
		ils := ilss.At(i)

		// These are finally the actual spans
		spans := ils.Spans()

		for j := 0; j < spans.Len(); j++ {
			span := spans.At(j)
			spanID := span.SpanID()
			// check for children metrics
			childrenMetrics, ok := parentToChildrenMetrics[tokenForSpanID(spanID[:])]
			if !ok {
				childrenMetrics = nil
			}
			row, err := spanToSpanRow(span, ils.Scope(), resource, childrenMetrics, limit)
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

func spanToSpanRow(span ptrace.Span, libraryTags pcommon.InstrumentationScope, resource pcommon.Resource, children Children, childrenLimit int) ([]any, error) {
	// If the id representation changed from hexstring to something else we need to change the transformBase64IDToHexString in the frontend code
	traceID := span.TraceID()
	traceIDHex := hex.EncodeToString(traceID[:])
	traceIDHex = strings.TrimPrefix(traceIDHex, strings.Repeat("0", 16))

	spanID := span.SpanID()
	spanIDHex := hex.EncodeToString(spanID[:])

	parentSpanID := span.ParentSpanID()
	parentSpanIDHex := hex.EncodeToString(parentSpanID[:])

	startTime := float64(span.StartTimestamp()) / 1_000_000
	serviceName, serviceTags := resourceToProcess(resource)

	status := span.Status()
	statusCode := int64(status.Code())
	statusMessage := status.Message()

	libraryName := libraryTags.Name()
	libraryVersion := libraryTags.Version()
	traceState := getTraceState(span.TraceState())

	serviceTagsJson, err := json.Marshal(serviceTags)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal service tags: %w", err)
	}

	spanTags, err := json.Marshal(getSpanTags(span))
	if err != nil {
		return nil, fmt.Errorf("failed to marshal span tags: %w", err)
	}

	logs, err := json.Marshal(spanEventsToLogs(span.Events()))
	if err != nil {
		return nil, fmt.Errorf("failed to marshal span logs: %w", err)
	}

	references, err := json.Marshal(spanLinksToReferences(span.Links()))

	childrenMetrics, err := json.Marshal(getChildrenMetrics(traceIDHex, children, childrenLimit))

	if err != nil {
		return nil, fmt.Errorf("failed to marshal span links: %w", err)
	}

	// Order matters (look at dataframe order)
	return []any{
		traceIDHex,
		spanIDHex,
		parentSpanIDHex,
		span.Name(),
		serviceName,
		getSpanKind(span.Kind()),
		statusCode,
		statusMessage,
		libraryName,
		libraryVersion,
		traceState,
		json.RawMessage(serviceTagsJson),
		startTime,
		float64(span.EndTimestamp()-span.StartTimestamp()) / 1_000_000,
		json.RawMessage(logs),
		json.RawMessage(references),
		json.RawMessage(spanTags),
		json.RawMessage(childrenMetrics),
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
		if attribute.Key(key) == semconv.ServiceNameKey {
			serviceName = attr.Str()
		}
		tags = append(tags, &KeyValue{Key: key, Value: getAttributeVal(attr)})
		return true
	})

	return serviceName, tags
}

func getAttributeVal(attr pcommon.Value) any {
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

func getSpanTags(span ptrace.Span) []*KeyValue {
	var tags []*KeyValue
	span.Attributes().Range(func(key string, attr pcommon.Value) bool {
		tags = append(tags, &KeyValue{Key: key, Value: getAttributeVal(attr)})
		return true
	})
	return tags
}

func getSpanKind(spanKind ptrace.SpanKind) string {
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
		return ""
	}

	return tagStr
}

func getTraceState(traceState pcommon.TraceState) string {
	return traceState.AsRaw()
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

		traceID := link.TraceID()
		traceIDHex := hex.EncodeToString(traceID[:])
		traceIDHex = strings.TrimLeft(traceIDHex, "0")

		spanID := link.SpanID()
		spanIDHex := hex.EncodeToString(spanID[:])

		tags := make([]*KeyValue, 0, link.Attributes().Len())
		link.Attributes().Range(func(key string, attr pcommon.Value) bool {
			tags = append(tags, &KeyValue{Key: key, Value: getAttributeVal(attr)})
			return true
		})

		references = append(references, &TraceReference{
			TraceID: traceIDHex,
			SpanID:  spanIDHex,
			Tags:    tags,
		})
	}

	return references
}

func getChildrenMetrics(traceIDHex string, children Children, limit int) []*TraceReference {
	numChildren := 0
	for _, child := range children {
		if child.Count > limit {
			numChildren++
		}
	}
	if numChildren == 0 {
		return nil
	}
	childrenMetrics := make([]*TraceReference, numChildren*5)

	for _, child := range children {
		if child.Count > limit {
			// get avg and std dev
			avg := stat.Mean(child.Durations, nil)
			stdDev := stat.StdDev(child.Durations, nil)
			minDuration := child.Min
			maxDuration := child.Max

			minSpanID := child.MinSpanID
			minSpanIDHex := hex.EncodeToString(minSpanID[:])
			maxSpanID := child.MaxSpanID
			maxSpanIDHex := hex.EncodeToString(maxSpanID[:])
			nilSpanID := pcommon.SpanID{0}
			nilSpanIDHex := hex.EncodeToString(nilSpanID[:])

			childrenMetrics[0] = &TraceReference{
				TraceID: traceIDHex,
				SpanID:  minSpanIDHex,
				Tags: []*KeyValue{
					{Key: "count", Value: child.Count},
					{Key: "name", Value: child.Name},
				},
			}

			childrenMetrics[1] = &TraceReference{
				TraceID: traceIDHex,
				SpanID:  minSpanIDHex,
				Tags: []*KeyValue{
					{Key: "min", Value: printStringDuration(minDuration)},
					{Key: "name", Value: child.Name},
				},
			}

			childrenMetrics[2] = &TraceReference{
				TraceID: traceIDHex,
				SpanID:  maxSpanIDHex,
				Tags: []*KeyValue{
					{Key: "max", Value: printStringDuration(maxDuration)},
					{Key: "name", Value: child.Name},
				},
			}

			childrenMetrics[3] = &TraceReference{
				TraceID: traceIDHex,
				SpanID:  nilSpanIDHex,
				Tags: []*KeyValue{
					{Key: "avg", Value: printStringDuration(int(avg))},
					{Key: "name", Value: child.Name},
				},
			}

			childrenMetrics[4] = &TraceReference{
				TraceID: traceIDHex,
				SpanID:  nilSpanIDHex,
				Tags: []*KeyValue{
					{Key: "stdev", Value: printStringDuration(int(stdDev))},
					{Key: "name", Value: child.Name},
				},
			}
		}
	}

	return childrenMetrics
}

func tokenForSpanID(b []byte) uint32 {
	h := fnv.New32()
	_, _ = h.Write(b)
	return h.Sum32()
}

func findChildrenByName(children Children, name string) int {
	for i, child := range children {
		if child.Name == name {
			return i
		}
	}
	return -1
}

func parentIndex(id uint32, parentsOrder []uint32) int {
	for i, parent := range parentsOrder {
		if parent == id {
			return i
		}
	}
	return -1
}

func printStringDuration(durationNano int) string {
	if durationNano < 1_000 {
		return fmt.Sprintf("%dns", durationNano)
	}
	if durationNano < 1_000_000 {
		return fmt.Sprintf("%dµs", durationNano/1_000)
	}
	if durationNano < 1_000_000_000 {
		return fmt.Sprintf("%dms", durationNano/1_000_000)
	}
	return fmt.Sprintf("%ds", durationNano/1_000_000_000)
}

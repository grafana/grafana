package types

// gRPC related types as defined in: https://github.com/jaegertracing/jaeger-idl/blob/main/swagger/api_v3/query_service.swagger.json

type GrpcServicesResponse struct {
	Services []string `json:"services"`
}

type GrpcOperationsResponse struct {
	Operations []GrpcOperation `json:"operations"`
}

type GrpcOperation struct {
	Name     string `json:"name"`
	SpanKind string `json:"spanKind"`
}

type GrpcTracesResponse struct {
	Result GrpcTracesResult       `json:"result"`
	Error  GrpcRuntimeStreamError `json:"error"`
}

type GrpcRuntimeStreamError struct {
	GrpcCode   int32         `json:"grpcCode"`
	HttpCode   int           `json:"httpCode"`
	Message    string        `json:"message"`
	HttpStatus string        `json:"httpStatus"`
	Details    []ProtobufAny `json:"details"`
}

type ProtobufAny struct {
	TypeUrl string `json:"typeUrl"`
	Value   string `json:"value"`
}
type GrpcTracesResult struct {
	ResourceSpans []GrpcResourceSpans `json:"resourceSpans"`
}
type GrpcResourceSpans struct {
	Resource   GrpcResource     `json:"resource"`
	ScopeSpans []GrpcScopeSpans `json:"scopeSpans"`
	SchemaURL  string           `json:"schemaUrl"`
}

type GrpcScopeSpans struct {
	Scope     GrpcInstrumentationScope `json:"scope"`
	Spans     []GrpcSpan               `json:"spans"`
	SchemaURL string                   `json:"schemaUrl"`
}

type GrpcInstrumentationScope struct {
	Name                   string         `json:"name"`
	Version                string         `json:"version"`
	Atrributes             []GrpcKeyValue `json:"attributes"`
	DroppedAttributesCount int64          `json:"droppedAttributesCount"`
}

type GrpcSpan struct {
	TraceID                string          `json:"traceId"`
	SpanID                 string          `json:"spanId"`
	TraceState             string          `json:"traceState"`
	ParentSpanID           string          `json:"parentSpanId"`
	Flags                  int64           `json:"flags"`
	Name                   string          `json:"name"`
	Kind                   int64           `json:"kind"` // default SPAN_KIND_UNSPECIFIED
	StartTimeUnixNano      string          `json:"startTimeUnixNano"`
	EndTimeUnixNano        string          `json:"endTimeUnixNano"`
	Attributes             []GrpcKeyValue  `json:"attributes"`
	DroppedAttributesCount int64           `json:"droppedAttributesCount"`
	Events                 []GrpcSpanEvent `json:"events"`
	DroppedEventsCount     int64           `json:"droppedEventsCount"`
	Links                  []GrpcSpanLink  `json:"links"`
	DroppedLinksCount      int64           `json:"droppedLinksCount"`
	Status                 GrpcStatus      `json:"status"`
}

type GrpcSpanEvent struct {
	TimeUnixNano           string         `json:"timeUnixNano"`
	Name                   string         `json:"name"`
	Attributes             []GrpcKeyValue `json:"attributes"`
	DroppedAttributesCount int64          `json:"droppedAttributesCount"`
}

type GrpcSpanLink struct {
	TraceID                string         `json:"traceId"`
	SpanID                 string         `json:"spanId"`
	TraceState             string         `json:"traceState"`
	Attributes             []GrpcKeyValue `json:"attributes"`
	DroppedAttributesCount int64          `json:"droppedAttributesCount"`
	Flags                  int64          `json:"flags"`
}

type GrpcStatus struct {
	Message string `json:"message"`
	Code    int64  `json:"code"` // default STATUS_CODE_UNSET
}

type GrpcResource struct {
	Attributes             []GrpcKeyValue `json:"attributes"`
	DroppedAttributesCount int64          `json:"droppedAttributesCount"`
}

type GrpcKeyValue struct {
	Key   string       `json:"key"`
	Value GrpcAnyValue `json:"value"`
}

type GrpcAnyValue struct {
	StringValue string         `json:"stringValue"`
	BoolValue   string         `json:"boolValue"`
	IntValue    string         `json:"intValue"`
	DoubleValue string         `json:"doubleValue"`
	ArrayValue  GrpcArrayValue `json:"array_value"`
	KvListValue KeyValueList   `json:"kvlistValue"`
	BytesValue  string         `json:"bytesValue"`
}

type GrpcArrayValue struct {
	Values []GrpcAnyValue `json:"values"`
}

type KeyValueList struct {
	Values []GrpcKeyValue `json:"values"`
}

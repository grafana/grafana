package server

import (
	"bytes"
	"compress/gzip"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

func TestHandleAuditLog_Protobuf(t *testing.T) {
	handler := NewHandler(slog.New(slog.NewTextHandler(io.Discard, nil)))

	// Create a sample OTLP logs request
	req := createSampleLogsRequest()

	// Marshal to protobuf
	body, err := proto.Marshal(req)
	if err != nil {
		t.Fatalf("failed to marshal protobuf: %v", err)
	}

	// Create HTTP request
	httpReq := httptest.NewRequest(http.MethodPost, "/auditlog", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", ContentTypeProtobuf)

	// Create response recorder
	rr := httptest.NewRecorder()

	// Handle request
	handler.HandleAuditLog(rr, httpReq)

	// Check response
	if rr.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d: %s", http.StatusOK, rr.Code, rr.Body.String())
	}

	// Verify response content type
	if ct := rr.Header().Get("Content-Type"); ct != ContentTypeProtobuf {
		t.Errorf("expected content type %s, got %s", ContentTypeProtobuf, ct)
	}

	// Verify response can be unmarshaled
	var resp collogspb.ExportLogsServiceResponse
	if err := proto.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Errorf("failed to unmarshal response: %v", err)
	}
}

func TestHandleAuditLog_JSON(t *testing.T) {
	handler := NewHandler(slog.New(slog.NewTextHandler(io.Discard, nil)))

	// Create a sample OTLP logs request
	req := createSampleLogsRequest()

	// Marshal to JSON
	body, err := protojson.Marshal(req)
	if err != nil {
		t.Fatalf("failed to marshal JSON: %v", err)
	}

	// Create HTTP request
	httpReq := httptest.NewRequest(http.MethodPost, "/auditlog", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", ContentTypeJSON)

	// Create response recorder
	rr := httptest.NewRecorder()

	// Handle request
	handler.HandleAuditLog(rr, httpReq)

	// Check response
	if rr.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d: %s", http.StatusOK, rr.Code, rr.Body.String())
	}

	// Verify response content type
	if ct := rr.Header().Get("Content-Type"); ct != ContentTypeJSON {
		t.Errorf("expected content type %s, got %s", ContentTypeJSON, ct)
	}
}

func TestHandleAuditLog_GzipCompressed(t *testing.T) {
	handler := NewHandler(slog.New(slog.NewTextHandler(io.Discard, nil)))

	// Create a sample OTLP logs request
	req := createSampleLogsRequest()

	// Marshal to protobuf
	body, err := proto.Marshal(req)
	if err != nil {
		t.Fatalf("failed to marshal protobuf: %v", err)
	}

	// Compress with gzip
	var compressed bytes.Buffer
	gzipWriter := gzip.NewWriter(&compressed)
	if _, err := gzipWriter.Write(body); err != nil {
		t.Fatalf("failed to write gzip: %v", err)
	}
	if err := gzipWriter.Close(); err != nil {
		t.Fatalf("failed to close gzip writer: %v", err)
	}

	// Create HTTP request
	httpReq := httptest.NewRequest(http.MethodPost, "/auditlog", &compressed)
	httpReq.Header.Set("Content-Type", ContentTypeProtobuf)
	httpReq.Header.Set("Content-Encoding", "gzip")

	// Create response recorder
	rr := httptest.NewRecorder()

	// Handle request
	handler.HandleAuditLog(rr, httpReq)

	// Check response
	if rr.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d: %s", http.StatusOK, rr.Code, rr.Body.String())
	}
}

func TestHandleAuditLog_NoContentType(t *testing.T) {
	handler := NewHandler(slog.New(slog.NewTextHandler(io.Discard, nil)))

	// Create a sample OTLP logs request
	req := createSampleLogsRequest()

	// Marshal to JSON (default when no content type)
	body, err := protojson.Marshal(req)
	if err != nil {
		t.Fatalf("failed to marshal JSON: %v", err)
	}

	// Create HTTP request without Content-Type header
	httpReq := httptest.NewRequest(http.MethodPost, "/auditlog", bytes.NewReader(body))

	// Create response recorder
	rr := httptest.NewRecorder()

	// Handle request
	handler.HandleAuditLog(rr, httpReq)

	// Should default to JSON and succeed
	if rr.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d: %s", http.StatusOK, rr.Code, rr.Body.String())
	}
}

func TestHandleAuditLog_UnsupportedContentType(t *testing.T) {
	handler := NewHandler(slog.New(slog.NewTextHandler(io.Discard, nil)))

	// Create HTTP request with unsupported content type
	httpReq := httptest.NewRequest(http.MethodPost, "/auditlog", bytes.NewReader([]byte("test")))
	httpReq.Header.Set("Content-Type", "text/plain")

	// Create response recorder
	rr := httptest.NewRecorder()

	// Handle request
	handler.HandleAuditLog(rr, httpReq)

	// Should fail with bad request
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestHandleAuditLog_InvalidProtobuf(t *testing.T) {
	handler := NewHandler(slog.New(slog.NewTextHandler(io.Discard, nil)))

	// Create HTTP request with invalid protobuf
	httpReq := httptest.NewRequest(http.MethodPost, "/auditlog", bytes.NewReader([]byte("invalid protobuf data")))
	httpReq.Header.Set("Content-Type", ContentTypeProtobuf)

	// Create response recorder
	rr := httptest.NewRecorder()

	// Handle request
	handler.HandleAuditLog(rr, httpReq)

	// Should fail with bad request
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestHandleAuditLog_InvalidJSON(t *testing.T) {
	handler := NewHandler(slog.New(slog.NewTextHandler(io.Discard, nil)))

	// Create HTTP request with invalid JSON
	httpReq := httptest.NewRequest(http.MethodPost, "/auditlog", bytes.NewReader([]byte("invalid json")))
	httpReq.Header.Set("Content-Type", ContentTypeJSON)

	// Create response recorder
	rr := httptest.NewRecorder()

	// Handle request
	handler.HandleAuditLog(rr, httpReq)

	// Should fail with bad request
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestHandleAuditLog_EmptyRequest(t *testing.T) {
	handler := NewHandler(slog.New(slog.NewTextHandler(io.Discard, nil)))

	// Create empty OTLP logs request
	req := &collogspb.ExportLogsServiceRequest{}

	// Marshal to protobuf
	body, err := proto.Marshal(req)
	if err != nil {
		t.Fatalf("failed to marshal protobuf: %v", err)
	}

	// Create HTTP request
	httpReq := httptest.NewRequest(http.MethodPost, "/auditlog", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", ContentTypeProtobuf)

	// Create response recorder
	rr := httptest.NewRecorder()

	// Handle request
	handler.HandleAuditLog(rr, httpReq)

	// Should succeed
	if rr.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d: %s", http.StatusOK, rr.Code, rr.Body.String())
	}
}

func TestHandleAuditLog_MultipleLogRecords(t *testing.T) {
	handler := NewHandler(slog.New(slog.NewTextHandler(io.Discard, nil)))

	// Create request with multiple log records
	req := &collogspb.ExportLogsServiceRequest{
		ResourceLogs: []*logspb.ResourceLogs{
			{
				Resource: &resourcepb.Resource{
					Attributes: []*commonpb.KeyValue{
						{Key: "service.name", Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: "test-service"}}},
					},
				},
				ScopeLogs: []*logspb.ScopeLogs{
					{
						Scope: &commonpb.InstrumentationScope{
							Name:    "audit-scope",
							Version: "1.0.0",
						},
						LogRecords: []*logspb.LogRecord{
							createLogRecord("First audit event", "INFO"),
							createLogRecord("Second audit event", "WARN"),
							createLogRecord("Third audit event", "ERROR"),
						},
					},
				},
			},
		},
	}

	// Marshal to protobuf
	body, err := proto.Marshal(req)
	if err != nil {
		t.Fatalf("failed to marshal protobuf: %v", err)
	}

	// Create HTTP request
	httpReq := httptest.NewRequest(http.MethodPost, "/auditlog", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", ContentTypeProtobuf)

	// Create response recorder
	rr := httptest.NewRecorder()

	// Handle request
	handler.HandleAuditLog(rr, httpReq)

	// Should succeed
	if rr.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d: %s", http.StatusOK, rr.Code, rr.Body.String())
	}
}

func TestAnyValueToInterface(t *testing.T) {
	tests := []struct {
		name     string
		input    *commonpb.AnyValue
		expected any
	}{
		{
			name:     "nil value",
			input:    nil,
			expected: nil,
		},
		{
			name:     "string value",
			input:    &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: "test"}},
			expected: "test",
		},
		{
			name:     "bool value true",
			input:    &commonpb.AnyValue{Value: &commonpb.AnyValue_BoolValue{BoolValue: true}},
			expected: true,
		},
		{
			name:     "bool value false",
			input:    &commonpb.AnyValue{Value: &commonpb.AnyValue_BoolValue{BoolValue: false}},
			expected: false,
		},
		{
			name:     "int value",
			input:    &commonpb.AnyValue{Value: &commonpb.AnyValue_IntValue{IntValue: 42}},
			expected: int64(42),
		},
		{
			name:     "double value",
			input:    &commonpb.AnyValue{Value: &commonpb.AnyValue_DoubleValue{DoubleValue: 3.14}},
			expected: 3.14,
		},
		{
			name:     "bytes value",
			input:    &commonpb.AnyValue{Value: &commonpb.AnyValue_BytesValue{BytesValue: []byte("hello")}},
			expected: []byte("hello"),
		},
		{
			name: "array value",
			input: &commonpb.AnyValue{Value: &commonpb.AnyValue_ArrayValue{ArrayValue: &commonpb.ArrayValue{
				Values: []*commonpb.AnyValue{
					{Value: &commonpb.AnyValue_StringValue{StringValue: "a"}},
					{Value: &commonpb.AnyValue_StringValue{StringValue: "b"}},
				},
			}}},
			expected: []any{"a", "b"},
		},
		{
			name:     "nil array value",
			input:    &commonpb.AnyValue{Value: &commonpb.AnyValue_ArrayValue{ArrayValue: nil}},
			expected: nil,
		},
		{
			name: "kvlist value",
			input: &commonpb.AnyValue{Value: &commonpb.AnyValue_KvlistValue{KvlistValue: &commonpb.KeyValueList{
				Values: []*commonpb.KeyValue{
					{Key: "key1", Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: "value1"}}},
					{Key: "key2", Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_IntValue{IntValue: 123}}},
				},
			}}},
			expected: map[string]any{"key1": "value1", "key2": int64(123)},
		},
		{
			name:     "nil kvlist value",
			input:    &commonpb.AnyValue{Value: &commonpb.AnyValue_KvlistValue{KvlistValue: nil}},
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := anyValueToInterface(tt.input)

			// Special handling for slice comparison
			if arr, ok := tt.expected.([]any); ok {
				resultArr, ok := result.([]any)
				if !ok {
					t.Errorf("expected []any, got %T", result)
					return
				}
				if len(arr) != len(resultArr) {
					t.Errorf("expected array length %d, got %d", len(arr), len(resultArr))
					return
				}
				for i, v := range arr {
					if resultArr[i] != v {
						t.Errorf("expected arr[%d] = %v, got %v", i, v, resultArr[i])
					}
				}
				return
			}

			// Special handling for map comparison
			if m, ok := tt.expected.(map[string]any); ok {
				resultMap, ok := result.(map[string]any)
				if !ok {
					t.Errorf("expected map[string]any, got %T", result)
					return
				}
				if len(m) != len(resultMap) {
					t.Errorf("expected map length %d, got %d", len(m), len(resultMap))
					return
				}
				for k, v := range m {
					if resultMap[k] != v {
						t.Errorf("expected map[%s] = %v, got %v", k, v, resultMap[k])
					}
				}
				return
			}

			// Special handling for byte slice comparison
			if b, ok := tt.expected.([]byte); ok {
				resultBytes, ok := result.([]byte)
				if !ok {
					t.Errorf("expected []byte, got %T", result)
					return
				}
				if string(b) != string(resultBytes) {
					t.Errorf("expected %v, got %v", b, resultBytes)
				}
				return
			}

			if result != tt.expected {
				t.Errorf("expected %v (%T), got %v (%T)", tt.expected, tt.expected, result, result)
			}
		})
	}
}

func TestParseLogsRequest(t *testing.T) {
	handler := NewHandler(slog.New(slog.NewTextHandler(io.Discard, nil)))

	req := createSampleLogsRequest()

	// Test protobuf parsing
	protoBody, _ := proto.Marshal(req)
	parsed, err := handler.parseLogsRequest(ContentTypeProtobuf, protoBody)
	if err != nil {
		t.Errorf("failed to parse protobuf: %v", err)
	}
	if len(parsed.GetResourceLogs()) != 1 {
		t.Errorf("expected 1 resource log, got %d", len(parsed.GetResourceLogs()))
	}

	// Test JSON parsing
	jsonBody, _ := protojson.Marshal(req)
	parsed, err = handler.parseLogsRequest(ContentTypeJSON, jsonBody)
	if err != nil {
		t.Errorf("failed to parse JSON: %v", err)
	}
	if len(parsed.GetResourceLogs()) != 1 {
		t.Errorf("expected 1 resource log, got %d", len(parsed.GetResourceLogs()))
	}

	// Test default (empty content type) parsing
	parsed, err = handler.parseLogsRequest("", jsonBody)
	if err != nil {
		t.Errorf("failed to parse with empty content type: %v", err)
	}
	if len(parsed.GetResourceLogs()) != 1 {
		t.Errorf("expected 1 resource log, got %d", len(parsed.GetResourceLogs()))
	}

	// Test unsupported content type
	_, err = handler.parseLogsRequest("text/xml", []byte("<xml/>"))
	if err == nil {
		t.Error("expected error for unsupported content type")
	}
}

// Helper functions

func createSampleLogsRequest() *collogspb.ExportLogsServiceRequest {
	return &collogspb.ExportLogsServiceRequest{
		ResourceLogs: []*logspb.ResourceLogs{
			{
				Resource: &resourcepb.Resource{
					Attributes: []*commonpb.KeyValue{
						{
							Key:   "service.name",
							Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: "audit-service"}},
						},
						{
							Key:   "host.name",
							Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: "test-host"}},
						},
					},
				},
				ScopeLogs: []*logspb.ScopeLogs{
					{
						Scope: &commonpb.InstrumentationScope{
							Name:    "audit",
							Version: "1.0.0",
						},
						LogRecords: []*logspb.LogRecord{
							createLogRecord("User login successful", "INFO"),
						},
					},
				},
			},
		},
	}
}

func createLogRecord(body string, severity string) *logspb.LogRecord {
	return &logspb.LogRecord{
		TimeUnixNano:   uint64(time.Now().UnixNano()),
		SeverityText:   severity,
		SeverityNumber: logspb.SeverityNumber_SEVERITY_NUMBER_INFO,
		Body:           &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: body}},
		Attributes: []*commonpb.KeyValue{
			{
				Key:   "audit",
				Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_BoolValue{BoolValue: true}},
			},
			{
				Key:   "user.id",
				Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: "user-123"}},
			},
			{
				Key:   "action",
				Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: "login"}},
			},
		},
	}
}

package server

import (
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"

	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

const (
	// ContentTypeProtobuf is the MIME type for binary protobuf.
	ContentTypeProtobuf = "application/x-protobuf"

	// ContentTypeJSON is the MIME type for JSON.
	ContentTypeJSON = "application/json"

	// MaxBodySize is the maximum request body size (10MB).
	MaxBodySize = 10 * 1024 * 1024
)

// Handler handles audit log HTTP requests.
type Handler struct {
	logger *slog.Logger
}

// NewHandler creates a new audit log handler.
func NewHandler(logger *slog.Logger) *Handler {
	return &Handler{
		logger: logger,
	}
}

// HandleAuditLog handles incoming OTLP log requests.
// It accepts both binary protobuf and JSON formats based on the Content-Type header.
func (h *Handler) HandleAuditLog(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Create a logger with request context
	logger := h.logger.With(
		"method", r.Method,
		"path", r.URL.Path,
		"content_type", r.Header.Get("Content-Type"),
	)

	logger.Debug("handling audit log request")

	// Limit request body size
	r.Body = http.MaxBytesReader(w, r.Body, MaxBodySize)

	// Read and potentially decompress the body
	body, err := h.readBody(r)
	if err != nil {
		logger.Error("failed to read request body", "error", err)
		http.Error(w, "failed to read request body", http.StatusBadRequest)
		return
	}

	// Parse the request based on Content-Type
	logsRequest, err := h.parseLogsRequest(r.Header.Get("Content-Type"), body)
	if err != nil {
		logger.Error("failed to parse logs request", "error", err)
		http.Error(w, fmt.Sprintf("failed to parse logs request: %v", err), http.StatusBadRequest)
		return
	}

	// Process the logs with context
	if err := h.processLogs(ctx, logger, logsRequest); err != nil {
		logger.Error("failed to process logs", "error", err)
		http.Error(w, "failed to process logs", http.StatusInternalServerError)
		return
	}

	logger.Debug("audit log request processed successfully")

	// Return success response
	response := &collogspb.ExportLogsServiceResponse{}
	h.writeResponse(w, r.Header.Get("Content-Type"), response)
}

// readBody reads the request body, handling gzip compression if present.
func (h *Handler) readBody(r *http.Request) ([]byte, error) {
	var reader io.Reader = r.Body
	defer r.Body.Close()

	// Handle gzip-compressed requests
	if r.Header.Get("Content-Encoding") == "gzip" {
		gzipReader, err := gzip.NewReader(r.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to create gzip reader: %w", err)
		}
		defer gzipReader.Close()
		reader = gzipReader
	}

	return io.ReadAll(reader)
}

// parseLogsRequest parses the logs request based on the content type.
func (h *Handler) parseLogsRequest(contentType string, body []byte) (*collogspb.ExportLogsServiceRequest, error) {
	request := &collogspb.ExportLogsServiceRequest{}

	switch contentType {
	case ContentTypeProtobuf:
		if err := proto.Unmarshal(body, request); err != nil {
			return nil, fmt.Errorf("failed to unmarshal protobuf: %w", err)
		}
	case ContentTypeJSON, "":
		// Default to JSON if no content type is specified
		if err := protojson.Unmarshal(body, request); err != nil {
			return nil, fmt.Errorf("failed to unmarshal JSON: %w", err)
		}
	default:
		return nil, fmt.Errorf("unsupported content type: %s (expected %s or %s)", contentType, ContentTypeProtobuf, ContentTypeJSON)
	}

	return request, nil
}

// processLogs processes the incoming logs.
// This is where you would add your business logic for handling audit logs.
func (h *Handler) processLogs(ctx context.Context, logger *slog.Logger, request *collogspb.ExportLogsServiceRequest) error {
	// Check for context cancellation
	if ctx.Err() != nil {
		return ctx.Err()
	}

	resourceLogs := request.GetResourceLogs()
	totalLogRecords := 0

	for _, rl := range resourceLogs {
		resource := rl.GetResource()
		resourceAttrs := make(map[string]any)
		for _, attr := range resource.GetAttributes() {
			resourceAttrs[attr.GetKey()] = anyValueToInterface(attr.GetValue())
		}

		for _, scopeLog := range rl.GetScopeLogs() {
			scope := scopeLog.GetScope()
			scopeName := scope.GetName()
			scopeVersion := scope.GetVersion()

			for _, logRecord := range scopeLog.GetLogRecords() {
				// Check for context cancellation during processing
				if ctx.Err() != nil {
					return ctx.Err()
				}

				totalLogRecords++

				logAttrs := make(map[string]any)
				for _, attr := range logRecord.GetAttributes() {
					logAttrs[attr.GetKey()] = anyValueToInterface(attr.GetValue())
				}

				logger.Info("received audit log",
					"severity", logRecord.GetSeverityText(),
					"body", anyValueToInterface(logRecord.GetBody()),
					"timestamp", logRecord.GetTimeUnixNano(),
					"scope_name", scopeName,
					"scope_version", scopeVersion,
					"resource_attributes", resourceAttrs,
					"log_attributes", logAttrs,
				)
			}
		}
	}

	// Record the number of logs received for metrics
	RecordLogsReceived(totalLogRecords)

	logger.Debug("processed log records", "count", totalLogRecords)

	return nil
}

// anyValueToInterface converts an OTLP AnyValue to a Go interface{}.
func anyValueToInterface(v *commonpb.AnyValue) any {
	if v == nil {
		return nil
	}

	switch val := v.Value.(type) {
	case *commonpb.AnyValue_StringValue:
		return val.StringValue
	case *commonpb.AnyValue_BoolValue:
		return val.BoolValue
	case *commonpb.AnyValue_IntValue:
		return val.IntValue
	case *commonpb.AnyValue_DoubleValue:
		return val.DoubleValue
	case *commonpb.AnyValue_BytesValue:
		return val.BytesValue
	case *commonpb.AnyValue_ArrayValue:
		if val.ArrayValue == nil {
			return nil
		}
		arr := make([]any, len(val.ArrayValue.Values))
		for i, elem := range val.ArrayValue.Values {
			arr[i] = anyValueToInterface(elem)
		}
		return arr
	case *commonpb.AnyValue_KvlistValue:
		if val.KvlistValue == nil {
			return nil
		}
		m := make(map[string]any)
		for _, kv := range val.KvlistValue.Values {
			m[kv.GetKey()] = anyValueToInterface(kv.GetValue())
		}
		return m
	default:
		return nil
	}
}

// writeResponse writes the response in the appropriate format.
func (h *Handler) writeResponse(w http.ResponseWriter, contentType string, response *collogspb.ExportLogsServiceResponse) {
	switch contentType {
	case ContentTypeProtobuf:
		w.Header().Set("Content-Type", ContentTypeProtobuf)
		data, err := proto.Marshal(response)
		if err != nil {
			h.logger.Error("failed to marshal protobuf response", "error", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		_, _ = w.Write(data)
	default:
		// Default to JSON
		w.Header().Set("Content-Type", ContentTypeJSON)
		data, err := json.Marshal(map[string]any{})
		if err != nil {
			h.logger.Error("failed to marshal JSON response", "error", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		_, _ = w.Write(data)
	}
}

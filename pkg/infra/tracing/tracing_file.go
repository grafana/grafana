package tracing

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"go.opentelemetry.io/collector/pdata/ptrace"
	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	// defaultTraceFileMaxSize bounds the capture file so an enabled-and-forgotten
	// exporter can't fill the disk on a production box.
	defaultTraceFileMaxSize = int64(100 * 1024 * 1024) // 100 MiB
	// defaultTraceCaptureDuration stops the capture some time after startup so a
	// reproduction window is bounded even if the operator walks away.
	defaultTraceCaptureDuration = 10 * time.Minute
)

// fileClient is an otlptrace.Client that writes OTLP/JSON to a local file
// instead of shipping spans to a collector. It lets an operator capture
// Grafana's own traces for support without running any tracing backend: enable
// it, reproduce the issue, then collect the file (e.g. upload to Grafana via
// Explore → Import trace).
//
// otlptrace.New performs the ReadOnlySpan -> OTLP-proto transform before
// calling UploadTraces, so this client only has to encode the proto spans as
// OTLP/JSON and append them to a bounded file.
type fileClient struct {
	mu     sync.Mutex
	writer *boundedFileWriter

	protoUnmarshaler ptrace.ProtoUnmarshaler
	jsonMarshaler    ptrace.JSONMarshaler
}

func newFileClient(cfg *TracingConfig, logger log.Logger) (*fileClient, error) {
	w, err := newBoundedFileWriter(cfg.FilePath, cfg.FileMaxSize, cfg.FileCaptureDuration, logger)
	if err != nil {
		return nil, err
	}
	return &fileClient{writer: w}, nil
}

func (c *fileClient) Start(_ context.Context) error { return nil }

func (c *fileClient) Stop(_ context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.writer.Close()
}

func (c *fileClient) UploadTraces(_ context.Context, protoSpans []*tracepb.ResourceSpans) error {
	// The OTLP/JSON spec requires hex-encoded trace/span IDs. Raw protojson
	// would base64-encode them, so round-trip through pdata, whose JSON
	// marshaler is spec-compliant.
	protoBytes, err := proto.Marshal(&coltracepb.ExportTraceServiceRequest{ResourceSpans: protoSpans})
	if err != nil {
		return fmt.Errorf("marshaling OTLP proto: %w", err)
	}
	traces, err := c.protoUnmarshaler.UnmarshalTraces(protoBytes)
	if err != nil {
		return fmt.Errorf("decoding OTLP proto: %w", err)
	}
	jsonBytes, err := c.jsonMarshaler.MarshalTraces(traces)
	if err != nil {
		return fmt.Errorf("encoding OTLP/JSON: %w", err)
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	return c.writer.WriteRecord(jsonBytes)
}

// boundedFileWriter appends newline-delimited OTLP/JSON records to a file until
// either a byte budget or a wall-clock deadline is reached, whichever comes
// first. It is not safe for concurrent use; fileClient serializes access.
type boundedFileWriter struct {
	log      log.Logger
	f        *os.File
	maxSize  int64
	deadline time.Time

	written int64
	done    bool
}

func newBoundedFileWriter(path string, maxSize int64, dur time.Duration, logger log.Logger) (*boundedFileWriter, error) {
	if path == "" {
		return nil, fmt.Errorf("tracing file exporter: path cannot be empty")
	}
	// A non-positive size would turn the disk guard off. Treat that as a
	// configuration error so file capture is disabled instead.
	if maxSize <= 0 {
		return nil, fmt.Errorf("tracing file exporter: max_file_size_bytes must be greater than 0")
	}
	// A non-positive duration would make the capture window expire immediately
	// and silently produce an empty file. Reject it like an invalid size.
	if dur <= 0 {
		return nil, fmt.Errorf("tracing file exporter: capture_duration must be greater than 0")
	}
	dir := filepath.Dir(path)
	// Operators must explicitly provision the capture directory. Creating it
	// here could accidentally place sensitive support artifacts in a broad path.
	info, err := os.Stat(dir)
	if err != nil {
		return nil, fmt.Errorf("checking trace capture directory %q: %w", dir, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("trace capture path parent %q is not a directory", dir)
	}

	// Trace captures can contain request paths, error messages, and attributes,
	// so newly created files are owner-only instead of matching regular logs.
	//nolint:gosec // G304: the capture path is an explicit operator-provided config value (the capture destination)
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
	if err != nil {
		return nil, fmt.Errorf("creating trace capture file %q: %w", path, err)
	}
	if err := f.Chmod(0o600); err != nil {
		_ = f.Close()
		return nil, fmt.Errorf("setting trace capture file permissions %q: %w", path, err)
	}
	logger.Info("Trace capture started", "path", path, "max_file_size_bytes", maxSize, "capture_duration", dur)
	return &boundedFileWriter{
		log:      logger,
		f:        f,
		maxSize:  maxSize,
		deadline: time.Now().Add(dur),
	}, nil
}

func (w *boundedFileWriter) WriteRecord(record []byte) error {
	if w.done {
		return nil
	}
	if !w.deadline.IsZero() && time.Now().After(w.deadline) {
		return w.finish("capture_duration reached")
	}
	// +1 accounts for the trailing newline.
	if w.written+int64(len(record))+1 > w.maxSize {
		return w.finish("max_file_size reached")
	}

	if _, err := w.f.Write(record); err != nil {
		return fmt.Errorf("writing trace record: %w", err)
	}
	if _, err := w.f.Write([]byte{'\n'}); err != nil {
		return fmt.Errorf("writing trace record: %w", err)
	}
	w.written += int64(len(record)) + 1
	return nil
}

// Close flushes and closes the underlying file. Safe to call more than once.
func (w *boundedFileWriter) Close() error {
	return w.finish("shutdown")
}

func (w *boundedFileWriter) finish(reason string) error {
	if w.done {
		return nil
	}
	w.done = true
	w.log.Info("Trace capture finished", "reason", reason, "path", w.f.Name(), "bytes_written", w.written)
	return w.f.Close()
}

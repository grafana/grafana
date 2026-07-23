package tracing

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"

	"github.com/grafana/grafana/pkg/infra/log"
)

func newFileTracingConfig(path string) *TracingConfig {
	cfg := NewEmptyTracingConfig()
	cfg.enabled = fileExporter
	cfg.ServiceName = "grafana"
	cfg.FilePath = path
	cfg.FileMaxSize = defaultTraceFileMaxSize
	cfg.FileCaptureDuration = defaultTraceCaptureDuration
	cfg.Sampler = "const"
	cfg.SamplerParam = 1
	return cfg
}

func TestFileExporter_WritesSpecCompliantOTLPJSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "traces.json")
	ots, err := ProvideService(newFileTracingConfig(path))
	require.NoError(t, err)

	_, span := ots.GetTracerProvider().Tracer("test").Start(context.Background(), "test-span")
	span.End()

	// Shutdown flushes the batch processor and closes the capture file.
	require.NoError(t, ots.GetTracerProvider().Shutdown(t.Context()))

	contents, err := os.ReadFile(path) //nolint:gosec // G304: path is a test-controlled t.TempDir() path
	require.NoError(t, err)
	require.NotEmpty(t, contents, "capture file should not be empty")

	// The file is newline-delimited OTLP/JSON; the first record holds our span.
	var record struct {
		ResourceSpans []struct {
			ScopeSpans []struct {
				Spans []struct {
					TraceID string `json:"traceId"`
					SpanID  string `json:"spanId"`
					Name    string `json:"name"`
				} `json:"spans"`
			} `json:"scopeSpans"`
		} `json:"resourceSpans"`
	}
	firstLine, _, _ := splitFirstLine(contents)
	require.NoError(t, json.Unmarshal(firstLine, &record), "record must be valid OTLP/JSON")

	require.Len(t, record.ResourceSpans, 1)
	require.Len(t, record.ResourceSpans[0].ScopeSpans, 1)
	require.Len(t, record.ResourceSpans[0].ScopeSpans[0].Spans, 1)

	got := record.ResourceSpans[0].ScopeSpans[0].Spans[0]
	assert.Equal(t, "test-span", got.Name)
	// OTLP/JSON requires hex-encoded IDs: 16 bytes -> 32 hex chars, 8 -> 16.
	assert.Len(t, got.TraceID, 32, "traceId must be hex-encoded")
	assert.Len(t, got.SpanID, 16, "spanId must be hex-encoded")
}

func TestFileExporter_DisablesWhenCaptureDirectoryIsUnavailable(t *testing.T) {
	path := filepath.Join(t.TempDir(), "missing", "traces.json")
	cfg := newFileTracingConfig(path)

	ots, err := ProvideService(cfg)
	require.NoError(t, err)

	assert.Equal(t, noopExporter, cfg.enabled)
	assert.NoFileExists(t, path)

	_, span := ots.GetTracerProvider().Tracer("test").Start(context.Background(), "test-span")
	span.End()
	require.NoError(t, ots.GetTracerProvider().Shutdown(t.Context()))
	assert.NoFileExists(t, path)
}

func TestFileExporter_DisablesWhenMaxSizeIsInvalid(t *testing.T) {
	path := filepath.Join(t.TempDir(), "traces.json")
	cfg := newFileTracingConfig(path)
	cfg.FileMaxSize = 0

	ots, err := ProvideService(cfg)
	require.NoError(t, err)

	assert.Equal(t, noopExporter, cfg.enabled)
	assert.NoFileExists(t, path)

	_, span := ots.GetTracerProvider().Tracer("test").Start(context.Background(), "test-span")
	span.End()
	require.NoError(t, ots.GetTracerProvider().Shutdown(t.Context()))
	assert.NoFileExists(t, path)
}

func TestFileExporter_DisablesWhenCaptureDurationIsInvalid(t *testing.T) {
	path := filepath.Join(t.TempDir(), "traces.json")
	cfg := newFileTracingConfig(path)
	cfg.FileCaptureDuration = 0

	ots, err := ProvideService(cfg)
	require.NoError(t, err)

	assert.Equal(t, noopExporter, cfg.enabled)
	assert.NoFileExists(t, path)

	_, span := ots.GetTracerProvider().Tracer("test").Start(context.Background(), "test-span")
	span.End()
	require.NoError(t, ots.GetTracerProvider().Shutdown(t.Context()))
	assert.NoFileExists(t, path)
}

func TestFileExporter_DisablesWhenSamplerIsInvalid(t *testing.T) {
	path := filepath.Join(t.TempDir(), "traces.json")
	cfg := newFileTracingConfig(path)
	cfg.Sampler = "not-a-sampler"

	ots, err := ProvideService(cfg)
	require.NoError(t, err, "an invalid sampler must disable the file exporter, not block startup")
	assert.Equal(t, noopExporter, cfg.enabled)

	_, span := ots.GetTracerProvider().Tracer("test").Start(context.Background(), "test-span")
	span.End()
	require.NoError(t, ots.GetTracerProvider().Shutdown(t.Context()))

	// The capture file is created before the sampler is initialized, so it may
	// exist, but nothing may have been captured.
	if contents, err := os.ReadFile(path); err == nil { //nolint:gosec // G304: path is a test-controlled t.TempDir() path
		assert.Empty(t, contents)
	}
}

func TestFileClient_SkipsUploadsOnceCaptureEnds(t *testing.T) {
	path := filepath.Join(t.TempDir(), "traces.json")
	cfg := newFileTracingConfig(path)
	// Any record is larger than this, so the first upload trips the cap.
	cfg.FileMaxSize = 4

	client, err := newFileClient(cfg, log.New("test"))
	require.NoError(t, err)

	spans := []*tracepb.ResourceSpans{{}}
	require.NoError(t, client.UploadTraces(context.Background(), spans))
	require.True(t, client.writer.Done(), "first upload should trip the size cap")

	// Later batches must be discarded without error or writes.
	require.NoError(t, client.UploadTraces(context.Background(), spans))
	require.NoError(t, client.Stop(context.Background()))

	contents, err := os.ReadFile(path) //nolint:gosec // G304: path is a test-controlled t.TempDir() path
	require.NoError(t, err)
	assert.Empty(t, contents, "no record fits under the cap, so nothing may be written")
}

func TestBoundedFileWriter_StopsAtMaxSize(t *testing.T) {
	path := filepath.Join(t.TempDir(), "bounded.json")
	w, err := newBoundedFileWriter(path, 10, time.Hour, log.New("test"))
	require.NoError(t, err)

	require.NoError(t, w.WriteRecord([]byte("12345")))   // 5 + newline = 6 bytes
	require.NoError(t, w.WriteRecord([]byte("67890")))   // would exceed 10 -> stops
	require.NoError(t, w.WriteRecord([]byte("ignored"))) // no-op after stop
	require.NoError(t, w.Close())

	contents, err := os.ReadFile(path) //nolint:gosec // G304: path is a test-controlled t.TempDir() path
	require.NoError(t, err)
	assert.Equal(t, "12345\n", string(contents), "writer must stop before exceeding max size")
}

func TestBoundedFileWriter_CreatesOwnerOnlyFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "private.json")
	w, err := newBoundedFileWriter(path, defaultTraceFileMaxSize, time.Hour, log.New("test"))
	require.NoError(t, err)
	require.NoError(t, w.Close())

	info, err := os.Stat(path)
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0o600), info.Mode().Perm(), "capture file must be owner-only")
}

func TestBoundedFileWriter_StopsAtDeadline(t *testing.T) {
	path := filepath.Join(t.TempDir(), "deadline.json")
	w, err := newBoundedFileWriter(path, defaultTraceFileMaxSize, time.Hour, log.New("test"))
	require.NoError(t, err)
	// Simulate a capture whose window has already elapsed.
	w.deadline = time.Now().Add(-time.Second)

	require.NoError(t, w.WriteRecord([]byte("too-late")))
	require.NoError(t, w.Close())

	contents, err := os.ReadFile(path) //nolint:gosec // G304: path is a test-controlled t.TempDir() path
	require.NoError(t, err)
	assert.Empty(t, contents, "writer past its deadline must not write")
}

func TestBoundedFileWriter_RejectsInvalidDuration(t *testing.T) {
	path := filepath.Join(t.TempDir(), "traces.json")
	_, err := newBoundedFileWriter(path, defaultTraceFileMaxSize, 0, log.New("test"))
	require.Error(t, err)
	assert.NoFileExists(t, path)
}

func TestBoundedFileWriter_RejectsEmptyPath(t *testing.T) {
	_, err := newBoundedFileWriter("", defaultTraceFileMaxSize, defaultTraceCaptureDuration, log.New("test"))
	require.Error(t, err)
}

func TestBoundedFileWriter_RejectsMissingParentDirectory(t *testing.T) {
	path := filepath.Join(t.TempDir(), "missing", "traces.json")
	_, err := newBoundedFileWriter(path, defaultTraceFileMaxSize, defaultTraceCaptureDuration, log.New("test"))
	require.Error(t, err)
	assert.NoDirExists(t, filepath.Dir(path), "writer must not create capture directories")
}

func TestBoundedFileWriter_RejectsInvalidMaxSize(t *testing.T) {
	path := filepath.Join(t.TempDir(), "traces.json")
	_, err := newBoundedFileWriter(path, 0, defaultTraceCaptureDuration, log.New("test"))
	require.Error(t, err)
	assert.NoFileExists(t, path)
}

func splitFirstLine(b []byte) (line, rest []byte, found bool) {
	for i, c := range b {
		if c == '\n' {
			return b[:i], b[i+1:], true
		}
	}
	return b, nil, false
}

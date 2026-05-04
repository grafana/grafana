package search

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"gocloud.dev/blob/memblob"
)

func setupSnapshotSpanRecorder(t *testing.T) *tracetest.SpanRecorder {
	t.Helper()
	recorder := tracetest.NewSpanRecorder()
	provider := tracesdk.NewTracerProvider(tracesdk.WithSpanProcessor(recorder))
	previous := otel.GetTracerProvider()
	previousTracer := tracer
	otel.SetTracerProvider(provider)
	tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/search")
	t.Cleanup(func() {
		tracer = previousTracer
		otel.SetTracerProvider(previous)
		require.NoError(t, provider.Shutdown(context.Background()))
	})
	return recorder
}

func assertSpanNames(t *testing.T, recorder *tracetest.SpanRecorder, expected ...string) {
	t.Helper()
	seen := map[string]bool{}
	for _, span := range recorder.Ended() {
		seen[span.Name()] = true
	}
	for _, name := range expected {
		assert.True(t, seen[name], "expected span %q; got %v", name, seen)
	}
}

func assertSpanEvents(t *testing.T, recorder *tracetest.SpanRecorder, spanName string, expected ...string) {
	t.Helper()
	for _, span := range recorder.Ended() {
		if span.Name() != spanName {
			continue
		}
		seen := map[string]bool{}
		for _, event := range span.Events() {
			seen[event.Name] = true
		}
		for _, name := range expected {
			assert.True(t, seen[name], "expected event %q on span %q; got %v", name, spanName, seen)
		}
		return
	}
	require.Failf(t, "span not found", "expected span %q", spanName)
}

func TestSnapshotDownloadEmitsSpan(t *testing.T) {
	recorder := setupSnapshotSpanRecorder(t)

	store := &fakeRemoteIndexStore{}
	store.put(makeULID(t, time.Now()), &IndexMeta{
		BuildVersion:   "11.5.0",
		LatestResourceVersion: 42,
		UploadTimestamp:       time.Now(),
	})
	dt := newDownloadTest(t, store)

	_, _, err := dt.run(t)
	require.NoError(t, err)

	assertSpanNames(t, recorder, "search.remote_index_snapshot.download")
}

func TestSnapshotUploadEmitsSpanAndLockEvents(t *testing.T) {
	recorder := setupSnapshotSpanRecorder(t)

	store := &uploadTestStore{}
	be, _ := newTestBleveBackend(t, SnapshotOptions{Store: store})
	key := newTestNsResource()
	idx := newUploadTestIndex(t, be, key, 42)

	require.NoError(t, be.uploadSnapshot(t.Context(), key, idx))

	assertSpanNames(t, recorder, "search.remote_index_snapshot.upload")
	assertSpanEvents(t, recorder, "search.remote_index_snapshot.upload",
		"snapshot.lock.acquire.started",
		"snapshot.lock.acquire.completed",
		"snapshot.lock.release.started",
		"snapshot.lock.release.completed",
	)
}

func TestSnapshotCleanupEmitsSpanAndLockEvents(t *testing.T) {
	recorder := setupSnapshotSpanRecorder(t)

	ctx := t.Context()
	bucket := memblob.OpenBucket(nil)
	t.Cleanup(func() { _ = bucket.Close() })
	store := newTestRemoteIndexStore(t, bucket)
	ns := newTestNsResource()
	now := time.Now()
	seedSnapshot(t, ctx, bucket, ns, makeULID(t, now.Add(-3*time.Hour)), mkMeta("11.5.0", 100, now.Add(-3*time.Hour)))
	seedSnapshot(t, ctx, bucket, ns, makeULID(t, now.Add(-2*time.Hour)), mkMeta("11.5.0", 200, now.Add(-2*time.Hour)))

	be, _ := newCleanupTestBackend(t, store, nil)
	be.runCleanup(ctx)

	assertSpanNames(t, recorder,
		"search.remote_index_snapshot.cleanup",
		"search.remote_index_snapshot.namespace_cleanup",
	)
	assertSpanEvents(t, recorder, "search.remote_index_snapshot.namespace_cleanup",
		"snapshot.lock.acquire.started",
		"snapshot.lock.acquire.completed",
		"snapshot.lock.release.started",
		"snapshot.lock.release.completed",
	)
}

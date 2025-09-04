package tracing_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	tracingmodule "github.com/grafana/grafana/pkg/modules/tracing"
)

// setupTestTracer creates a test tracer with in-memory span recording
func setupTestTracer(t *testing.T) (*tracetest.InMemoryExporter, *trace.TracerProvider, func()) {
	exporter := tracetest.NewInMemoryExporter()
	tp := trace.NewTracerProvider(
		trace.WithSyncer(exporter),
		trace.WithSampler(trace.AlwaysSample()),
	)

	// Set the global tracer provider for the tracing package to use
	otel.SetTracerProvider(tp)

	cleanup := func() {
		err := tp.Shutdown(context.Background())
		require.NoError(t, err)
	}

	return exporter, tp, cleanup
}

// createTracingContext creates a context with a root span to enable tracing
func createTracingContext(t *testing.T, tp *trace.TracerProvider) (context.Context, func()) {
	ctx := context.Background()
	tracer := tp.Tracer("test-tracer")
	ctx, rootSpan := tracer.Start(ctx, "test-root")

	cleanup := func() {
		rootSpan.End()
	}

	return ctx, cleanup
}

func TestNewListener(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	serviceName := "test-service"

	listener := tracingmodule.NewListener(ctx, serviceName)

	require.NotNil(t, listener)
	// We can't directly access private fields, but we can test the behavior
	// by calling methods and checking the results
}

func TestListener_Starting(t *testing.T) {
	t.Parallel()

	exporter, tp, cleanup := setupTestTracer(t)
	defer cleanup()

	ctx, ctxCleanup := createTracingContext(t, tp)
	defer ctxCleanup()

	serviceName := "test-service"
	listener := tracingmodule.NewListener(ctx, serviceName)

	// Call Starting to create a span
	listener.Starting()

	// End the starting span by transitioning to another state
	listener.Running()

	// Give a moment for span to be recorded
	time.Sleep(10 * time.Millisecond)

	spans := exporter.GetSpans()
	require.Len(t, spans, 2)

	// First span should be the New Service span
	newSpan := spans[0]
	require.Equal(t, "New Service", newSpan.Name)

	// Second span should be the Starting Service span
	startingSpan := spans[1]
	require.Equal(t, "Starting Service", startingSpan.Name)
	require.True(t, startingSpan.SpanContext.IsValid())

	// Check that the span has the expected attributes
	found := false
	for _, attr := range startingSpan.Attributes {
		if attr.Key == "grafana.service.name" && attr.Value.AsString() == serviceName {
			found = true
			break
		}
	}
	require.True(t, found, "Expected grafana.service.name attribute not found")
}

func TestListener_Running(t *testing.T) {
	t.Parallel()

	exporter, tp, cleanup := setupTestTracer(t)
	defer cleanup()

	ctx, ctxCleanup := createTracingContext(t, tp)
	defer ctxCleanup()
	serviceName := "test-service"
	listener := tracingmodule.NewListener(ctx, serviceName)

	// Start with Starting state
	listener.Starting()

	// Transition to Running
	listener.Running()

	// End the running span by stopping
	listener.Stopping(services.Running)

	// Give a moment for spans to be recorded
	time.Sleep(10 * time.Millisecond)

	spans := exporter.GetSpans()
	require.Len(t, spans, 3)

	// First span should be the completed New span
	newSpan := spans[0]
	require.Equal(t, "New Service", newSpan.Name)
	require.True(t, newSpan.EndTime.After(newSpan.StartTime))

	// Second span should be the completed Starting span
	startingSpan := spans[1]
	require.Equal(t, "Starting Service", startingSpan.Name)
	require.True(t, startingSpan.EndTime.After(startingSpan.StartTime))

	// Third span should be the Running span (still active)
	runningSpan := spans[2]
	require.Equal(t, "Running Service", runningSpan.Name)
}

func TestListener_Stopping(t *testing.T) {
	t.Parallel()

	exporter, tp, cleanup := setupTestTracer(t)
	defer cleanup()

	ctx, ctxCleanup := createTracingContext(t, tp)
	defer ctxCleanup()
	serviceName := "test-service"
	listener := tracingmodule.NewListener(ctx, serviceName)

	// Start with Running state
	listener.Starting()
	listener.Running()

	// Transition to Stopping
	listener.Stopping(services.Running)

	// End the stopping span by terminating
	listener.Terminated(services.Stopping)

	time.Sleep(10 * time.Millisecond)

	spans := exporter.GetSpans()
	require.Len(t, spans, 5) // New, Starting, Running, Stopping, Parent

	// Check that Stopping span was started (should be the 4th span, index 3)
	stoppingSpan := spans[3]
	require.Equal(t, "Stopping Service", stoppingSpan.Name)
}

func TestListener_Terminated(t *testing.T) {
	t.Parallel()

	exporter, tp, cleanup := setupTestTracer(t)
	defer cleanup()

	ctx, ctxCleanup := createTracingContext(t, tp)
	defer ctxCleanup()
	serviceName := "test-service"
	listener := tracingmodule.NewListener(ctx, serviceName)

	// Go through normal lifecycle
	listener.Starting()
	listener.Running()
	listener.Stopping(services.Running)

	// Terminate
	listener.Terminated(services.Stopping)

	time.Sleep(10 * time.Millisecond)

	spans := exporter.GetSpans()
	require.Len(t, spans, 5) // New, Starting, Running, Stopping, Parent - all should be ended

	// All spans should be completed
	for _, span := range spans {
		require.True(t, span.EndTime.After(span.StartTime), "Span %s should be ended", span.Name)
	}
}

func TestListener_Failed(t *testing.T) {
	t.Parallel()

	exporter, tp, cleanup := setupTestTracer(t)
	defer cleanup()

	ctx, ctxCleanup := createTracingContext(t, tp)
	defer ctxCleanup()
	serviceName := "test-service"
	listener := tracingmodule.NewListener(ctx, serviceName)

	// Start and then fail
	listener.Starting()

	testError := errors.New("service failed")
	listener.Failed(services.Starting, testError)

	time.Sleep(10 * time.Millisecond)

	spans := exporter.GetSpans()
	require.Len(t, spans, 3) // New, Starting, Parent spans

	// The Starting span should have the error recorded
	startingSpan := spans[1]
	require.Equal(t, "Starting Service", startingSpan.Name)
	require.True(t, startingSpan.EndTime.After(startingSpan.StartTime))

	// Check that the error was recorded
	found := false
	for _, event := range startingSpan.Events {
		if event.Name == "exception" {
			found = true
			break
		}
	}
	require.True(t, found, "Expected exception event not found in span")
}

func TestListener_ConcurrentAccess(t *testing.T) {
	t.Parallel()

	exporter, tp, cleanup := setupTestTracer(t)
	defer cleanup()

	ctx, ctxCleanup := createTracingContext(t, tp)
	defer ctxCleanup()
	serviceName := "test-service"
	listener := tracingmodule.NewListener(ctx, serviceName)

	var wg sync.WaitGroup
	numGoroutines := 10

	// Test concurrent state transitions
	wg.Add(numGoroutines)
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()

			// Each goroutine performs a different operation
			switch id % 4 {
			case 0:
				listener.Starting()
			case 1:
				listener.Running()
			case 2:
				listener.Stopping(services.Running)
			case 3:
				listener.Terminated(services.Stopping)
			}
		}(i)
	}

	wg.Wait()
	time.Sleep(50 * time.Millisecond)

	// Should not panic and should have recorded some spans
	spans := exporter.GetSpans()
	require.Greater(t, len(spans), 0, "Expected at least some spans to be recorded")
}

func TestListener_EdgeCases(t *testing.T) {
	t.Parallel()

	t.Run("terminate without starting", func(t *testing.T) {
		exporter, tp, cleanup := setupTestTracer(t)
		defer cleanup()

		ctx, ctxCleanup := createTracingContext(t, tp)
		defer ctxCleanup()

		serviceName := "test-service"
		listener := tracingmodule.NewListener(ctx, serviceName)

		// Terminate without starting - should not panic
		listener.Terminated(services.New)

		time.Sleep(10 * time.Millisecond)
		spans := exporter.GetSpans()
		require.Len(t, spans, 2, "Should have New span and parent span")
	})

	t.Run("fail without starting", func(t *testing.T) {
		exporter, tp, cleanup := setupTestTracer(t)
		defer cleanup()

		ctx, ctxCleanup := createTracingContext(t, tp)
		defer ctxCleanup()

		serviceName := "test-service"
		listener := tracingmodule.NewListener(ctx, serviceName)

		testError := errors.New("immediate failure")
		// Fail without starting - should not panic
		listener.Failed(services.New, testError)

		time.Sleep(10 * time.Millisecond)
		spans := exporter.GetSpans()
		require.Len(t, spans, 2, "Should have New span with error and parent span")
	})

	t.Run("multiple terminations", func(t *testing.T) {
		exporter, tp, cleanup := setupTestTracer(t)
		defer cleanup()

		ctx, ctxCleanup := createTracingContext(t, tp)
		defer ctxCleanup()

		serviceName := "test-service"
		listener := tracingmodule.NewListener(ctx, serviceName)

		listener.Starting()
		listener.Terminated(services.Starting)
		// Second termination should not panic
		listener.Terminated(services.Starting)

		time.Sleep(10 * time.Millisecond)
		spans := exporter.GetSpans()
		require.Len(t, spans, 3, "Should have New, Starting, and parent spans")
	})
}

func TestListener_ServiceLifecycleIntegration(t *testing.T) {
	t.Parallel()

	exporter, tp, cleanup := setupTestTracer(t)
	defer cleanup()

	ctx, ctxCleanup := createTracingContext(t, tp)
	defer ctxCleanup()
	serviceName := "integration-test-service"
	listener := tracingmodule.NewListener(ctx, serviceName)

	// Simulate complete service lifecycle
	listener.Starting()
	time.Sleep(5 * time.Millisecond) // Simulate startup time

	listener.Running()
	time.Sleep(10 * time.Millisecond) // Simulate running time

	listener.Stopping(services.Running)
	time.Sleep(5 * time.Millisecond) // Simulate shutdown time

	listener.Terminated(services.Stopping)

	time.Sleep(10 * time.Millisecond)

	spans := exporter.GetSpans()
	require.Len(t, spans, 5) // New, Starting, Running, Stopping, Parent

	// Verify span names and order (excluding parent span which is last)
	expectedNames := []string{
		"New Service",
		"Starting Service",
		"Running Service",
		"Stopping Service",
	}

	// Check the first 4 spans (service state spans)
	for i := 0; i < 4; i++ {
		span := spans[i]
		require.Equal(t, expectedNames[i], span.Name)
		require.True(t, span.EndTime.After(span.StartTime), "Span %s should be ended", span.Name)

		// Verify service name attribute
		found := false
		for _, attr := range span.Attributes {
			if attr.Key == "grafana.service.name" && attr.Value.AsString() == serviceName {
				found = true
				break
			}
		}
		require.True(t, found, "Expected grafana.service.name attribute not found in span %s", span.Name)
	}

	// Check the parent span (last span)
	parentSpan := spans[4]
	require.Equal(t, serviceName, parentSpan.Name)
	require.True(t, parentSpan.EndTime.After(parentSpan.StartTime), "Parent span should be ended")

	// Verify timing relationships between state spans
	require.True(t, spans[0].EndTime.Before(spans[1].StartTime) || spans[0].EndTime.Equal(spans[1].StartTime),
		"New span should end before or when Starting span starts")
	require.True(t, spans[1].EndTime.Before(spans[2].StartTime) || spans[1].EndTime.Equal(spans[2].StartTime),
		"Starting span should end before or when Running span starts")
	require.True(t, spans[2].EndTime.Before(spans[3].StartTime) || spans[2].EndTime.Equal(spans[3].StartTime),
		"Running span should end before or when Stopping span starts")
}

func TestListener_ErrorRecording(t *testing.T) {
	t.Parallel()

	exporter, tp, cleanup := setupTestTracer(t)
	defer cleanup()

	ctx, ctxCleanup := createTracingContext(t, tp)
	defer ctxCleanup()
	serviceName := "error-test-service"
	listener := tracingmodule.NewListener(ctx, serviceName)

	// Start service and then fail with error
	listener.Starting()
	listener.Running()

	testError := errors.New("critical service failure")
	listener.Failed(services.Running, testError)

	time.Sleep(10 * time.Millisecond)

	spans := exporter.GetSpans()
	require.Len(t, spans, 4) // New, Starting, Running, Parent spans

	// The Running span should have the error recorded
	runningSpan := spans[2]
	require.Equal(t, "Running Service", runningSpan.Name)

	// Check for exception event
	hasException := false
	for _, event := range runningSpan.Events {
		if event.Name == "exception" {
			hasException = true
			// Check for error message in attributes
			for _, attr := range event.Attributes {
				if attr.Key == "exception.message" {
					require.Equal(t, testError.Error(), attr.Value.AsString())
				}
			}
		}
	}
	require.True(t, hasException, "Expected exception event in failed span")
}

func TestListener_EndAllSpansWithNonRecordingSpan(t *testing.T) {
	t.Parallel()

	exporter, tp, cleanup := setupTestTracer(t)
	defer cleanup()

	ctx, ctxCleanup := createTracingContext(t, tp)
	defer ctxCleanup()

	serviceName := "test-service"
	listener := tracingmodule.NewListener(ctx, serviceName)

	// Start a span and then manually end it to make it non-recording
	listener.Starting()

	// Force the span to be ended by calling Failed, which should handle non-recording spans gracefully
	testError := errors.New("test error")
	listener.Failed(services.Starting, testError)

	// Call Failed again to test the endAllSpans with potentially non-recording spans
	listener.Failed(services.Starting, testError)

	time.Sleep(10 * time.Millisecond)

	spans := exporter.GetSpans()
	require.Len(t, spans, 3, "Should have New, Starting, and parent spans")
}

package tracing_test

import (
	"context"
	"errors"
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
	t.Helper()
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
	t.Helper()
	ctx := context.Background()
	tracer := tp.Tracer("test-tracer")
	ctx, rootSpan := tracer.Start(ctx, "test-root")

	cleanup := func() {
		rootSpan.End()
	}

	return ctx, cleanup
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
	require.Len(t, spans, 1)

	// First span should be the Starting Service span
	startingSpan := spans[0]
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
	require.Len(t, spans, 2)

	// First span should be the completed Starting span
	startingSpan := spans[0]
	require.Equal(t, "Starting Service", startingSpan.Name)
	require.True(t, startingSpan.EndTime.After(startingSpan.StartTime))

	// Second span should be the Running span (still active)
	runningSpan := spans[1]
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
	require.Len(t, spans, 4) // Starting, Running, Stopping, Parent

	// Check that Stopping span was started (should be the 3rd span, index 2)
	stoppingSpan := spans[2]
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
	require.Len(t, spans, 4) // Starting, Running, Stopping, Parent - all should be ended

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
	require.Len(t, spans, 2) // Starting, Parent spans

	// The Starting span should have the error recorded
	startingSpan := spans[0]
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
	require.Len(t, spans, 4) // Starting, Running, Stopping, Parent

	// Verify span names and order (excluding parent span which is last)
	expectedNames := []string{
		"Starting Service",
		"Running Service",
		"Stopping Service",
	}

	// Check the first 3 spans (service state spans)
	for i := 0; i < 3; i++ {
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
	parentSpan := spans[3]
	require.Equal(t, serviceName, parentSpan.Name)
	require.True(t, parentSpan.EndTime.After(parentSpan.StartTime), "Parent span should be ended")

	// Verify timing relationships between state spans
	require.True(t, spans[0].EndTime.Before(spans[1].StartTime) || spans[0].EndTime.Equal(spans[1].StartTime),
		"Starting span should end before or when Running span starts")
	require.True(t, spans[1].EndTime.Before(spans[2].StartTime) || spans[1].EndTime.Equal(spans[2].StartTime),
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
	require.Len(t, spans, 3) // Starting, Running, Parent spans

	// The Running span should have the error recorded
	runningSpan := spans[1]
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

func TestListener_SpanAttributes(t *testing.T) {
	t.Parallel()

	exporter, tp, cleanup := setupTestTracer(t)
	defer cleanup()

	ctx, ctxCleanup := createTracingContext(t, tp)
	defer ctxCleanup()

	serviceName := "attribute-test-service"
	listener := tracingmodule.NewListener(ctx, serviceName)

	// Test that all state transitions include proper attributes
	listener.Starting()
	listener.Running()
	listener.Stopping(services.Running)
	listener.Terminated(services.Stopping)

	time.Sleep(10 * time.Millisecond)

	spans := exporter.GetSpans()
	require.Len(t, spans, 4) // Starting, Running, Stopping, Parent

	// Check Starting span attributes
	startingSpan := spans[0]
	require.Equal(t, "Starting Service", startingSpan.Name)
	hasServiceName := false
	for _, attr := range startingSpan.Attributes {
		if attr.Key == "grafana.service.name" && attr.Value.AsString() == serviceName {
			hasServiceName = true
		}
	}
	require.True(t, hasServiceName, "Starting span should have service name attribute")

	// Check Stopping span has from_state attribute
	stoppingSpan := spans[2]
	require.Equal(t, "Stopping Service", stoppingSpan.Name)
	hasFromState2 := false
	hasServiceName2 := false
	for _, attr := range stoppingSpan.Attributes {
		if attr.Key == "modules.tracing.from_state" && attr.Value.AsString() == "Running" {
			hasFromState2 = true
		}
		if attr.Key == "grafana.service.name" && attr.Value.AsString() == serviceName {
			hasServiceName2 = true
		}
	}
	require.True(t, hasFromState2, "Stopping span should have from_state attribute")
	require.True(t, hasServiceName2, "Stopping span should have service name attribute")

	// Check parent span has final_state attribute
	parentSpan := spans[3]
	require.Equal(t, serviceName, parentSpan.Name)
	hasFinalState := false
	for _, attr := range parentSpan.Attributes {
		if attr.Key == "modules.tracing.final_state" && attr.Value.AsString() == "Stopping" {
			hasFinalState = true
		}
	}
	require.True(t, hasFinalState, "Parent span should have final_state attribute")
}

func TestListener_SpanStatusCodes(t *testing.T) {
	t.Parallel()

	t.Run("successful lifecycle has OK status", func(t *testing.T) {
		exporter, tp, cleanup := setupTestTracer(t)
		defer cleanup()

		ctx, ctxCleanup := createTracingContext(t, tp)
		defer ctxCleanup()

		serviceName := "status-test-service"
		listener := tracingmodule.NewListener(ctx, serviceName)

		listener.Starting()
		listener.Running()
		listener.Terminated(services.Running)

		time.Sleep(10 * time.Millisecond)

		spans := exporter.GetSpans()
		require.Len(t, spans, 3) // Starting, Running, Parent

		// All spans should have OK status
		for _, span := range spans {
			require.Equal(t, "Ok", span.Status.Code.String(), "Span %s should have OK status", span.Name)
		}
	})

	t.Run("failed service has Error status", func(t *testing.T) {
		exporter, tp, cleanup := setupTestTracer(t)
		defer cleanup()

		ctx, ctxCleanup := createTracingContext(t, tp)
		defer ctxCleanup()

		serviceName := "error-status-test-service"
		listener := tracingmodule.NewListener(ctx, serviceName)

		listener.Starting()
		testError := errors.New("service startup failed")
		listener.Failed(services.Starting, testError)

		time.Sleep(10 * time.Millisecond)

		spans := exporter.GetSpans()
		require.Len(t, spans, 2) // Starting, Parent

		// Both spans should have Error status
		for _, span := range spans {
			require.Equal(t, "Error", span.Status.Code.String(), "Span %s should have Error status", span.Name)
			require.Equal(t, testError.Error(), span.Status.Description, "Span %s should have error description", span.Name)
		}
	})
}

func TestListener_ContextPropagation(t *testing.T) {
	t.Parallel()

	exporter, tp, cleanup := setupTestTracer(t)
	defer cleanup()

	// Create a parent context with a span
	ctx := context.Background()
	tracer := tp.Tracer("test-tracer")
	parentCtx, parentSpan := tracer.Start(ctx, "parent-operation")
	defer parentSpan.End()

	serviceName := "context-test-service"
	listener := tracingmodule.NewListener(parentCtx, serviceName)

	listener.Starting()
	listener.Running()
	listener.Terminated(services.Running)

	time.Sleep(10 * time.Millisecond)

	spans := exporter.GetSpans()
	require.GreaterOrEqual(t, len(spans), 3, "Should have at least service spans")

	// Find the service parent span
	var serviceParentSpan *tracetest.SpanStub
	for i := range spans {
		if spans[i].Name == serviceName {
			serviceParentSpan = &spans[i]
			break
		}
	}
	require.NotNil(t, serviceParentSpan, "Should find service parent span")

	// The service parent span should be a child of our test parent span
	require.Equal(t, parentSpan.SpanContext().TraceID(), serviceParentSpan.SpanContext.TraceID(),
		"Service spans should be in the same trace as parent context")
}

func TestListener_EmptyServiceName(t *testing.T) {
	t.Parallel()

	exporter, tp, cleanup := setupTestTracer(t)
	defer cleanup()

	ctx, ctxCleanup := createTracingContext(t, tp)
	defer ctxCleanup()

	// Test with empty service name
	listener := tracingmodule.NewListener(ctx, "")

	listener.Starting()
	listener.Terminated(services.Starting)

	time.Sleep(10 * time.Millisecond)

	spans := exporter.GetSpans()
	require.Len(t, spans, 2) // Starting, Parent

	// Parent span should have empty name
	parentSpan := spans[1]
	require.Equal(t, "", parentSpan.Name)
}

func TestListener_LongRunningService(t *testing.T) {
	t.Parallel()

	exporter, tp, cleanup := setupTestTracer(t)
	defer cleanup()

	ctx, ctxCleanup := createTracingContext(t, tp)
	defer ctxCleanup()

	serviceName := "long-running-service"
	listener := tracingmodule.NewListener(ctx, serviceName)

	startTime := time.Now()

	listener.Starting()
	time.Sleep(20 * time.Millisecond) // Simulate startup time

	listener.Running()
	time.Sleep(50 * time.Millisecond) // Simulate running time

	listener.Stopping(services.Running)
	time.Sleep(10 * time.Millisecond) // Simulate shutdown time

	listener.Terminated(services.Stopping)

	endTime := time.Now()
	time.Sleep(10 * time.Millisecond)

	spans := exporter.GetSpans()
	require.Len(t, spans, 4) // Starting, Running, Stopping, Parent

	// Verify timing relationships
	startingSpan := spans[0]
	runningSpan := spans[1]
	stoppingSpan := spans[2]
	parentSpan := spans[3]

	// Each span should have reasonable duration
	require.True(t, startingSpan.EndTime.After(startingSpan.StartTime))
	require.True(t, runningSpan.EndTime.After(runningSpan.StartTime))
	require.True(t, stoppingSpan.EndTime.After(stoppingSpan.StartTime))
	require.True(t, parentSpan.EndTime.After(parentSpan.StartTime))

	// Parent span should encompass the entire lifecycle
	require.True(t, parentSpan.StartTime.Before(startTime.Add(10*time.Millisecond)) ||
		parentSpan.StartTime.Equal(startTime.Add(10*time.Millisecond)),
		"Parent span should start around the beginning")
	require.True(t, parentSpan.EndTime.After(endTime.Add(-10*time.Millisecond)),
		"Parent span should end around the end")
}

func TestListener_EarlyTermination(t *testing.T) {
	t.Parallel()

	t.Run("New to Terminated without Starting", func(t *testing.T) {
		// This is a valid dskit transition: when StopAsync() is called on a service in New state,
		// it goes directly to Terminated without ever calling Starting()
		exporter, tp, cleanup := setupTestTracer(t)
		defer cleanup()

		ctx, ctxCleanup := createTracingContext(t, tp)
		defer ctxCleanup()

		serviceName := "early-terminated-service"
		listener := tracingmodule.NewListener(ctx, serviceName)

		// Call Terminated directly from New state (valid dskit behavior)
		require.NotPanics(t, func() {
			listener.Terminated(services.New)
		}, "Terminated should not panic when called without Starting")

		time.Sleep(10 * time.Millisecond)

		spans := exporter.GetSpans()
		// Should have no spans since Starting() was never called to create the parent span
		require.Len(t, spans, 0, "Should have no spans since Starting() was never called")
	})

	t.Run("New to Failed without Starting", func(t *testing.T) {
		// This is a valid dskit transition: service can fail during initialization
		// before Starting() is called
		exporter, tp, cleanup := setupTestTracer(t)
		defer cleanup()

		ctx, ctxCleanup := createTracingContext(t, tp)
		defer ctxCleanup()

		serviceName := "early-failed-service"
		listener := tracingmodule.NewListener(ctx, serviceName)

		testError := errors.New("initialization failure")
		// Call Failed directly from New state (valid dskit behavior)
		require.NotPanics(t, func() {
			listener.Failed(services.New, testError)
		}, "Failed should not panic when called without Starting")

		time.Sleep(10 * time.Millisecond)

		spans := exporter.GetSpans()
		// Should have no spans since Starting() was never called to create the parent span
		require.Len(t, spans, 0, "Should have no spans since Starting() was never called")
	})
}

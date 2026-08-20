package modules

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	"github.com/grafana/grafana/pkg/infra/log"
)

func setupTracer(t *testing.T) *tracetest.InMemoryExporter {
	t.Helper()
	exporter := tracetest.NewInMemoryExporter()
	tp := tracesdk.NewTracerProvider(
		tracesdk.WithSyncer(exporter),
		tracesdk.WithSampler(tracesdk.AlwaysSample()),
	)
	prev := otel.GetTracerProvider()
	otel.SetTracerProvider(tp)
	t.Cleanup(func() {
		otel.SetTracerProvider(prev)
		require.NoError(t, tp.Shutdown(context.Background()))
	})
	return exporter
}

func tracedContext(t *testing.T) context.Context {
	t.Helper()
	ctx, span := otel.GetTracerProvider().Tracer("test").Start(context.Background(), "test-root")
	t.Cleanup(func() { span.End() })
	return ctx
}

func spanNames(spans tracetest.SpanStubs) []string {
	names := make([]string, 0, len(spans))
	for _, s := range spans {
		names = append(names, s.Name)
	}
	return names
}

func newServiceWithModule(t *testing.T, name string, fn func() (services.Service, error)) *service {
	t.Helper()
	svc := New(log.New("test"), []string{name}).WithDependencies(map[string][]string{name: {}})
	svc.moduleManager.SetContext(tracedContext(t))
	svc.moduleManager.RegisterModule(name, fn)
	_, err := svc.moduleManager.InitModuleServices(name)
	require.NoError(t, err)
	return svc
}

func TestDrainListeners_IgnoresExpiredParentDeadline(t *testing.T) {
	setupTracer(t)
	svc := newServiceWithModule(t, "never-started", func() (services.Service, error) {
		return services.NewBasicService(nil, nil, nil).WithName("never-started"), nil
	})

	expired, cancel := context.WithDeadline(context.Background(), time.Now().Add(-time.Minute))
	defer cancel()

	start := time.Now()
	svc.drainListeners(expired)
	elapsed := time.Since(start)

	require.Greater(t, elapsed, listenerDrainTimeout/2,
		"drainListeners inherited the expired deadline instead of using its own")
	require.Less(t, elapsed, listenerDrainTimeout*3, "drainListeners overran its own deadline")
}

func TestBeginShutdown(t *testing.T) {
	newService := func(t *testing.T) *service {
		return newServiceWithModule(t, "m", func() (services.Service, error) {
			return services.NewBasicService(nil, nil, nil).WithName("m"), nil
		})
	}

	t.Run("roots the shutdown trace and parents the listeners on it", func(t *testing.T) {
		exporter := setupTracer(t)
		svc := newService(t)

		spanCtx := svc.beginShutdown(context.Background())

		require.Empty(t, exporter.GetSpans(), "beginShutdown must leave the span open")
		require.Equal(t, spanCtx, svc.moduleManager.ShutdownContext())

		svc.endShutdownSpan()
		require.Equal(t, []string{"server.Shutdown"}, spanNames(exporter.GetSpans()))
	})

	t.Run("only the first call opens a span", func(t *testing.T) {
		exporter := setupTracer(t)
		svc := newService(t)

		first := svc.beginShutdown(context.Background())
		second := svc.beginShutdown(context.Background())
		require.Equal(t, first, second)

		svc.endShutdownSpan()
		require.Len(t, exporter.GetSpans(), 1, "the span must be exported exactly once")
	})

	t.Run("endShutdownSpan is idempotent", func(t *testing.T) {
		exporter := setupTracer(t)
		svc := newService(t)

		svc.beginShutdown(context.Background())
		svc.endShutdownSpan()
		svc.endShutdownSpan()

		require.Len(t, exporter.GetSpans(), 1, "the span must be exported exactly once")
	})

	t.Run("stopping closes the span", func(t *testing.T) {
		exporter := setupTracer(t)
		svc := newService(t)

		svc.beginShutdown(context.Background())
		require.NoError(t, svc.stopping(nil))

		require.Contains(t, spanNames(exporter.GetSpans()), "server.Shutdown")
	})
}

func TestStarting_FailureExportsServiceSpans(t *testing.T) {
	exporter := setupTracer(t)

	boom := errors.New("boom")
	svc := New(log.New("test"), []string{"boom"}).WithDependencies(map[string][]string{"boom": {}})
	svc.moduleManager.RegisterModule("boom", func() (services.Service, error) {
		return services.NewBasicService(
			func(context.Context) error { return boom },
			nil, nil,
		).WithName("boom"), nil
	})

	err := svc.starting(tracedContext(t))
	require.ErrorIs(t, err, boom)

	names := spanNames(exporter.GetSpans())
	require.Contains(t, names, "boom", "the failed service's parent span should be exported")
	require.Contains(t, names, "Starting Service")

	for _, s := range exporter.GetSpans() {
		if s.Name == "boom" {
			require.Equal(t, "Error", s.Status.Code.String())
			require.Equal(t, boom.Error(), s.Status.Description)
		}
	}
}

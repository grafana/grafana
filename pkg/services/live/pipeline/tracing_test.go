package pipeline

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
)

func TestPipelineTracingUsesConfiguredProvider(t *testing.T) {
	for _, tc := range []struct {
		name    string
		enabled string
		sampler sdktrace.Sampler
		want    int
	}{
		{name: "enabled", enabled: "1", sampler: sdktrace.AlwaysSample(), want: 2},
		{name: "disabled", sampler: sdktrace.AlwaysSample()},
		{name: "respects sampling", enabled: "1", sampler: sdktrace.NeverSample()},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("GF_LIVE_PIPELINE_TRACE", tc.enabled)
			t.Setenv("GF_LIVE_PIPELINE_DEV", "")
			recorder := tracetest.NewSpanRecorder()
			tp := sdktrace.NewTracerProvider(
				sdktrace.WithSpanProcessor(recorder),
				sdktrace.WithSampler(tc.sampler),
				sdktrace.WithResource(resource.NewSchemaless(attribute.String("service.name", "configured-grafana"))),
			)
			previous := otel.GetTracerProvider()
			otel.SetTracerProvider(tp)
			t.Cleanup(func() {
				otel.SetTracerProvider(previous)
				require.NoError(t, tp.Shutdown(context.Background()))
			})

			p, err := New(&testRuleGetter{})
			require.NoError(t, err)
			ctx, parent := tp.Tracer("test").Start(context.Background(), "parent")
			_, err = p.ProcessInput(ctx, "default", "test", []byte("{}"))
			require.NoError(t, err)

			spans := recorder.Ended()
			require.Len(t, spans, tc.want)
			for _, span := range spans {
				require.Equal(t, parent.SpanContext().TraceID(), span.SpanContext().TraceID())
				require.Equal(t, "github.com/grafana/grafana/pkg/services/live/pipeline", span.InstrumentationScope().Name)
				require.Contains(t, span.Resource().Attributes(), attribute.String("service.name", "configured-grafana"))
			}
			if tc.want > 0 {
				require.Equal(t, "live.pipeline.process_input", spans[1].Name())
				require.Equal(t, parent.SpanContext().SpanID(), spans[1].Parent().SpanID())
				require.Equal(t, spans[1].SpanContext().SpanID(), spans[0].Parent().SpanID())
			}
			parent.End()
		})
	}
}

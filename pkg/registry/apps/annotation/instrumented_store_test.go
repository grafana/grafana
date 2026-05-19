package annotation

import (
	"context"
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	otelcodes "go.opentelemetry.io/otel/codes"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
)

// fakeStore lets tests inject specific Get/List/Create/Update/Delete results so
// observeOp can be exercised across the full status-label space.
type fakeStore struct {
	getErr error
	getRes *annotationV0.Annotation
}

func (f *fakeStore) Get(_ context.Context, _, _ string) (*annotationV0.Annotation, error) {
	return f.getRes, f.getErr
}

func (f *fakeStore) List(_ context.Context, _ string, _ ListOptions) (*AnnotationList, error) {
	return &AnnotationList{}, nil
}

func (f *fakeStore) Create(_ context.Context, a *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	return a, nil
}

func (f *fakeStore) Update(_ context.Context, a *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	return a, nil
}

func (f *fakeStore) Delete(_ context.Context, _, _ string) error {
	return nil
}

func (f *fakeStore) Close() error { return nil }

// newTestInstrumentedStore wires a real (in-memory) tracer + prometheus
// registry so tests can read back what the instrumentation actually emitted.
func newTestInstrumentedStore(t *testing.T, inner Store) (*instrumentedStore, *tracetest.SpanRecorder, prometheus.Gatherer) {
	t.Helper()
	recorder := tracetest.NewSpanRecorder()
	tp := tracesdk.NewTracerProvider(tracesdk.WithSpanProcessor(recorder))
	t.Cleanup(func() { _ = tp.Shutdown(context.Background()) })

	reg := prometheus.NewRegistry()
	m := ProvideMetrics(reg)
	store := newInstrumentedStore(inner, tp.Tracer("annotation-test"), m, log.NewNopLogger())
	return store, recorder, reg
}

func TestInstrumentedStore_RecordsSuccessfulCall(t *testing.T) {
	store, recorder, reg := newTestInstrumentedStore(t, &fakeStore{getRes: &annotationV0.Annotation{}})

	_, err := store.Get(context.Background(), "ns", "n")
	require.NoError(t, err)

	spans := recorder.Ended()
	require.Len(t, spans, 1)
	assert.Equal(t, "annotation.store.get", spans[0].Name())
	assert.Equal(t, otelcodes.Unset, spans[0].Status().Code, "successful op should not set Error status")
	assert.Empty(t, spans[0].Events(), "successful op should not record any error events")

	count := histogramSampleCount(t, reg, "grafana_annotations_store_operation_duration_seconds", map[string]string{
		"operation": "get",
		"status":    "ok",
	})
	assert.Equal(t, uint64(1), count)
}

func TestInstrumentedStore_ExpectedClientErrorAttachesButDoesNotFail(t *testing.T) {
	store, recorder, reg := newTestInstrumentedStore(t, &fakeStore{getErr: ErrNotFound})

	_, err := store.Get(context.Background(), "ns", "missing")
	require.ErrorIs(t, err, ErrNotFound)

	spans := recorder.Ended()
	require.Len(t, spans, 1)
	assert.Equal(t, otelcodes.Unset, spans[0].Status().Code,
		"expected client errors must NOT mark span as Error — keeps trace error rates clean")
	require.NotEmpty(t, spans[0].Events(),
		"expected client errors must still appear on the span via AddEvent so traces show the outcome")
	assert.Equal(t, "client_error", spans[0].Events()[0].Name,
		"expected client errors must use AddEvent('client_error'), not RecordError ('exception') — exception events pollute trace error dashboards")

	count := histogramSampleCount(t, reg, "grafana_annotations_store_operation_duration_seconds", map[string]string{
		"operation": "get",
		"status":    "not_found",
	})
	assert.Equal(t, uint64(1), count, "metric must record not_found status, not error or ok")
}

func TestInstrumentedStore_UnexpectedErrorMarksSpanFailed(t *testing.T) {
	boom := errors.New("backend exploded")
	store, recorder, reg := newTestInstrumentedStore(t, &fakeStore{getErr: boom})

	_, err := store.Get(context.Background(), "ns", "n")
	require.ErrorIs(t, err, boom)

	spans := recorder.Ended()
	require.Len(t, spans, 1)
	assert.Equal(t, otelcodes.Error, spans[0].Status().Code,
		"unexpected errors must mark span as Error so trace dashboards page on them")
	require.NotEmpty(t, spans[0].Events(), "RecordError must produce a span event")

	count := histogramSampleCount(t, reg, "grafana_annotations_store_operation_duration_seconds", map[string]string{
		"operation": "get",
		"status":    "error",
	})
	assert.Equal(t, uint64(1), count)
}

func TestInstrumentedStore_ApierrorsForbiddenIsExpected(t *testing.T) {
	gr := schema.GroupResource{Group: "annotation.grafana.app", Resource: "annotations"}
	store, recorder, _ := newTestInstrumentedStore(t,
		&fakeStore{getErr: apierrors.NewForbidden(gr, "n", errors.New("nope"))})

	_, err := store.Get(context.Background(), "ns", "n")
	require.Error(t, err)

	spans := recorder.Ended()
	require.Len(t, spans, 1)
	assert.Equal(t, otelcodes.Unset, spans[0].Status().Code,
		"forbidden is part of normal API traffic, must not mark span Error")
}

// histogramSampleCount reads the gathered registry and returns the number of
// observations for the histogram matching name + labels.
func histogramSampleCount(t *testing.T, gatherer prometheus.Gatherer, name string, labels map[string]string) uint64 {
	t.Helper()
	mfs, err := gatherer.Gather()
	require.NoError(t, err)
	for _, mf := range mfs {
		if mf.GetName() != name {
			continue
		}
		for _, m := range mf.Metric {
			if matchLabels(m.Label, labels) {
				if h := m.GetHistogram(); h != nil {
					return h.GetSampleCount()
				}
			}
		}
	}
	return 0
}

func matchLabels(actual []*dto.LabelPair, want map[string]string) bool {
	if len(actual) != len(want) {
		return false
	}
	for _, lp := range actual {
		if want[lp.GetName()] != lp.GetValue() {
			return false
		}
	}
	return true
}

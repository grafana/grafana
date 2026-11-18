package jobs

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

const (
	rootSpanName   = "provisioning.jobs.claim_and_process_one_job"
	workerSpanName = "test.worker.child"
)

// processOneJob runs one job through processKey. The worker starts a span with
// tracing.Start, in the same way as the migrate, export and delete workers.
func processOneJob(t *testing.T, tracer tracing.Tracer) {
	t.Helper()

	job := makeTestJob("1")
	store := NewMockStore(t)
	store.EXPECT().Claim(mock.Anything, job.Namespace, job.Name, "0").Return(job, func() {}, nil).Once()
	store.EXPECT().Update(mock.Anything, mock.Anything).
		RunAndReturn(func(_ context.Context, job *provisioning.Job) (*provisioning.Job, error) {
			return job.DeepCopy(), nil
		})
	store.EXPECT().Complete(mock.Anything, mock.Anything).Return(nil).Once()
	history := NewMockHistoryWriter(t)
	history.EXPECT().WriteJob(mock.Anything, mock.Anything).Return(nil).Once()
	repo := repository.NewMockRepository(t)
	repo.On("Config").Return(makeRepoConfig("test-repo", nil, nil))
	repoGetter := NewMockRepoGetter(t)
	repoGetter.EXPECT().GetRepository(mock.Anything, job.Namespace, "test-repo").Return(repo, nil)

	worker := NewMockWorker(t)
	worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
	worker.EXPECT().Process(mock.Anything, repo, mock.Anything, mock.Anything).
		RunAndReturn(func(ctx context.Context, _ repository.Repository, _ provisioning.Job, _ JobProgressRecorder) error {
			_, span := tracing.Start(ctx, workerSpanName)
			span.End()
			return nil
		})

	metrics := &JobMetrics{
		processedTotal: prometheus.NewCounterVec(prometheus.CounterOpts{Name: "test_jobs_processed_total"}, []string{"action", "outcome"}),
		durationHist: prometheus.NewHistogramVec(prometheus.HistogramOpts{Name: "test_jobs_duration_seconds"},
			[]string{"action", "resources_changed_bucket", "outcome"}),
		resourceOpsTotal: prometheus.NewCounterVec(prometheus.CounterOpts{Name: "test_resource_operations_total"},
			[]string{"action", "operation", "outcome", "reason", "group", "kind"}),
	}
	processor := newJobProcessor(time.Minute, time.Minute, store, repoGetter, history, "0", metrics, nil, worker)
	processor.tracer = tracer
	require.NoError(t, processor.processKey(t.Context(), job.Namespace, job.Name, triggerLive, time.Time{}))
}

func TestProcessKey_WorkerSpansJoinTheJobTrace(t *testing.T) {
	recorder := tracetest.NewSpanRecorder()
	tracer := tracing.InitializeTracerForTest(tracing.WithSpanProcessor(recorder))

	processOneJob(t, tracer)

	spans := map[string]sdktrace.ReadOnlySpan{}
	for _, s := range recorder.Ended() {
		spans[s.Name()] = s
	}

	root, ok := spans[rootSpanName]
	require.True(t, ok, "the job needs a root span")
	require.False(t, root.Parent().IsValid(), "the root span must not have a parent")

	child, ok := spans[workerSpanName]
	require.True(t, ok, "a span that a worker starts with tracing.Start must be recorded")
	require.Equal(t, root.SpanContext().TraceID(), child.SpanContext().TraceID())
}

// Without a tracer, tracing.Start has no parent span and records nothing.
// This test shows why the driver needs a tracer.
func TestProcessKey_NilTracerDropsWorkerSpans(t *testing.T) {
	recorder := tracetest.NewSpanRecorder()
	tracing.InitializeTracerForTest(tracing.WithSpanProcessor(recorder))

	processOneJob(t, nil)

	for _, s := range recorder.Ended() {
		require.NotEqual(t, workerSpanName, s.Name())
		require.NotEqual(t, rootSpanName, s.Name())
	}
}

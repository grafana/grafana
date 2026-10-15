package backfill

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/codes"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

type pageTextFunc func(context.Context, embedder.EmbedTextInput) (embedder.EmbedTextOutput, error)

func (f pageTextFunc) EmbedText(ctx context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
	return f(ctx, input)
}

func setPageTextEmbedder(b *VectorBackfiller, text pageTextFunc) {
	b.batchEmbedder = embedder.NewBatchEmbedder(embedder.Embedder{TextEmbedder: text, Model: "test-model"})
}

func numberedEmbeddings(input embedder.EmbedTextInput) embedder.EmbedTextOutput {
	out := embedder.EmbedTextOutput{Embeddings: make([]embedder.Embedding, len(input.Texts))}
	for i := range input.Texts {
		out.Embeddings[i].Dense = []float32{float32(i + 1)}
	}
	return out
}

func recordPageOutcomes(t *testing.T, b *VectorBackfiller) func(map[string]string) {
	t.Helper()
	recorder := tracetest.NewSpanRecorder()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
	previousTracer := tracer
	tracer = provider.Tracer("backfill-test")
	t.Cleanup(func() {
		tracer = previousTracer
		require.NoError(t, provider.Shutdown(context.Background()))
	})
	b.metrics = resource.ProvideVectorMetrics(prometheus.NewRegistry())
	return func(want map[string]string) {
		t.Helper()
		spans := recorder.Ended()
		require.Len(t, spans, len(want))
		for _, span := range spans {
			var uid string
			for _, attr := range span.Attributes() {
				if attr.Key == "uid" {
					uid = attr.Value.AsString()
				}
			}
			require.Contains(t, want, uid)
			if want[uid] == "error" {
				assert.Equal(t, codes.Error, span.Status().Code, uid)
				assert.NotEmpty(t, span.Events(), uid)
			} else {
				assert.Equal(t, codes.Unset, span.Status().Code, uid)
				assert.Empty(t, span.Events(), uid)
			}
		}
		counts := map[string]uint64{"error": 0, "aborted": 0}
		for _, status := range want {
			counts[status]++
		}
		for status, count := range counts {
			var observed dto.Metric
			metric := b.metrics.BackfillItemDuration.WithLabelValues("folder.grafana.app", "folders", status)
			require.NoError(t, metric.(prometheus.Metric).Write(&observed))
			assert.Equal(t, count, observed.GetHistogram().GetSampleCount(), status)
		}
	}
}

func TestRunBackfillPage_BatchesObjectsAndPreservesIdentity(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{
		makeFolderListItem("ns-a", "shared", 11),
		makeFolderListItem("ns-a", "existing", 12),
		makeFolderListItem("ns-b", "shared", 23),
	}
	storage.listItems[0].Value = []byte(`{"apiVersion":"folder.grafana.app/v1","spec":{"title":"Operations"}}`)
	storage.listItems[2].Value = []byte(`{"apiVersion":"folder.grafana.app/v1","spec":{"title":"Engineering"}}`)
	wantTexts := []string{"title: Operations", "title: Engineering"}
	vec := newFakeVector()
	builder := collectionBuilder{Builder: newFolderBuilder(), partitionKey: "folders"}
	b := newBackfillerWithBuilders(t, storage, vec, builder.Builder)
	vec.seedEmbeddedRows("ns-a", "test-model", "folders", "existing", builder.Version(), "")
	calls := 0
	setPageTextEmbedder(b, func(_ context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
		calls++
		assert.Equal(t, wantTexts, input.Texts)
		assert.Empty(t, vec.replaceCalls, "the whole page must be embedded before any object is replaced")
		return numberedEmbeddings(input), nil
	})

	next, err := b.runBackfillPage(t.Context(), vector.BackfillJob{ID: 1, Model: "test-model", StoppingRV: 100}, builder, "")

	require.NoError(t, err)
	assert.Empty(t, next)
	assert.Equal(t, 1, calls)
	require.Len(t, vec.replaceCalls, 2)
	for i, source := range []listItem{storage.listItems[0], storage.listItems[2]} {
		call := vec.replaceCalls[i]
		assert.Equal(t, source.Namespace, call.Namespace)
		assert.Equal(t, source.Name, call.UID)
		require.Len(t, call.Changed, 1)
		assert.Equal(t, []string{""}, call.Desired)
		row := call.Changed[0]
		assert.Equal(t, source.Namespace, row.Namespace)
		assert.Equal(t, source.Name, row.UID)
		assert.Equal(t, source.RV, row.ResourceVersion)
		assert.Equal(t, builder.Version(), row.ContentVersion)
		assert.Equal(t, "folders", row.Resource)
		assert.Equal(t, "test-model", row.Model)
		assert.Equal(t, wantTexts[i], row.Content)
		assert.Equal(t, []float32{float32(i + 1)}, row.Embedding)
		assert.Contains(t, call.Desired, row.Subresource)
	}
	require.Len(t, vec.checkpoints, 2)
	assert.Equal(t, encodeCursor("folders", "tok-2"), vec.checkpoints[1].LastSeenKey)
}

func TestRunBackfillPage_AllSkippedDoesNotCallProvider(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeFolderListItem("ns", "current", 1), makeFolderListItem("ns", "newer", 2)}
	vec := newFakeVector()
	builder := collectionBuilder{Builder: newFolderBuilder(), partitionKey: "folders"}
	b, text := newBackfillerWithEmbedder(t, storage, vec, builder.Builder)
	vec.seedEmbeddedRows("ns", "test-model", "folders", "current", builder.Version(), "")
	vec.seedEmbeddedRows("ns", "test-model", "folders", "newer", builder.Version()+1, "")

	next, err := b.runBackfillPage(t.Context(), vector.BackfillJob{ID: 1, Model: "test-model", StoppingRV: 100}, builder, "")

	require.NoError(t, err)
	assert.Empty(t, next)
	assert.Zero(t, text.calls)
	assert.Empty(t, vec.replaceCalls)
	require.Len(t, vec.checkpoints, 1)
	assert.Equal(t, encodeCursor("folders", "tok-1"), vec.checkpoints[0].LastSeenKey)
}

func TestRunBackfillPage_ProviderFailureLeavesWholePageRetryable(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{
		{Group: "folder.grafana.app", Resource: "folders", Namespace: "ns", Name: "empty", RV: 1, Value: []byte(`{"apiVersion":"folder.grafana.app/v1","spec":{}}`)},
		makeFolderListItem("ns", "a", 2),
		makeFolderListItem("ns", "b", 3),
		makeFolderListItem("ns", "current", 4),
		{Group: "folder.grafana.app", Resource: "folders", Namespace: "ns", Name: "unsupported", RV: 5, Value: []byte(`{"apiVersion":"folder.grafana.app/v2","spec":{"title":"Unsupported version"}}`)},
	}
	vec := newFakeVector()
	builder := collectionBuilder{Builder: newFolderBuilder(), partitionKey: "folders"}
	b, text := newBackfillerWithEmbedder(t, storage, vec, builder.Builder)
	assertOutcomes := recordPageOutcomes(t, b)
	vec.seedEmbeddedRows("ns", "test-model", "folders", "empty", builder.Version()-1, "")
	vec.seedEmbeddedRows("ns", "test-model", "folders", "current", builder.Version(), "")
	vec.seedEmbeddedRows("ns", "test-model", "folders", "unsupported", builder.Version()-1, "")
	providerErr := errors.New("provider unavailable")
	text.err = providerErr

	_, err := b.runBackfillPage(t.Context(), vector.BackfillJob{ID: 1, Model: "test-model", StoppingRV: 100}, builder, "")

	require.ErrorIs(t, err, providerErr)
	assert.Equal(t, 1, text.calls)
	assert.Empty(t, vec.replaceCalls)
	assert.Empty(t, vec.deletes, "even non-embedding mutations wait until the page's provider call succeeds")
	assert.Empty(t, vec.checkpoints)
	assertOutcomes(map[string]string{
		"empty": "aborted", "a": "error", "b": "error",
		"current": "skipped_already_embedded", "unsupported": "aborted",
	})
}

type pageWriteFailure struct {
	*fakeVector
	failUID string
	err     error
}

func (v *pageWriteFailure) UpsertReplaceSubresources(ctx context.Context, ns, model, res, uid string, changed []vector.Vector, unchanged []vector.VectorMeta, desired []string) error {
	if uid == v.failUID {
		return v.err
	}
	return v.fakeVector.UpsertReplaceSubresources(ctx, ns, model, res, uid, changed, unchanged, desired)
}

func TestRunBackfillPage_WriteFailureResumesAfterSuccessfulPrefix(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeFolderListItem("ns", "a", 1), makeFolderListItem("ns", "b", 2), makeFolderListItem("ns", "c", 3)}
	vec := newFakeVector()
	builder := newFolderBuilder()
	b, text := newBackfillerWithEmbedder(t, storage, vec, builder)
	assertOutcomes := recordPageOutcomes(t, b)
	writeErr := errors.New("database unavailable")
	failing := &pageWriteFailure{fakeVector: vec, failUID: "b", err: writeErr}
	b.vectorBackend = failing
	builders := []collectionBuilder{{Builder: builder, partitionKey: "folders"}}
	job := vector.BackfillJob{ID: 1, Model: "test-model", StoppingRV: 100}

	err := b.runBackfillJob(t.Context(), job, builders)

	require.ErrorIs(t, err, writeErr)
	assert.Equal(t, 1, text.calls)
	require.Len(t, vec.replaceCalls, 1)
	assert.Equal(t, "a", vec.replaceCalls[0].UID)
	require.Len(t, vec.checkpoints, 1)
	assert.Equal(t, encodeCursor("folders", "tok-1"), vec.checkpoints[0].LastSeenKey)
	assertOutcomes(map[string]string{"a": "embedded", "b": "error", "c": "aborted"})

	job.LastSeenKey = vec.checkpoints[0].LastSeenKey
	b, err = NewVectorBackfiller(Options{
		Storage: storage, VectorBackend: vec, BatchEmbedder: embedder.NewBatchEmbedder(*newFakeEmbedder(text)),
		Builders: []embed.Builder{builder}, PageSize: 1,
	})
	require.NoError(t, err)
	require.NoError(t, b.runBackfillJob(t.Context(), job, builders))

	assert.Equal(t, 3, text.calls)
	assert.Equal(t, []string{"", "tok-1", "tok-2"}, storage.listCalls)
	assert.Equal(t, []int64{50, 1, 1}, storage.listLimits)
	require.Len(t, vec.replaceCalls, 3)
	assert.Equal(t, "b", vec.replaceCalls[1].UID)
	assert.Equal(t, "c", vec.replaceCalls[2].UID)
}

func TestRunBackfillPage_CanceledAfterEmbeddingDoesNotWriteOrCheckpoint(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeFolderListItem("ns", "a", 1), makeFolderListItem("ns", "b", 2)}
	vec := newFakeVector()
	builder := collectionBuilder{Builder: newFolderBuilder(), partitionKey: "folders"}
	b := newBackfillerWithBuilders(t, storage, vec, builder.Builder)
	assertOutcomes := recordPageOutcomes(t, b)
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	setPageTextEmbedder(b, func(_ context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
		cancel()
		return numberedEmbeddings(input), nil
	})

	_, err := b.runBackfillPage(ctx, vector.BackfillJob{ID: 1, Model: "test-model", StoppingRV: 100}, builder, "")

	require.ErrorIs(t, err, context.Canceled)
	assert.Empty(t, vec.replaceCalls)
	assert.Empty(t, vec.checkpoints)
	assertOutcomes(map[string]string{"a": "aborted", "b": "aborted"})
}

type pageIteratorError struct {
	resource.ListIterator
	err  error
	done bool
}

func (i *pageIteratorError) Next() bool {
	i.done = !i.ListIterator.Next()
	return !i.done
}

func (i *pageIteratorError) Error() error {
	if i.done {
		return i.err
	}
	return i.ListIterator.Error()
}

type pageIteratorErrorStorage struct {
	*fakeStorage
	err error
}

func (s *pageIteratorErrorStorage) ListIterator(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	return s.fakeStorage.ListIterator(ctx, req, func(iter resource.ListIterator) error {
		return cb(&pageIteratorError{ListIterator: iter, err: s.err})
	})
}

func TestRunBackfillPage_TerminalIteratorErrorLeavesPageRetryable(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeFolderListItem("ns", "a", 1), makeFolderListItem("ns", "b", 2)}
	vec := newFakeVector()
	builder := collectionBuilder{Builder: newFolderBuilder(), partitionKey: "folders"}
	b, text := newBackfillerWithEmbedder(t, storage, vec, builder.Builder)
	iteratorErr := errors.New("scan interrupted")
	b.storage = &pageIteratorErrorStorage{fakeStorage: storage, err: iteratorErr}

	_, err := b.runBackfillPage(t.Context(), vector.BackfillJob{ID: 1, Model: "test-model", StoppingRV: 100}, builder, "")

	require.ErrorIs(t, err, iteratorErr)
	assert.Zero(t, text.calls)
	assert.Empty(t, vec.replaceCalls)
	assert.Empty(t, vec.checkpoints)
}

func TestRunBackfillPage_RechecksLiveStateAfterProvider(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{
		makeFolderListItem("ns", "changed", 1),
		makeFolderListItem("ns", "deleted", 2),
		{Group: "folder.grafana.app", Resource: "folders", Namespace: "ns", Name: "empty", RV: 3, Value: []byte(`{"apiVersion":"folder.grafana.app/v1","spec":{}}`)},
		makeFolderListItem("ns", "identical", 4),
		makeFolderListItem("ns", "good", 5),
	}
	vec := newFakeVector()
	builder := collectionBuilder{Builder: newFolderBuilder(), partitionKey: "folders"}
	b := newBackfillerWithBuilders(t, storage, vec, builder.Builder)
	vec.seedEmbeddedRows("ns", "test-model", "folders", "empty", builder.Version()-1, "")
	items, err := builder.Extract(t.Context(), &resourcepb.ResourceKey{Group: builder.Group(), Resource: builder.Resource(), Name: "identical"}, storage.listItems[3].Value, "")
	require.NoError(t, err)
	require.Len(t, items, 1)
	vec.seedStoredContent("ns", "test-model", "folders", "identical", items[0].Subresource, items[0].Content, builder.Version()-1)
	setPageTextEmbedder(b, func(_ context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
		require.Len(t, input.Texts, 3)
		assert.Empty(t, vec.updateCalls)
		for _, name := range []string{"changed", "empty", "identical"} {
			storage.resources[storeKey("ns", builder.Group(), builder.Resource(), name)] = storedResource{RV: 99}
		}
		storage.markNotFound("ns", builder.Group(), builder.Resource(), "deleted")
		return numberedEmbeddings(input), nil
	})

	next, err := b.runBackfillPage(t.Context(), vector.BackfillJob{ID: 1, Model: "test-model", StoppingRV: 100}, builder, "")

	require.NoError(t, err)
	assert.Empty(t, next)
	require.Len(t, vec.replaceCalls, 1)
	assert.Equal(t, "good", vec.replaceCalls[0].UID)
	assert.Equal(t, []float32{3}, vec.replaceCalls[0].Changed[0].Embedding)
	assert.Empty(t, vec.deletes, "an empty extraction must not delete rows after the object changes")
	assert.Empty(t, vec.updateCalls, "identical content must not be stamped with a new version after the object changes")
	assert.Len(t, vec.checkpoints, 4, "deliberate live-state skips can advance the checkpoint")
}

func TestRunBackfillPage_PermanentExtractionFailureDoesNotShiftResults(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{
		makeFolderListItem("ns", "a", 1),
		{Group: "folder.grafana.app", Resource: "folders", Namespace: "ns", Name: "bad", RV: 2, Value: []byte(`{"spec":`)},
		makeFolderListItem("ns", "b", 3),
	}
	vec := newFakeVector()
	builder := collectionBuilder{Builder: newFolderBuilder(), partitionKey: "folders"}
	b := newBackfillerWithBuilders(t, storage, vec, builder.Builder)
	calls := 0
	setPageTextEmbedder(b, func(_ context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
		calls++
		require.Len(t, input.Texts, 2)
		return numberedEmbeddings(input), nil
	})

	_, err := b.runBackfillPage(t.Context(), vector.BackfillJob{ID: 1, Model: "test-model", StoppingRV: 100}, builder, "")

	require.NoError(t, err)
	assert.Equal(t, 1, calls)
	require.Len(t, vec.replaceCalls, 2)
	assert.Equal(t, "a", vec.replaceCalls[0].UID)
	assert.Equal(t, []float32{1}, vec.replaceCalls[0].Changed[0].Embedding)
	assert.Equal(t, "b", vec.replaceCalls[1].UID)
	assert.Equal(t, []float32{2}, vec.replaceCalls[1].Changed[0].Embedding)
	assert.Len(t, vec.checkpoints, 2)
}

func TestRunBackfill_GenericPagination(t *testing.T) {
	for _, tc := range []struct {
		name           string
		resourceCount  int
		pageSize       int
		wantLimit      int64
		wantBatchSizes []int
		wantPageTokens []string
	}{
		{name: "default with partial last page", resourceCount: 57, wantLimit: 50, wantBatchSizes: []int{50, 7}, wantPageTokens: []string{"", "tok-50"}},
		{name: "one exact page", resourceCount: 50, wantLimit: 50, wantBatchSizes: []int{50}, wantPageTokens: []string{""}},
		{name: "two exact pages", resourceCount: 100, wantLimit: 50, wantBatchSizes: []int{50, 50}, wantPageTokens: []string{"", "tok-50"}},
		{name: "negative uses default", resourceCount: 57, pageSize: -1, wantLimit: 50, wantBatchSizes: []int{50, 7}, wantPageTokens: []string{"", "tok-50"}},
		{name: "configured", resourceCount: 5, pageSize: 2, wantLimit: 2, wantBatchSizes: []int{2, 2, 1}, wantPageTokens: []string{"", "tok-2", "tok-4"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			storage := newFakeStorage()
			storage.listItems = make([]listItem, tc.resourceCount)
			for i := range storage.listItems {
				storage.listItems[i] = makeFolderListItem("ns", fmt.Sprintf("folder-%03d", i), int64(i+1))
			}
			vec := newFakeVector()
			vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 1000}}
			var batchSizes []int
			text := pageTextFunc(func(_ context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
				batchSizes = append(batchSizes, len(input.Texts))
				return numberedEmbeddings(input), nil
			})
			b, err := NewVectorBackfiller(Options{
				Storage: storage, VectorBackend: vec,
				BatchEmbedder: embedder.NewBatchEmbedder(embedder.Embedder{TextEmbedder: text, Model: "test-model"}),
				Builders:      []embed.Builder{newFolderBuilder()}, PageSize: tc.pageSize,
			})
			require.NoError(t, err)

			b.runBackfill(t.Context())

			assert.Empty(t, vec.errorMarks)
			assert.Equal(t, []int64{1}, vec.completedJobIDs)
			assert.Equal(t, tc.wantBatchSizes, batchSizes)
			assert.Equal(t, tc.wantPageTokens, storage.listCalls)
			require.Len(t, storage.listLimits, len(tc.wantBatchSizes))
			for _, limit := range storage.listLimits {
				assert.Equal(t, tc.wantLimit, limit)
			}
			assert.Len(t, vec.replaceCalls, tc.resourceCount)
			assert.Len(t, vec.checkpoints, tc.resourceCount-1, "the final item has no confirmed continuation token")
		})
	}
}

func TestRunBackfillJob_DashboardsUseOneResourcePerPage(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{
		{Namespace: "ns-a", Name: "shared", RV: 11, Value: []byte(`{"uid":"shared","title":"First","panels":[{"id":2,"title":"CPU"},{"id":3,"title":"Memory"}]}`)},
		makeListItem("ns-b", "shared", 23),
	}
	vec := newFakeVector()
	builder := dashboard.New()
	b, err := NewVectorBackfiller(Options{
		Storage: storage, VectorBackend: vec, BatchEmbedder: embedder.NewBatchEmbedder(*newFakeEmbedder(&fakeText{dim: 4})),
		Builders: []embed.Builder{builder}, PageSize: 25,
	})
	require.NoError(t, err)
	var batchSizes []int
	setPageTextEmbedder(b, func(_ context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
		assert.Len(t, vec.replaceCalls, len(batchSizes), "the preceding dashboard is written before the next page is embedded")
		batchSizes = append(batchSizes, len(input.Texts))
		return numberedEmbeddings(input), nil
	})

	err = b.runBackfillJob(t.Context(), vector.BackfillJob{ID: 1, Model: "test-model", StoppingRV: 100}, []collectionBuilder{{Builder: builder, partitionKey: "custom_dashboard_partition"}})

	require.NoError(t, err)
	assert.Equal(t, []int{2, 1}, batchSizes)
	assert.Equal(t, []int64{1, 1}, storage.listLimits)
	assert.Equal(t, []string{"", "tok-1"}, storage.listCalls)
	require.Len(t, vec.replaceCalls, 2, "all panels of each dashboard must be written together")
	for i, call := range vec.replaceCalls {
		source := storage.listItems[i]
		assert.Equal(t, source.Namespace, call.Namespace)
		assert.Equal(t, source.Name, call.UID)
		require.Len(t, call.Changed, 2-i)
		for j, row := range call.Changed {
			assert.Equal(t, source.Namespace, row.Namespace)
			assert.Equal(t, source.Name, row.UID)
			assert.Equal(t, source.RV, row.ResourceVersion)
			assert.Equal(t, builder.Version(), row.ContentVersion)
			assert.Equal(t, "custom_dashboard_partition", row.Resource)
			assert.Equal(t, []float32{float32(j + 1)}, row.Embedding)
		}
	}
	assert.Equal(t, []string{"panel/2", "panel/3"}, vec.replaceCalls[0].Desired)
	require.Len(t, vec.checkpoints, 1)
	assert.Equal(t, encodeCursor("custom_dashboard_partition", "tok-1"), vec.checkpoints[0].LastSeenKey)
}

package backfill

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
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

func TestRunBackfillPage_BatchesObjectsAndPreservesIdentity(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{
		makeListItem("ns-a", "shared", 11),
		makeListItem("ns-a", "existing", 12),
		{Namespace: "ns-b", Name: "shared", RV: 23, Value: []byte(`{"uid":"shared","title":"Second","panels":[{"id":2,"title":"CPU"},{"id":3,"title":"Memory"}]}`)},
	}
	vec := newFakeVector()
	b := newBackfiller(t, storage, vec)
	builder := collectionBuilder{Builder: dashboard.New(), partitionKey: "dashboards"}
	vec.seedEmbeddedRows("ns-a", "test-model", "dashboards", "existing", builder.Version(), "panel/1")
	calls := 0
	setPageTextEmbedder(b, func(_ context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
		calls++
		require.Len(t, input.Texts, 3)
		assert.Empty(t, vec.replaceCalls, "the whole page must be embedded before any object is replaced")
		return numberedEmbeddings(input), nil
	})

	next, err := b.runBackfillPage(t.Context(), vector.BackfillJob{ID: 1, Model: "test-model", StoppingRV: 100}, builder, "")

	require.NoError(t, err)
	assert.Empty(t, next)
	assert.Equal(t, 1, calls)
	require.Len(t, vec.replaceCalls, 2, "all panels of each dashboard must be written together")
	wantDense := float32(1)
	for i, source := range []listItem{storage.listItems[0], storage.listItems[2]} {
		call := vec.replaceCalls[i]
		assert.Equal(t, source.Namespace, call.Namespace)
		assert.Equal(t, source.Name, call.UID)
		require.Len(t, call.Changed, i+1)
		assert.Len(t, call.Desired, i+1)
		for _, row := range call.Changed {
			assert.Equal(t, source.Namespace, row.Namespace)
			assert.Equal(t, source.Name, row.UID)
			assert.Equal(t, source.RV, row.ResourceVersion)
			assert.Equal(t, builder.Version(), row.ContentVersion)
			assert.Equal(t, "dashboards", row.Resource)
			assert.Equal(t, "test-model", row.Model)
			assert.Equal(t, []float32{wantDense}, row.Embedding)
			assert.Contains(t, call.Desired, row.Subresource)
			wantDense++
		}
	}
	assert.Equal(t, []string{"panel/2", "panel/3"}, vec.replaceCalls[1].Desired)
	require.Len(t, vec.checkpoints, 2)
	assert.Equal(t, encodeCursor("dashboards", "tok-2"), vec.checkpoints[1].LastSeenKey)
}

func TestRunBackfillPage_AllSkippedDoesNotCallProvider(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "current", 1), makeListItem("ns", "newer", 2)}
	vec := newFakeVector()
	b, text := newBackfillerWithEmbedder(t, storage, vec)
	builder := collectionBuilder{Builder: dashboard.New(), partitionKey: "dashboards"}
	vec.seedEmbeddedRows("ns", "test-model", "dashboards", "current", builder.Version(), "panel/1")
	vec.seedEmbeddedRows("ns", "test-model", "dashboards", "newer", builder.Version()+1, "panel/1")

	next, err := b.runBackfillPage(t.Context(), vector.BackfillJob{ID: 1, Model: "test-model", StoppingRV: 100}, builder, "")

	require.NoError(t, err)
	assert.Empty(t, next)
	assert.Zero(t, text.calls)
	assert.Empty(t, vec.replaceCalls)
	require.Len(t, vec.checkpoints, 1)
	assert.Equal(t, encodeCursor("dashboards", "tok-1"), vec.checkpoints[0].LastSeenKey)
}

func TestRunBackfillPage_ProviderFailureLeavesWholePageRetryable(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{
		{Namespace: "ns", Name: "empty", RV: 1, Value: []byte(`{"uid":"empty","title":"Empty"}`)},
		makeListItem("ns", "a", 2),
		makeListItem("ns", "b", 3),
	}
	vec := newFakeVector()
	b, text := newBackfillerWithEmbedder(t, storage, vec)
	builder := collectionBuilder{Builder: dashboard.New(), partitionKey: "dashboards"}
	vec.seedEmbeddedRows("ns", "test-model", "dashboards", "empty", builder.Version()-1, "panel/1")
	providerErr := errors.New("provider unavailable")
	text.err = providerErr

	_, err := b.runBackfillPage(t.Context(), vector.BackfillJob{ID: 1, Model: "test-model", StoppingRV: 100}, builder, "")

	require.ErrorIs(t, err, providerErr)
	assert.Equal(t, 1, text.calls)
	assert.Empty(t, vec.replaceCalls)
	assert.Empty(t, vec.deletes, "even non-embedding mutations wait until the page's provider call succeeds")
	assert.Empty(t, vec.checkpoints)
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
	storage.listItems = []listItem{makeListItem("ns", "a", 1), makeListItem("ns", "b", 2), makeListItem("ns", "c", 3)}
	vec := newFakeVector()
	b, text := newBackfillerWithEmbedder(t, storage, vec)
	writeErr := errors.New("database unavailable")
	failing := &pageWriteFailure{fakeVector: vec, failUID: "b", err: writeErr}
	b.vectorBackend = failing
	builders := []collectionBuilder{{Builder: dashboard.New(), partitionKey: "dashboards"}}
	job := vector.BackfillJob{ID: 1, Model: "test-model", StoppingRV: 100}

	err := b.runBackfillJob(t.Context(), job, builders)

	require.ErrorIs(t, err, writeErr)
	assert.Equal(t, 1, text.calls)
	require.Len(t, vec.replaceCalls, 1)
	assert.Equal(t, "a", vec.replaceCalls[0].UID)
	require.Len(t, vec.checkpoints, 1)
	assert.Equal(t, encodeCursor("dashboards", "tok-1"), vec.checkpoints[0].LastSeenKey)

	job.LastSeenKey = vec.checkpoints[0].LastSeenKey
	failing.failUID = ""
	require.NoError(t, b.runBackfillJob(t.Context(), job, builders))

	assert.Equal(t, 2, text.calls)
	assert.Equal(t, []string{"", "tok-1"}, storage.listCalls)
	require.Len(t, vec.replaceCalls, 3)
	assert.Equal(t, "b", vec.replaceCalls[1].UID)
	assert.Equal(t, "c", vec.replaceCalls[2].UID)
}

func TestRunBackfillPage_CanceledAfterEmbeddingDoesNotWriteOrCheckpoint(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "a", 1), makeListItem("ns", "b", 2)}
	vec := newFakeVector()
	b := newBackfiller(t, storage, vec)
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	setPageTextEmbedder(b, func(_ context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
		cancel()
		return numberedEmbeddings(input), nil
	})

	_, err := b.runBackfillPage(ctx, vector.BackfillJob{ID: 1, Model: "test-model", StoppingRV: 100}, collectionBuilder{Builder: dashboard.New(), partitionKey: "dashboards"}, "")

	require.ErrorIs(t, err, context.Canceled)
	assert.Empty(t, vec.replaceCalls)
	assert.Empty(t, vec.checkpoints)
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
	storage.listItems = []listItem{makeListItem("ns", "a", 1), makeListItem("ns", "b", 2)}
	vec := newFakeVector()
	b, text := newBackfillerWithEmbedder(t, storage, vec)
	iteratorErr := errors.New("scan interrupted")
	b.storage = &pageIteratorErrorStorage{fakeStorage: storage, err: iteratorErr}

	_, err := b.runBackfillPage(t.Context(), vector.BackfillJob{ID: 1, Model: "test-model", StoppingRV: 100}, collectionBuilder{Builder: dashboard.New(), partitionKey: "dashboards"}, "")

	require.ErrorIs(t, err, iteratorErr)
	assert.Zero(t, text.calls)
	assert.Empty(t, vec.replaceCalls)
	assert.Empty(t, vec.checkpoints)
}

func TestRunBackfillPage_RechecksLiveStateAfterProvider(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{
		makeListItem("ns", "changed", 1),
		makeListItem("ns", "deleted", 2),
		{Namespace: "ns", Name: "empty", RV: 3, Value: []byte(`{"uid":"empty","title":"Empty"}`)},
		makeListItem("ns", "identical", 4),
		makeListItem("ns", "good", 5),
	}
	vec := newFakeVector()
	b := newBackfiller(t, storage, vec)
	builder := collectionBuilder{Builder: dashboard.New(), partitionKey: "dashboards"}
	vec.seedEmbeddedRows("ns", "test-model", "dashboards", "empty", builder.Version()-1, "panel/1")
	items, err := builder.Extract(t.Context(), &resourcepb.ResourceKey{Name: "identical"}, storage.listItems[3].Value, "")
	require.NoError(t, err)
	require.Len(t, items, 1)
	vec.seedStoredContent("ns", "test-model", "dashboards", "identical", items[0].Subresource, items[0].Content, builder.Version()-1)
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
		makeListItem("ns", "a", 1),
		{Namespace: "ns", Name: "bad", RV: 2, Value: []byte(`{"uid":`)},
		makeListItem("ns", "b", 3),
	}
	vec := newFakeVector()
	b := newBackfiller(t, storage, vec)
	calls := 0
	setPageTextEmbedder(b, func(_ context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
		calls++
		require.Len(t, input.Texts, 2)
		return numberedEmbeddings(input), nil
	})

	_, err := b.runBackfillPage(t.Context(), vector.BackfillJob{ID: 1, Model: "test-model", StoppingRV: 100}, collectionBuilder{Builder: dashboard.New(), partitionKey: "dashboards"}, "")

	require.NoError(t, err)
	assert.Equal(t, 1, calls)
	require.Len(t, vec.replaceCalls, 2)
	assert.Equal(t, "a", vec.replaceCalls[0].UID)
	assert.Equal(t, []float32{1}, vec.replaceCalls[0].Changed[0].Embedding)
	assert.Equal(t, "b", vec.replaceCalls[1].UID)
	assert.Equal(t, []float32{2}, vec.replaceCalls[1].Changed[0].Embedding)
	assert.Len(t, vec.checkpoints, 2)
}

func TestRunBackfillJob_BatchesOncePerExactPage(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = make([]listItem, 2*backfillPageSize)
	for i := range storage.listItems {
		storage.listItems[i] = makeListItem("ns", fmt.Sprintf("dashboard-%03d", i), int64(i+1))
	}
	vec := newFakeVector()
	b, text := newBackfillerWithEmbedder(t, storage, vec)

	err := b.runBackfillJob(t.Context(), vector.BackfillJob{ID: 1, Model: "test-model", StoppingRV: 1000}, []collectionBuilder{{Builder: dashboard.New(), partitionKey: "dashboards"}})

	require.NoError(t, err)
	assert.Equal(t, 2, text.calls)
	assert.Len(t, storage.listCalls, 2)
	assert.Len(t, vec.replaceCalls, 2*backfillPageSize)
	assert.Len(t, vec.checkpoints, 2*backfillPageSize-1)
}

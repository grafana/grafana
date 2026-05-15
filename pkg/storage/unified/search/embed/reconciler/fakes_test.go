package reconciler

import (
	"context"
	"errors"
	"iter"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

// fakeStorage stubs the bits of resource.StorageBackend the reconciler uses.
// ListModifiedSince returns the configured changes (filtered by sinceRv)
// and a latestRv equal to the highest RV in the slice. Empty namespace
// on the request runs cross-namespace, mirroring the real backends.
type fakeStorage struct {
	mu       sync.Mutex
	changes  []*resource.ModifiedResource
	listErr  error
	watchErr error
	watchCh  chan *resource.WrittenEvent
	itemErr  error // returned from the iterator partway through
	itemErrI int   // index after which to inject itemErr
}

// emit synchronously delivers a watch event on the channel set up by
// startWatch. Tests use it to drive the watch path.
func (f *fakeStorage) emit(ev *resource.WrittenEvent) {
	f.mu.Lock()
	ch := f.watchCh
	f.mu.Unlock()
	if ch == nil {
		return
	}
	ch <- ev
}

func (f *fakeStorage) WriteEvent(context.Context, resource.WriteEvent) (int64, error) {
	panic("not implemented")
}
func (f *fakeStorage) ReadResource(context.Context, *resourcepb.ReadRequest) *resource.BackendReadResponse {
	panic("not implemented")
}
func (f *fakeStorage) ListIterator(context.Context, *resourcepb.ListRequest, func(resource.ListIterator) error) (int64, error) {
	panic("not implemented")
}
func (f *fakeStorage) ListHistory(context.Context, *resourcepb.ListRequest, func(resource.ListIterator) error) (int64, error) {
	panic("not implemented")
}

// WatchWriteEvents returns a channel the test can push events onto via
// emit(). Closing happens when the parent ctx ends (handled by the test
// harness). Tests that need watch errors set watchErr.
func (f *fakeStorage) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.watchErr != nil {
		return nil, f.watchErr
	}
	if f.watchCh == nil {
		f.watchCh = make(chan *resource.WrittenEvent, 16)
	}
	return f.watchCh, nil
}

// GetResourceStats returns one ResourceStats per distinct
// (namespace, group, resource) seen in `changes`. Used elsewhere in
// the codebase; the reconciler doesn't call it directly post-refactor.
func (f *fakeStorage) GetResourceStats(_ context.Context, nsr resource.NamespacedResource, _ int) ([]resource.ResourceStats, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	seen := map[string]resource.ResourceStats{}
	for _, c := range f.changes {
		if c.Key.Group != nsr.Group || c.Key.Resource != nsr.Resource {
			continue
		}
		k := c.Key.Namespace
		s, ok := seen[k]
		if !ok {
			s = resource.ResourceStats{
				NamespacedResource: resource.NamespacedResource{
					Namespace: c.Key.Namespace,
					Group:     c.Key.Group,
					Resource:  c.Key.Resource,
				},
			}
		}
		s.Count++
		if c.ResourceVersion > s.ResourceVersion {
			s.ResourceVersion = c.ResourceVersion
		}
		seen[k] = s
	}
	out := make([]resource.ResourceStats, 0, len(seen))
	for _, s := range seen {
		out = append(out, s)
	}
	return out, nil
}
func (f *fakeStorage) GetResourceLastImportTimes(context.Context) iter.Seq2[resource.ResourceLastImportTime, error] {
	panic("not implemented")
}

func (f *fakeStorage) ListModifiedSince(_ context.Context, key resource.NamespacedResource, sinceRv int64, _ *time.Time) (int64, iter.Seq2[*resource.ModifiedResource, error]) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.listErr != nil {
		err := f.listErr
		return 0, func(yield func(*resource.ModifiedResource, error) bool) {
			yield(nil, err)
		}
	}
	// Snapshot the slice + per-iteration error config so the iterator
	// closes over a stable view. The reconciler runs the iter outside the
	// lock, and the test may mutate state afterwards. Empty namespace
	// runs cross-namespace, mirroring the real backends.
	matches := make([]*resource.ModifiedResource, 0, len(f.changes))
	var latestRv int64
	for _, c := range f.changes {
		if c.Key.Group != key.Group || c.Key.Resource != key.Resource {
			continue
		}
		if key.Namespace != "" && c.Key.Namespace != key.Namespace {
			continue
		}
		if c.ResourceVersion <= sinceRv {
			continue
		}
		matches = append(matches, c)
		if c.ResourceVersion > latestRv {
			latestRv = c.ResourceVersion
		}
	}
	itemErr := f.itemErr
	itemErrI := f.itemErrI
	return latestRv, func(yield func(*resource.ModifiedResource, error) bool) {
		for i, c := range matches {
			if itemErr != nil && i == itemErrI {
				if !yield(nil, itemErr) {
					return
				}
				continue
			}
			if !yield(c, nil) {
				return
			}
		}
	}
}

// fakeVector records calls and lets tests inspect upserts/deletes/checkpoint advancement.
type fakeVector struct {
	mu sync.Mutex

	latestRV    int64
	upserts     [][]vector.Vector
	deletes     []deleteCall
	delsubs     []deleteSubsCall
	storedSubs  map[string]map[string]string // ns|model|res|uid -> sub -> content
	upsertErr   error
	upsertErrFn func(vs []vector.Vector) error // dynamic error decision
	deleteErr   error

	lockUnavailable bool
	lockAttempts    int
	lockReleases    int

	setLatestRVCalls int
	setLatestRVErr   error
	getLatestRVErr   error
}

type deleteCall struct{ Namespace, Model, Resource, UID string }
type deleteSubsCall struct {
	Namespace, Model, Resource, UID string
	Subresources                    []string
}

func newFakeVector() *fakeVector {
	return &fakeVector{storedSubs: map[string]map[string]string{}}
}

func subsKey(ns, model, res, uid string) string { return ns + "|" + model + "|" + res + "|" + uid }

func (f *fakeVector) Search(context.Context, string, string, string, []float32, int, ...vector.SearchFilter) ([]vector.VectorSearchResult, error) {
	return nil, nil
}
func (f *fakeVector) Upsert(_ context.Context, vs []vector.Vector) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.upsertLocked(vs)
}

func (f *fakeVector) UpsertReplaceSubresources(_ context.Context, vs []vector.Vector) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	// Atomic stale-removal + upsert: stage the delete-stale step, then
	// the upsert. Failure on either rolls back via the lock-protected
	// snapshot.
	type uidKey struct{ ns, model, res, uid string }
	groups := map[uidKey]map[string]struct{}{}
	for _, v := range vs {
		k := uidKey{v.Namespace, v.Model, v.Resource, v.UID}
		if groups[k] == nil {
			groups[k] = map[string]struct{}{}
		}
		groups[k][v.Subresource] = struct{}{}
	}
	for k, keep := range groups {
		key := subsKey(k.ns, k.model, k.res, k.uid)
		stored := f.storedSubs[key]
		var stale []string
		for sub := range stored {
			if _, ok := keep[sub]; !ok {
				stale = append(stale, sub)
			}
		}
		if len(stale) > 0 {
			f.delsubs = append(f.delsubs, deleteSubsCall{k.ns, k.model, k.res, k.uid, stale})
			for _, s := range stale {
				delete(stored, s)
			}
		}
	}
	return f.upsertLocked(vs)
}

func (f *fakeVector) upsertLocked(vs []vector.Vector) error {
	if f.upsertErrFn != nil {
		if err := f.upsertErrFn(vs); err != nil {
			return err
		}
	}
	if f.upsertErr != nil {
		return f.upsertErr
	}
	f.upserts = append(f.upserts, vs)
	for _, v := range vs {
		k := subsKey(v.Namespace, v.Model, v.Resource, v.UID)
		if f.storedSubs[k] == nil {
			f.storedSubs[k] = map[string]string{}
		}
		f.storedSubs[k][v.Subresource] = v.Content
	}
	return nil
}
func (f *fakeVector) Delete(_ context.Context, ns, model, res, uid string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.deleteErr != nil {
		return f.deleteErr
	}
	f.deletes = append(f.deletes, deleteCall{ns, model, res, uid})
	delete(f.storedSubs, subsKey(ns, model, res, uid))
	return nil
}
func (f *fakeVector) DeleteSubresources(_ context.Context, ns, model, res, uid string, subs []string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.delsubs = append(f.delsubs, deleteSubsCall{ns, model, res, uid, subs})
	if m := f.storedSubs[subsKey(ns, model, res, uid)]; m != nil {
		for _, s := range subs {
			delete(m, s)
		}
	}
	return nil
}
func (f *fakeVector) GetSubresourceContent(_ context.Context, ns, model, res, uid string) (map[string]string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := map[string]string{}
	for k, v := range f.storedSubs[subsKey(ns, model, res, uid)] {
		out[k] = v
	}
	if len(out) == 0 {
		return nil, nil
	}
	return out, nil
}
func (f *fakeVector) Exists(context.Context, string, string, string, string) (bool, error) {
	return false, nil
}
func (f *fakeVector) GetLatestRV(context.Context) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.getLatestRVErr != nil {
		return 0, f.getLatestRVErr
	}
	return f.latestRV, nil
}
func (f *fakeVector) SetLatestRV(_ context.Context, rv int64) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.setLatestRVCalls++
	if f.setLatestRVErr != nil {
		return f.setLatestRVErr
	}
	if rv > f.latestRV {
		f.latestRV = rv
	}
	return nil
}
func (f *fakeVector) ListIncompleteBackfillJobs(context.Context, string) ([]vector.BackfillJob, error) {
	return nil, nil
}
func (f *fakeVector) UpdateBackfillJobCheckpoint(context.Context, int64, string, string) error {
	return nil
}
func (f *fakeVector) MarkBackfillJobError(context.Context, int64, string) error { return nil }
func (f *fakeVector) CompleteBackfillJob(context.Context, int64) error          { return nil }
func (f *fakeVector) TryAcquireBackfillLock(context.Context) (func(), bool, error) {
	return func() {}, true, nil
}
func (f *fakeVector) TryAcquireReconcilerLock(context.Context) (func(), bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.lockAttempts++
	if f.lockUnavailable {
		return nil, false, nil
	}
	return func() {
		f.mu.Lock()
		defer f.mu.Unlock()
		f.lockReleases++
	}, true, nil
}

// fakeText is a deterministic embedder used by the reconciler. It
// records each EmbedText invocation so tests can assert on the *number*
// of pooled calls — the whole point of the reconcile-cycle batching.
type fakeText struct {
	mu       sync.Mutex
	dim      int
	calls    int     // number of EmbedText invocations
	textSets [][]int // counts of texts per call (per-call sizes)
	failNext error   // if non-nil, returned from the next EmbedText call
}

func (f *fakeText) EmbedText(_ context.Context, in embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	f.textSets = append(f.textSets, []int{len(in.Texts)})
	if f.failNext != nil {
		err := f.failNext
		f.failNext = nil
		return embedder.EmbedTextOutput{}, err
	}
	out := embedder.EmbedTextOutput{Embeddings: make([]embedder.Embedding, len(in.Texts))}
	for i := range in.Texts {
		dense := make([]float32, f.dim)
		for j := range dense {
			dense[j] = 0.5
		}
		out.Embeddings[i] = embedder.Embedding{Dense: dense}
	}
	return out, nil
}

func newFakeEmbedder(text *fakeText) *embedder.Embedder {
	return &embedder.Embedder{
		TextEmbedder: text,
		Model:        "test-model",
		VectorType:   embedder.VectorTypeDense,
		Metric:       embedder.CosineDistance,
		Dimensions:   uint32(text.dim),
	}
}

var errBoom = errors.New("boom")

// fakeBroadcaster is the smallest viable resource.Broadcaster impl for
// the reconciler tests. It returns a single subscriber channel, lets
// the test push events via emit(), and records unsubscribe calls so
// we can assert clean shutdown.
type fakeBroadcaster struct {
	mu              sync.Mutex
	subscribeErr    error
	ch              chan *resource.WrittenEvent
	subscribeCalls  int
	unsubscribeCh   <-chan *resource.WrittenEvent
	unsubscribeOnce sync.Once
}

func newFakeBroadcaster() *fakeBroadcaster {
	return &fakeBroadcaster{ch: make(chan *resource.WrittenEvent, 16)}
}

func (b *fakeBroadcaster) Subscribe(_ context.Context, _, _ string) (<-chan *resource.WrittenEvent, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.subscribeCalls++
	if b.subscribeErr != nil {
		return nil, b.subscribeErr
	}
	return b.ch, nil
}

func (b *fakeBroadcaster) Unsubscribe(ch <-chan *resource.WrittenEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.unsubscribeCh = ch
	// Closing once so consumeWatchEvents exits via the `!ok` branch
	// (the real broadcaster has the same behavior on Unsubscribe).
	b.unsubscribeOnce.Do(func() { close(b.ch) })
}

func (b *fakeBroadcaster) emit(ev *resource.WrittenEvent) {
	b.ch <- ev
}

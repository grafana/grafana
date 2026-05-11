package backfill

import (
	"context"
	"fmt"
	"iter"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

// fakeListIterator implements resource.ListIterator. It carries a reference
// to the *full* result slice plus the page boundaries so ContinueToken can
// honestly distinguish "exhausted page" from "exhausted everything".
type fakeListIterator struct {
	full      []listItem
	pageStart int // inclusive index into full
	pageEnd   int // exclusive index into full
	idx       int // 0 = "before first item"; advanced by Next.
	err       error
}

func (i *fakeListIterator) Next() bool {
	if i.idx >= i.pageEnd-i.pageStart {
		return false
	}
	i.idx++
	return true
}
func (i *fakeListIterator) Error() error { return i.err }
func (i *fakeListIterator) ContinueToken() string {
	nextAbs := i.pageStart + i.idx
	if nextAbs >= len(i.full) {
		return ""
	}
	return fmt.Sprintf("tok-%d", nextAbs)
}

func (i *fakeListIterator) item() listItem         { return i.full[i.pageStart+i.idx-1] }
func (i *fakeListIterator) ResourceVersion() int64 { return i.item().RV }
func (i *fakeListIterator) Namespace() string      { return i.item().Namespace }
func (i *fakeListIterator) Name() string           { return i.item().Name }
func (i *fakeListIterator) Folder() string         { return i.item().Folder }
func (i *fakeListIterator) Value() []byte          { return i.item().Value }

// fakeStorage implements just enough of resource.StorageBackend to drive
// resourceembedder tests. ReadResource looks up by full key; ListIterator yields
// the configured items in order.
type fakeStorage struct {
	mu sync.Mutex
	// resources[ns/group/resource/name] = (value, rv).
	resources map[string]storedResource
	readErr   error
	notFound  map[string]struct{}

	// Backfill iteration state. listItems is the full result set; the fake
	// honours req.Limit to simulate pagination + peek-for-more.
	listItems []listItem
	listErr   error
	// listCalls records each ListIterator invocation's NextPageToken so
	// tests can assert the backfiller actually paginated rather than
	// pulling everything in a single call.
	listCalls []string
}

type listItem struct {
	Namespace, Name, Folder string
	Value                   []byte
	RV                      int64
}

type storedResource struct {
	Value []byte
	RV    int64
}

func newFakeStorage() *fakeStorage {
	return &fakeStorage{
		resources: map[string]storedResource{},
		notFound:  map[string]struct{}{},
	}
}

func storeKey(ns, group, res, name string) string {
	return ns + "/" + group + "/" + res + "/" + name
}

func (f *fakeStorage) ReadResource(_ context.Context, req *resourcepb.ReadRequest) *resource.BackendReadResponse {
	if f.readErr != nil {
		return &resource.BackendReadResponse{Error: &resourcepb.ErrorResult{Code: 500, Message: f.readErr.Error()}}
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	k := storeKey(req.Key.Namespace, req.Key.Group, req.Key.Resource, req.Key.Name)
	if _, nf := f.notFound[k]; nf {
		return &resource.BackendReadResponse{Error: &resourcepb.ErrorResult{Code: 404, Message: "not found"}}
	}
	r, ok := f.resources[k]
	if !ok {
		return &resource.BackendReadResponse{Error: &resourcepb.ErrorResult{Code: 404, Message: "not found"}}
	}
	return &resource.BackendReadResponse{
		Key:             req.Key,
		Value:           r.Value,
		ResourceVersion: r.RV,
	}
}

// Unused methods of StorageBackend — panic so a test that hits them is
// obviously wrong rather than silently passing.
func (f *fakeStorage) WriteEvent(context.Context, resource.WriteEvent) (int64, error) {
	panic("not implemented")
}

// ListIterator simulates pagination: req.Limit determines how many items
// to yield this call. The fake yields up to Limit+1 items so the
// resourceembedder's "peek for next page" logic exercises correctly.
// req.NextPageToken is parsed as "tok-<index>" pointing at the next item.
func (f *fakeStorage) ListIterator(_ context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	f.mu.Lock()
	f.listCalls = append(f.listCalls, req.NextPageToken)
	f.mu.Unlock()
	if f.listErr != nil {
		return 0, f.listErr
	}
	start := 0
	if req.NextPageToken != "" {
		var idx int
		_, err := fmt.Sscanf(req.NextPageToken, "tok-%d", &idx)
		if err == nil {
			start = idx
		}
	}
	end := len(f.listItems)
	if req.Limit > 0 {
		max := start + int(req.Limit) + 1
		if max < end {
			end = max
		}
	}
	iter := &fakeListIterator{full: f.listItems, pageStart: start, pageEnd: end}
	return 1, cb(iter)
}

func (f *fakeStorage) ListHistory(context.Context, *resourcepb.ListRequest, func(resource.ListIterator) error) (int64, error) {
	panic("not implemented")
}
func (f *fakeStorage) ListModifiedSince(context.Context, resource.NamespacedResource, int64, *time.Time) (int64, iter.Seq2[*resource.ModifiedResource, error]) {
	panic("not implemented")
}
func (f *fakeStorage) WatchWriteEvents(context.Context) (<-chan *resource.WrittenEvent, error) {
	panic("not implemented")
}
func (f *fakeStorage) GetResourceStats(context.Context, resource.NamespacedResource, int) ([]resource.ResourceStats, error) {
	panic("not implemented")
}
func (f *fakeStorage) GetResourceLastImportTimes(context.Context) iter.Seq2[resource.ResourceLastImportTime, error] {
	panic("not implemented")
}

// fakeVector records calls and lets tests preload Exists / GetSubresourceContent.
type fakeVector struct {
	mu                 sync.Mutex
	upserts            [][]vector.Vector
	deletes            []deleteCall
	subresourceDeletes []deleteSubsCall
	existing           map[string]map[string]string // uid → subresource → content
	existsSet          map[string]bool              // ns|model|resource|uid → true
	upsertErr          error

	// Backfill bookkeeping:
	jobs            []vector.BackfillJob
	checkpoints     []checkpointCall
	errorMarks      []errorMarkCall
	completedJobIDs []int64
	updateErr       error
	markErrErr      error
	completeErr     error

	// Advisory-lock simulation:
	lockUnavailable bool
	lockAttempts    int
	lockReleases    int
}

type checkpointCall struct {
	ID          int64
	LastSeenKey string
	LastError   string
}

type errorMarkCall struct {
	ID        int64
	LastError string
}

type deleteCall struct{ Namespace, Model, Resource, UID string }
type deleteSubsCall struct {
	Namespace, Model, Resource, UID string
	Subresources                    []string
}

func newFakeVector() *fakeVector {
	return &fakeVector{
		existing:  map[string]map[string]string{},
		existsSet: map[string]bool{},
	}
}

func existsKey(ns, model, res, uid string) string {
	return ns + "|" + model + "|" + res + "|" + uid
}

func (f *fakeVector) markExists(ns, model, res, uid string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.existsSet[existsKey(ns, model, res, uid)] = true
}

func (f *fakeVector) Search(context.Context, string, string, string, []float32, int, ...vector.SearchFilter) ([]vector.VectorSearchResult, error) {
	return nil, nil
}
func (f *fakeVector) UpsertReplaceSubresources(ctx context.Context, vs []vector.Vector) error {
	return f.Upsert(ctx, vs)
}
func (f *fakeVector) Upsert(_ context.Context, vs []vector.Vector) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.upsertErr != nil {
		return f.upsertErr
	}
	f.upserts = append(f.upserts, vs)
	return nil
}
func (f *fakeVector) Delete(_ context.Context, namespace, model, res, uid string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.deletes = append(f.deletes, deleteCall{namespace, model, res, uid})
	return nil
}
func (f *fakeVector) DeleteSubresources(_ context.Context, namespace, model, res, uid string, subs []string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.subresourceDeletes = append(f.subresourceDeletes, deleteSubsCall{namespace, model, res, uid, subs})
	return nil
}
func (f *fakeVector) GetSubresourceContent(_ context.Context, _, _, _, uid string) (map[string]string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if existing, ok := f.existing[uid]; ok {
		out := make(map[string]string, len(existing))
		for k, v := range existing {
			out[k] = v
		}
		return out, nil
	}
	return nil, nil
}
func (f *fakeVector) Exists(_ context.Context, ns, model, res, uid string) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.existsSet[existsKey(ns, model, res, uid)], nil
}
func (f *fakeVector) GetLatestRV(context.Context) (int64, error) { return 0, nil }
func (f *fakeVector) SetLatestRV(context.Context, int64) error   { return nil }
func (f *fakeVector) TryAcquireReconcilerLock(context.Context) (func(), bool, error) {
	return func() {}, true, nil
}
func (f *fakeVector) ListIncompleteBackfillJobs(_ context.Context, model string) ([]vector.BackfillJob, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]vector.BackfillJob, 0, len(f.jobs))
	for _, j := range f.jobs {
		if j.Model == model {
			out = append(out, j)
		}
	}
	return out, nil
}
func (f *fakeVector) UpdateBackfillJobCheckpoint(_ context.Context, id int64, key, e string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.updateErr != nil {
		return f.updateErr
	}
	f.checkpoints = append(f.checkpoints, checkpointCall{ID: id, LastSeenKey: key, LastError: e})
	return nil
}
func (f *fakeVector) MarkBackfillJobError(_ context.Context, id int64, e string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.markErrErr != nil {
		return f.markErrErr
	}
	f.errorMarks = append(f.errorMarks, errorMarkCall{ID: id, LastError: e})
	return nil
}
func (f *fakeVector) CompleteBackfillJob(_ context.Context, id int64) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.completeErr != nil {
		return f.completeErr
	}
	f.completedJobIDs = append(f.completedJobIDs, id)
	return nil
}
func (f *fakeVector) TryAcquireBackfillLock(context.Context) (func(), bool, error) {
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

// fakeText is a deterministic embedder: returns one fixed-dim vector per text.
type fakeText struct {
	dim int
	err error
}

func (f *fakeText) EmbedText(_ context.Context, in embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
	if f.err != nil {
		return embedder.EmbedTextOutput{}, f.err
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

package resource

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"iter"
	"sync"
	"testing"
	"time"

	"github.com/grafana/dskit/backoff"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// flakyStep describes one injected failure in flakyBatchGetKV's plan.
//
//	at          — Inject on the incoming item when yielded == at.
//	onValueRead — If true, wrap the Value so the first Read() returns err.
//	              If false, yield (KeyValue{}, err) and terminate the stream.
type flakyStep struct {
	at          int
	onValueRead bool
	err         error
}

// flakyBatchGetKV wraps a KV and injects a sequence of failures into the BatchGet stream.
type flakyBatchGetKV struct {
	kv.KV
	plan []flakyStep

	stepIdx  int
	yielded  int
	injected int
}

type errReader struct{ err error }

func (e *errReader) Read(p []byte) (int, error) { return 0, e.err }
func (e *errReader) Close() error               { return nil }

func (f *flakyBatchGetKV) BatchGet(ctx context.Context, section string, keys []string) iter.Seq2[kv.KeyValue, error] {
	inner := f.KV.BatchGet(ctx, section, keys)
	return func(yield func(kv.KeyValue, error) bool) {
		for v, err := range inner {
			if err != nil {
				yield(v, err)
				return
			}
			if f.stepIdx < len(f.plan) && f.yielded == f.plan[f.stepIdx].at {
				step := f.plan[f.stepIdx]
				f.stepIdx++
				f.injected++
				if step.onValueRead {
					if v.Value != nil {
						_ = v.Value.Close()
					}
					v.Value = &errReader{err: step.err}
					if !yield(v, nil) {
						return
					}
					f.yielded++
					continue
				}
				if v.Value != nil {
					_ = v.Value.Close()
				}
				yield(kv.KeyValue{}, step.err)
				return
			}
			if !yield(v, nil) {
				return
			}
			f.yielded++
		}
	}
}

// failAt builds a plan that injects `count` yield-error failures all at the same yield offset.
func failAt(offset int, count int, err error) []flakyStep {
	plan := make([]flakyStep, count)
	for i := range plan {
		plan[i] = flakyStep{at: offset, err: err}
	}
	return plan
}

// retryableErr wraps err with kv.ErrRetryable.
func retryableErr(err error) error {
	return fmt.Errorf("%w: %w", kv.ErrRetryable, err)
}

// fastListIteratorBackoff is a sub-millisecond backoff override for tests.
var fastListIteratorBackoff = backoff.Config{MinBackoff: time.Microsecond, MaxBackoff: time.Millisecond}

func swapListBackoff(t *testing.T) {
	t.Helper()
	orig := kvListIteratorBackoff
	kvListIteratorBackoff = fastListIteratorBackoff
	t.Cleanup(func() { kvListIteratorBackoff = orig })
}

var testRetryPolicy = BatchGetRetryPolicy{
	MaxConsecutiveFailures: 3,
	MaxTotalFailureRate:    0,  // rely solely on FailureBudgetFloor
	FailureBudgetFloor:     10, // legacy maxKvListIteratorTotalAttempts
}

func makeTestDataKey(name string) DataKey {
	return DataKey{
		Group:           "testgroup",
		Resource:        "testresource",
		Namespace:       "testns",
		Name:            name,
		ResourceVersion: node.Generate().Int64(),
		Action:          kv.DataActionCreated,
	}
}

func keyNames(keys []DataKey) []string {
	out := make([]string, len(keys))
	for i, k := range keys {
		out[i] = k.Name
	}
	return out
}

// seedKeys saves n DataObjs with bodies produced by body(i). Returns the
// keys in insertion order.
func seedKeys(t *testing.T, ds *dataStore, n int, body func(i int) string) []DataKey {
	t.Helper()
	ctx := context.Background()
	out := make([]DataKey, 0, n)
	for i := 0; i < n; i++ {
		dk := makeTestDataKey(fmt.Sprintf("obj-%06d", i))
		require.NoError(t, ds.Save(ctx, dk, bytes.NewReader([]byte(body(i)))))
		out = append(out, dk)
	}
	return out
}

// historyBody returns a JSON body annotated with the given manager kind.
func historyBody(manager []string) func(i int) string {
	return func(i int) string {
		if i < len(manager) && manager[i] != "" {
			return fmt.Sprintf(`{"metadata":{"annotations":{"grafana.app/managedBy":%q}}}`, manager[i])
		}
		return `{"metadata":{}}`
	}
}

// collectNames drains an iterator, returning the yielded names and the
// iterator's final error. Works for any ListIterator.
func collectNames(it ListIterator) ([]string, error) {
	var names []string
	for it.Next() {
		names = append(names, it.Name())
	}
	return names, it.Error()
}

// setupListRetryTest wires a flakyBatchGetKV around a fresh Badger store,
// seeds n list-style keys, and returns an attached kvListIterator along
// with the seeded keys and the flaky wrapper for assertions.
func setupListRetryTest(t *testing.T, n int, plan []flakyStep, policy BatchGetRetryPolicy) (*kvListIterator, []DataKey, *flakyBatchGetKV) {
	t.Helper()
	realKV := setupBadgerKV(t)
	ds := newDataStore(realKV, nil)
	keys := seedKeys(t, ds, n, func(int) string { return "v" })
	flaky := &flakyBatchGetKV{KV: realKV, plan: plan}
	it := newKvListIterator(context.Background(), newDataStore(flaky, nil), keys, 0, false, policy)
	t.Cleanup(it.stop)
	return it, keys, flaky
}

// setupHistoryRetryTest is the history analogue of setupListRetryTest.
// manager is the per-index provisioned-kind annotation; pass nil for none.
func setupHistoryRetryTest(t *testing.T, n int, manager []string, skipProvisioned bool, plan []flakyStep, policy BatchGetRetryPolicy) (*kvHistoryIterator, []DataKey, *flakyBatchGetKV) {
	t.Helper()
	realKV := setupBadgerKV(t)
	ds := newDataStore(realKV, nil)
	keys := seedKeys(t, ds, n, historyBody(manager))
	flaky := &flakyBatchGetKV{KV: realKV, plan: plan}
	it := newKvHistoryIterator(context.Background(), newDataStore(flaky, nil), keys, 0, skipProvisioned, policy)
	t.Cleanup(it.stop)
	return it, keys, flaky
}

type iteratorFlavor struct {
	name  string
	setup func(t *testing.T, n int, plan []flakyStep) (ListIterator, []DataKey, *flakyBatchGetKV)
}

var iteratorFlavors = []iteratorFlavor{
	{
		name: "list",
		setup: func(t *testing.T, n int, plan []flakyStep) (ListIterator, []DataKey, *flakyBatchGetKV) {
			it, keys, flaky := setupListRetryTest(t, n, plan, testRetryPolicy)
			return it, keys, flaky
		},
	},
	{
		name: "history",
		setup: func(t *testing.T, n int, plan []flakyStep) (ListIterator, []DataKey, *flakyBatchGetKV) {
			it, keys, flaky := setupHistoryRetryTest(t, n, nil, false, plan, testRetryPolicy)
			return it, keys, flaky
		},
	},
}

// TestKvIterator_Retry exercises retry behavior that must hold for any
// BatchGet-backed iterator. Each subtest runs once per flavor.
func TestKvIterator_Retry(t *testing.T) {
	swapListBackoff(t)

	for _, f := range iteratorFlavors {
		t.Run(f.name, func(t *testing.T) {
			t.Run("resumes after retryable mid-stream error", func(t *testing.T) {
				it, keys, flaky := f.setup(t, 5,
					failAt(2, 1, retryableErr(errors.New("simulated transient"))))
				names, err := collectNames(it)
				require.NoError(t, err)
				assert.Equal(t, keyNames(keys), names)
				assert.Equal(t, 1, flaky.injected)
			})

			t.Run("resumes across multiple retryable failures interspersed with progress", func(t *testing.T) {
				// Fail at yield 1, 2, 3 — after each success the counter
				// resets so another failure can fire. Iterator must still
				// deliver all keys in order exactly once.
				retry := retryableErr(errors.New("flap"))
				it, keys, flaky := f.setup(t, 5, []flakyStep{
					{at: 1, err: retry},
					{at: 2, err: retry},
					{at: 3, err: retry},
				})
				names, err := collectNames(it)
				require.NoError(t, err)
				assert.Equal(t, keyNames(keys), names)
				assert.Equal(t, 3, flaky.injected)
			})

			t.Run("resumes after retryable Value.Read error", func(t *testing.T) {
				// kvGRPC.BatchGet can yield a key successfully, then return
				// kv.ErrRetryable while readAndClose consumes the streamed
				// value. The current key must be re-fetched, not skipped.
				it, keys, flaky := f.setup(t, 4, []flakyStep{
					{at: 2, onValueRead: true, err: retryableErr(errors.New("value-read flap"))},
				})
				names, err := collectNames(it)
				require.NoError(t, err)
				assert.Equal(t, keyNames(keys), names)
				assert.Equal(t, 1, flaky.injected)
			})

			t.Run("non-retryable error propagates immediately", func(t *testing.T) {
				nonRetryable := errors.New("permanent")
				it, keys, _ := f.setup(t, 3, failAt(1, 1, nonRetryable))
				names, err := collectNames(it)
				require.Error(t, err)
				assert.ErrorIs(t, err, nonRetryable)
				assert.False(t, errors.Is(err, kv.ErrRetryable), "non-retryable error must not be tagged retryable")
				assert.Equal(t, []string{keys[0].Name}, names)
			})

			t.Run("exhausts consecutive-failure budget", func(t *testing.T) {
				it, _, flaky := f.setup(t, 3,
					failAt(0, testRetryPolicy.MaxConsecutiveFailures, retryableErr(errors.New("down"))))
				names, err := collectNames(it)
				require.Error(t, err)
				assert.ErrorIs(t, err, kv.ErrRetryable)
				assert.Empty(t, names)
				assert.Equal(t, testRetryPolicy.MaxConsecutiveFailures, flaky.injected)
			})

			t.Run("exhausts total-attempt budget despite progress", func(t *testing.T) {
				// Each failure is interspersed with one successful yield so
				// the consecutive counter resets between failures. Total
				// attempts must still cap the retries.
				retry := retryableErr(errors.New("flap"))
				totalCap := testRetryPolicy.totalBudget(testRetryPolicy.FailureBudgetFloor + 2)
				plan := make([]flakyStep, totalCap)
				for i := range plan {
					plan[i] = flakyStep{at: i + 1, err: retry}
				}
				it, keys, flaky := f.setup(t, totalCap+2, plan)
				names, err := collectNames(it)
				require.Error(t, err)
				assert.ErrorIs(t, err, kv.ErrRetryable)
				// We made real progress before giving up: at least one key
				// was yielded, but not all of them.
				assert.NotEmpty(t, names)
				assert.Less(t, len(names), len(keys))
				assert.Equal(t, totalCap, flaky.injected)
			})

			t.Run("ContinueToken is non-empty across retryable recoveries", func(t *testing.T) {
				// After the iterator transparently recovers from a
				// retryable error, its observable state (including
				// ContinueToken) must reflect a real yielded item.
				it, keys, _ := f.setup(t, 4,
					failAt(1, 1, retryableErr(errors.New("mid-stream flap"))))

				// Drain one key before the injected failure.
				require.True(t, it.Next())
				require.Equal(t, keys[0].Name, it.Name())
				require.NotEmpty(t, it.ContinueToken())

				// The retry fires as the iterator tries to advance past
				// obj-a; this Next() must still return a live, named item.
				require.True(t, it.Next())
				require.NotEmpty(t, it.Name())
				require.NotEmpty(t, it.ContinueToken(), "ContinueToken must not be empty right after a retryable failure was resolved")

				// Rest completes cleanly without re-yielding already-seen keys.
				rest, err := collectNames(it)
				require.NoError(t, err)
				assert.Equal(t, keyNames(keys[2:]), rest)
			})
		})
	}

	// spreadFailures returns a plan with `failures` retryable errors
	// distributed evenly across `n` yields, each at the midpoint of its
	// stride window so every failure is preceded by successful yields.
	// That keeps offsets in [0, n) and stops the consecutive-failure cap
	// from tripping for low failure rates.
	spreadFailures := func(n, failures int, err error) []flakyStep {
		plan := make([]flakyStep, failures)
		stride := n / failures
		for i := range plan {
			plan[i] = flakyStep{at: i*stride + stride/2, err: err}
		}
		return plan
	}

	scaledPolicy := BatchGetRetryPolicy{
		MaxConsecutiveFailures: 3,
		MaxTotalFailureRate:    0.10,
		FailureBudgetFloor:     20,
	}

	t.Run("scaled budget tolerates spread-out failures across large key set", func(t *testing.T) {
		// 500 keys with 5% failures. Scaled budget is max(20, 0.10*500) = 50.
		const n = 500
		const failures = n / 20
		it, keys, flaky := setupListRetryTest(t, n,
			spreadFailures(n, failures, retryableErr(errors.New("noise"))),
			scaledPolicy)
		names, err := collectNames(it)
		require.NoError(t, err)
		assert.Equal(t, keyNames(keys), names)
		assert.Equal(t, failures, flaky.injected)
	})

	t.Run("scaled budget still trips on excessive failure rate", func(t *testing.T) {
		// 200 keys with 25% failures (50 errors) exceeds the budget of
		// max(20, 0.10*200) = 20.
		const n = 200
		const failures = 50
		it, _, flaky := setupListRetryTest(t, n,
			spreadFailures(n, failures, retryableErr(errors.New("flood"))),
			scaledPolicy)
		names, err := collectNames(it)
		require.Error(t, err)
		assert.ErrorIs(t, err, kv.ErrRetryable)
		assert.NotEmpty(t, names)
		assert.Less(t, len(names), n)
		assert.Equal(t, scaledPolicy.totalBudget(n), flaky.injected)
	})

	// kvListIterator specific behavior
	t.Run("ContinueToken sees valid next key after retryable prefetch failure", func(t *testing.T) {
		it, keys, _ := setupListRetryTest(t, 3,
			failAt(1, 1, retryableErr(errors.New("prefetch flap"))),
			testRetryPolicy)

		require.True(t, it.Next())
		require.Equal(t, keys[0].Name, it.Name())
		assert.NotEmpty(t, it.ContinueToken(), "ContinueToken must not be empty right after a retryable prefetch failure was resolved")
		assert.Equal(t, keys[1].Name, it.nextDataObj.Key.Name)

		// The rest of the iteration still completes cleanly.
		rest, err := collectNames(it)
		require.NoError(t, err)
		assert.Equal(t, []string{keys[1].Name, keys[2].Name}, rest)
	})

	// kvHistoryIterator specific behavior
	t.Run("skipProvisioned advances past skipped items and retries correctly", func(t *testing.T) {
		// Seed 4 items; two of them are provisioned (annotated with a
		// manager kind). With skipProvisioned=true the iterator must yield
		// only the two unmanaged items — AND if a retryable error fires
		// after a skipped item, the retry must not re-fetch it.
		it, keys, flaky := setupHistoryRetryTest(t, 4,
			[]string{"", "git", "", "git"}, true,
			failAt(2, 1, retryableErr(errors.New("flap"))),
			testRetryPolicy)
		names, err := collectNames(it)
		require.NoError(t, err)
		// idx 0 and idx 2 are unmanaged and survive.
		assert.Equal(t, []string{keys[0].Name, keys[2].Name}, names)
		assert.Equal(t, 1, flaky.injected)
	})
}

func TestKvStorageBackend_retryPolicyFor(t *testing.T) {
	k := &kvStorageBackend{}

	t.Run("untagged ctx picks the fixed sync default", func(t *testing.T) {
		assert.Equal(t, defaultBatchGetRetryPolicy, k.retryPolicyFor(context.Background()))
	})

	t.Run("WithIndexBuildRetryBudget picks the fixed rebuild default", func(t *testing.T) {
		ctx := WithIndexBuildRetryBudget(context.Background())
		assert.Equal(t, defaultRebuildBatchGetRetryPolicy, k.retryPolicyFor(ctx))
	})
}

func TestBatchGetRetryPolicy_TotalBudget(t *testing.T) {
	t.Run("rate=0 makes the budget exactly the floor", func(t *testing.T) {
		p := BatchGetRetryPolicy{
			MaxConsecutiveFailures: 3,
			MaxTotalFailureRate:    0,
			FailureBudgetFloor:     50,
		}
		assert.Equal(t, 50, p.totalBudget(1_000_000),
			"with rate=0, budget must be the floor regardless of key count")
	})

	t.Run("rate>0 scales above the floor", func(t *testing.T) {
		p := BatchGetRetryPolicy{
			MaxConsecutiveFailures: 3,
			MaxTotalFailureRate:    0.05,
			FailureBudgetFloor:     20,
		}
		assert.Equal(t, 20, p.totalBudget(100),
			"100 keys × 5%% = 5 < floor 20 → budget is the floor")
		assert.Equal(t, 5000, p.totalBudget(100_000),
			"100k keys × 5%% = 5000 > floor 20 → budget is the rate")
	})
}

// ctxCapturingStorage wraps mockStorageBackend and records the ctx passed
// to ListIterator. Tests use this to assert that the right callers tag ctx
// with WithIndexBuildRetryBudget.
type ctxCapturingStorage struct {
	mockStorageBackend
	mu           sync.Mutex
	listIterCtxs []context.Context
}

func (c *ctxCapturingStorage) ListIterator(ctx context.Context, _ *resourcepb.ListRequest, _ func(ListIterator) error) (int64, error) {
	c.mu.Lock()
	c.listIterCtxs = append(c.listIterCtxs, ctx)
	c.mu.Unlock()
	return 0, nil
}

func newRetryBudgetTestServer(t *testing.T, storage StorageBackend) *searchServer {
	t.Helper()
	opts := SearchOptions{
		Backend: &mockSearchBackend{},
		Resources: &TestDocumentBuilderSupplier{
			GroupsResources: map[string]string{"g": "r"},
		},
		InitMinCount: 1,
	}
	s, err := newSearchServer(opts, storage, nil, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, s)
	return s
}

// TestSearchServer_InitTagsCtxForRebuildBudget pins the wiring that
// resolved the original startup failure: when init runs s.buildIndexes,
// the ctx that reaches the storage backend must carry the
// WithIndexBuildRetryBudget marker.
func TestSearchServer_InitTagsCtxForRebuildBudget(t *testing.T) {
	storage := &ctxCapturingStorage{
		mockStorageBackend: mockStorageBackend{
			resourceStats: []ResourceStats{
				{NamespacedResource: NamespacedResource{Namespace: "ns", Group: "g", Resource: "r"}, Count: 50, ResourceVersion: 1},
			},
		},
	}
	s := newRetryBudgetTestServer(t, storage)

	_, err := s.buildIndexes(context.Background())
	require.NoError(t, err)

	require.Len(t, storage.listIterCtxs, 1, "init must call ListIterator once for the seeded resource")
	assert.True(t, isIndexBuildRetryBudget(storage.listIterCtxs[0]),
		"init's call to s.build must tag ctx with WithIndexBuildRetryBudget")
}

// TestSearchServer_GetOrCreateIndexDoesNotTagCtx guards against the
// reviewer's concern: under context.WithoutCancel a flaky build at request
// time could otherwise consume a budget proportional to the full key
// count, stalling search requests for hours.
func TestSearchServer_GetOrCreateIndexDoesNotTagCtx(t *testing.T) {
	storage := &ctxCapturingStorage{
		mockStorageBackend: mockStorageBackend{
			resourceStats: []ResourceStats{
				{NamespacedResource: NamespacedResource{Namespace: "ns", Group: "g", Resource: "r"}, Count: 50, ResourceVersion: 1},
			},
		},
	}
	s := newRetryBudgetTestServer(t, storage)

	_, err := s.getOrCreateIndex(context.Background(), nil,
		NamespacedResource{Namespace: "ns", Group: "g", Resource: "r"}, "test")
	require.NoError(t, err)

	require.Len(t, storage.listIterCtxs, 1, "getOrCreateIndex must call ListIterator once")
	assert.False(t, isIndexBuildRetryBudget(storage.listIterCtxs[0]),
		"getOrCreateIndex must NOT tag ctx with the rebuild retry budget")
}

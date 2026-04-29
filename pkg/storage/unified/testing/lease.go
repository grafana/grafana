package test

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"os"
	"reflect"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"testing/quick"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
)

// RunLeaseTest runs the lease contract suite against any kv.KV produced by
// newKV. The suite is shared between unit tests (using an in-memory map KV)
// and integration tests (Badger and sqlkv).
func RunLeaseTest(t *testing.T, newKV NewKVFunc) {
	t.Helper()

	store := newKV(t.Context())

	t.Run("happy path", func(t *testing.T) { runLeaseHappyPath(t, store) })
	t.Run("contention", func(t *testing.T) { runLeaseContention(t, store) })
	t.Run("concurrency", func(t *testing.T) { runLeaseConcurrency(t, store) })
	t.Run("expiration", func(t *testing.T) { runLeaseExpiration(t, store) })
	t.Run("release semantics", func(t *testing.T) { runLeaseReleaseSemantics(t, store) })
	t.Run("notifying loss", func(t *testing.T) { runLeaseLoss(t, store) })
	t.Run("kv errors", func(t *testing.T) { runLeaseKVErrors(t, &leaseFailingKV{KV: store}) })
	t.Run("property-based testing", func(t *testing.T) { runLeasePBT(t, store) })
}

func runLeaseHappyPath(t *testing.T, store kv.KV) {
	ctx := t.Context()
	m := lease.NewManager(store, "holder-happy")

	t.Run("acquire then release", func(t *testing.T) {
		l, err := m.Acquire(ctx, "happy/basic")
		require.NoError(t, err)
		require.NotNil(t, l)

		require.NoError(t, m.Release(ctx, l))
	})

	t.Run("acquire after release", func(t *testing.T) {
		l, err := m.Acquire(ctx, "happy/reacquire")
		require.NoError(t, err)
		require.NoError(t, m.Release(ctx, l))

		l2, err := m.Acquire(ctx, "happy/reacquire")
		require.NoError(t, err)
		require.NotNil(t, l2)
		require.NoError(t, m.Release(ctx, l2))
	})
}

func runLeaseContention(t *testing.T, store kv.KV) {
	ctx := t.Context()

	t.Run("different holders", func(t *testing.T) {
		a := lease.NewManager(store, "holder-a")
		b := lease.NewManager(store, "holder-b")

		l, err := a.Acquire(ctx, "contention/different-holders")
		require.NoError(t, err)

		_, err = b.Acquire(ctx, "contention/different-holders")
		require.ErrorIs(t, err, lease.ErrLeaseAlreadyHeld)

		require.NoError(t, a.Release(ctx, l))
	})

	t.Run("same holder twice", func(t *testing.T) {
		m := lease.NewManager(store, "holder-same")

		l, err := m.Acquire(ctx, "contention/same-holder")
		require.NoError(t, err)

		_, err = m.Acquire(ctx, "contention/same-holder")
		require.ErrorIs(t, err, lease.ErrLeaseAlreadyHeld)

		require.NoError(t, m.Release(ctx, l))
	})

	t.Run("different names do not interfere", func(t *testing.T) {
		m := lease.NewManager(store, "holder-multi")

		leaseA, err := m.Acquire(ctx, "contention/name-a")
		require.NoError(t, err)

		leaseB, err := m.Acquire(ctx, "contention/name-b")
		require.NoError(t, err)

		require.NotNil(t, leaseA)
		require.NotNil(t, leaseB)

		require.NoError(t, m.Release(ctx, leaseA))
		require.NoError(t, m.Release(ctx, leaseB))
	})
}

func runLeaseConcurrency(t *testing.T, store kv.KV) {
	const goroutines = 5
	ctx := t.Context()

	t.Run("same name, one winner", func(t *testing.T) {
		name := "concurrency/same-name"

		var (
			wg    sync.WaitGroup
			start = make(chan struct{})

			mu        sync.Mutex
			winner    *lease.Lease
			winnerM   *lease.Manager
			otherErrs []error
		)

		for i := range goroutines {
			holder := fmt.Sprintf("holder-race-%d", i)
			m := lease.NewManager(store, holder)
			wg.Go(func() {
				<-start
				l, err := m.Acquire(ctx, name)

				mu.Lock()
				defer mu.Unlock()
				switch {
				case err == nil:
					if winner != nil {
						otherErrs = append(otherErrs, fmt.Errorf("multiple winners: holder %s", holder))
						return
					}
					winner = l
					winnerM = m
				case errors.Is(err, lease.ErrLeaseAlreadyHeld):
					// expected error
				default:
					otherErrs = append(otherErrs, err)
				}
			})
		}
		close(start)
		wg.Wait()

		require.Empty(t, otherErrs, "unexpected errors from racing acquires")
		require.NotNil(t, winner, "no goroutine acquired the lease")

		require.NoError(t, winnerM.Release(ctx, winner))
	})

	t.Run("distinct names all succeed", func(t *testing.T) {
		var (
			wg    sync.WaitGroup
			start = make(chan struct{})

			mu      sync.Mutex
			leases  []*lease.Lease
			holders []*lease.Manager
			errs    []error
		)

		for i := range goroutines {
			m := lease.NewManager(store, fmt.Sprintf("holder-distinct-%d", i))
			name := fmt.Sprintf("concurrency/distinct-%d", i)
			wg.Go(func() {
				<-start
				l, err := m.Acquire(ctx, name)

				mu.Lock()
				defer mu.Unlock()
				if err != nil {
					errs = append(errs, err)
					return
				}
				leases = append(leases, l)
				holders = append(holders, m)
			})
		}
		close(start)
		wg.Wait()

		require.Empty(t, errs, "all distinct-name acquires should succeed")
		require.Len(t, leases, goroutines)

		for i, l := range leases {
			require.NoError(t, holders[i].Release(ctx, l))
		}
	})
}

func runLeaseExpiration(t *testing.T, store kv.KV) {
	const ttl = 75 * time.Millisecond
	ctx := t.Context()

	t.Run("different holder can acquire after TTL", func(t *testing.T) {
		a := lease.NewManager(store, "holder-expire-a")
		b := lease.NewManager(store, "holder-expire-b")

		_, err := a.Acquire(ctx, "expiration/handoff", lease.WithTTL(ttl))
		require.NoError(t, err)

		// Wait past TTL with a small buffer for timer slack.
		time.Sleep(ttl + 50*time.Millisecond)

		leaseB, err := b.Acquire(ctx, "expiration/handoff", lease.WithTTL(ttl))
		require.NoError(t, err, "second holder should be able to acquire after TTL elapsed")
		require.NotNil(t, leaseB)
		require.NoError(t, b.Release(ctx, leaseB))
	})

	t.Run("original release after TTL returns ErrLeaseLost", func(t *testing.T) {
		m := lease.NewManager(store, "holder-expire-self")

		l, err := m.Acquire(ctx, "expiration/self-release", lease.WithTTL(ttl))
		require.NoError(t, err)

		time.Sleep(ttl + 50*time.Millisecond)

		err = m.Release(ctx, l)
		require.ErrorIs(t, err, lease.ErrLeaseLost)
	})
}

func runLeaseReleaseSemantics(t *testing.T, store kv.KV) {
	ctx := t.Context()

	t.Run("double release returns ErrLeaseLost", func(t *testing.T) {
		m := lease.NewManager(store, "holder-double-release")

		l, err := m.Acquire(ctx, "release/double")
		require.NoError(t, err)

		require.NoError(t, m.Release(ctx, l))
		err = m.Release(ctx, l)
		require.ErrorIs(t, err, lease.ErrLeaseLost)
	})

	t.Run("release after expiry returns ErrLeaseLost", func(t *testing.T) {
		const ttl = 75 * time.Millisecond
		m := lease.NewManager(store, "holder-release-expired")

		l, err := m.Acquire(ctx, "release/expired", lease.WithTTL(ttl))
		require.NoError(t, err)

		time.Sleep(ttl + 50*time.Millisecond)

		err = m.Release(ctx, l)
		require.ErrorIs(t, err, lease.ErrLeaseLost)
	})
}

func runLeaseLoss(t *testing.T, store kv.KV) {
	t.Run("Lost() closes when TTL elapses", func(t *testing.T) {
		const ttl = 75 * time.Millisecond
		m := lease.NewManager(store, "holder-lost-ttl")

		l, err := m.Acquire(t.Context(), "ctx/lost-on-ttl", lease.WithTTL(ttl))
		require.NoError(t, err)
		require.NotNil(t, l)

		select {
		case <-l.Lost():
			// success
		case <-time.After(ttl + 500*time.Millisecond):
			t.Fatal("Lost() did not close after TTL elapsed")
		}
	})

	t.Run("Lost() closes after successful Release", func(t *testing.T) {
		m := lease.NewManager(store, "holder-lost-on-release")

		l, err := m.Acquire(t.Context(), "ctx/lost-on-release")
		require.NoError(t, err)
		require.NoError(t, m.Release(t.Context(), l))

		select {
		case <-l.Lost():
			// success
		case <-time.After(time.Second):
			t.Fatal("Lost() did not close after successful Release")
		}
	})

	t.Run("Acquire with cancelled context returns error", func(t *testing.T) {
		m := lease.NewManager(store, "holder-ctx-acquire-cancelled")
		ctx, cancel := context.WithCancel(t.Context())
		cancel()

		_, err := m.Acquire(ctx, "ctx/acquire-cancelled")
		require.Error(t, err)
		require.ErrorIs(t, err, context.Canceled)
	})

	t.Run("Release with cancelled context returns error", func(t *testing.T) {
		m := lease.NewManager(store, "holder-ctx-release-cancelled")
		l, err := m.Acquire(t.Context(), "ctx/release-cancelled")
		require.NoError(t, err)

		ctx, cancel := context.WithCancel(t.Context())
		cancel()

		err = m.Release(ctx, l)
		require.Error(t, err)
		require.ErrorIs(t, err, context.Canceled)

		require.NoError(t, m.Release(t.Context(), l))
	})
}

func runLeaseKVErrors(t *testing.T, failing *leaseFailingKV) {
	ctx := t.Context()

	t.Run("Batch failure surfaces from Acquire", func(t *testing.T) {
		injected := errors.New("injected acquire failure")
		failing.injectedError = injected
		t.Cleanup(failing.Reset)

		m := lease.NewManager(failing, "holder-kv-acquire")
		_, err := m.Acquire(ctx, "kv-errors/acquire")
		require.Error(t, err)
		require.ErrorIs(t, err, injected)
	})

	t.Run("Batch failure surfaces from Release", func(t *testing.T) {
		// Acquire cleanly first, then inject failure for the Release call.
		m := lease.NewManager(failing, "holder-kv-release")
		l, err := m.Acquire(ctx, "kv-errors/release")
		require.NoError(t, err)

		injected := errors.New("injected release failure")
		failing.injectedError = injected
		t.Cleanup(failing.Reset)

		err = m.Release(ctx, l)
		require.Error(t, err)
		require.ErrorIs(t, err, injected)

		failing.Reset()
		require.NoError(t, m.Release(t.Context(), l))
	})
}

// opKind tags each operation in a property-based workload.
type opKind int

const (
	opAcquire opKind = iota
	opRelease
)

// operation is one randomized operation in a property-based workload.
type operation struct {
	kind      opKind
	serverIdx int // index into the manager array
	leaseIdx  int // index into the lease-name array
}

// model records, based on observed Acquire/Release responses, which servers
// currently believe they hold each lease. The invariant — at most one
// believer per lease — is enforced on every successful Acquire by
// model.acquired's return value.
type model struct {
	mu      sync.Mutex
	holders map[int]map[int]struct{} // leaseIdx -> set of serverIdx
}

// acquired records that serverIdx now believes it holds leaseIdx, and
// returns true if the model's invariant (≤1 holder per lease) still holds.
// A false return means a violation was just observed.
func (m *model) acquired(serverIdx, leaseIdx int) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.holders[leaseIdx] == nil {
		m.holders[leaseIdx] = make(map[int]struct{})
	}
	m.holders[leaseIdx][serverIdx] = struct{}{}
	return len(m.holders[leaseIdx]) <= 1
}

// released drops serverIdx from the believed-holders of leaseIdx.
func (m *model) released(serverIdx, leaseIdx int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.holders[leaseIdx], serverIdx)
}

const (
	executeSequential = 0
	executeConcurrent = 1
)

// pbtTTL is large relative to any plausible iteration length so that no
// lease expires mid-workload. The model does not track per-lease expiration so,
// without this margin, a real expiration plus reacquire would look like a
// violation.
const pbtTTL = 3 * time.Minute

// newRNG returns the random source used by the property-based test, seeded
// from KV_LEASES_SEED if set so failing runs can be reproduced.
func newRNG(t *testing.T) *rand.Rand {
	seed := time.Now().UnixNano()
	if seedStr := os.Getenv("KV_LEASES_SEED"); seedStr != "" {
		var err error
		seed, err = strconv.ParseInt(seedStr, 10, 64)
		require.NoError(t, err, "parsing seed from KV_LEASES_SEED")
	}
	t.Logf("using random seed: %d", seed)
	return rand.New(rand.NewSource(seed))
}

// numBetween returns a uniformly-random int in [low, high].
func numBetween(rng *rand.Rand, low, high int) int {
	return low + rng.Intn(high-low+1)
}

// candidateReleases lists currently-held (server, lease) pairs from the
// generator's optimistic model as candidate Release ops, in deterministic order.
func candidateReleases(numLeases int, heldByLease map[int]int) []operation {
	var out []operation
	for leaseIdx := range numLeases {
		if serverIdx, ok := heldByLease[leaseIdx]; ok {
			out = append(out, operation{
				kind:      opRelease,
				serverIdx: serverIdx,
				leaseIdx:  leaseIdx,
			})
		}
	}
	return out
}

// leasePBT carries the state shared by the generator and the workload runner
// across quick.Check iterations.
type leasePBT struct {
	t          *testing.T
	ctx        context.Context
	managers   []*lease.Manager
	numServers int
	numLeases  int

	// Per-iteration state, reset at the top of RunWorkload.
	iteration int
	held      []map[int]*lease.Lease
	m         *model
}

func newLeasePBT(t *testing.T, store kv.KV, rng *rand.Rand) *leasePBT {
	numServers := numBetween(rng, 3, 10)
	numLeases := numBetween(rng, 1, 10)
	t.Logf("servers: %d, leases: %d", numServers, numLeases)

	managers := make([]*lease.Manager, numServers)
	for i := range numServers {
		managers[i] = lease.NewManager(store, fmt.Sprintf("server-%d", i))
	}
	return &leasePBT{
		t:          t,
		ctx:        t.Context(),
		managers:   managers,
		numServers: numServers,
		numLeases:  numLeases,
	}
}

// Generator picks ops + mode randomly and feeds them to quick.Check.
//
// Generator-side optimistic model: leaseIdx -> serverIdx for leases the
// generator believes are currently held. Lets us pick Release ops against
// pairs that have a real chance of being held by the runner. Without this,
// ~half of all ops would be no-op Releases on (server, lease) pairs that
// were never Acquired — those don't exercise the protocol.
//
// In sequential mode this prediction matches the runner exactly. In
// concurrent mode races may invalidate some predictions; the runner skips
// Releases without a matching local handle.
func (p *leasePBT) Generator(values []reflect.Value, rng *rand.Rand) {
	numOps := numBetween(rng, 5, 10)
	mode := executeConcurrent
	if rng.Float64() < 0.5 {
		mode = executeSequential
	}

	heldByLease := make(map[int]int)

	ops := make([]operation, numOps)
	for i := range numOps {
		if opKind(rng.Intn(2)) == opRelease {
			if held := candidateReleases(p.numLeases, heldByLease); len(held) > 0 {
				ops[i] = held[rng.Intn(len(held))]
				delete(heldByLease, ops[i].leaseIdx)
				continue
			}
			// Nothing held yet: fall through to an Acquire instead of
			// emitting a guaranteed-no-op Release.
		}

		op := operation{
			kind:      opAcquire,
			serverIdx: rng.Intn(p.numServers),
			leaseIdx:  rng.Intn(p.numLeases),
		}
		ops[i] = op
		// Optimistic update: only record as held if no other server
		// already holds the lease in our model.
		if _, taken := heldByLease[op.leaseIdx]; !taken {
			heldByLease[op.leaseIdx] = op.serverIdx
		}
	}

	values[0] = reflect.ValueOf(mode)
	values[1] = reflect.ValueOf(ops)
}

// leaseName is the KV-side name of the leaseIdx-th lease in the current
// iteration. The iteration prefix isolates rounds of quick.Check from each
// other.
func (p *leasePBT) leaseName(leaseIdx int) string {
	return fmt.Sprintf("iter-%d/lease-%d", p.iteration, leaseIdx)
}

// RunWorkload runs ops against the managers (sequentially or per-server
// concurrent) and returns true if no violation was observed. Called by
// quick.Check once per iteration.
func (p *leasePBT) RunWorkload(mode int, ops []operation) bool {
	p.iteration++
	p.t.Logf("iteration %d: mode=%d ops=%d", p.iteration, mode, len(ops))

	// Per-server held-lease handles. Each server's map is touched only by
	// the goroutine running that server's ops (or by the single
	// sequential-mode goroutine), so it needs no synchronization.
	p.held = make([]map[int]*lease.Lease, p.numServers)
	for i := range p.numServers {
		p.held[i] = make(map[int]*lease.Lease)
	}
	p.m = &model{holders: make(map[int]map[int]struct{})}

	var violated atomic.Bool
	if mode == executeSequential {
		// Walk the trace in generated order.
		for _, op := range ops {
			if p.runOp(op.serverIdx, op) {
				violated.Store(true)
				break
			}
		}
	} else {
		// Per-server goroutines: ops within a server run in generated
		// order; servers race each other.
		opsByServer := make([][]operation, p.numServers)
		for _, op := range ops {
			opsByServer[op.serverIdx] = append(opsByServer[op.serverIdx], op)
		}
		var wg sync.WaitGroup
		for i := range p.numServers {
			wg.Go(func() {
				for _, op := range opsByServer[i] {
					if p.runOp(i, op) {
						violated.Store(true)
						return
					}
				}
			})
		}
		wg.Wait()
	}

	// Drain anything still held so the next iteration starts clean, even
	// if the test failed mid-run.
	for serverIdx, leases := range p.held {
		for _, l := range leases {
			_ = p.managers[serverIdx].Release(p.ctx, l)
		}
	}

	return !violated.Load()
}

// runOp executes one operation against the given server, updates the model,
// and returns whether a violation was observed. Safe to call concurrently
// as long as no two callers share a serverIdx (model's mutations are
// mutex-protected; held[serverIdx] is touched only by serverIdx's caller).
func (p *leasePBT) runOp(serverIdx int, op operation) (violation bool) {
	switch op.kind {
	case opAcquire:
		l, err := p.managers[serverIdx].Acquire(p.ctx, p.leaseName(op.leaseIdx), lease.WithTTL(pbtTTL))
		if err != nil {
			// Errors are only expected if the lease is already held by
			// another server.
			if errors.Is(err, lease.ErrLeaseAlreadyHeld) {
				return false
			}
			p.t.Logf("violation: server %d failed to acquire lease %d with unexpected error: %v",
				serverIdx, op.leaseIdx, err)
			return true
		}
		p.held[serverIdx][op.leaseIdx] = l
		if !p.m.acquired(serverIdx, op.leaseIdx) {
			p.t.Logf("violation: server %d acquired lease %d while another server still holds it",
				serverIdx, op.leaseIdx)
			return true
		}
	case opRelease:
		l, ok := p.held[serverIdx][op.leaseIdx]
		if !ok {
			// This server doesn't believe it holds the lease, so there's
			// nothing to release.
			return false
		}
		if err := p.managers[serverIdx].Release(p.ctx, l); err != nil {
			p.t.Logf("violation: server %d failed to release: %v",
				serverIdx, err)
			return true
		}
		delete(p.held[serverIdx], op.leaseIdx)
		p.m.released(serverIdx, op.leaseIdx)
	}
	return false
}

func runLeasePBT(t *testing.T, store kv.KV) {
	t.Run("randomized workload", func(t *testing.T) {
		rng := newRNG(t)
		pbt := newLeasePBT(t, store, rng)

		require.NoError(t, quick.Check(
			pbt.RunWorkload, &quick.Config{
				MaxCount: 10,
				Rand:     rng,
				Values:   pbt.Generator,
			}),
		)
	})
}

type leaseFailingKV struct {
	kv.KV
	injectedError error
}

func (f *leaseFailingKV) Save(ctx context.Context, section, key string) (io.WriteCloser, error) {
	if f.injectedError != nil {
		return nil, f.injectedError
	}
	return f.KV.Save(ctx, section, key)
}

func (f *leaseFailingKV) Batch(ctx context.Context, section string, ops []kv.BatchOp) error {
	if f.injectedError != nil {
		return f.injectedError
	}
	return f.KV.Batch(ctx, section, ops)
}

func (f *leaseFailingKV) Reset() {
	f.injectedError = nil
}

package leaderelection

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"iter"
	"slices"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
)

func newTestKVProvider(t *testing.T) *kv.EventualKVProvider {
	t.Helper()
	p := kv.ProvideEventualKVStore()
	p.Set(newMapKV())
	return p
}

func testConfig() Config {
	return Config{
		LeaseName:     "test-lease",
		Identity:      "test-holder",
		LeaseDuration: 500 * time.Millisecond,
		RenewDeadline: 300 * time.Millisecond,
		RetryPeriod:   100 * time.Millisecond,
	}
}

func testElectorOpts() []KVLeaseElectorOption {
	return []KVLeaseElectorOption{
		WithManagerOptions(lease.WithInternalMinTTL(50 * time.Millisecond)),
	}
}

func TestKVLeaseElector_AcquireLeadership(t *testing.T) {
	kvp := newTestKVProvider(t)
	cfg := testConfig()

	elector, err := NewKVLeaseElector(kvp, cfg, log.NewNopLogger(), testElectorOpts()...)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()

	var leaderCalled atomic.Bool
	go func() {
		_ = elector.Run(ctx, func(ctx context.Context) {
			leaderCalled.Store(true)
			<-ctx.Done()
		})
	}()

	require.Eventually(t, func() bool {
		return leaderCalled.Load()
	}, 2*time.Second, 10*time.Millisecond)

	cancel()
}

func TestKVLeaseElector_GracefulRelease(t *testing.T) {
	kvp := newTestKVProvider(t)
	cfg := testConfig()

	elector, err := NewKVLeaseElector(kvp, cfg, log.NewNopLogger(), testElectorOpts()...)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)

	done := make(chan error, 1)
	go func() {
		done <- elector.Run(ctx, func(ctx context.Context) {
			<-ctx.Done()
		})
	}()

	// Wait for leadership to be acquired.
	time.Sleep(200 * time.Millisecond)
	cancel()

	select {
	case err := <-done:
		require.ErrorIs(t, err, context.Canceled)
	case <-time.After(3 * time.Second):
		t.Fatal("Run did not return after cancel")
	}
}

func TestKVLeaseElector_LeadershipHandoff(t *testing.T) {
	kvp := newTestKVProvider(t)
	cfg := testConfig()

	var leader1Called, leader2Called atomic.Bool

	elector1, err := NewKVLeaseElector(kvp, Config{
		LeaseName:     cfg.LeaseName,
		Identity:      "holder-1",
		LeaseDuration: cfg.LeaseDuration,
		RenewDeadline: cfg.RenewDeadline,
		RetryPeriod:   cfg.RetryPeriod,
	}, log.NewNopLogger(), testElectorOpts()...)
	require.NoError(t, err)

	elector2, err := NewKVLeaseElector(kvp, Config{
		LeaseName:     cfg.LeaseName,
		Identity:      "holder-2",
		LeaseDuration: cfg.LeaseDuration,
		RenewDeadline: cfg.RenewDeadline,
		RetryPeriod:   cfg.RetryPeriod,
	}, log.NewNopLogger(), testElectorOpts()...)
	require.NoError(t, err)

	ctx1, cancel1 := context.WithCancel(t.Context())
	ctx2, cancel2 := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel2()

	// Start elector 1
	go func() {
		_ = elector1.Run(ctx1, func(ctx context.Context) {
			leader1Called.Store(true)
			<-ctx.Done()
		})
	}()

	// Wait for leader 1 to acquire
	require.Eventually(t, func() bool {
		return leader1Called.Load()
	}, 2*time.Second, 10*time.Millisecond)

	// Start elector 2 (should be blocked)
	go func() {
		_ = elector2.Run(ctx2, func(ctx context.Context) {
			leader2Called.Store(true)
			<-ctx.Done()
		})
	}()

	// Kill leader 1
	cancel1()

	// Leader 2 should take over within lease duration + retry period.
	require.Eventually(t, func() bool {
		return leader2Called.Load()
	}, 3*time.Second, 50*time.Millisecond)

	cancel2()
}

func TestKVLeaseElector_IdentityAutoGeneration(t *testing.T) {
	kvp := newTestKVProvider(t)

	elector, err := NewKVLeaseElector(kvp, Config{
		LeaseName:     "test-auto-id",
		Identity:      "",
		LeaseDuration: time.Second,
		RenewDeadline: 500 * time.Millisecond,
		RetryPeriod:   200 * time.Millisecond,
	}, log.NewNopLogger())
	require.NoError(t, err)
	require.NotEmpty(t, elector.identity)
	require.Contains(t, elector.identity, ":")
}

func TestKVLeaseElector_MissingLeaseName(t *testing.T) {
	kvp := newTestKVProvider(t)

	_, err := NewKVLeaseElector(kvp, Config{
		LeaseName: "",
	}, log.NewNopLogger())
	require.Error(t, err)
	require.ErrorContains(t, err, "leader_election_lease_name")
}

func TestKVLeaseElector_KVProviderCancelled(t *testing.T) {
	p := kv.ProvideEventualKVStore() // never set
	cfg := testConfig()

	elector, err := NewKVLeaseElector(p, cfg, log.NewNopLogger())
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(t.Context(), 200*time.Millisecond)
	defer cancel()

	err = elector.Run(ctx, func(ctx context.Context) {
		<-ctx.Done()
	})
	require.ErrorIs(t, err, context.DeadlineExceeded)
}

// mapKV is a minimal in-memory KV for testing the elector.
type mapKV struct {
	mu   sync.Mutex
	data map[string][]byte
}

func newMapKV() *mapKV {
	return &mapKV{data: make(map[string][]byte)}
}

func (m *mapKV) Get(_ context.Context, _, key string) (io.ReadCloser, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	v, ok := m.data[key]
	if !ok {
		return nil, kv.ErrNotFound
	}
	return io.NopCloser(bytes.NewReader(v)), nil
}

func (m *mapKV) Keys(_ context.Context, _ string, opt kv.ListOptions) iter.Seq2[string, error] {
	m.mu.Lock()
	keys := make([]string, 0, len(m.data))
	for k := range m.data {
		if opt.StartKey != "" && k < opt.StartKey {
			continue
		}
		if opt.EndKey != "" && k >= opt.EndKey {
			continue
		}
		keys = append(keys, k)
	}
	m.mu.Unlock()

	slices.Sort(keys)
	if opt.Sort == kv.SortOrderDesc {
		slices.Reverse(keys)
	}
	if opt.Limit > 0 && int64(len(keys)) > opt.Limit {
		keys = keys[:opt.Limit]
	}

	return func(yield func(string, error) bool) {
		for _, k := range keys {
			if !yield(k, nil) {
				return
			}
		}
	}
}

func (m *mapKV) Batch(_ context.Context, _ string, ops []kv.BatchOp) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	snapshot := make(map[string][]byte, len(m.data))
	for k, v := range m.data {
		snapshot[k] = v
	}

	for i, op := range ops {
		switch op.Mode {
		case kv.BatchOpCreate:
			if len(op.Value) == 0 {
				m.data = snapshot
				return &kv.BatchError{Err: kv.ErrEmptyValue, Index: i, Op: op}
			}
			if _, exists := m.data[op.Key]; exists {
				m.data = snapshot
				return &kv.BatchError{Err: kv.ErrKeyAlreadyExists, Index: i, Op: op}
			}
			v := make([]byte, len(op.Value))
			copy(v, op.Value)
			m.data[op.Key] = v
		default:
			panic(fmt.Sprintf("mapKV: Batch mode %d not implemented", op.Mode))
		}
	}
	return nil
}

func (m *mapKV) Save(_ context.Context, _, key string) (io.WriteCloser, error) {
	return &mapKVWriter{m: m, key: key}, nil
}

type mapKVWriter struct {
	m   *mapKV
	key string
	buf bytes.Buffer
}

func (w *mapKVWriter) Write(p []byte) (int, error) { return w.buf.Write(p) }

func (w *mapKVWriter) Close() error {
	data := w.buf.Bytes()
	if len(data) == 0 {
		return kv.ErrEmptyValue
	}
	w.m.mu.Lock()
	defer w.m.mu.Unlock()
	w.m.data[w.key] = data
	return nil
}

func (m *mapKV) Delete(context.Context, string, string) error {
	panic("not implemented")
}

func (m *mapKV) BatchGet(context.Context, string, []string) iter.Seq2[kv.KeyValue, error] {
	panic("not implemented")
}

func (m *mapKV) BatchDelete(context.Context, string, []string) error {
	panic("not implemented")
}

func (m *mapKV) UnixTimestamp(context.Context) (int64, error) {
	panic("not implemented")
}

package lease_test

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"iter"
	"slices"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
	test "github.com/grafana/grafana/pkg/storage/unified/testing"
)

func TestLease(t *testing.T) {
	test.RunLeaseTest(t, func(ctx context.Context) kv.KV {
		return newMapKV()
	})
}

func TestAcquireNameValidation(t *testing.T) {
	m := lease.NewManager(newMapKV(), "holder-validation")

	t.Run("invalid keys are rejected", func(t *testing.T) {
		for _, name := range []string{"", "invalid key", "invalid\nkey"} {
			l, err := m.Acquire(t.Context(), name)
			require.Error(t, err)
			require.ErrorContains(t, err, "invalid lease name")
			require.Nil(t, l)
		}
	})

	t.Run("trailing slash is rejected", func(t *testing.T) {
		l, err := m.Acquire(t.Context(), "validation/trailing/")
		require.Error(t, err)
		require.ErrorContains(t, err, "trailing slash")
		require.Nil(t, l)
	})

	t.Run("valid slash-separated name is accepted", func(t *testing.T) {
		l, err := m.Acquire(t.Context(), "validation/slash-separated")
		require.NoError(t, err)
		require.NotNil(t, l)
		require.NoError(t, m.Release(t.Context(), l))
	})
}

// mapKV is a thread-safe, in-memory kv.KV implementation scoped to a single
// section (the lease package's section). It is the minimum needed to
// exercise the lease contract: Get, Keys, Save, and Batch (Create only). Any
// unused method panics so an accidental new dependency is loud.
type mapKV struct {
	mu   sync.Mutex
	data map[string][]byte
}

func newMapKV() *mapKV {
	return &mapKV{data: make(map[string][]byte)}
}

func (m *mapKV) checkSection(s string) {
	if s != kv.LeasesSection {
		panic(fmt.Sprintf("mapKV: unexpected section %q (only %q is supported)", s, kv.LeasesSection))
	}
}

func (m *mapKV) Get(ctx context.Context, sec, key string) (io.ReadCloser, error) {
	m.checkSection(sec)
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	v, ok := m.data[key]
	if !ok {
		return nil, kv.ErrNotFound
	}
	return io.NopCloser(bytes.NewReader(v)), nil
}

func (m *mapKV) Keys(ctx context.Context, sec string, opt kv.ListOptions) iter.Seq2[string, error] {
	m.checkSection(sec)

	// Snapshot the matching keys under the lock, then yield outside the lock
	// so consumers can call other mapKV methods during iteration without
	// deadlocking.
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
			if err := ctx.Err(); err != nil {
				yield("", err)
				return
			}
			if !yield(k, nil) {
				return
			}
		}
	}
}

func (m *mapKV) Batch(ctx context.Context, sec string, ops []kv.BatchOp) error {
	m.checkSection(sec)
	if err := ctx.Err(); err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	// Snapshot for atomic rollback on failure.
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
			panic(fmt.Sprintf("mapKV: Batch mode %d not implemented (only BatchOpCreate is supported)", op.Mode))
		}
	}
	return nil
}

func (m *mapKV) Save(ctx context.Context, sec, key string) (io.WriteCloser, error) {
	m.checkSection(sec)
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return &mapKVWriter{m: m, ctx: ctx, key: key}, nil
}

type mapKVWriter struct {
	m   *mapKV
	ctx context.Context
	key string
	buf bytes.Buffer
}

func (w *mapKVWriter) Write(p []byte) (int, error) {
	return w.buf.Write(p)
}

func (w *mapKVWriter) Close() error {
	if err := w.ctx.Err(); err != nil {
		return err
	}

	data := w.buf.Bytes()
	if len(data) == 0 {
		return kv.ErrEmptyValue
	}

	w.m.mu.Lock()
	defer w.m.mu.Unlock()
	w.m.data[w.key] = data
	return nil
}

func (m *mapKV) Delete(ctx context.Context, section, key string) error {
	panic("mapKV: Delete not implemented")
}

func (m *mapKV) BatchGet(ctx context.Context, section string, keys []string) iter.Seq2[kv.KeyValue, error] {
	panic("mapKV: BatchGet not implemented")
}

func (m *mapKV) BatchDelete(ctx context.Context, section string, keys []string) error {
	panic("mapKV: BatchDelete not implemented")
}

func (m *mapKV) UnixTimestamp(ctx context.Context) (int64, error) {
	panic("mapKV: UnixTimestamp not implemented")
}

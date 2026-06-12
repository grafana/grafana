package stats

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strconv"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// Store reads and writes stats buckets/aggregates over a KV backend.
type Store struct {
	kv kv.KV
}

func NewStore(store kv.KV) *Store {
	return &Store{kv: store}
}

func getInt64(ctx context.Context, store kv.KV, section, key string) (int64, error) {
	r, err := store.Get(ctx, section, key)
	if err != nil {
		if errors.Is(err, kv.ErrNotFound) {
			return 0, nil
		}
		return 0, err
	}
	defer func() { _ = r.Close() }()
	b, err := io.ReadAll(r)
	if err != nil {
		return 0, err
	}
	if len(b) == 0 {
		return 0, nil
	}
	return strconv.ParseInt(string(b), 10, 64)
}

func encodeInt64(v int64) []byte {
	return []byte(strconv.FormatInt(v, 10))
}

// IncrementDaily atomically adds deltas to today's daily buckets for an
// object (read-add-write per metric, in a single batch). The caller is
// expected to hold the flush lease so the read-add-write is serialized.
func (s *Store) IncrementDaily(ctx context.Context, o objectRef, day string, deltas map[string]int64) error {
	ops := make([]kv.BatchOp, 0, len(deltas))
	for metric, delta := range deltas {
		if delta == 0 {
			continue
		}
		key := dailyKey(o, day, metric)
		cur, err := getInt64(ctx, s.kv, dailySection, key)
		if err != nil {
			return fmt.Errorf("read daily %s: %w", key, err)
		}
		ops = append(ops, kv.BatchOp{Mode: kv.BatchOpPut, Key: key, Value: encodeInt64(cur + delta)})
	}
	if len(ops) == 0 {
		return nil
	}
	if len(ops) > kv.MaxBatchOps {
		return fmt.Errorf("too many metrics in one object increment: %d", len(ops))
	}
	return s.kv.Batch(ctx, dailySection, ops)
}

// ReadDailyForObject returns day -> metric -> value for an object.
func (s *Store) ReadDailyForObject(ctx context.Context, o objectRef) (map[string]map[string]int64, error) {
	out := map[string]map[string]int64{}
	for key, err := range s.kv.Keys(ctx, dailySection, kv.ListOptions{StartKey: o.prefix(), EndKey: kv.PrefixRangeEnd(o.prefix())}) {
		if err != nil {
			return nil, err
		}
		pk, err := parseDailyKey(key)
		if err != nil {
			return nil, err
		}
		v, err := getInt64(ctx, s.kv, dailySection, key)
		if err != nil {
			return nil, err
		}
		if out[pk.Day] == nil {
			out[pk.Day] = map[string]int64{}
		}
		out[pk.Day][pk.Metric] = v
	}
	return out, nil
}

// SetDaily writes a daily bucket value (used by recalc/backfill).
func (s *Store) SetDaily(ctx context.Context, o objectRef, day, metric string, v int64) error {
	w, err := s.kv.Save(ctx, dailySection, dailyKey(o, day, metric))
	if err != nil {
		return err
	}
	if _, err := w.Write(encodeInt64(v)); err != nil {
		return err
	}
	return w.Close()
}

// DeleteDaily removes a daily bucket (e.g. the expiring 31st bucket).
func (s *Store) DeleteDaily(ctx context.Context, o objectRef, day, metric string) error {
	return s.kv.Delete(ctx, dailySection, dailyKey(o, day, metric))
}

// WriteAggregates writes the derived window cache for an object.
func (s *Store) WriteAggregates(ctx context.Context, o objectRef, fields map[string]int64) error {
	for field, v := range fields {
		w, err := s.kv.Save(ctx, aggregatesSection, aggregateKey(o, field))
		if err != nil {
			return err
		}
		if _, err := w.Write(encodeInt64(v)); err != nil {
			return err
		}
		if err := w.Close(); err != nil {
			return err
		}
	}
	return nil
}

// ScanAggregates prefix-scans the aggregates cache for a namespace and returns
// name -> field -> value. This is what the search index reads.
func (s *Store) ScanAggregates(ctx context.Context, group, resource, namespace string) (map[string]map[string]int64, error) {
	prefix := namespacePrefix(group, resource, namespace)
	out := map[string]map[string]int64{}
	for key, err := range s.kv.Keys(ctx, aggregatesSection, kv.ListOptions{StartKey: prefix, EndKey: kv.PrefixRangeEnd(prefix)}) {
		if err != nil {
			return nil, err
		}
		pk, err := parseAggregateKey(key)
		if err != nil {
			return nil, err
		}
		v, err := getInt64(ctx, s.kv, aggregatesSection, key)
		if err != nil {
			return nil, err
		}
		if out[pk.Name] == nil {
			out[pk.Name] = map[string]int64{}
		}
		out[pk.Name][pk.Field] = v
	}
	return out, nil
}

// listObjects returns the distinct objects that have daily buckets, optionally
// limited to a namespace (empty group/resource/namespace scans everything).
func (s *Store) listObjects(ctx context.Context, group, resource, namespace string) ([]objectRef, error) {
	var startKey, endKey string
	if group != "" && resource != "" && namespace != "" {
		startKey = namespacePrefix(group, resource, namespace)
		endKey = kv.PrefixRangeEnd(startKey)
	}
	seen := map[objectRef]struct{}{}
	var out []objectRef
	for key, err := range s.kv.Keys(ctx, dailySection, kv.ListOptions{StartKey: startKey, EndKey: endKey}) {
		if err != nil {
			return nil, err
		}
		pk, err := parseDailyKey(key)
		if err != nil {
			return nil, err
		}
		if _, ok := seen[pk.objectRef]; ok {
			continue
		}
		seen[pk.objectRef] = struct{}{}
		out = append(out, pk.objectRef)
	}
	return out, nil
}

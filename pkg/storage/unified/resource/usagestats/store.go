package usagestats

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strconv"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

type Store struct {
	kv kv.KV
}

func NewStore(store kv.KV) *Store {
	return &Store{kv: store}
}

func getUint64(ctx context.Context, store kv.KV, section, key string) (uint64, error) {
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
	return strconv.ParseUint(string(b), 10, 64)
}

func encodeUint64(v uint64) []byte {
	return []byte(strconv.FormatUint(v, 10))
}

// IncrementDaily atomically adds deltas to a day's daily buckets for an object
// (read-add-write per metric, in a single batch). The caller is expected to
// serialize the read-add-write (e.g. under a flush lease).
func (s *Store) IncrementDaily(ctx context.Context, o objectRef, day string, deltas map[string]uint64) error {
	ops := make([]kv.BatchOp, 0, len(deltas))
	for metric, delta := range deltas {
		if delta == 0 {
			continue
		}
		key := dailyKey(o, day, metric)
		cur, err := getUint64(ctx, s.kv, dailySection, key)
		if err != nil {
			return fmt.Errorf("read daily %s: %w", key, err)
		}
		ops = append(ops, kv.BatchOp{Mode: kv.BatchOpPut, Key: key, Value: encodeUint64(cur + delta)})
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
func (s *Store) ReadDailyForObject(ctx context.Context, o objectRef) (map[string]map[string]uint64, error) {
	out := map[string]map[string]uint64{}
	for key, err := range s.kv.Keys(ctx, dailySection, kv.ListOptions{StartKey: o.prefix(), EndKey: kv.PrefixRangeEnd(o.prefix())}) {
		if err != nil {
			return nil, err
		}
		pk, err := parseDailyKey(key)
		if err != nil {
			return nil, err
		}
		v, err := getUint64(ctx, s.kv, dailySection, key)
		if err != nil {
			return nil, err
		}
		if out[pk.Day] == nil {
			out[pk.Day] = map[string]uint64{}
		}
		out[pk.Day][pk.Metric] = v
	}
	return out, nil
}

// ReadDailyRange returns day -> metric -> value for an object, restricted to
// the inclusive [fromDay, toDay] calendar-day window. Empty bounds mean
// unbounded on that side. The overflow bucket is always excluded since it does
// not correspond to a single calendar day.
func (s *Store) ReadDailyRange(ctx context.Context, o objectRef, fromDay, toDay string) (map[string]map[string]uint64, error) {
	all, err := s.ReadDailyForObject(ctx, o)
	if err != nil {
		return nil, err
	}
	out := make(map[string]map[string]uint64, len(all))
	for day, metrics := range all {
		if day == overflowBucket {
			continue
		}
		if fromDay != "" && day < fromDay {
			continue
		}
		if toDay != "" && day > toDay {
			continue
		}
		out[day] = metrics
	}
	return out, nil
}

func (s *Store) FoldIntoOverflow(ctx context.Context, o objectRef, expired map[string]map[string]uint64) error {
	if len(expired) == 0 {
		return nil
	}
	deltas := map[string]uint64{}
	ops := make([]kv.BatchOp, 0)
	for day, metrics := range expired {
		if day == overflowBucket {
			return fmt.Errorf("cannot fold the overflow bucket into itself")
		}
		for metric, v := range metrics {
			deltas[metric] += v
			ops = append(ops, kv.BatchOp{Mode: kv.BatchOpDelete, Key: dailyKey(o, day, metric)})
		}
	}
	for metric, delta := range deltas {
		key := dailyKey(o, overflowBucket, metric)
		cur, err := getUint64(ctx, s.kv, dailySection, key)
		if err != nil {
			return fmt.Errorf("read overflow %s: %w", key, err)
		}
		ops = append(ops, kv.BatchOp{Mode: kv.BatchOpPut, Key: key, Value: encodeUint64(cur + delta)})
	}
	for start := 0; start < len(ops); start += kv.MaxBatchOps {
		end := min(start+kv.MaxBatchOps, len(ops))
		if err := s.kv.Batch(ctx, dailySection, ops[start:end]); err != nil {
			return err
		}
	}
	return nil
}

// IncrementAggregates adds deltas to an object's aggregate fields
// (read-add-write per field). The caller is expected to serialize the
// read-add-write (e.g. under a flush lease).
func (s *Store) IncrementAggregates(ctx context.Context, o objectRef, deltas map[string]uint64) error {
	ops := make([]kv.BatchOp, 0, len(deltas))
	for field, delta := range deltas {
		if delta == 0 {
			continue
		}
		key := aggregateKey(o, field)
		cur, err := getUint64(ctx, s.kv, aggregatesSection, key)
		if err != nil {
			return fmt.Errorf("read aggregate %s: %w", key, err)
		}
		ops = append(ops, kv.BatchOp{Mode: kv.BatchOpPut, Key: key, Value: encodeUint64(cur + delta)})
	}
	for start := 0; start < len(ops); start += kv.MaxBatchOps {
		end := min(start+kv.MaxBatchOps, len(ops))
		if err := s.kv.Batch(ctx, aggregatesSection, ops[start:end]); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) WriteAggregates(ctx context.Context, o objectRef, fields map[string]uint64) error {
	ops := make([]kv.BatchOp, 0, len(fields))
	for field, v := range fields {
		ops = append(ops, kv.BatchOp{Mode: kv.BatchOpPut, Key: aggregateKey(o, field), Value: encodeUint64(v)})
	}
	for start := 0; start < len(ops); start += kv.MaxBatchOps {
		end := min(start+kv.MaxBatchOps, len(ops))
		if err := s.kv.Batch(ctx, aggregatesSection, ops[start:end]); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) ScanAggregates(ctx context.Context, group, resource, namespace string) (map[string]map[string]uint64, error) {
	prefix := namespacePrefix(group, resource, namespace)
	out := map[string]map[string]uint64{}
	for key, err := range s.kv.Keys(ctx, aggregatesSection, kv.ListOptions{StartKey: prefix, EndKey: kv.PrefixRangeEnd(prefix)}) {
		if err != nil {
			return nil, err
		}
		pk, err := parseAggregateKey(key)
		if err != nil {
			return nil, err
		}
		v, err := getUint64(ctx, s.kv, aggregatesSection, key)
		if err != nil {
			return nil, err
		}
		if out[pk.Name] == nil {
			out[pk.Name] = map[string]uint64{}
		}
		out[pk.Name][pk.Field] = v
	}
	return out, nil
}

// listObjects returns the distinct objects that have daily buckets within a
// namespace.
func (s *Store) listObjects(ctx context.Context, group, resource, namespace string) ([]objectRef, error) {
	prefix := namespacePrefix(group, resource, namespace)
	seen := map[objectRef]struct{}{}
	var out []objectRef
	for key, err := range s.kv.Keys(ctx, dailySection, kv.ListOptions{StartKey: prefix, EndKey: kv.PrefixRangeEnd(prefix)}) {
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

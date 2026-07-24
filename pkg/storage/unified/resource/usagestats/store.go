package usagestats

import (
	"context"
	"errors"
	"fmt"
	"io"
	"iter"
	"strconv"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// DailyBucket is a single calendar day's metrics for an object.
type DailyBucket struct {
	Day     string
	Metrics map[string]uint64
}

// dailyReadBatchSize bounds how many daily keys are fetched per BatchGet round trip
const dailyReadBatchSize = 50

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
	return readUint64(r)
}

// readUint64 consumes and closes r, decoding the stored counter value.
func readUint64(r io.ReadCloser) (uint64, error) {
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

// ObjectDaily is one object's complete set of daily buckets.
type ObjectDaily struct {
	Ref   objectRef
	Daily map[string]map[string]uint64
}

// StreamNamespaces yields each namespace that has daily buckets for a group/resource.
func (s *Store) StreamNamespaces(ctx context.Context, group, resource string) iter.Seq2[string, error] {
	return func(yield func(string, error) bool) {
		prefix := groupResourcePrefix(group, resource)
		end := kv.PrefixRangeEnd(prefix)
		start := prefix
		for {
			var (
				first string
				found bool
				err   error
			)
			for key, keyErr := range s.kv.Keys(ctx, dailySection, kv.ListOptions{StartKey: start, EndKey: end, Limit: 1}) {
				first, err, found = key, keyErr, true
				break
			}
			if err != nil {
				yield("", err)
				return
			}
			if !found {
				return
			}
			pk, err := parseDailyKey(first)
			if err != nil {
				yield("", err)
				return
			}
			if !yield(pk.Namespace, nil) {
				return
			}
			start = kv.PrefixRangeEnd(namespacePrefix(group, resource, pk.Namespace))
		}
	}
}

// StreamObjectDailies streams each object in a namespace together with its
// daily buckets, in a single pass over the namespace's daily keys.
func (s *Store) StreamObjectDailies(ctx context.Context, group, resource, namespace string) iter.Seq2[ObjectDaily, error] {
	return func(yield func(ObjectDaily, error) bool) {
		prefix := namespacePrefix(group, resource, namespace)
		var (
			curRef  objectRef
			curKeys []string
			haveObj bool
		)
		emit := func() bool {
			daily, err := s.readDailyKeys(ctx, curKeys)
			if err != nil {
				yield(ObjectDaily{}, err)
				return false
			}
			return yield(ObjectDaily{Ref: curRef, Daily: daily}, nil)
		}
		for key, err := range s.kv.Keys(ctx, dailySection, kv.ListOptions{StartKey: prefix, EndKey: kv.PrefixRangeEnd(prefix)}) {
			if err != nil {
				yield(ObjectDaily{}, err)
				return
			}
			pk, err := parseDailyKey(key)
			if err != nil {
				yield(ObjectDaily{}, err)
				return
			}
			if haveObj && pk.objectRef != curRef {
				if !emit() {
					return
				}
				curKeys = curKeys[:0]
			}
			curRef = pk.objectRef
			haveObj = true
			curKeys = append(curKeys, key)
		}
		if haveObj {
			emit()
		}
	}
}

// readDailyKeys fetches the given daily keys (all belonging to one object) and
// returns day -> metric -> value, batching the value reads.
func (s *Store) readDailyKeys(ctx context.Context, keys []string) (map[string]map[string]uint64, error) {
	out := map[string]map[string]uint64{}
	for start := 0; start < len(keys); start += dailyReadBatchSize {
		end := min(start+dailyReadBatchSize, len(keys))
		for item, err := range s.kv.BatchGet(ctx, dailySection, keys[start:end]) {
			if err != nil {
				return nil, err
			}
			pk, err := parseDailyKey(item.Key)
			if err != nil {
				return nil, err
			}
			v, err := readUint64(item.Value)
			if err != nil {
				return nil, err
			}
			if out[pk.Day] == nil {
				out[pk.Day] = map[string]uint64{}
			}
			out[pk.Day][pk.Metric] = v
		}
	}
	return out, nil
}

// ReadDailyRange streams an object's per-day buckets in ascending
// chronological order, restricted to the inclusive [fromDay, toDay] window.
// Empty bounds mean unbounded on that side. The overflow bucket is always
// excluded since it does not correspond to a single calendar day.
func (s *Store) ReadDailyRange(ctx context.Context, o objectRef, fromDay, toDay string) iter.Seq2[DailyBucket, error] {
	return func(yield func(DailyBucket, error) bool) {
		// buffer all the keys upfront to keep the code simple. We have a bounded number of metrics (20) and days (30)
		// so this will never be too big
		var keys []string
		for key, err := range s.kv.Keys(ctx, dailySection, kv.ListOptions{StartKey: o.prefix(), EndKey: kv.PrefixRangeEnd(o.prefix())}) {
			if err != nil {
				yield(DailyBucket{}, err)
				return
			}
			pk, err := parseDailyKey(key)
			if err != nil {
				yield(DailyBucket{}, err)
				return
			}
			// The overflow bucket is not a calendar day; it sorts after the
			// dated keys, so skipping it never leaves a day half-accumulated.
			if pk.Day == overflowBucket {
				continue
			}
			if fromDay != "" && pk.Day < fromDay {
				continue
			}
			if toDay != "" && pk.Day > toDay {
				// Keys are ascending, so every remaining dated key is also
				// out of range.
				break
			}
			keys = append(keys, key)
		}

		var (
			curDay     string
			curMetrics map[string]uint64
			haveDay    bool
		)
		for start := 0; start < len(keys); start += dailyReadBatchSize {
			end := min(start+dailyReadBatchSize, len(keys))
			for item, err := range s.kv.BatchGet(ctx, dailySection, keys[start:end]) {
				if err != nil {
					yield(DailyBucket{}, err)
					return
				}
				pk, err := parseDailyKey(item.Key)
				if err != nil {
					yield(DailyBucket{}, err)
					return
				}
				v, err := readUint64(item.Value)
				if err != nil {
					yield(DailyBucket{}, err)
					return
				}
				if haveDay && pk.Day != curDay {
					if !yield(DailyBucket{Day: curDay, Metrics: curMetrics}, nil) {
						return
					}
					haveDay = false
				}
				if !haveDay {
					curDay = pk.Day
					curMetrics = map[string]uint64{}
					haveDay = true
				}
				curMetrics[pk.Metric] = v
			}
		}
		if haveDay {
			yield(DailyBucket{Day: curDay, Metrics: curMetrics}, nil)
		}
	}
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

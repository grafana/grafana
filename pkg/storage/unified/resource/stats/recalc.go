package stats

import (
	"context"
	"time"
)

// Recalc recomputes the aggregates cache from the daily buckets, folds buckets
// older than MaxWindow days into the overflow bucket (then drops them), and
// rewrites the derived window/total fields. This is the daily reconcile that
// makes total fully recoverable and self-heals stale aggregates.
//
// now is sourced from KV.UnixTimestamp by the caller for cross-pod consistency.
func (s *Store) Recalc(ctx context.Context, decls *Declarations, now int64) error {
	objects, err := s.listObjects(ctx, "", "", "")
	if err != nil {
		return err
	}
	for _, o := range objects {
		if err := s.recalcObject(ctx, decls, o, now); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) recalcObject(ctx context.Context, decls *Declarations, o objectRef, now int64) error {
	decl, ok := decls.Lookup(o.Group, o.Resource)
	if !ok {
		return nil // untracked; leave alone (orphan GC handles cleanup)
	}

	daily, err := s.ReadDailyForObject(ctx, o)
	if err != nil {
		return err
	}

	today := time.Unix(now, 0).UTC().Truncate(24 * time.Hour)
	cutoff := today.AddDate(0, 0, -(MaxWindow - 1)) // oldest day kept as a real bucket

	// Fold expired buckets into overflow, drop them.
	overflow := map[string]int64{}
	for metric, v := range daily[overflowBucket] {
		overflow[metric] = v
	}
	for day, metrics := range daily {
		if day == overflowBucket {
			continue
		}
		d, perr := parseDay(day)
		if perr != nil {
			continue
		}
		if d.Before(cutoff) {
			for metric, v := range metrics {
				overflow[metric] += v
				if err := s.DeleteDaily(ctx, o, day, metric); err != nil {
					return err
				}
			}
			delete(daily, day)
		}
	}

	// Persist the folded overflow.
	for metric, v := range overflow {
		if err := s.SetDaily(ctx, o, overflowBucket, metric, v); err != nil {
			return err
		}
	}

	// Recompute windows + totals from the trailing buckets.
	fields := map[string]int64{}
	for _, metric := range decl.Metrics {
		total := overflow[metric]
		windowSums := make(map[int]int64, len(decl.Windows))
		for day, metrics := range daily {
			if day == overflowBucket {
				continue
			}
			d, perr := parseDay(day)
			if perr != nil {
				continue
			}
			v := metrics[metric]
			total += v
			for _, w := range decl.Windows {
				// rolling, inclusive of the current partial day:
				// last_N = sum(buckets[today-(N-1) .. today])
				start := today.AddDate(0, 0, -(w - 1))
				if !d.Before(start) && !d.After(today) {
					windowSums[w] += v
				}
			}
		}
		fields[totalField(metric)] = total
		for _, w := range decl.Windows {
			fields[aggregateField(metric, w)] = windowSums[w]
		}
	}

	return s.WriteAggregates(ctx, o, fields)
}

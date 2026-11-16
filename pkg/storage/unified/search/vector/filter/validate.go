package filter

// ValueCount returns the total number of values across all $in/$nin clauses in
// the filter tree. Each value expands to a few SQL parameters at compile time,
// so callers bound this before compiling to stay under Postgres's 65535
// parameter limit.
func ValueCount(f *Filter) int {
	if f == nil {
		return 0
	}
	switch {
	case f.Logical != nil:
		total := 0
		for _, sub := range f.Logical.Filters {
			total += ValueCount(sub)
		}
		return total
	case f.Comparison != nil:
		if f.Comparison.Operator == In || f.Comparison.Operator == Nin {
			if vs, ok := f.Comparison.Value.([]any); ok {
				return len(vs)
			}
		}
		return 0
	default:
		return 0
	}
}

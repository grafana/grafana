package search

import (
	"testing"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// FuzzBleveRequirementQuery exercises the Bleve query construction path
// for selector requirements. The function has branchy handling around
// operator dispatch, wildcards, term splitting, title-vs-other fields,
// and value-list semantics, so it is a good target for coverage-guided
// fuzzing.
//
// Invariants:
//   - Must not panic.
//   - Each return path produces exactly one of (query, error). The fuzzer
//     fails if both are nil or both are non-nil.
func FuzzBleveRequirementQuery(f *testing.F) {
	// Seed with shapes that cover the main switch arms.
	seeds := []struct {
		key, op, v1, v2, prefix string
		n                       byte
	}{
		{"title", "=", "hello", "", "", 1},
		{"title", "==", "hello world", "", "", 1},
		{"title", "=", "hell*", "", "", 1},
		{"title", "=", "*grafana*", "", "", 1},
		{"title", "in", "a", "b", "", 2},
		{"title", "notin", "a", "b", "", 2},
		{"folder", "=", "general", "", "tenant-", 1},
		{"tags", "=", "prod", "", "", 1},
		{"login", "=", "user", "", "", 1},
		{"email", "=", "u@x", "", "", 1},
		{"title", "=", "a b c d", "", "", 1},
		{"", "", "", "", "", 0},
	}
	for _, s := range seeds {
		f.Add(s.key, s.op, s.v1, s.v2, s.prefix, s.n)
	}

	f.Fuzz(func(t *testing.T, key, op, v1, v2, prefix string, n byte) {
		var values []string
		switch n % 3 {
		case 1:
			values = []string{v1}
		case 2:
			values = []string{v1, v2}
		}
		req := &resourcepb.Requirement{
			Key:      key,
			Operator: op,
			Values:   values,
		}
		q, errRes := requirementQuery(req, prefix)
		if (q == nil) == (errRes == nil) {
			t.Fatalf("query/err invariant violated: query=%v err=%v for req=%+v prefix=%q",
				q, errRes, req, prefix)
		}
	})
}

package dashboard

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// fuzzNopLookup is a do-nothing DatasourceLookup. Returning nil from both
// methods is safe for the parser: the few call sites that consume the
// result check for nil. We don't need real datasource resolution to
// exercise the JSON walker.
type fuzzNopLookup struct{}

func (fuzzNopLookup) ByRef(*DataSourceRef) *DataSourceRef { return nil }
func (fuzzNopLookup) ByType(string) []DataSourceRef       { return nil }

// FuzzReadDashboard fuzzes the streaming dashboard JSON walker. The walker
// type-switches on every field and accepts several polymorphic shapes, so
// the goal is to flush out panics, unbounded recursion, and divergence
// bugs on adversarial input.
//
// Invariant: must not panic. Any error is acceptable.
//
// Coverage caveat: Go's built-in fuzzer is format-agnostic and mutates
// inputs at the byte level. On a deeply structured format like dashboard
// JSON, most mutations break the document early and the parser bails
// before reading any field, so deep grammar paths (panels, datasources,
// template variables, v1/v2 polymorphism, recursive spec descent) are
// rarely reached. This target is most useful for catching panics on
// shallow inputs and as a regression harness against the seed corpus.
// Comprehensive deep-grammar coverage would need a structure-aware
// mutator (e.g. gosentry) or hand-written dashboard generators, tracked
// as follow-ups.
func FuzzReadDashboard(f *testing.F) {
	seedDirs := []string{
		"testdata",
		"../../../../storage/unified/search/testdata",
		"../../../../storage/unified/search/embed/dashboard/testdata",
	}
	seedCount := 0
	for _, dir := range seedDirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			f.Fatalf("read seed dir %q: %v (did seed paths move?)", dir, err)
		}
		for _, e := range entries {
			if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
				continue
			}
			// *-info.json files are golden outputs from existing tests,
			// not parser inputs.
			if strings.HasSuffix(e.Name(), "-info.json") {
				continue
			}
			// nolint:gosec // G304: paths come from a hard-coded list of
			// seed directories joined with names read from those
			// directories, not user input.
			data, err := os.ReadFile(filepath.Join(dir, e.Name()))
			if err != nil {
				continue
			}
			f.Add(data)
			seedCount++
		}
	}
	if seedCount == 0 {
		f.Fatalf("no seeds loaded; seed paths may have moved: %v", seedDirs)
	}

	f.Fuzz(func(t *testing.T, data []byte) {
		// Cap input size. Real dashboards are well under a megabyte and an
		// uncapped fuzzer happily spends time on multi-MB inputs that
		// don't exercise new paths.
		if len(data) > 1<<20 {
			t.Skip()
		}
		_, _ = ReadDashboard(bytes.NewReader(data), fuzzNopLookup{})
	})
}

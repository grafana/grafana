package dashboard

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// FuzzExtractDashboard fuzzes the second, independent dashboard JSON
// parser used to build embeddings. It walks v1 and v2 dashboard shapes
// via map[string]any and jsonpath helpers; a different bug surface than
// the streaming ReadDashboard parser.
//
// Invariant: must not panic. Any error is acceptable.
//
// Coverage caveat: same as FuzzReadDashboard. Go's built-in fuzzer
// mutates at the byte level, so most inputs fail to deserialize and the
// deeper walker paths are rarely reached. This target is most useful for
// catching panics on shallow inputs and as a regression harness against
// the seed corpus. Structure-aware mutation (e.g. gosentry) is tracked
// as a follow-up.
func FuzzExtractDashboard(f *testing.F) {
	seedDirs := []string{
		"testdata",
		"../../testdata",
		"../../../../../services/store/kind/dashboard/testdata",
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

	e := New()
	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Name:      "fuzz",
	}

	f.Fuzz(func(t *testing.T, data []byte) {
		if len(data) > 1<<20 {
			t.Skip()
		}
		_, _ = e.Extract(context.Background(), key, data, "")
	})
}

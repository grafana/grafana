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
func FuzzExtractDashboard(f *testing.F) {
	seedDirs := []string{
		"testdata",
		"../../testdata",
		"../../../../../services/store/kind/dashboard/testdata",
	}
	for _, dir := range seedDirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
				continue
			}
			if strings.HasSuffix(e.Name(), "-info.json") {
				continue
			}
			data, err := os.ReadFile(filepath.Join(dir, e.Name()))
			if err != nil {
				continue
			}
			f.Add(data)
		}
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

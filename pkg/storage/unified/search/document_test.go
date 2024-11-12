package search

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type testBuilderOptions struct {
	key     *resource.ResourceKey
	prefix  string
	names   []string
	builder resource.DocumentBuilder
}

func testDocumentBuilder(t *testing.T, opts testBuilderOptions) {
	key := opts.key
	ctx := context.Background()
	for _, name := range opts.names {
		// nolint:gosec
		// We can ignore the gosec G304 warning because this is a test with hardcoded input values
		src, err := os.ReadFile(filepath.Join("testdata", "doc", fmt.Sprintf("input-%s-%s.json", opts.prefix, name)))
		require.NoError(t, err)

		key.Name = name
		doc, err := opts.builder.BuildDocument(ctx, key, 1234, src)
		require.NoError(t, err)

		outpath := filepath.Join("testdata", "doc", fmt.Sprintf("output-%s-%s.json", opts.prefix, name))
		cmp, _ := os.ReadFile(outpath)
		out, err := json.MarshalIndent(doc, "", "  ")
		require.NoError(t, err)

		if !assert.JSONEq(t, string(cmp), string(out)) {
			err = os.WriteFile(outpath, out, 0644)
			require.NoError(t, err)
		}
	}
}

func TestDefaultDocumentBuilder(t *testing.T) {
	// playlists
	testDocumentBuilder(t, testBuilderOptions{
		key: &resource.ResourceKey{
			Namespace: "default",
			Group:     "playlist.grafana.app",
			Resource:  "playlists",
		},
		prefix:  "playlist",
		names:   []string{"aaa"},
		builder: &defaultDocumentBuilder{},
	})

	// Folders (still basic, should support nesting)
	testDocumentBuilder(t, testBuilderOptions{
		key: &resource.ResourceKey{
			Namespace: "default",
			Group:     "folder.grafana.app",
			Resource:  "folders",
		},
		prefix:  "folder",
		names:   []string{"aaa", "bbb"},
		builder: &defaultDocumentBuilder{},
	})

	// reports (eg, unknown, but valid resource)
	testDocumentBuilder(t, testBuilderOptions{
		key: &resource.ResourceKey{
			Namespace: "default",
			Group:     "report.grafana.app",
			Resource:  "reports",
		},
		prefix:  "report",
		names:   []string{"aaa"},
		builder: &defaultDocumentBuilder{},
	})
}

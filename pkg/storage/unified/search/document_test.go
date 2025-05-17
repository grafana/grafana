package search_test

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

func doSnapshotTests(t *testing.T, builder resource.DocumentBuilder, kind string, key *resourcepb.ResourceKey, names []string) {
	t.Helper()

	for _, name := range names {
		key.Name = name
		prefix := fmt.Sprintf("%s-%s", kind, key.Name)
		t.Run(prefix, func(t *testing.T) {
			// nolint:gosec
			in, err := os.ReadFile(filepath.Join("testdata", "doc", prefix+".json"))
			require.NoError(t, err)

			doc, err := builder.BuildDocument(context.Background(), key, int64(1234), in)
			require.NoError(t, err)

			out, err := json.MarshalIndent(doc, "", "  ")
			require.NoError(t, err)

			outpath := filepath.Join("testdata", "doc", prefix+"-out.json")

			// test path
			// nolint:gosec
			expect, _ := os.ReadFile(outpath)
			if !assert.JSONEq(t, string(expect), string(out)) {
				err = os.WriteFile(outpath, out, 0600)
				require.NoError(t, err)
			}
		})
	}
}

func TestDashboardDocumentBuilder(t *testing.T) {
	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}

	info, err := search.DashboardBuilder(func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
		return &search.DashboardDocumentBuilder{
			Namespace: namespace,
			Blob:      blob,
			Stats: map[string]map[string]int64{
				"aaa": {
					search.DASHBOARD_ERRORS_LAST_1_DAYS: 1,
					search.DASHBOARD_ERRORS_LAST_7_DAYS: 1,
				},
			},
			DatasourceLookup: dashboard.CreateDatasourceLookup([]*dashboard.DatasourceQueryResult{{
				Name: "TheDisplayName", // used to be the unique ID!
				Type: "my-custom-plugin",
				UID:  "DSUID",
			}}),
		}, nil
	})
	require.NoError(t, err)

	builder, err := info.Namespaced(context.Background(), key.Namespace, nil)
	require.NoError(t, err)

	// Dashboards (custom)
	doSnapshotTests(t, builder, "dashboard", key, []string{
		"aaa",
	})

	// Standard
	builder = resource.StandardDocumentBuilder()
	doSnapshotTests(t, builder, "folder", &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "folder.grafana.app",
		Resource:  "folders",
	}, []string{
		"aaa",
		"bbb",
	})
	doSnapshotTests(t, builder, "playlist", &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "playlist.grafana.app",
		Resource:  "playlists",
	}, []string{
		"aaa",
	})
	doSnapshotTests(t, builder, "report", &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "reporting.grafana.app",
		Resource:  "reports",
	}, []string{
		"aaa",
	})
}

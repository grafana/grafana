package builders

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

			// nolint:gosec
			expect, _ := os.ReadFile(outpath)
			if !assert.JSONEq(t, string(expect), string(out)) {
				err = os.WriteFile(outpath, out, 0600)
				require.NoError(t, err)
			}
		})
	}
}

func TestUserDocumentBuilder(t *testing.T) {
	info, err := GetUserBuilder()
	require.NoError(t, err)
	doSnapshotTests(t, info.Builder, "user", &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "iam.grafana.app",
		Resource:  "users",
	}, []string{
		"with-login-and-email",
		"with-login-only",
		"with-last-seen-at-and-role",
	})
}

func TestExternalGroupMappingDocumentBuilder(t *testing.T) {
	info, err := GetExternalGroupMappingBuilder()
	require.NoError(t, err)
	doSnapshotTests(t, info.Builder, "external_group_mapping", &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "iam.grafana.app",
		Resource:  "externalgroupmappings",
	}, []string{
		"mapping-with-team-and-group",
	})
}

func TestTeamSearchBuilder(t *testing.T) {
	info, err := GetTeamSearchBuilder()
	require.NoError(t, err)
	doSnapshotTests(t, info.Builder, "team", &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "iam.grafana.app",
		Resource:  "searchTeams",
	}, []string{
		"with-email-and-external-uid",
	})
}

func TestDashboardDocumentBuilder(t *testing.T) {
	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}

	info, err := DashboardBuilder(func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
		return &DashboardDocumentBuilder{
			Namespace: namespace,
			Blob:      blob,
			Stats: map[string]map[string]int64{
				"aaa": {
					DASHBOARD_ERRORS_LAST_1_DAYS: 1,
					DASHBOARD_ERRORS_LAST_7_DAYS: 1,
				},
			},
			DatasourceLookup: dashboard.CreateDatasourceLookup([]*dashboard.DatasourceQueryResult{{
				Name: "TheDisplayName",
				Type: "my-custom-plugin",
				UID:  "DSUID",
			}}),
		}, nil
	})
	require.NoError(t, err)

	builder, err := info.Namespaced(context.Background(), key.Namespace, nil)
	require.NoError(t, err)

	doSnapshotTests(t, builder, "dashboard", key, []string{
		"aaa",
	})

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

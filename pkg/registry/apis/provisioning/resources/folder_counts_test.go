package resources

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/sets"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

// countsClient answers the counts subresource and delegates every other call.
type countsClient struct {
	*fakeDynamicResourceClient
	counts    map[string][]folderv1.ResourceStats
	countsErr error
}

func (c *countsClient) Get(ctx context.Context, name string, opts metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	if len(subresources) == 1 && subresources[0] == "counts" {
		if c.countsErr != nil {
			return nil, c.countsErr
		}
		obj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&folderv1.DescendantCounts{Counts: c.counts[name]})
		if err != nil {
			return nil, err
		}
		return &unstructured.Unstructured{Object: obj}, nil
	}
	return c.fakeDynamicResourceClient.Get(ctx, name, opts, subresources...)
}

func TestGetFolderCounts(t *testing.T) {
	dashboards := folderv1.ResourceStats{Group: DashboardResource.Group, Resource: DashboardResource.Resource, Count: 2}

	t.Run("returns the counts of the folder", func(t *testing.T) {
		client := &countsClient{
			fakeDynamicResourceClient: &fakeDynamicResourceClient{},
			counts:                    map[string][]folderv1.ResourceStats{"folder-a": {dashboards}},
		}

		counts, err := GetFolderCounts(context.Background(), client, "folder-a")
		require.NoError(t, err)
		require.Equal(t, []folderv1.ResourceStats{dashboards}, counts)
	})

	t.Run("returns the error of the counts request", func(t *testing.T) {
		client := &countsClient{fakeDynamicResourceClient: &fakeDynamicResourceClient{}, countsErr: errors.New("boom")}

		_, err := GetFolderCounts(context.Background(), client, "folder-a")
		require.ErrorContains(t, err, `get counts for folder "folder-a": boom`)
	})
}

func TestHasUnsupportedResources(t *testing.T) {
	dashboards := DashboardResource.GroupResource()
	supported := sets.New(dashboards)

	tests := []struct {
		name   string
		counts []folderv1.ResourceStats
		want   bool
	}{
		{name: "empty folder", want: false},
		{
			name: "dashboards and folders only",
			counts: []folderv1.ResourceStats{
				{Group: dashboards.Group, Resource: dashboards.Resource, Count: 3},
				{Group: FolderResource.Group, Resource: FolderResource.Resource, Count: 2},
			},
			want: false,
		},
		{
			name:   "alert rules from unified storage",
			counts: []folderv1.ResourceStats{{Group: "rules.alerting.grafana.app", Resource: "alertrules", Count: 1}},
			want:   true,
		},
		{
			name:   "alert rules from legacy storage",
			counts: []folderv1.ResourceStats{{Group: "sql-fallback", Resource: "alertrules", Count: 1}},
			want:   true,
		},
		{
			name: "unsupported kinds with a count of zero",
			counts: []folderv1.ResourceStats{
				{Group: "rules.alerting.grafana.app", Resource: "alertrules", Count: 0},
				{Group: "sql-fallback", Resource: "library_elements", Count: 0},
			},
			want: false,
		},
		{
			name:   "variables are not supported",
			counts: []folderv1.ResourceStats{{Group: "dashboard.grafana.app", Resource: "variables", Count: 1}},
			want:   true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, HasUnsupportedResources(tt.counts, supported))
		})
	}
}

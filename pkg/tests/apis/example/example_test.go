package playlist

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/exp/slices"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/tests/apis"
)

func TestExampleApp(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := apis.NewK8sTestHelper(t)

	t.Run("Check runtime info resource", func(t *testing.T) {
		// Resource is not namespaced!
		client := helper.Org1.Admin.Client.Resource(schema.GroupVersionResource{
			Group:    "example.grafana.app",
			Version:  "v0alpha1",
			Resource: "runtime",
		})
		rsp, err := client.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)

		v, ok := rsp.Object["startupTime"].(int64)
		require.True(t, ok)
		require.Greater(t, v, time.Now().Add(-1*time.Hour).UnixMilli()) // should be within the last hour
	})

	t.Run("Check discovery client", func(t *testing.T) {
		global := helper.NewDiscoveryClient(&schema.GroupVersion{
			Group:   "playlist.grafana.app", // example running in dev mode?
			Version: "v0alpha1",
		})
		paths, err := global.OpenAPIV3().Paths()
		require.NoError(t, err)

		keys := []string{}
		for k := range paths {
			keys = append(keys, k)
		}
		slices.Sort(keys)
		require.Equal(t, []string{"a"}, keys)
	})
}

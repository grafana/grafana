package plugins

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/tests/apis"
)

var gvrPluginMeta = schema.GroupVersionResource{
	Group:    "plugins.grafana.app",
	Version:  "v0alpha1",
	Resource: "pluginmetas",
}

func TestIntegrationPluginMeta(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Run("list plugin metas", func(t *testing.T) {
		helper := setupHelper(t)
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrPluginMeta,
		})
		list, err := client.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.NotNil(t, list)
		require.Empty(t, list.Items)
	})

	t.Run("get plugin meta", func(t *testing.T) {
		helper := setupHelper(t)
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrPluginMeta,
		})
		_, err := client.Resource.Get(ctx, "example", metav1.GetOptions{})
		require.Error(t, err)
	})
}

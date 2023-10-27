package playlist

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/tests/apis"
)

func TestExampleApp(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := apis.NewK8sTestHelper(t)
	gvr := schema.GroupVersionResource{
		Group:    "example.grafana.app",
		Version:  "v0alpha1",
		Resource: "runtime",
	}

	t.Run("Check runtime info", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Editor,
			GVR:  gvr,
		})
		rsp, err := client.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)

		vvv, err := json.MarshalIndent(rsp, "", "  ")
		fmt.Printf("%s\n", vvv)

		require.Equal(t, 1, 2)
	})
}

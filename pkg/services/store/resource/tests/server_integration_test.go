package resource_server_tests

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/apis/playlist/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/store/resource"
)

var (
	//go:embed testdata/dashboard-with-tags-b-g.json
	dashboardWithTagsBlueGreen string
	//go:embed testdata/dashboard-with-tags-r-g.json
	dashboardWithTagsRedGreen string
)

func TestIntegrationEntityServer(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	testCtx := createTestContext(t)
	ctx := appcontext.WithUser(testCtx.ctx, testCtx.user)

	t.Run("should not retrieve non-existent objects", func(t *testing.T) {
		resp, err := testCtx.client.GetResource(ctx, &resource.GetResourceRequest{
			Key: &resource.Key{
				Group:     "X",
				Namespace: "X",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotNil(t, resp.Status)
		require.Nil(t, resp.Value)
		require.Equal(t, int32(http.StatusBadRequest), resp.Status.Code)
	})

	t.Run("insert an object", func(t *testing.T) {
		var err error
		key := &resource.Key{
			Namespace: "default",
			Group:     "playlists.grafana.app",
			Resource:  "Playlist",
			Name:      "x123",
		}
		sample := v0alpha1.Playlist{
			ObjectMeta: metav1.ObjectMeta{
				Name:      key.Name,
				Namespace: key.Namespace,
				UID:       types.UID("xyz"),
			},
			TypeMeta: metav1.TypeMeta{
				Kind:       key.Resource,
				APIVersion: key.Group + "/v0alpha1",
			},
			Spec: v0alpha1.Spec{
				Title: "hello",
			},
		}
		req := &resource.CreateRequest{
			Key: key,
		}
		req.Value, err = json.Marshal(sample)
		require.NoError(t, err)

		fmt.Printf("%s", string(req.Value))

		resp, err := testCtx.client.Create(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Nil(t, resp.Status)
		require.True(t, resp.ResourceVersion > 0) // that it has a positive resource version
	})
}

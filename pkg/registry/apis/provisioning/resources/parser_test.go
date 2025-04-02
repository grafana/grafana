package resources

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

func TestParer(t *testing.T) {
	parser := &Parser{
		repo: v0alpha1.ResourceRepositoryInfo{
			Type:      v0alpha1.LocalRepositoryType,
			Namespace: "xxx",
			Name:      "repo",
		},
		clients: NewDummyClients(),
	}

	t.Run("invalid input", func(t *testing.T) {
		_, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte("hello"), // not a real resource
		}, false)
		require.Error(t, err)
		require.Equal(t, "classic resource must be JSON", err.Error())
	})

	t.Run("dashboard parsing (with and without name)", func(t *testing.T) {
		dash, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
metadata:
  name: test-v0
spec:
  title: Test dashboard
`),
		}, false)
		require.NoError(t, err)
		require.Equal(t, "dashboard.grafana.app", dash.GVK.Group)
		require.Equal(t, "v0alpha1", dash.GVK.Version)
		require.Equal(t, "dashboard.grafana.app", dash.GVR.Group)
		require.Equal(t, "v0alpha1", dash.GVR.Version)

		// Now try again without a name
		dash, err = parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
spec:
  title: Test dashboard
`),
		}, false)
		require.NoError(t, err) // parsed, but has internal error
		require.NotEmpty(t, dash.Errors)
	})
}

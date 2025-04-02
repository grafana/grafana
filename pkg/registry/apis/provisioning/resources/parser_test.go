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
		clients: &resourceClients{},
	}

	t.Run("invalid input", func(t *testing.T) {
		_, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte("hello"), // not a real resource
		}, false)
		require.Error(t, err)
		require.Equal(t, "classic resource must be JSON", err.Error())
	})

	t.Run("dashboard missing name", func(t *testing.T) {
		_, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
metadata:
  name: test-v0
spec:
  title: Test dashboard. Created at v0
  uid: test-v0 # will be removed by mutation hook
  version: 1234567 # will be removed by mutation hook
`),
		}, false)
		require.Error(t, err)
		require.Equal(t, "classic resource must be JSON", err.Error())
	})
}

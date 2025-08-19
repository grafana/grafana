package resources

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

func TestParser(t *testing.T) {
	clients := NewMockResourceClients(t)
	clients.On("ForKind", dashboardV0.DashboardResourceInfo.GroupVersionKind()).
		Return(nil, dashboardV0.DashboardResourceInfo.GroupVersionResource(), nil).Maybe()
	clients.On("ForKind", dashboardV1.DashboardResourceInfo.GroupVersionKind()).
		Return(nil, dashboardV1.DashboardResourceInfo.GroupVersionResource(), nil).Maybe()

	parser := &parser{
		repo: provisioning.ResourceRepositoryInfo{
			Type:      provisioning.LocalRepositoryType,
			Namespace: "xxx",
			Name:      "repo",
		},
		clients: clients,
	}

	t.Run("invalid input", func(t *testing.T) {
		_, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte("hello"), // not a real resource
		})
		require.Error(t, err)
		require.Equal(t, "unable to read file as a resource", err.Error())
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
		})
		require.NoError(t, err)
		require.Equal(t, "test-v0", dash.Obj.GetName())
		require.Equal(t, "dashboard.grafana.app", dash.GVK.Group)
		require.Equal(t, "v0alpha1", dash.GVK.Version)
		require.Equal(t, "dashboard.grafana.app", dash.GVR.Group)
		require.Equal(t, "v0alpha1", dash.GVR.Version)

		// Now try again without a name
		_, err = parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`apiVersion: ` + dashboardV1.APIVERSION + `
kind: Dashboard
spec:
  title: Test dashboard
`),
		})
		require.EqualError(t, err, "name.metadata.name: Required value: missing name in resource")
	})

	t.Run("generate name will generate a name", func(t *testing.T) {
		dash, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
metadata:
  generateName: rand-
spec:
  title: Test dashboard
`),
		})
		require.NoError(t, err)
		require.Equal(t, "dashboard.grafana.app", dash.GVK.Group)
		require.Equal(t, "v0alpha1", dash.GVK.Version)
		require.True(t, strings.HasPrefix(dash.Obj.GetName(), "rand-"), "set name")
	})

	t.Run("dashboard classic format", func(t *testing.T) {
		dash, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`{ "uid": "test", "schemaVersion": 30, "panels": [], "tags": [] }`),
		})
		require.NoError(t, err)
		require.Equal(t, "test", dash.Obj.GetName())
		require.Equal(t, provisioning.ClassicDashboard, dash.Classic)
		require.Equal(t, "dashboard.grafana.app", dash.GVK.Group)
		require.Equal(t, "v0alpha1", dash.GVK.Version)
		require.Equal(t, "dashboard.grafana.app", dash.GVR.Group)
		require.Equal(t, "v0alpha1", dash.GVR.Version)
	})
}

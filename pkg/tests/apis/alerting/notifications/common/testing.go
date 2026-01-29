package common

import (
	"context"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/routingtree"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/tests/apis"
)

func NewReceiverClient(t *testing.T, user apis.User) *apis.TypedClient[v0alpha1.Receiver, v0alpha1.ReceiverList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[v0alpha1.Receiver, v0alpha1.ReceiverList]{
		Client: client.Resource(
			v0alpha1.ReceiverKind().GroupVersionResource()).
			Namespace("default"),
	}
}

func NewRoutingTreeClient(t *testing.T, user apis.User) *apis.TypedClient[v0alpha1.RoutingTree, v0alpha1.RoutingTreeList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[v0alpha1.RoutingTree, v0alpha1.RoutingTreeList]{
		Client: client.Resource(
			v0alpha1.RoutingTreeKind().GroupVersionResource()).Namespace("default"),
	}
}

func NewTemplateGroupClient(t *testing.T, user apis.User) *apis.TypedClient[v0alpha1.TemplateGroup, v0alpha1.TemplateGroupList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[v0alpha1.TemplateGroup, v0alpha1.TemplateGroupList]{
		Client: client.Resource(
			v0alpha1.TemplateGroupKind().GroupVersionResource()).Namespace("default"),
	}
}

func NewTimeIntervalClient(t *testing.T, user apis.User) *apis.TypedClient[v0alpha1.TimeInterval, v0alpha1.TimeIntervalList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[v0alpha1.TimeInterval, v0alpha1.TimeIntervalList]{
		Client: client.Resource(
			v0alpha1.TimeIntervalKind().GroupVersionResource()).Namespace("default"),
	}
}

// UpdateDefaultRoute helper method to update the default route based on api definition.
func UpdateDefaultRoute(t *testing.T, user apis.User, r *definitions.Route) {
	t.Helper()
	v1Route, err := routingtree.ConvertToK8sResource(user.Identity.GetOrgID(), *r, "", func(int64) string { return apis.DefaultNamespace })
	require.NoError(t, err)
	routeAdminClient, err := v0alpha1.NewRoutingTreeClientFromGenerator(user.GetClientRegistry())
	require.NoError(t, err)
	_, err = routeAdminClient.Update(context.Background(), v1Route, resource.UpdateOptions{})
	require.NoError(t, err)
}

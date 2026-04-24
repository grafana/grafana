package common

import (
	"context"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/routingtree"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/tests/apis"
)

func NewReceiverClient(t *testing.T, user apis.User) *apis.TypedClient[v1beta1.Receiver, v1beta1.ReceiverList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[v1beta1.Receiver, v1beta1.ReceiverList]{
		Client: client.Resource(
			v1beta1.ReceiverKind().GroupVersionResource()).
			Namespace("default"),
	}
}

func NewRoutingTreeClient(t *testing.T, user apis.User) *apis.TypedClient[v1beta1.RoutingTree, v1beta1.RoutingTreeList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[v1beta1.RoutingTree, v1beta1.RoutingTreeList]{
		Client: client.Resource(
			v1beta1.RoutingTreeKind().GroupVersionResource()).Namespace("default"),
	}
}

func NewTemplateGroupClient(t *testing.T, user apis.User) *apis.TypedClient[v1beta1.TemplateGroup, v1beta1.TemplateGroupList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[v1beta1.TemplateGroup, v1beta1.TemplateGroupList]{
		Client: client.Resource(
			v1beta1.TemplateGroupKind().GroupVersionResource()).Namespace("default"),
	}
}

func NewTimeIntervalClient(t *testing.T, user apis.User) *apis.TypedClient[v1beta1.TimeInterval, v1beta1.TimeIntervalList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[v1beta1.TimeInterval, v1beta1.TimeIntervalList]{
		Client: client.Resource(
			v1beta1.TimeIntervalKind().GroupVersionResource()).Namespace("default"),
	}
}

// UpdateDefaultRoute helper method to update the default route based on api definition.
func UpdateDefaultRoute(t *testing.T, user apis.User, r *definitions.Route) {
	t.Helper()
	routeClient, err := v1beta1.NewRoutingTreeClientFromGenerator(user.GetClientRegistry())
	require.NoError(t, err)
	route := legacy_storage.NewManagedRoute(v1beta1.UserDefinedRoutingTreeName, r)
	route.Version = "" // Avoid version conflict.
	v1route, err := routingtree.ConvertToK8sResource(user.Identity.GetOrgID(), route, func(int64) string { return apis.DefaultNamespace }, nil)
	require.NoError(t, err)
	_, err = routeClient.Update(context.Background(), v1route, resource.UpdateOptions{})
	require.NoError(t, err)
}

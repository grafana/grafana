package common

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/tests/apis"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
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

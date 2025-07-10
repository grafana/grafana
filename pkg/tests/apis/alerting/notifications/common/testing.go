package common

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alerting/v0alpha1"
)

func NewReceiverClient(t *testing.T, user apis.User) *apis.TypedClient[v0alpha1.Receiver, v0alpha1.ReceiverList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[v0alpha1.Receiver, v0alpha1.ReceiverList]{
		Client: client.Resource(
			schema.GroupVersionResource{
				Group:    v0alpha1.ReceiverKind().Group(),
				Version:  v0alpha1.ReceiverKind().Version(),
				Resource: v0alpha1.ReceiverKind().Plural(),
			}).Namespace("default"),
	}
}

func NewRoutingTreeClient(t *testing.T, user apis.User) *apis.TypedClient[v0alpha1.RoutingTree, v0alpha1.RoutingTreeList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[v0alpha1.RoutingTree, v0alpha1.RoutingTreeList]{
		Client: client.Resource(
			schema.GroupVersionResource{
				Group:    v0alpha1.RoutingTreeKind().Group(),
				Version:  v0alpha1.RoutingTreeKind().Version(),
				Resource: v0alpha1.RoutingTreeKind().Plural(),
			}).Namespace("default"),
	}
}

func NewTemplateGroupClient(t *testing.T, user apis.User) *apis.TypedClient[v0alpha1.TemplateGroup, v0alpha1.TemplateGroupList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[v0alpha1.TemplateGroup, v0alpha1.TemplateGroupList]{
		Client: client.Resource(
			schema.GroupVersionResource{
				Group:    v0alpha1.TemplateGroupKind().Group(),
				Version:  v0alpha1.TemplateGroupKind().Version(),
				Resource: v0alpha1.TemplateGroupKind().Plural(),
			}).Namespace("default"),
	}
}

func NewTimeIntervalClient(t *testing.T, user apis.User) *apis.TypedClient[v0alpha1.TimeInterval, v0alpha1.TimeIntervalList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[v0alpha1.TimeInterval, v0alpha1.TimeIntervalList]{
		Client: client.Resource(
			schema.GroupVersionResource{
				Group:    v0alpha1.TimeIntervalKind().Group(),
				Version:  v0alpha1.TimeIntervalKind().Version(),
				Resource: v0alpha1.TimeIntervalKind().Plural(),
			}).Namespace("default"),
	}
}

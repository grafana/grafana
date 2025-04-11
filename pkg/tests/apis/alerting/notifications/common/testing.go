package common

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	v0alpha1_receiver "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/receiver/v0alpha1"
	v0alpha1_routingtree "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/routingtree/v0alpha1"
	v0alpha1_templategroup "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/templategroup/v0alpha1"
	v0alpha1_timeinterval "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/timeinterval/v0alpha1"
)

func NewReceiverClient(t *testing.T, user apis.User) *apis.TypedClient[v0alpha1_receiver.Receiver, v0alpha1_receiver.ReceiverList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[v0alpha1_receiver.Receiver, v0alpha1_receiver.ReceiverList]{
		Client: client.Resource(
			schema.GroupVersionResource{
				Group:    v0alpha1_receiver.Kind().Group(),
				Version:  v0alpha1_receiver.Kind().Version(),
				Resource: v0alpha1_receiver.Kind().Plural(),
			}).Namespace("default"),
	}
}

func NewRoutingTreeClient(t *testing.T, user apis.User) *apis.TypedClient[v0alpha1_routingtree.RoutingTree, v0alpha1_routingtree.RoutingTreeList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[v0alpha1_routingtree.RoutingTree, v0alpha1_routingtree.RoutingTreeList]{
		Client: client.Resource(
			schema.GroupVersionResource{
				Group:    v0alpha1_routingtree.Kind().Group(),
				Version:  v0alpha1_routingtree.Kind().Version(),
				Resource: v0alpha1_routingtree.Kind().Plural(),
			}).Namespace("default"),
	}
}

func NewTemplateGroupClient(t *testing.T, user apis.User) *apis.TypedClient[v0alpha1_templategroup.TemplateGroup, v0alpha1_templategroup.TemplateGroupList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[v0alpha1_templategroup.TemplateGroup, v0alpha1_templategroup.TemplateGroupList]{
		Client: client.Resource(
			schema.GroupVersionResource{
				Group:    v0alpha1_templategroup.Kind().Group(),
				Version:  v0alpha1_templategroup.Kind().Version(),
				Resource: v0alpha1_templategroup.Kind().Plural(),
			}).Namespace("default"),
	}
}

func NewTimeIntervalClient(t *testing.T, user apis.User) *apis.TypedClient[v0alpha1_timeinterval.TimeInterval, v0alpha1_timeinterval.TimeIntervalList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[v0alpha1_timeinterval.TimeInterval, v0alpha1_timeinterval.TimeIntervalList]{
		Client: client.Resource(
			schema.GroupVersionResource{
				Group:    v0alpha1_timeinterval.Kind().Group(),
				Version:  v0alpha1_timeinterval.Kind().Version(),
				Resource: v0alpha1_timeinterval.Kind().Plural(),
			}).Namespace("default"),
	}
}

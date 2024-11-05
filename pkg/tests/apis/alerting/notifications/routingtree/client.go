package routingtree

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/routingtree/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis"
)

func newClient(t *testing.T, user apis.User) *apis.GenericClient[model.RoutingTree, model.RoutingTreeList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.GenericClient[model.RoutingTree, model.RoutingTreeList]{
		Client: client.Resource(
			schema.GroupVersionResource{
				Group:    model.Kind().Group(),
				Version:  model.Kind().Version(),
				Resource: model.Kind().Plural(),
			}).Namespace("default"),
	}
}

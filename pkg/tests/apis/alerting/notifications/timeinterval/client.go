package timeinterval

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/apps/alerting/notifications/apis/resource/timeinterval/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis"
)

func newClient(t *testing.T, user apis.User) *apis.GenericClient[v0alpha1.TimeInterval, v0alpha1.TimeIntervalList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.GenericClient[v0alpha1.TimeInterval, v0alpha1.TimeIntervalList]{
		Client: client.Resource(
			schema.GroupVersionResource{
				Group:    v0alpha1.Kind().Group(),
				Version:  v0alpha1.Kind().Version(),
				Resource: v0alpha1.Kind().Plural(),
			}).Namespace("default"),
	}
}

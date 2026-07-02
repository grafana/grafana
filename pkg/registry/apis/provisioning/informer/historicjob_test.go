package informer

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

// The historic-job informer takes no live notifications (its handler reads the
// object directly), so it never subscribes — it is driven only by the re-list.
func TestNewHistoricJobInformer_DoesNotSubscribe(t *testing.T) {
	sub := newFakeSubscriber()
	gvr := provisioningapis.HistoricJobResourceInfo.GroupVersionResource()

	inf := NewHistoricJobInformer(sub, fake.NewClientset(), testNamespace, time.Minute, usinformer.NewStore(), nil)
	_, err := inf.AddEventHandler(&typeRecorder{})
	require.NoError(t, err)
	stopCh := make(chan struct{})
	go inf.Run(stopCh)
	t.Cleanup(func() { close(stopCh) })

	require.Eventually(t, inf.HasSynced, 5*time.Second, 5*time.Millisecond)
	assert.False(t, sub.subscribed(resourcewatch.Subject(gvr, testNamespace)),
		"historic-job informer must not subscribe to live notifications")
}

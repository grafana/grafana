package informer

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/cache"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// addRecorder records the names delivered to OnAdd.
type addRecorder struct {
	mu    sync.Mutex
	names []string
}

func (r *addRecorder) OnAdd(obj interface{}, _ bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if m, ok := obj.(metav1.Object); ok {
		r.names = append(r.names, m.GetName())
	}
}
func (r *addRecorder) OnUpdate(_, _ interface{}) {}
func (r *addRecorder) OnDelete(_ interface{})    {}

func (r *addRecorder) got() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]string(nil), r.names...)
}

// TestNewHistoricJobDeltaSource_SelectsSourceByNATS verifies the source selection:
// an apiserver-backed SharedIndexInformer when NATS is off, and a CachelessCronSource
// when NATS is on. The historic-job controller is unaffected either way — it only
// registers its EventHandler on whichever DeltaSource this returns.
func TestNewHistoricJobDeltaSource_SelectsSourceByNATS(t *testing.T) {
	client := fake.NewClientset()

	t.Run("NATS off uses apiserver informer", func(t *testing.T) {
		src := NewHistoricJobDeltaSource(false, client, time.Minute)
		_, isCron := src.(*usinformer.CachelessCronSource)
		assert.False(t, isCron, "expected the apiserver informer, not the cron source")
		_, isInformer := src.(cache.SharedIndexInformer)
		assert.True(t, isInformer, "expected an apiserver-backed SharedIndexInformer")
	})

	t.Run("NATS on uses cron source", func(t *testing.T) {
		src := NewHistoricJobDeltaSource(true, client, time.Minute)
		_, isCron := src.(*usinformer.CachelessCronSource)
		assert.True(t, isCron, "expected the cron source when NATS is enabled")
	})
}

// TestNewHistoricJobCronSource_ListsFromClient verifies the NATS-mode source reads
// historic jobs through the provisioning client.
func TestNewHistoricJobCronSource_ListsFromClient(t *testing.T) {
	client := fake.NewClientset(
		&provisioningapis.HistoricJob{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "old"}},
	)

	src := NewHistoricJobCronSource(client, "", time.Hour)
	h := &addRecorder{}
	_, err := src.AddEventHandler(h)
	require.NoError(t, err)

	stop := make(chan struct{})
	defer close(stop)
	go src.Run(stop)

	require.Eventually(t, func() bool { return len(h.got()) == 1 }, time.Second, 5*time.Millisecond)
	assert.ElementsMatch(t, []string{"old"}, h.got())
}

package informer

import (
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/cache"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	"github.com/grafana/grafana/pkg/services/apiserver/informers/informerstest"
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

// The historic-job controller registers its handler on whichever informer the
// supplier picks: the API watch without NATS, the re-list with it. Either way it
// is handed typed HistoricJobs.
func TestNewHistoricJobDeltaSource(t *testing.T) {
	for name, supplier := range map[string]operator.InformerSupplier{
		"NATS off watches the API":                  nil,
		"NATS on re-lists, needing no subscription": natsSupplier(nil),
	} {
		t.Run(name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				clients := informerstest.NewClients(&provisioningapis.HistoricJob{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "old"}})
				src, err := NewHistoricJobDeltaSource(supplier, clients, time.Minute)
				require.NoError(t, err)

				h := &typeRecorder{}
				reg, err := src.AddEventHandler(h)
				require.NoError(t, err)
				stop := make(chan struct{})
				defer close(stop)
				go src.Run(stop)

				require.True(t, cache.WaitForCacheSync(t.Context().Done(), reg.HasSynced))
				synctest.Wait()
				job, ok := h.last().(*provisioningapis.HistoricJob)
				require.True(t, ok, "expected a typed HistoricJob, got %T", h.last())
				assert.Equal(t, "old", job.Name)
			})
		})
	}
}

// TestNewHistoricJobPeriodicInformer_ListsFromClient verifies the NATS-mode source reads
// historic jobs through the provisioning client.
func TestNewHistoricJobPeriodicInformer_ListsFromClient(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		client := fake.NewClientset(
			&provisioningapis.HistoricJob{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "old"}},
		)

		src := NewHistoricJobPeriodicInformer(client, "", time.Hour)
		h := &addRecorder{}
		_, err := src.AddEventHandler(h)
		require.NoError(t, err)

		stop := make(chan struct{})
		defer close(stop)
		go src.Run(stop)

		// Finish the initial client list and deliver its historic job to the handler.
		synctest.Wait()

		assert.ElementsMatch(t, []string{"old"}, h.got())
	})
}

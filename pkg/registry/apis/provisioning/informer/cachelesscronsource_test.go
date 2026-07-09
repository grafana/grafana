package informer

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// recordingHandler counts the objects delivered to OnAdd.
type recordingHandler struct {
	mu    sync.Mutex
	added []string
}

func (h *recordingHandler) OnAdd(obj interface{}, _ bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if m, ok := obj.(metav1.Object); ok {
		h.added = append(h.added, m.GetName())
	}
}
func (h *recordingHandler) OnUpdate(_, _ interface{}) {}
func (h *recordingHandler) OnDelete(_ interface{})    {}

func (h *recordingHandler) names() []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	return append([]string(nil), h.added...)
}

func TestCachelessCronSource_DeliversListedObjects(t *testing.T) {
	list := func(_ context.Context) ([]runtime.Object, error) {
		return []runtime.Object{
			&provisioningapis.HistoricJob{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "a"}},
			&provisioningapis.HistoricJob{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "b"}},
		}, nil
	}

	src := NewCachelessCronSource("historicjobs", time.Hour, list)
	h := &recordingHandler{}
	_, err := src.AddEventHandler(h)
	require.NoError(t, err)

	stop := make(chan struct{})
	defer close(stop)
	go src.Run(stop)

	require.Eventually(t, func() bool { return len(h.names()) == 2 }, time.Second, 5*time.Millisecond)
	assert.ElementsMatch(t, []string{"a", "b"}, h.names())
}

func TestCachelessCronSource_RetriesInitialListUntilItSucceeds(t *testing.T) {
	var mu sync.Mutex
	fail := true
	list := func(_ context.Context) ([]runtime.Object, error) {
		mu.Lock()
		defer mu.Unlock()
		if fail {
			return nil, assert.AnError
		}
		return []runtime.Object{
			&provisioningapis.HistoricJob{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "a"}},
		}, nil
	}

	src := NewCachelessCronSource("historicjobs", time.Hour, list)
	// Shorten the retry so the test does not wait the default interval.
	src.retryInterval = 10 * time.Millisecond
	h := &recordingHandler{}
	_, err := src.AddEventHandler(h)
	require.NoError(t, err)

	stop := make(chan struct{})
	defer close(stop)
	go src.Run(stop)

	// Nothing delivered while the list keeps failing.
	assert.Empty(t, h.names())

	mu.Lock()
	fail = false
	mu.Unlock()

	require.Eventually(t, func() bool { return len(h.names()) == 1 }, time.Second, 5*time.Millisecond)
	assert.ElementsMatch(t, []string{"a"}, h.names())
}

package router

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// staticAggregateLoader is a test-only RoutesLoader that reflects one
// aggregateTarget's live snapshot -- standing in for cloudLoader so this test
// exercises GrafanaRouter's real reconcile/serve path against a
// discovery-produced Backend without needing the full CRD machinery. Notify
// lazily creates the coalescing dirty channel (same contract as
// cloudLoader.dirty); GrafanaRouter.Run calls Notify synchronously before it
// ever reads from the channel, so by the time Run returns the channel is
// already wired and safe for a caller to hand to aggregateTarget.run.
type staticAggregateLoader struct {
	target *aggregateTarget
	dirty  chan struct{}
}

func (l *staticAggregateLoader) Load(context.Context) ([]Backend, error) {
	return l.target.Backends(), nil
}

func (l *staticAggregateLoader) Notify(context.Context) (<-chan struct{}, error) {
	l.dirty = make(chan struct{}, 1)
	return l.dirty, nil
}

// TestGrafanaRouter_AggregatedGroupIsServedAndFiltered is an end-to-end proof
// that a group learned purely through active discovery (no RouteBackend CR)
// reaches a real GrafanaRouter's reconcile/serve pipeline: NewGrafanaRouter,
// Run's initial reconcile plus its dirty-triggered reconcile, and HandleFunc
// actually proxying a request -- with a non-matching group filtered out by
// group_regex before it ever becomes a served group.
func TestGrafanaRouter_AggregatedGroupIsServedAndFiltered(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/apis":
			list := metav1.APIGroupList{Groups: []metav1.APIGroup{
				{Name: "dashboard.grafana.app"},
				{Name: "coordination.k8s.io"}, // must be filtered out by group_regex
			}}
			_ = json.NewEncoder(w).Encode(list)
		default:
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("proxied:" + r.URL.Path))
		}
	}))
	defer upstream.Close()

	target, err := newAggregateTarget(aggregateTargetConfig{
		Name:          "baas_apiserver",
		URL:           upstream.URL,
		GroupPatterns: []string{"*.grafana.app"},
	}, upstream.Client())
	require.NoError(t, err)
	// The cooldown is the poll loop's only pacing source, so shortening it is
	// what makes this test fast.
	target.cooldown = newCooldown(10*time.Millisecond, 10*time.Millisecond, 100*time.Millisecond)

	loader := &staticAggregateLoader{target: target}
	r := NewGrafanaRouter(loader)

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()

	// Run calls loader.Notify synchronously before it spawns the reconcile
	// goroutine (see router.go's Run), so loader.dirty is already set by the
	// time Run returns -- only then is it safe to hand it to target.run.
	require.NoError(t, r.Run(ctx))
	go target.run(ctx, loader.dirty)

	require.Eventually(t, func() bool { return r.KnownGroup("dashboard.grafana.app") }, 2*time.Second, 10*time.Millisecond)
	require.False(t, r.KnownGroup("coordination.k8s.io"))

	req := httptest.NewRequest(http.MethodGet, "/apis/dashboard.grafana.app/v1/things", nil)
	rec := httptest.NewRecorder()
	r.HandleFunc(rec, req, http.NotFoundHandler())
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), "proxied:/apis/dashboard.grafana.app/v1/things")
}

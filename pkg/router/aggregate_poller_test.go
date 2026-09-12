package router

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestAggregateTarget_DiscoversAndFiltersGroups(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		list := metav1.APIGroupList{Groups: []metav1.APIGroup{
			{Name: "dashboard.grafana.app"},
			{Name: "coordination.k8s.io"},
		}}
		_ = json.NewEncoder(w).Encode(list)
	}))
	defer srv.Close()

	target, err := newAggregateTarget(aggregateTargetConfig{
		Name:          "baas_apiserver",
		URL:           srv.URL,
		GroupPatterns: []string{"*.grafana.app"},
	}, srv.Client())
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(t.Context())
	dirty := make(chan struct{}, 1)
	go target.run(ctx, dirty)

	require.Eventually(t, func() bool {
		return len(target.Backends()) == 1
	}, 2*time.Second, 10*time.Millisecond)

	backends := target.Backends()
	require.Equal(t, "dashboard.grafana.app", backends[0].Group().Name)

	// The first successful poll took the discovered key set from empty to
	// non-empty, so it must have signaled dirty.
	require.Eventually(t, func() bool {
		select {
		case <-dirty:
			return true
		default:
			return false
		}
	}, 500*time.Millisecond, 5*time.Millisecond, "expected dirty to be signaled when the discovered key set changed from empty to non-empty")

	cancel()
}

func TestAggregateTarget_CooldownLimitsRequestsWhileDown(t *testing.T) {
	var attempts atomic.Int64
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts.Add(1)
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	target, err := newAggregateTarget(aggregateTargetConfig{
		Name: "baas_apiserver",
		URL:  srv.URL,
	}, srv.Client())
	require.NoError(t, err)
	target.cooldown = newCooldown(10*time.Millisecond, 200*time.Millisecond, time.Second)

	ctx, cancel := context.WithCancel(t.Context())
	dirty := make(chan struct{}, 1)
	go target.run(ctx, dirty)

	time.Sleep(150 * time.Millisecond)
	cancel()

	// Without backoff, the 10ms steady interval over 150ms would be ~15
	// attempts; with a 200ms floor after the first failure, it must be
	// at most 2 (the initial attempt plus, at most, one more right at
	// the boundary).
	require.LessOrEqual(t, attempts.Load(), int64(2))
	require.Empty(t, target.Backends())

	// A poll that only ever fails must never signal dirty: there is no
	// discovered key set to change.
	select {
	case <-dirty:
		t.Fatal("dirty must not be signaled while every poll fails")
	default:
	}
}

// TestAggregateTarget_BackoffLadderDrivesRetries pins down the fix for the
// double-pacing bug: retries after a failure must be scheduled by the
// cooldown's backoff ladder, not by a separate steady-interval ticker. The
// steady interval here (1s) is far longer than the test window, so every
// attempt after the first can only have come from the backoff schedule --
// under the old ticker-plus-Ready-gate loop this would have produced exactly
// one attempt.
func TestAggregateTarget_BackoffLadderDrivesRetries(t *testing.T) {
	var attempts atomic.Int64
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts.Add(1)
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	target, err := newAggregateTarget(aggregateTargetConfig{
		Name: "baas_apiserver",
		URL:  srv.URL,
	}, srv.Client())
	require.NoError(t, err)
	target.cooldown = newCooldown(time.Second, 10*time.Millisecond, 40*time.Millisecond)

	ctx, cancel := context.WithCancel(t.Context())
	dirty := make(chan struct{}, 1)
	go target.run(ctx, dirty)
	defer cancel()

	// 10ms -> 20ms -> 40ms (capped) leaves room for well over 3 attempts in
	// 300ms, while the 1s steady interval alone would allow only the first.
	require.Eventually(t, func() bool {
		return attempts.Load() >= 3
	}, 300*time.Millisecond, 5*time.Millisecond, "backoff ladder must drive retries faster than the steady interval")
}

// TestAggregateTarget_SignalsDirtyOnlyOnKeySetChange exercises poll()
// directly (bypassing the timer-driven run loop) so the "no signal when
// unchanged" case doesn't depend on real-time scheduling: sameKeySet's
// diffing is the reason dirty exists rather than firing on every successful
// poll, so it needs to be pinned down explicitly.
func TestAggregateTarget_SignalsDirtyOnlyOnKeySetChange(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		list := metav1.APIGroupList{Groups: []metav1.APIGroup{
			{Name: "dashboard.grafana.app"},
		}}
		_ = json.NewEncoder(w).Encode(list)
	}))
	defer srv.Close()

	target, err := newAggregateTarget(aggregateTargetConfig{
		Name:          "baas_apiserver",
		URL:           srv.URL,
		GroupPatterns: []string{"*.grafana.app"},
	}, srv.Client())
	require.NoError(t, err)

	ctx := t.Context()
	dirty := make(chan struct{}, 1)

	// First poll: key set goes from empty to {dashboard.grafana.app} -- must signal.
	target.poll(ctx, dirty)
	require.Len(t, target.Backends(), 1)
	select {
	case <-dirty:
	default:
		t.Fatal("expected dirty to be signaled on the first poll (empty -> non-empty key set)")
	}

	// Second poll: same upstream response, same key set -- must not signal.
	// No need to reopen the cooldown first: poll() no longer gates itself on
	// it (run()'s timer is the only gate), it just records the outcome.
	target.poll(ctx, dirty)
	require.Len(t, target.Backends(), 1)
	select {
	case <-dirty:
		t.Fatal("dirty must not be signaled when the discovered key set is unchanged from the previous poll")
	default:
	}
}

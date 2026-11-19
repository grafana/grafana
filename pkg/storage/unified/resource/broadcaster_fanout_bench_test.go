package resource

import (
	"context"
	"fmt"
	"syscall"
	"testing"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// discardWatchServer drops every event, like a client that keeps up.
type discardWatchServer struct{ *mockWatchServer }

func (discardWatchServer) Send(*resourcepb.WatchEvent) error { return nil }

func processCPU(b *testing.B) time.Duration {
	b.Helper()
	var usage syscall.Rusage
	if err := syscall.Getrusage(syscall.RUSAGE_SELF, &usage); err != nil {
		b.Fatal(err)
	}
	return time.Duration(usage.Utime.Nano() + usage.Stime.Nano())
}

func waitForMetric(b *testing.B, collector prometheus.Collector, want float64) {
	b.Helper()
	deadline := time.Now().Add(time.Minute)
	for testutil.ToFloat64(collector) != want {
		if time.Now().After(deadline) {
			b.Fatalf("metric stuck at %v, want %v", testutil.ToFloat64(collector), want)
		}
		time.Sleep(time.Millisecond)
	}
}

// BenchmarkWatchFanout writes to one collection while many watches are open,
// either of another collection (a busy collection next to many watchers of a
// quiet one) or of the written collection itself. cpu-ns/op includes the
// watchers' work on other goroutines.
func BenchmarkWatchFanout(b *testing.B) {
	for _, watched := range []string{"other", "same"} {
		for _, backendType := range []string{"legacy", "kv"} {
			for _, watchers := range []int{1000, 4000} {
				b.Run(fmt.Sprintf("%s/%s/watchers=%d", watched, backendType, watchers), func(b *testing.B) {
					benchmarkWatchFanout(b, watched == "same", backendType, watchers)
				})
			}
		}
	}
}

func benchmarkWatchFanout(b *testing.B, same bool, backendType string, watchers int) {
	events := make(chan *WrittenEvent)
	var backend StorageBackend = &legacyWatchBackend{events: events}
	base := time.Now().Add(-time.Hour).UnixMicro()
	if backendType == "kv" {
		backend = &unseededKVWatchBackend{events: events}
		base = snowflakeFromTime(time.Now().Add(-time.Hour))
	}
	srv, err := NewUninitializedResourceServer(ResourceServerOptions{
		Backend: backend, StorageMetrics: ProvideStorageMetrics(prometheus.NewRegistry()), BookmarkFrequency: time.Second,
	})
	if err != nil {
		b.Fatal(err)
	}
	if err := srv.initWatcher(); err != nil {
		b.Fatal(err)
	}

	written := &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "dashboards", Namespace: watchTestNamespace, Name: "d"}
	watchedKey := bookmarkWatchRequest().Options.Key
	if same {
		watchedKey = &resourcepb.ResourceKey{Group: written.Group, Resource: written.Resource, Namespace: written.Namespace}
	}
	watchedKey.Name = ""
	ctx, cancel := context.WithCancel(authlib.WithAuthInfo(context.Background(), newWatchTestUser()))
	done := make(chan struct{}, watchers)
	for range watchers {
		req := &resourcepb.WatchRequest{Options: &resourcepb.ListOptions{Key: watchedKey}, Since: base}
		go func() {
			_ = srv.Watch(req, discardWatchServer{newMockWatchServer(ctx)})
			done <- struct{}{}
		}()
	}
	waitForMetric(b, srv.storageMetrics.Broadcaster.Subscribers.WithLabelValues(watchedKey.Resource), float64(watchers))
	b.Cleanup(func() {
		cancel()
		for range watchers {
			<-done
		}
		close(events)
		stopCtx, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		_ = srv.Stop(stopCtx)
	})

	received := srv.storageMetrics.Broadcaster.EventsReceivedTotal.WithLabelValues(written.Resource)
	rv := base
	cpuBefore := processCPU(b)
	for b.Loop() {
		rv++
		event := bookmarkWrittenEvent(rv)
		event.Key = written
		events <- event
	}
	waitForMetric(b, received, float64(rv-base))
	b.StopTimer()
	b.ReportMetric(float64(processCPU(b)-cpuBefore)/float64(rv-base), "cpu-ns/op")
}

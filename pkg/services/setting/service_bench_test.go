package setting

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"
)

// memTransport serves a canned settings list without network I/O.
type memTransport struct {
	body  []byte
	delay time.Duration
	fail  atomic.Bool
	calls atomic.Int32
}

func (transport *memTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	transport.calls.Add(1)
	if transport.delay > 0 {
		select {
		case <-time.After(transport.delay):
		case <-req.Context().Done():
			return nil, req.Context().Err()
		}
	}

	status := http.StatusOK
	body := transport.body
	if transport.fail.Load() {
		// A 500 without Retry-After is not retried by the client. Connection
		// errors would be retried and distort call counts.
		status = http.StatusInternalServerError
		body = []byte(`{"kind":"Status","apiVersion":"v1","status":"Failure","message":"internal error","reason":"InternalError","code":500}`)
	}
	return &http.Response{
		StatusCode: status,
		Status:     http.StatusText(status),
		Proto:      "HTTP/1.1",
		ProtoMajor: 1,
		ProtoMinor: 1,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(body)),
		Request:    req,
	}, nil
}

// newMemClient returns the public Service interface so the file compiles
// against any implementation of the cache.
func newMemClient(tb testing.TB, rt http.RoundTripper, cacheTTL time.Duration) Service {
	tb.Helper()
	return newMemClientWithConfig(tb, rt, Config{CacheTTL: cacheTTL})
}

// newMemClientWithConfig fills in the URL, transport and rate limits of config.
func newMemClientWithConfig(tb testing.TB, rt http.RoundTripper, config Config) Service {
	tb.Helper()
	// An http URL without TLS config makes client-go use http.DefaultTransport
	// without starting goroutines. The high QPS and Burst keep the rate
	// limiter out of the measurements.
	config.URL = "http://settings.invalid"
	config.WrapTransport = func(http.RoundTripper) http.RoundTripper { return rt }
	config.QPS = 1e6
	config.Burst = 1e6
	client, err := New(config)
	require.NoError(tb, err)
	return client
}

func benchNamespaceContext(namespace string) context.Context {
	return request.WithNamespace(context.Background(), namespace)
}

func mustList(tb testing.TB, ctx context.Context, svc Service) {
	tb.Helper()
	_, err := svc.List(ctx, metav1.LabelSelector{})
	require.NoError(tb, err)
}

func BenchmarkList_Hit(b *testing.B) {
	b.ReportAllocs()

	transport := &memTransport{body: []byte(generateSettingListJSON(500, 50))}
	svc := newMemClient(b, transport, time.Hour)
	ctx := benchNamespaceContext("bench-ns")
	mustList(b, ctx, svc)

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			if _, err := svc.List(ctx, metav1.LabelSelector{}); err != nil {
				b.Error(err)
				return
			}
		}
	})
}

const (
	expiringGoroutines = 8
	expiringTick       = 100 * time.Microsecond
	expiringRound      = 500 * time.Millisecond
	expiringSlowLimit  = time.Millisecond
)

// runExpiringRound has every goroutine call List on one shared key once per
// tick slot for a whole round. Latency is measured from the slot's scheduled
// time, and slots missed while a call blocked are issued as soon as it returns.
// Measuring from call start would record a 150ms block as one slow sample
// instead of the ~1500 calls that waited behind it.
func runExpiringRound(b *testing.B, svc Service, ctx context.Context, buffers [][]time.Duration) {
	b.Helper()
	var group sync.WaitGroup
	roundStart := time.Now()
	for index := range buffers {
		buffers[index] = buffers[index][:0]
		group.Add(1)
		go func() {
			defer group.Done()
			for scheduled := roundStart; scheduled.Before(roundStart.Add(expiringRound)); scheduled = scheduled.Add(expiringTick) {
				if wait := time.Until(scheduled); wait > 0 {
					time.Sleep(wait)
				}
				_, err := svc.List(ctx, metav1.LabelSelector{})
				buffers[index] = append(buffers[index], time.Since(scheduled))
				if err != nil {
					b.Error(err)
					return
				}
			}
		}()
	}
	group.Wait()
}

func reportLatencies(b *testing.B, samples []time.Duration) {
	b.Helper()
	if len(samples) == 0 {
		b.Fatal("no latency samples recorded")
	}
	slices.Sort(samples)
	percentile := func(fraction float64) float64 {
		return float64(samples[int(float64(len(samples)-1)*fraction)].Nanoseconds())
	}
	slow, stalled := 0, 0
	for _, sample := range samples {
		if sample > expiringSlowLimit {
			slow++
		}
		if sample > DefaultCacheStaleWait/2 {
			stalled++
		}
	}
	b.ReportMetric(percentile(0.50), "p50-ns")
	b.ReportMetric(percentile(0.99), "p99-ns")
	b.ReportMetric(percentile(0.999), "p999-ns")
	b.ReportMetric(float64(samples[len(samples)-1].Nanoseconds()), "max-ns")
	b.ReportMetric(float64(slow)/float64(len(samples))*100, "slow-%")
	b.ReportMetric(float64(stalled)/float64(len(samples))*100, "stall-%")
}

func BenchmarkList_Expiring(b *testing.B) {
	const cacheTTL = 50 * time.Millisecond
	for _, remoteDelay := range []time.Duration{time.Millisecond, 150 * time.Millisecond} {
		b.Run(fmt.Sprintf("remote=%s", remoteDelay), func(b *testing.B) {
			b.ReportAllocs()

			transport := &memTransport{body: []byte(generateSettingListJSON(500, 50)), delay: remoteDelay}
			svc := newMemClient(b, transport, cacheTTL)
			ctx := benchNamespaceContext("bench-ns")
			mustList(b, ctx, svc)

			buffers := make([][]time.Duration, expiringGoroutines)
			for index := range buffers {
				buffers[index] = make([]time.Duration, 0, expiringRound/expiringTick)
			}
			var samples []time.Duration

			b.ResetTimer()
			for b.Loop() {
				runExpiringRound(b, svc, ctx, buffers)
				for _, buffer := range buffers {
					samples = append(samples, buffer...)
				}
			}
			b.StopTimer()
			reportLatencies(b, samples)
		})
	}
}

func heapAlloc() uint64 {
	runtime.GC()
	var stats runtime.MemStats
	runtime.ReadMemStats(&stats)
	return stats.HeapAlloc
}

func BenchmarkList_ManyKeys(b *testing.B) {
	const keys = 1000
	b.ReportAllocs()

	transport := &memTransport{body: []byte(generateSettingListJSON(20, 2))}
	var totalBytes int64
	iterations := 0

	for b.Loop() {
		b.StopTimer()
		svc := newMemClient(b, transport, time.Hour)
		before := heapAlloc()
		b.StartTimer()

		for key := range keys {
			mustList(b, benchNamespaceContext(fmt.Sprintf("ns-%d", key)), svc)
		}

		b.StopTimer()
		after := heapAlloc()
		runtime.KeepAlive(svc)
		totalBytes += int64(after) - int64(before)
		iterations++
		b.StartTimer()
	}

	if iterations > 0 {
		b.ReportMetric(float64(totalBytes)/float64(iterations)/keys, "heap-B/entry")
	}
}

// Benchmark tests for streaming JSON parser

func BenchmarkParseSettingList(b *testing.B) {
	jsonData := generateSettingListJSON(4000, 100)
	jsonBytes := []byte(jsonData)

	b.ResetTimer()
	b.ReportAllocs()

	for b.Loop() {
		reader := bytes.NewReader(jsonBytes)
		_, _, _ = parseSettingList(context.Background(), reader)
	}
}

func BenchmarkParseSettingList_SinglePage(b *testing.B) {
	jsonData := generateSettingListJSON(500, 50)
	jsonBytes := []byte(jsonData)

	b.ResetTimer()
	b.ReportAllocs()
	for b.Loop() {
		reader := bytes.NewReader(jsonBytes)
		_, _, _ = parseSettingList(context.Background(), reader)
	}
}

// generateSettingListJSON generates a K8s-style SettingList JSON response for benchmarks
func generateSettingListJSON(totalSettings, numSections int) string {
	var sb strings.Builder
	sb.WriteString(`{"apiVersion":"setting.grafana.app/v1","kind":"SettingList","metadata":{"continue":""},"items":[`)

	settingsPerSection := totalSettings / numSections
	first := true
	for section := range numSections {
		for key := range settingsPerSection {
			if !first {
				sb.WriteString(",")
			}
			first = false
			sb.WriteString(fmt.Sprintf(
				`{"apiVersion":"setting.grafana.app/v1","kind":"Setting","metadata":{"name":"section-%03d--key-%03d","namespace":"bench-ns","labels":{"section":"section-%03d","key":"key-%03d"}},"spec":{"section":"section-%03d","key":"key-%03d","value":"value-for-section-%d-key-%d"}}`,
				section, key, section, key, section, key, section, key,
			))
		}
	}

	sb.WriteString(`]}`)
	return sb.String()
}

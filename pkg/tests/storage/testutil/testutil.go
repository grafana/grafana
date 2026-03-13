package testutil

import (
	"context"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	promtestutil "github.com/prometheus/client_golang/prometheus/testutil"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

const DefaultContextTimeout = time.Second

type T interface {
	Helper()
	Cleanup(func())
	Deadline() (time.Time, bool)
	Errorf(format string, args ...any)
	FailNow()
}

type TestContext interface {
	context.Context
	Cancel()
	CancelCause(error)
}

type testContext struct {
	context.Context
	cancel      context.CancelFunc
	cancelCause context.CancelCauseFunc
}

func SkipIntegrationTestInShortMode(t testing.TB) {
	t.Helper()
	if !strings.HasPrefix(t.Name(), "TestIntegration") {
		t.Fatal("test is not an integration test")
	}
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
}

func NewDefaultTestContext(t T) TestContext {
	return NewTestContext(t, time.Now().Add(DefaultContextTimeout))
}

func NewTestContext(t T, deadline time.Time) TestContext {
	t.Helper()

	if td, ok := t.Deadline(); ok && td.Before(deadline) {
		deadline = td
	}

	ctx, cancel := context.WithDeadline(context.Background(), deadline)
	t.Cleanup(cancel)

	ctx, cancelCause := context.WithCancelCause(identity.WithRequester(ctx, &identity.StaticRequester{}))
	return testContext{
		Context:     ctx,
		cancel:      cancel,
		cancelCause: cancelCause,
	}
}

func ToFloat64(c prometheus.Collector) float64 {
	return promtestutil.ToFloat64(c)
}

func GatherAndCompare(g prometheus.Gatherer, reader io.Reader, metricNames ...string) error {
	return promtestutil.GatherAndCompare(g, reader, metricNames...)
}

func (t testContext) Cancel() {
	t.cancel()
}

func (t testContext) CancelCause(err error) {
	t.cancelCause(err)
}

package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// This is to ensure that the interface contract is held by the implementation
func Test_InterfaceContractValidity(t *testing.T) {
	newUsageStats := func() usagestats.Service {
		return &UsageStats{}
	}
	v, ok := newUsageStats().(*UsageStats)

	assert.NotNil(t, v)
	assert.True(t, ok)
}

func TestMetrics(t *testing.T) {
	const metricName = "stats.test_metric.count"

	sqlStore := dbtest.NewFakeDB()
	uss := createService(t, sqlStore, false)

	uss.RegisterMetricsFunc(func(context.Context) (map[string]any, error) {
		return map[string]any{metricName: 1}, nil
	})

	_, err := uss.sendUsageStats(context.Background())
	require.NoError(t, err)

	t.Run("Given reporting not enabled and sending usage stats", func(t *testing.T) {
		origSendUsageStats := sendUsageStats
		t.Cleanup(func() {
			sendUsageStats = origSendUsageStats
		})
		statsSent := false
		sendUsageStats = func(uss *UsageStats, ctx context.Context, b *bytes.Buffer) error {
			statsSent = true
			return nil
		}

		uss.Cfg.ReportingEnabled = false
		_, err := uss.sendUsageStats(context.Background())
		require.NoError(t, err)

		require.False(t, statsSent)
	})

	t.Run("Given reporting enabled, stats should be gathered and sent to HTTP endpoint", func(t *testing.T) {
		origCfg := uss.Cfg
		t.Cleanup(func() {
			uss.Cfg = origCfg
		})
		uss.Cfg = &setting.Cfg{
			ReportingEnabled:     true,
			BuildVersion:         "5.0.0",
			Anonymous:            setting.AnonymousSettings{Enabled: true},
			BasicAuthEnabled:     true,
			LDAPAuthEnabled:      true,
			AuthProxy:            setting.AuthProxySettings{Enabled: true},
			Packaging:            "deb",
			ReportingDistributor: "hosted-grafana",
		}

		ch := make(chan httpResp)
		ticker := time.NewTicker(2 * time.Second)
		ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			buf, err := io.ReadAll(r.Body)
			if err != nil {
				t.Logf("Fake HTTP handler received an error: %s", err.Error())
				ch <- httpResp{
					err: err,
				}
				return
			}
			require.NoError(t, err, "Failed to read response body, err=%v", err)
			t.Logf("Fake HTTP handler received a response")
			ch <- httpResp{
				responseBuffer: bytes.NewBuffer(buf),
				req:            r,
			}
		}))
		t.Cleanup(ts.Close)
		t.Cleanup(func() {
			close(ch)
		})
		usageStatsURL = ts.URL

		go func() {
			_, err := uss.sendUsageStats(context.Background())
			require.NoError(t, err)
		}()

		// Wait for fake HTTP server to receive a request
		var resp httpResp
		select {
		case resp = <-ch:
			require.NoError(t, resp.err, "Fake server experienced an error")
		case <-ticker.C:
			t.Fatalf("Timed out waiting for HTTP request")
		}

		t.Logf("Received response from fake HTTP server: %+v\n", resp)

		assert.NotNil(t, resp.req)

		assert.Equal(t, http.MethodPost, resp.req.Method)
		assert.Equal(t, "application/json", resp.req.Header.Get("Content-Type"))

		require.NotNil(t, resp.responseBuffer)

		j := make(map[string]any)
		err = json.Unmarshal(resp.responseBuffer.Bytes(), &j)
		require.NoError(t, err)

		assert.Equal(t, "5_0_0", j["version"])
		assert.Equal(t, runtime.GOOS, j["os"])
		assert.Equal(t, runtime.GOARCH, j["arch"])

		usageId := uss.GetUsageStatsId(context.Background())
		assert.NotEmpty(t, usageId)

		metrics, ok := j["metrics"].(map[string]any)
		require.True(t, ok)
		assert.EqualValues(t, 1, metrics[metricName])
	})
}

func TestGetUsageReport_IncludesMetrics(t *testing.T) {
	sqlStore := dbtest.NewFakeDB()
	uss := createService(t, sqlStore, true)
	metricName := "stats.test_metric.count"

	uss.RegisterMetricsFunc(func(context.Context) (map[string]any, error) {
		return map[string]any{metricName: 1}, nil
	})

	report, err := uss.GetUsageReport(context.Background())
	require.NoError(t, err, "Expected no error")

	metric := report.Metrics[metricName]
	assert.Equal(t, 1, metric)
}

func TestRegisterMetrics(t *testing.T) {
	const goodMetricName = "stats.test_external_metric.count"

	sqlStore := dbtest.NewFakeDB()
	uss := createService(t, sqlStore, false)
	metrics := sync.Map{}
	metrics.Store("stats.test_metric.count", 1)
	metrics.Store("stats.test_metric_second.count", 2)

	uss.RegisterMetricsFunc(func(context.Context) (map[string]any, error) {
		return map[string]any{goodMetricName: 1}, nil
	})

	{
		extMetrics, err := uss.externalMetrics[0](context.Background())
		require.NoError(t, err)
		assert.Equal(t, map[string]any{goodMetricName: 1}, extMetrics)
	}

	uss.gatherMetrics(context.Background(), &metrics)
	v, ok := metrics.Load(goodMetricName)
	assert.True(t, ok)
	assert.Equal(t, 1, v)
	metricsCountBefore := 0
	metrics.Range(func(_, _ any) bool {
		metricsCountBefore++
		return true
	})

	t.Run("do not add metrics that return an error when fetched", func(t *testing.T) {
		const badMetricName = "stats.test_external_metric_error.count"

		uss.RegisterMetricsFunc(func(context.Context) (map[string]any, error) {
			return map[string]any{badMetricName: 1}, errors.New("some error")
		})
		uss.gatherMetrics(context.Background(), &metrics)

		extErrorMetric, ok := metrics.Load(badMetricName)
		assert.False(t, ok)
		extMetric, ok := metrics.Load(goodMetricName)
		assert.True(t, ok)

		require.Nil(t, extErrorMetric, "Invalid metric should not be added")
		assert.Equal(t, 1, extMetric)

		metricsCountAfter := 0
		metrics.Range(func(_, _ any) bool {
			metricsCountAfter++
			return true
		})

		assert.Equal(t, metricsCountAfter, metricsCountBefore, "Expected same number of metrics before and after collecting bad metric")
		errCount, ok := metrics.Load("stats.usagestats.debug.collect.error.count")
		assert.True(t, ok)
		assert.EqualValues(t, 1, errCount)
	})
}

type httpResp struct {
	req            *http.Request
	responseBuffer *bytes.Buffer
	err            error
}

func createService(t *testing.T, sqlStore db.DB, withDB bool) *UsageStats {
	t.Helper()
	if withDB {
		sqlStore = db.InitTestDB(t)
	}

	cfg := setting.NewCfg()
	service, _ := ProvideService(
		cfg,
		kvstore.ProvideService(sqlStore),
		routing.NewRouteRegister(),
		tracing.InitializeTracerForTest(),
		acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
		supportbundlestest.NewFakeBundleService(),
	)

	return service
}

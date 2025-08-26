package ticker

import (
	"bytes"
	"context"
	"fmt"
	"math/rand"
	"sync"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
)

func TestTicker(t *testing.T) {
	readChanOrFail := func(t *testing.T, c chan time.Time) time.Time {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		t.Cleanup(func() {
			cancel()
		})

		t.Helper()
		select {
		case tick := <-c:
			return tick
		case <-ctx.Done():
			require.Failf(t, fmt.Sprintf("%v", ctx.Err()), "timeout reading the channel")
		default:
			require.Failf(t, "channel is empty but it should have a tick", "")
		}
		return time.Time{}
	}
	t.Run("should align with clock", func(t *testing.T) {
		interval := 10 * time.Second
		clk := clock.NewMock()
		clk.Add(1 * time.Minute)

		require.Equal(t, clk.Now(), getStartTick(clk, interval))
		now := clk.Now()
		for i := 0; i < 100; i++ {
			delta := time.Duration(rand.Int63n(interval.Nanoseconds()))
			clk.Set(now.Add(delta))
			require.Equal(t, now, getStartTick(clk, interval))
		}
	})

	t.Run("should not drop ticks", func(t *testing.T) {
		interval := time.Duration(rand.Int63n(100)+10) * time.Second
		clk := clock.NewMock()
		clk.Add(interval) // align clock with the start tick
		ticker := New(clk, interval, NewMetrics(prometheus.NewRegistry(), "test"), &logtest.Fake{})

		ticks := rand.Intn(9) + 1
		jitter := rand.Int63n(int64(interval) - 1)

		clk.Add(time.Duration(ticks)*interval + time.Duration(jitter))

		w := sync.WaitGroup{}
		w.Add(1)
		regTicks := make([]time.Time, 0, ticks)
		go func() {
			for timestamp := range ticker.C {
				regTicks = append(regTicks, timestamp)
				if len(regTicks) == ticks {
					w.Done()
				}
			}
		}()
		w.Wait()

		require.Len(t, regTicks, ticks)

		t.Run("ticks should monotonically increase", func(t *testing.T) {
			for i := 1; i < len(regTicks); i++ {
				previous := regTicks[i-1]
				current := regTicks[i]
				require.Equal(t, interval, current.Sub(previous))
			}
		})
	})

	t.Run("should not put anything to channel until it's time", func(t *testing.T) {
		clk := clock.NewMock()
		interval := time.Duration(rand.Int63n(9)+1) * time.Second
		ticker := New(clk, interval, NewMetrics(prometheus.NewRegistry(), "test"), &logtest.Fake{})
		expectedTick := clk.Now().Add(interval)
		for {
			require.Empty(t, ticker.C)
			clk.Add(time.Duration(rand.Int31n(500)+100) * time.Millisecond)
			if clk.Now().After(expectedTick) {
				break
			}
		}

		actual := readChanOrFail(t, ticker.C)
		require.Equal(t, expectedTick, actual)
	})

	t.Run("should put the tick in the channel immediately if it is behind", func(t *testing.T) {
		clk := clock.NewMock()
		interval := time.Duration(rand.Int63n(9)+1) * time.Second
		ticker := New(clk, interval, NewMetrics(prometheus.NewRegistry(), "test"), &logtest.Fake{})

		//  We can expect the first tick to be at a consistent interval. Take a snapshot of the clock now, before we advance it.
		expectedTick := clk.Now().Add(interval)

		require.Empty(t, ticker.C)

		clk.Add(interval) // advance the clock by the interval to make the ticker tick the first time.
		clk.Add(interval) // advance the clock by the interval to make the ticker tick the second time.

		// Irregardless of wall time, the first tick should be initial clock + interval.
		actual1 := readChanOrFail(t, ticker.C)
		require.Equal(t, expectedTick, actual1)

		var actual2 time.Time
		require.Eventually(t, func() bool {
			actual2 = readChanOrFail(t, ticker.C)
			return true
		}, time.Second, 10*time.Millisecond)

		// Similarly, the second tick should be last tick + interval irregardless of wall time.
		require.Equal(t, expectedTick.Add(interval), actual2)
	})

	t.Run("should report metrics", func(t *testing.T) {
		clk := clock.NewMock()
		clk.Set(time.Now())
		interval := time.Duration(rand.Int63n(9)+1) * time.Second
		registry := prometheus.NewPedanticRegistry()
		ticker := New(clk, interval, NewMetrics(registry, "test"), &logtest.Fake{})
		expectedTick := getStartTick(clk, interval).Add(interval)

		expectedMetricFmt := `# HELP grafana_test_ticker_interval_seconds Interval at which the ticker is meant to tick.
                    # TYPE grafana_test_ticker_interval_seconds gauge
                    grafana_test_ticker_interval_seconds %v
                    # HELP grafana_test_ticker_last_consumed_tick_timestamp_seconds Timestamp of the last consumed tick in seconds.
                    # TYPE grafana_test_ticker_last_consumed_tick_timestamp_seconds gauge
                    grafana_test_ticker_last_consumed_tick_timestamp_seconds %v
                    # HELP grafana_test_ticker_next_tick_timestamp_seconds Timestamp of the next tick in seconds before it is consumed.
                    # TYPE grafana_test_ticker_next_tick_timestamp_seconds gauge
                    grafana_test_ticker_next_tick_timestamp_seconds %v
					`

		expectedMetric := fmt.Sprintf(expectedMetricFmt, interval.Seconds(), 0, float64(expectedTick.UnixNano())/1e9)

		errs := make(map[string]error, 1)
		require.Eventuallyf(t, func() bool {
			err := testutil.GatherAndCompare(registry, bytes.NewBufferString(expectedMetric), "grafana_test_ticker_last_consumed_tick_timestamp_seconds", "grafana_test_ticker_next_tick_timestamp_seconds", "grafana_test_ticker_interval_seconds")
			if err != nil {
				errs["error"] = err
			}
			return err == nil
		}, 1*time.Second, 100*time.Millisecond, "failed to wait for metrics to match expected values:\n%v", errs)

		clk.Add(interval)
		actual := readChanOrFail(t, ticker.C)

		expectedMetric = fmt.Sprintf(expectedMetricFmt, interval.Seconds(), float64(actual.UnixNano())/1e9, float64(expectedTick.Add(interval).UnixNano())/1e9)

		require.Eventuallyf(t, func() bool {
			err := testutil.GatherAndCompare(registry, bytes.NewBufferString(expectedMetric), "grafana_test_ticker_last_consumed_tick_timestamp_seconds", "grafana_test_ticker_next_tick_timestamp_seconds", "grafana_test_ticker_interval_seconds")
			if err != nil {
				errs["error"] = err
			}
			return err == nil
		}, 1*time.Second, 100*time.Millisecond, "failed to wait for metrics to match expected values:\n%v", errs)
	})

	t.Run("should stop", func(t *testing.T) {
		t.Run("when it waits for the next tick", func(t *testing.T) {
			clk := clock.NewMock()
			interval := time.Duration(rand.Int63n(9)+1) * time.Second
			ticker := New(clk, interval, NewMetrics(prometheus.NewRegistry(), "test"), &logtest.Fake{})
			clk.Add(interval)
			readChanOrFail(t, ticker.C)
			ticker.Stop()
			clk.Add(interval)
			require.Empty(t, ticker.C)
		})

		t.Run("when it waits for the tick to be consumed", func(t *testing.T) {
			clk := clock.NewMock()
			interval := time.Duration(rand.Int63n(9)+1) * time.Second
			ticker := New(clk, interval, NewMetrics(prometheus.NewRegistry(), "test"), &logtest.Fake{})
			clk.Add(interval)
			ticker.Stop()
			require.Empty(t, ticker.C)
		})

		t.Run("multiple times", func(t *testing.T) {
			clk := clock.NewMock()
			interval := time.Duration(rand.Int63n(9)+1) * time.Second
			ticker := New(clk, interval, NewMetrics(prometheus.NewRegistry(), "test"), &logtest.Fake{})
			ticker.Stop()
			ticker.Stop()
			ticker.Stop()
		})
	})
}

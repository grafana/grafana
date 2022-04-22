package alerting

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/stretchr/testify/require"
)

func TestTicker(t *testing.T) {
	readChanOrFail := func(t *testing.T, ctx context.Context, c chan time.Time) time.Time {
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
	t.Run("should not drop ticks", func(t *testing.T) {
		clk := clock.NewMock()
		intervalSec := rand.Int63n(100) + 10
		interval := time.Duration(intervalSec) * time.Second
		last := clk.Now()
		ticker := NewTicker(last, 0, clk, intervalSec)

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
		intervalSec := rand.Int63n(9) + 1
		interval := time.Duration(intervalSec) * time.Second
		last := clk.Now()
		ticker := NewTicker(last, 0, clk, intervalSec)
		expectedTick := clk.Now().Add(interval)
		for {
			require.Empty(t, ticker.C)
			clk.Add(time.Duration(rand.Int31n(500)+100) * time.Millisecond)
			if clk.Now().After(expectedTick) {
				break
			}
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		t.Cleanup(func() {
			cancel()
		})
		actual := readChanOrFail(t, ctx, ticker.C)
		require.Equal(t, expectedTick, actual)
	})

	t.Run("should put the tick in the channel immediately if it is behind", func(t *testing.T) {
		clk := clock.NewMock()
		intervalSec := rand.Int63n(9) + 1
		interval := time.Duration(intervalSec) * time.Second
		last := clk.Now()
		ticker := NewTicker(last, 0, clk, intervalSec)

		//  We can expect the first tick to be at a consistent interval. Take a snapshot of the clock now, before we advance it.
		expectedTick := clk.Now().Add(interval)

		require.Empty(t, ticker.C)

		clk.Add(interval) // advance the clock by the interval to make the ticker tick the first time.
		clk.Add(interval) // advance the clock by the interval to make the ticker tick the second time.

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		t.Cleanup(func() {
			cancel()
		})

		// Irregardless of wall time, the first tick should be initial clock + interval.
		actual1 := readChanOrFail(t, ctx, ticker.C)
		require.Equal(t, expectedTick, actual1)

		var actual2 time.Time
		require.Eventually(t, func() bool {
			actual2 = readChanOrFail(t, ctx, ticker.C)
			return true
		}, time.Second, 10*time.Millisecond)

		// Similarly, the second tick should be last tick + interval irregardless of wall time.
		require.Equal(t, expectedTick.Add(interval), actual2)
	})
}

package alerting

import (
	"math/rand"
	"sync"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/stretchr/testify/require"
)

func TestTicker(t *testing.T) {
	readChanOrFail := func(t *testing.T, c chan time.Time) time.Time {
		t.Helper()
		select {
		case tick := <-c:
			return tick
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
		actual := readChanOrFail(t, ticker.C)
		require.Equal(t, expectedTick, actual)
	})

	t.Run("should put the tick in the channel immediately if it is behind", func(t *testing.T) {
		clk := clock.NewMock()
		intervalSec := rand.Int63n(9) + 1
		interval := time.Duration(intervalSec) * time.Second
		last := clk.Now()
		ticker := NewTicker(last, 0, clk, intervalSec)
		expectedTick := clk.Now().Add(interval)
		require.Empty(t, ticker.C)
		jitter := time.Duration(rand.Int63n(interval.Milliseconds()-1)) * time.Millisecond
		clk.Add(interval)          // make it put the first tick
		clk.Add(interval + jitter) // make it put the second tick

		actual1 := readChanOrFail(t, ticker.C)
		var actual2 time.Time
		require.Eventually(t, func() bool {
			actual2 = readChanOrFail(t, ticker.C)
			return true
		}, time.Second, 10*time.Millisecond)
		require.Equal(t, expectedTick, actual1)
		require.Equal(t, expectedTick.Add(interval), actual2)
	})
}

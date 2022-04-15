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
			for {
				select {
				case timestamp := <-ticker.C:
					regTicks = append(regTicks, timestamp)
					if len(regTicks) == ticks {
						w.Done()
					}
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

}

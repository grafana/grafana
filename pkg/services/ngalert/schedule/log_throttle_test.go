package schedule

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
)

func TestLogThrottle(t *testing.T) {
	var th logThrottle
	start := time.Unix(1_700_000_000, 0)

	_, ok := th.allow(start)
	require.True(t, ok, "the first call logs")

	for i := 1; i <= 3; i++ {
		_, ok = th.allow(start.Add(time.Duration(i) * time.Minute))
		require.False(t, ok)
	}

	suppressed, ok := th.allow(start.Add(staleLogInterval))
	require.True(t, ok, "logs again once the interval has passed")
	require.Equal(t, 3, suppressed)

	suppressed, ok = th.allow(start.Add(staleLogInterval + time.Second))
	require.False(t, ok)
	require.Zero(t, suppressed)
}

func TestRecordingRuleStaleMarkerFailureLog(t *testing.T) {
	h := newStaleHarness(t)
	h.ev.resp = seriesResponse(map[string]string{"instance": "a"}, map[string]string{"instance": "b"})
	h.tick()
	h.rule.cfg.StaleMarkerMaxAge = time.Hour
	h.failStale = true
	h.staleErr = foreignError{"temporarily unavailable"}

	logger := &logtest.Fake{}
	write := func(minutes int) {
		h.rule.writeStale(context.Background(), h.now.Add(time.Duration(minutes)*time.Minute), nil, logger)
	}

	for minute := 1; minute <= 5; minute++ {
		write(minute)
	}
	require.Equal(t, 1, logger.WarnLogs.Calls, "five failing ticks inside the interval log once")

	write(6)
	require.Equal(t, 2, logger.WarnLogs.Calls, "a tick after the interval logs again")
	require.Contains(t, logger.WarnLogs.Ctx, "suppressed")
	require.Contains(t, logger.WarnLogs.Ctx, 4, "and says how many lines it held back")
	require.Equal(t, 6, h.staleAttempts, "the writes themselves are not throttled")
}

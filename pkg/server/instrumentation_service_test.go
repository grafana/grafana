package server

import (
	"context"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRunInstrumentationService(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.HTTPPort = "3001"
	ms := ModuleServer{
		log:          log.New("test-logger"),
		cfg:          cfg,
		promGatherer: prometheus.DefaultGatherer,
	}
	s, err := ms.initInstrumentationServer()
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Second)
	defer cancel()

	err = services.StartAndAwaitRunning(ctx, s)
	require.NoError(t, err)

	testCounter := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "test_counter",
	})
	err = prometheus.Register(testCounter)
	require.NoError(t, err)

	testCounter.Inc()

	time.Sleep(100 * time.Millisecond)

	client := http.Client{}
	res, err := client.Get("http://localhost:3001/metrics")
	require.NoError(t, err)
	assert.Equal(t, 200, res.StatusCode)

	b, err := io.ReadAll(res.Body)
	require.NoError(t, err)
	resp := string(b[len(b)-16:])
	assert.Equal(t, "\ntest_counter 1\n", resp)

	err = res.Body.Close()
	require.NoError(t, err)

	err = services.StopAndAwaitTerminated(ctx, s)
	require.NoError(t, err)
}

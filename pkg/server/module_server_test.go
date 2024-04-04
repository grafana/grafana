package server

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestWillRunInstrumentationServerWhenTargetHasNoHttpServer(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Target = []string{modules.StorageServer}
	ms, err := InitializeModuleServer(cfg, Options{}, api.ServerOptions{})
	require.NoError(t, err)

	go func() {
		_ = ms.Run()
	}()
	time.Sleep(500 * time.Millisecond) // wait for http server to be running

	client := http.Client{}
	res, err := client.Get("http://localhost:3000/metrics")
	require.NoError(t, err)
	err = res.Body.Close()
	require.NoError(t, err)
	assert.Equal(t, 200, res.StatusCode)

	err = ms.Shutdown(context.Background(), "test over")
	require.NoError(t, err)
}

package server

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWillCreateMetricServerWhenOnlyStorageServerTarget(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Target = []string{modules.StorageServer}
	logger := log.New()
	svc, err := ProvideService(cfg, featuremgmt.WithFeatures(), logger)
	require.NoError(t, err)

	srv := svc.initInstrumentation(context.Background())
	defer func() {
		if err := srv.Shutdown(context.Background()); err != nil {
			t.Errorf("Error shutting down server: %v", err)
		}
	}()
	time.Sleep(500 * time.Millisecond) // wait for http server to be running

	client := http.Client{}
	res, err := client.Get("http://localhost:8000/metrics")
	require.NoError(t, err)
	assert.Equal(t, 200, res.StatusCode)
}

func TestWillNotCreateMetricServerWhenTargetIsAll(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Target = []string{modules.All}
	logger := log.New()
	svc, err := ProvideService(cfg, featuremgmt.WithFeatures(), logger)
	require.NoError(t, err)

	srv := svc.initInstrumentation(context.Background())
	assert.Nil(t, srv)
}

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

	err = svc.initInstrumentation(context.Background())
	require.NoError(t, err)

	time.Sleep(5 * time.Second)

	client := http.Client{}
	res, err := client.Get("http://127.0.0.1:8000/metrics")
	require.NoError(t, err)
	assert.Equal(t, 200, res.StatusCode)
}

func TestWillNotCreateMetricServerWhenTargetIsAll(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Target = []string{modules.All}
	logger := log.New()
	svc, err := ProvideService(cfg, featuremgmt.WithFeatures(), logger)
	require.NoError(t, err)

	err = svc.initInstrumentation(context.Background())
	require.NoError(t, err)

	client := http.Client{}
	_, err = client.Get("http://localhost:8000/metrics")
	require.ErrorContainsf(t, err, "connection refused", err.Error())
}

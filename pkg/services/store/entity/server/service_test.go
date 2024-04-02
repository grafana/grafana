package server

import (
	"context"
	"net/http"
	"testing"

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

	client := http.Client{}
	res, err := client.Get("http://localhost:8000/metrics")
	require.NoError(t, err)
	assert.Equal(t, 200, res.Status)
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

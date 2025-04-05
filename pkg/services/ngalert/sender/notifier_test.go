package sender

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/go-kit/log"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/config"
	"github.com/stretchr/testify/require"
)

func TestManager_sendAll_CancelledContext(t *testing.T) {
	// Create a context and cancel it immediately
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	reg := prometheus.NewRegistry()
	metrics := newAlertMetrics(reg, 100, func() float64 { return 0 }, func() float64 { return 0 })

	manager := &Manager{
		queue:   make([]*Alert, 0, 100),
		metrics: metrics,
		ctx:     ctx,
		logger:  log.NewNopLogger(),
		opts: &Options{
			Do: func(ctx context.Context, client *http.Client, req *http.Request) (*http.Response, error) {
				return nil, ctx.Err()
			},
		},
		alertmanagers: map[string]*alertmanagerSet{
			"test": {
				client: &http.Client{},
				cfg: &config.AlertmanagerConfig{
					APIVersion: config.AlertmanagerAPIVersionV2,
					Timeout:    model.Duration(time.Second),
				},
				metrics: metrics,
				logger:  log.NewNopLogger(),
				ams: []alertmanager{
					alertmanagerLabels{},
				},
			},
		},
	}

	err := manager.sendAll(&Alert{})
	require.Nil(t, err)
}

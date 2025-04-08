package sender

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"github.com/prometheus/common/promslog"
	"github.com/prometheus/prometheus/config"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/stretchr/testify/require"
)

func TestSendAllWithCancelledContext(t *testing.T) {
	reg := prometheus.NewRegistry()
	queueCap := 100
	metrics := newAlertMetrics(
		reg,
		queueCap,
		func() float64 { return 0 },
		func() float64 { return 0 },
	)

	builder := labels.NewBuilder(labels.EmptyLabels())
	lbls := map[string]string{
		model.SchemeLabel:  "http",
		model.AddressLabel: "alertmanager:9093",
		pathLabel:          "/api/v2/alerts",
	}
	for k, v := range lbls {
		builder.Set(k, v)
	}
	labels := builder.Labels()

	manager := &Manager{
		queue:   make([]*Alert, 0, queueCap),
		metrics: metrics,
		logger:  promslog.NewNopLogger(),
		opts: &Options{
			Do: func(ctx context.Context, client *http.Client, req *http.Request) (*http.Response, error) {
				return nil, context.Canceled
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
				logger:  promslog.NewNopLogger(),
				ams:     []alertmanager{alertmanagerLabels{Labels: labels}},
			},
		},
	}

	result := manager.sendAll(&Alert{})

	// sendAll should return true even when all alertmanagers fail because of the cancelled context
	require.True(t, result)
}

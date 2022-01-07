package featuremgmt

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	featureToggleInfo = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "feature_toggles_info",
		Help:      "info metric that exposes what feature toggles are enabled or not",
		Namespace: "grafana",
	}, []string{"name"})
)

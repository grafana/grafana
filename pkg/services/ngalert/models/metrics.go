package models

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// invalidExpressionModelSaves counts alert rule save attempts whose expression
// model failed a parse-only validation. Increments are advisory only: the save
// still proceeds. Labels allow slicing by expression command type (e.g.
// "classic_conditions") and a short reason (e.g. "unmarshal"). Used to measure
// prevalence of malformed expression data flowing through provisioning, file,
// and legacy-migration write paths.
var invalidExpressionModelSaves = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Namespace: "grafana",
		Subsystem: "alerting",
		Name:      "invalid_expression_model_saves_total",
		Help:      "Number of alert rule save attempts whose expression model failed parse validation. Advisory only; saves still proceed.",
	},
	[]string{"expression_type", "reason"},
)

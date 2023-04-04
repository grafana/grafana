package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana/pkg/util/ticker"
)

const (
	AlertRuleActiveLabelValue = "active"
	AlertRulePausedLabelValue = "paused"
)

type Scheduler struct {
	Registerer                          prometheus.Registerer
	BehindSeconds                       prometheus.Gauge
	EvalTotal                           *prometheus.CounterVec
	EvalFailures                        *prometheus.CounterVec
	EvalDuration                        *prometheus.HistogramVec
	GroupRules                          *prometheus.GaugeVec
	SchedulePeriodicDuration            prometheus.Histogram
	SchedulableAlertRules               prometheus.Gauge
	SchedulableAlertRulesHash           prometheus.Gauge
	UpdateSchedulableAlertRulesDuration prometheus.Histogram
	Ticker                              *ticker.Metrics
	EvaluationMissed                    *prometheus.CounterVec
}

func NewSchedulerMetrics(r prometheus.Registerer) *Scheduler {
	return &Scheduler{
		Registerer: r,
		BehindSeconds: promauto.With(r).NewGauge(prometheus.GaugeOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "scheduler_behind_seconds",
			Help:      "The total number of seconds the scheduler is behind.",
		}),
		// TODO: once rule groups support multiple rules, consider partitioning
		// on rule group as well as tenant, similar to loki|cortex.
		EvalTotal: promauto.With(r).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "rule_evaluations_total",
				Help:      "The total number of rule evaluations.",
			},
			[]string{"org"},
		),
		// TODO: once rule groups support multiple rules, consider partitioning
		// on rule group as well as tenant, similar to loki|cortex.
		EvalFailures: promauto.With(r).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "rule_evaluation_failures_total",
				Help:      "The total number of rule evaluation failures.",
			},
			[]string{"org"},
		),
		EvalDuration: promauto.With(r).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "rule_evaluation_duration_seconds",
				Help:      "The duration for a rule to execute.",
				Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
			},
			[]string{"org"},
		),
		// TODO: partition on rule group as well as tenant, similar to loki|cortex.
		GroupRules: promauto.With(r).NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "rule_group_rules",
				Help:      "The number of alert rules that are scheduled, both active and paused.",
			},
			[]string{"org", "state"},
		),
		SchedulePeriodicDuration: promauto.With(r).NewHistogram(
			prometheus.HistogramOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "schedule_periodic_duration_seconds",
				Help:      "The time taken to run the scheduler.",
				Buckets:   []float64{0.1, 0.25, 0.5, 1, 2, 5, 10},
			},
		),
		SchedulableAlertRules: promauto.With(r).NewGauge(
			prometheus.GaugeOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "schedule_alert_rules",
				Help:      "The number of alert rules that could be considered for evaluation at the next tick.",
			},
		),
		SchedulableAlertRulesHash: promauto.With(r).NewGauge(
			prometheus.GaugeOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "schedule_alert_rules_hash",
				Help:      "A hash of the alert rules that could be considered for evaluation at the next tick.",
			}),
		UpdateSchedulableAlertRulesDuration: promauto.With(r).NewHistogram(
			prometheus.HistogramOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "schedule_query_alert_rules_duration_seconds",
				Help:      "The time taken to fetch alert rules from the database.",
				Buckets:   []float64{0.1, 0.25, 0.5, 1, 2, 5, 10},
			},
		),
		Ticker: ticker.NewMetrics(r, "alerting"),
		EvaluationMissed: promauto.With(r).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "schedule_rule_evaluations_missed_total",
				Help:      "The total number of rule evaluations missed due to a slow rule evaluation.",
			},
			[]string{"org", "name"},
		),
	}
}

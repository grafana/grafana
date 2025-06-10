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
	EvalAttemptTotal                    *prometheus.CounterVec
	EvalAttemptFailures                 *prometheus.CounterVec
	ProcessDuration                     *prometheus.HistogramVec
	SendDuration                        *prometheus.HistogramVec
	SimpleNotificationRules             *prometheus.GaugeVec
	GroupRules                          *prometheus.GaugeVec
	Groups                              *prometheus.GaugeVec
	SchedulePeriodicDuration            prometheus.Histogram
	SchedulableAlertRules               prometheus.Gauge
	SchedulableAlertRulesHash           prometheus.Gauge
	UpdateSchedulableAlertRulesDuration prometheus.Histogram
	Ticker                              *ticker.Metrics
	EvaluationMissed                    *prometheus.CounterVec
	SimplifiedEditorRules               *prometheus.GaugeVec
	PrometheusImportedRules             *prometheus.GaugeVec
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
				Help:      "The time to evaluate a rule.",
				Buckets:   []float64{.01, .1, .5, 1, 5, 10, 15, 30, 60, 120, 180, 240, 300},
			},
			[]string{"org"},
		),
		EvalAttemptTotal: promauto.With(r).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "rule_evaluation_attempts_total",
				Help:      "The total number of rule evaluation attempts.",
			},
			[]string{"org"},
		),
		EvalAttemptFailures: promauto.With(r).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "rule_evaluation_attempt_failures_total",
				Help:      "The total number of rule evaluation attempt failures.",
			},
			[]string{"org"},
		),
		ProcessDuration: promauto.With(r).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "rule_process_evaluation_duration_seconds",
				Help:      "The time to process the evaluation results for a rule.",
				Buckets:   []float64{.01, .1, .5, 1, 5, 10, 15, 30, 60, 120, 180, 240, 300},
			},
			[]string{"org"},
		),
		SendDuration: promauto.With(r).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "rule_send_alerts_duration_seconds",
				Help:      "The time to send the alerts to Alertmanager.",
				Buckets:   []float64{.01, .1, .5, 1, 5, 10, 15, 30, 60, 120, 180, 240, 300},
			},
			[]string{"org"},
		),
		SimpleNotificationRules: promauto.With(r).NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "simple_routing_rules",
				Help:      "The number of alert rules using simplified routing.",
			},
			[]string{"org"},
		),
		GroupRules: promauto.With(r).NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "rule_group_rules",
				Help:      "The number of alert rules that are scheduled, by type and state.",
			},
			[]string{"org", "type", "state", "rule_group"},
		),
		Groups: promauto.With(r).NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "rule_groups",
				Help:      "The number of alert rule groups",
			},
			[]string{"org"},
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
		SimplifiedEditorRules: promauto.With(r).NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "simplified_editor_rules",
				Help:      "The number of alert rules using simplified editor settings.",
			},
			[]string{"org", "setting"},
		),
		PrometheusImportedRules: promauto.With(r).NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "prometheus_imported_rules",
				Help:      "The number of rules imported from a Prometheus-compatible source.",
			},
			[]string{"org", "state"},
		),
	}
}

package teamlbac

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/services/datasources"
)

type forSubjectMetrics struct {
	requestsTotal   *prometheus.CounterVec
	durationSeconds *prometheus.HistogramVec
	missingTeams    prometheus.Counter
}

type forSubjectOutcome string

const (
	forSubjectOutcomeError               forSubjectOutcome = "error"
	forSubjectOutcomeRejected            forSubjectOutcome = "rejected"
	forSubjectOutcomeNoRules             forSubjectOutcome = "no_rules"
	forSubjectOutcomeEmptyRule           forSubjectOutcome = "empty_rule"
	forSubjectOutcomeNoTeamMembership    forSubjectOutcome = "no_team_membership"
	forSubjectOutcomeNoApplicableFilters forSubjectOutcome = "no_applicable_filters"
	forSubjectOutcomeFiltersReturned     forSubjectOutcome = "filters_returned"
)

type forSubjectErrorClass string

const (
	forSubjectErrorNone          forSubjectErrorClass = "none"
	forSubjectErrorInternal      forSubjectErrorClass = "internal"
	forSubjectErrorBadRequest    forSubjectErrorClass = "bad_request"
	forSubjectErrorCanceled      forSubjectErrorClass = "canceled"
	forSubjectErrorTimeout       forSubjectErrorClass = "timeout"
	forSubjectErrorUnavailable   forSubjectErrorClass = "unavailable"
	forSubjectErrorAuthorization forSubjectErrorClass = "authorization"
)

func newForSubjectMetrics(reg prometheus.Registerer) *forSubjectMetrics {
	if reg == nil {
		return nil
	}
	m := &forSubjectMetrics{
		requestsTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "team_lbac_for_subject",
			Name:      "requests_total",
			Help:      "IAM Team LBAC for-subject requests by evaluation outcome, error class, and datasource type",
		}, []string{"outcome", "error_class", "datasource_type"}),
		durationSeconds: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: "grafana",
			Subsystem: "team_lbac_for_subject",
			Name:      "duration_seconds",
			Help:      "IAM Team LBAC for-subject request duration in seconds",
			Buckets:   prometheus.DefBuckets,
		}, []string{"outcome", "error_class", "datasource_type"}),
		missingTeams: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "team_lbac_for_subject",
			Name:      "missing_teams_total",
			Help:      "Team LBAC rule references to missing teams during for-subject evaluation",
		}),
	}
	reg.MustRegister(m.requestsTotal, m.durationSeconds, m.missingTeams)
	return m
}

func (m *forSubjectMetrics) observe(outcome forSubjectOutcome, errorClass forSubjectErrorClass, datasourceName string, start time.Time) {
	if m == nil {
		return
	}
	datasourceType := forSubjectDatasourceType(datasourceName)
	m.requestsTotal.WithLabelValues(string(outcome), string(errorClass), datasourceType).Inc()
	m.durationSeconds.WithLabelValues(string(outcome), string(errorClass), datasourceType).Observe(time.Since(start).Seconds())
}

func forSubjectDatasourceType(name string) string {
	datasourceType, _, _ := strings.Cut(name, ".")
	switch datasourceType {
	case datasources.DS_PROMETHEUS, datasources.DS_LOKI, datasources.DS_TEMPO:
		return datasourceType
	default:
		return "other"
	}
}

func (m *forSubjectMetrics) incMissingTeam() {
	if m != nil {
		m.missingTeams.Inc()
	}
}

func classifyForSubjectError(err error) forSubjectErrorClass {
	switch {
	case errors.Is(err, context.Canceled):
		return forSubjectErrorCanceled
	case errors.Is(err, context.DeadlineExceeded), apierrors.IsTimeout(err), apierrors.IsServerTimeout(err):
		return forSubjectErrorTimeout
	case apierrors.IsServiceUnavailable(err):
		return forSubjectErrorUnavailable
	case apierrors.IsBadRequest(err):
		return forSubjectErrorBadRequest
	case apierrors.IsForbidden(err), apierrors.IsUnauthorized(err):
		return forSubjectErrorAuthorization
	default:
		return forSubjectErrorInternal
	}
}

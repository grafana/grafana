package teamlbac

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type forSubjectMetrics struct {
	requestsTotal                 *prometheus.CounterVec
	durationSeconds               *prometheus.HistogramVec
	teamEvaluationDurationSeconds *prometheus.HistogramVec
	missingTeams                  prometheus.Counter
	listedTeamsWithoutLegacyID    prometheus.Counter
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
		// Most requests have no stored rules and never evaluate Teams. Mixing
		// those fast requests into the same quantile hid slow membership checks,
		// including checks that eventually returned no rules for the user.
		teamEvaluationDurationSeconds: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:    "grafana_team_lbac_for_subject_team_evaluation_duration_seconds",
			Help:    "Time spent listing Teams and selecting subject rules for non-empty policies, including evaluations returning no applicable rules or errors",
			Buckets: prometheus.DefBuckets,
		}, []string{"datasource_type"}),
		missingTeams: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "team_lbac_for_subject",
			Name:      "missing_teams_total",
			Help:      "Team LBAC rule references to missing teams during for-subject evaluation",
		}),
		// Numeric LBAC keys depend on the original Team IDs. Losing an ID can
		// make required rules look like references to a deleted Team and omit
		// them from the result. This detects missing/invalid IDs, not replacement
		// of an original ID with a different positive ID.
		listedTeamsWithoutLegacyID: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "grafana_team_lbac_for_subject_listed_teams_without_legacy_id_total",
			Help: "Listed Team observations without a valid positive legacy numeric ID during for-subject evaluation; repeated evaluations count the same Team again",
		}),
	}
	reg.MustRegister(m.requestsTotal, m.durationSeconds, m.missingTeams)
	return m
}

func (m *forSubjectMetrics) observeTeamEvaluation(datasourceName string, start time.Time) {
	if m != nil {
		m.teamEvaluationDurationSeconds.WithLabelValues(forSubjectDatasourceType(datasourceName)).Observe(time.Since(start).Seconds())
	}
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

func (m *forSubjectMetrics) countMissingTeams(count int) {
	if m != nil {
		m.missingTeams.Add(float64(count))
	}
}

func (m *forSubjectMetrics) countTeamsWithoutLegacyIDs(teams []iamv0.Team) {
	if m == nil {
		return
	}
	count := 0
	for i := range teams {
		id, err := strconv.ParseInt(teams[i].Labels[apiutils.LabelKeyDeprecatedInternalID], 10, 64) //nolint:staticcheck // observe missing legacy IDs used by numeric rules
		if err != nil || id <= 0 {
			count++
		}
	}
	m.listedTeamsWithoutLegacyID.Add(float64(count))
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

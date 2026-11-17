package acimpl

import (
	"context"
	"errors"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/shadow"
)

const legacyCheckShadowMaxConcurrent = 32

type legacyCheckShadow struct {
	runner   *shadow.Runner
	logger   log.Logger
	duration *prometheus.HistogramVec
	results  *prometheus.CounterVec
	skipped  *prometheus.CounterVec
}

func newLegacyCheckShadow(reg prometheus.Registerer) (*legacyCheckShadow, error) {
	runner, err := shadow.NewRunner(legacyCheckShadowMaxConcurrent, 10*time.Second)
	if err != nil {
		return nil, err
	}

	factory := promauto.With(reg)
	return &legacyCheckShadow{
		runner: runner,
		logger: log.New("accesscontrol.legacy-check-shadow"),
		duration: factory.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "grafana_accesscontrol_legacy_check_shadow_duration_seconds",
			Help:    "Execution time of local and LegacyCheck evaluations during shadow comparisons.",
			Buckets: prometheus.ExponentialBuckets(0.00001, 4, 10),
		}, []string{"implementation"}),
		results: factory.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_accesscontrol_legacy_check_shadow_comparisons_total",
			Help: "LegacyCheck shadow comparisons by result: match, mismatch or error.",
		}, []string{"result"}),
		skipped: factory.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_accesscontrol_legacy_check_shadow_skipped_total",
			Help: "LegacyCheck comparisons skipped because of an active transaction or the concurrency limit.",
		}, []string{"reason"}),
	}, nil
}

func (s *legacyCheckShadow) evaluate(ctx context.Context, ac *AccessControl, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	if s == nil {
		return ac.evaluateLocal(ctx, user, evaluator)
	}

	var allowed bool
	var err error
	s.runner.Run(
		ctx,
		s,
		func() {
			allowed, err = ac.evaluateLocal(ctx, user, evaluator)
		},
		func() shadow.Work {
			req, shadowErr := ac.buildLegacyCheckRequest(user, evaluator, ac.useExternalGroups, ac.legacyNamespace)
			var call func(context.Context) (bool, error)
			if shadowErr == nil {
				if ac.legacyCheckClient == nil {
					shadowErr = errors.New("legacy check client is not configured")
				} else {
					call, shadowErr = ac.legacyCheckClient.PrepareLegacyCheck(req)
				}
			}

			var expected, actual bool
			var primaryErr error

			return shadow.Work{
				Snapshot: func() {
					expected, primaryErr = allowed, err
				},
				Call: func(ctx context.Context) {
					if shadowErr == nil {
						actual, shadowErr = call(ctx)
					}
				},
				Compare: func(ctx context.Context) shadow.Outcome {
					if primaryErr != nil || shadowErr != nil {
						s.logger.FromContext(ctx).Warn("LegacyCheck shadow comparison failed", "namespace", req.Namespace, "subject", req.Subject, "currentError", primaryErr, "shadowError", shadowErr)
						return shadow.Failed
					}
					if expected != actual {
						s.logger.FromContext(ctx).Warn("LegacyCheck shadow results differ", "namespace", req.Namespace, "subject", req.Subject, "currentAllowed", expected, "shadowAllowed", actual)
						return shadow.Mismatch
					}
					return shadow.Match
				},
			}
		},
		shadow.WithSkip(skipPermissionShadowForSQLSession),
	)
	return allowed, err
}

func (s *legacyCheckShadow) ObserveDuration(implementation shadow.Implementation, elapsed time.Duration) {
	s.duration.WithLabelValues(string(implementation)).Observe(elapsed.Seconds())
}

func (s *legacyCheckShadow) ObserveOutcome(outcome shadow.Outcome) {
	s.results.WithLabelValues(string(outcome)).Inc()
}

func (s *legacyCheckShadow) ObserveSkip(reason shadow.SkipReason) {
	s.skipped.WithLabelValues(string(reason)).Inc()
}

func (s *legacyCheckShadow) ObserveError(ctx context.Context, err error) {
	s.logger.FromContext(ctx).Warn("LegacyCheck shadow work failed", "error", err)
}

func (s *legacyCheckShadow) ObservePanic(ctx context.Context, recovered any) {
	s.logger.FromContext(ctx).Warn("LegacyCheck shadow call panicked", "panic", recovered)
}

package acimpl

import (
	"context"
	"slices"
	"time"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/shadow"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func LegacyUserPermissionsShadowEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagAuthzLegacyUserPermissionsShadow, false, openfeature.TransactionContext(ctx))
}

// LegacyUserPermissionsShadow compares local permissions without changing the authoritative result.
type LegacyUserPermissionsShadow struct {
	runner   *shadow.Runner
	duration *prometheus.HistogramVec
	results  *prometheus.CounterVec
	skipped  prometheus.Counter
	logger   log.Logger
}

func NewLegacyUserPermissionsShadow(reg prometheus.Registerer, maxConcurrent int) (*LegacyUserPermissionsShadow, error) {
	if maxConcurrent < 1 {
		maxConcurrent = setting.DefaultLegacyUserPermissionsShadowMaxConcurrent
	}

	runner, err := shadow.NewRunner(maxConcurrent, 10*time.Second)
	if err != nil {
		return nil, err
	}
	factory := promauto.With(reg)

	return &LegacyUserPermissionsShadow{
		runner: runner,
		logger: log.New("accesscontrol.legacy-shadow"),
		duration: factory.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "grafana_accesscontrol_user_permissions_duration_milliseconds",
			Help:    "Execution time of permission loaders during shadow comparisons, in milliseconds.",
			Buckets: prometheus.ExponentialBuckets(0.1, 2, 18),
		}, []string{"implementation"}),
		results: factory.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_accesscontrol_user_permissions_shadow_comparisons_total",
			Help: "Permission shadow comparisons. Errors include loader failures and permission differences.",
		}, []string{"result"}),
		skipped: factory.NewCounter(prometheus.CounterOpts{
			Name: "grafana_accesscontrol_user_permissions_shadow_skipped_total",
			Help: "Permission shadow calls skipped because of an active SQL session or the concurrency limit.",
		}),
	}, nil
}

func (s *LegacyUserPermissionsShadow) GetUserPermissions(ctx context.Context, client legacyclient.Service, usr identity.Requester, options ac.Options, cfg *setting.Cfg, primary func() ([]ac.Permission, error)) ([]ac.Permission, error) {
	if s == nil {
		return primary()
	}

	var result userPermissionsResult
	s.runner.Run(ctx, s, func() {
		result.permissions, result.err = primary()
	}, func() shadow.Work {
		return s.prepareShadowWork(client, usr, options, cfg, &result)
	}, shadow.WithSkip(skipPermissionShadowForSQLSession))

	return result.permissions, result.err
}

func skipPermissionShadowForSQLSession(ctx context.Context) shadow.SkipReason {
	// A detached read cannot compare the caller's uncommitted transaction state.
	if session, ok := ctx.Value(sqlstore.ContextSessionKey{}).(*sqlstore.DBSession); ok && session != nil {
		return shadow.Transaction
	}

	return ""
}

type userPermissionsResult struct {
	permissions []ac.Permission
	err         error
}

func (s *LegacyUserPermissionsShadow) prepareShadowWork(client legacyclient.Service, usr identity.Requester, options ac.Options, cfg *setting.Cfg, primary *userPermissionsResult) shadow.Work {
	req, shadowErr := legacyUserPermissionsRequest(usr, options, cfg)
	var expected, actual []ac.Permission
	var primaryErr error
	return shadow.Work{
		Snapshot: func() {
			expected = slices.Clone(primary.permissions)
			primaryErr = primary.err
		},
		Call: func(ctx context.Context) {
			if shadowErr == nil {
				actual, shadowErr = loadLegacyUserPermissions(legacypermissions.WithPermissionShadow(ctx), client, req)
			}
		},
		Compare: func(ctx context.Context) shadow.Outcome {
			if primaryErr != nil || shadowErr != nil {
				s.logger.FromContext(ctx).Warn("Permission shadow comparison failed", "namespace", req.Namespace, "currentError", primaryErr, "shadowError", shadowErr)
				return shadow.Failed
			}
			missing, gained := permissionSetDifference(expected, actual)
			if len(missing) != 0 || len(gained) != 0 {
				s.logger.FromContext(ctx).Warn("Permission shadow results differ", "namespace", req.Namespace, "subject", req.Identity.UID, "missing", missing, "gained", gained)
				return shadow.Mismatch
			}
			return shadow.Match
		},
	}
}

func (s *LegacyUserPermissionsShadow) ObserveDuration(implementation shadow.Implementation, elapsed time.Duration) {
	label := "current"
	if implementation == shadow.Shadow {
		label = "legacy"
	}
	s.duration.WithLabelValues(label).Observe(float64(elapsed) / float64(time.Millisecond))
}

func (s *LegacyUserPermissionsShadow) ObserveOutcome(outcome shadow.Outcome) {
	label := "error"
	if outcome == shadow.Match {
		label = "ok"
	}
	s.results.WithLabelValues(label).Inc()
}

func (s *LegacyUserPermissionsShadow) ObserveSkip(shadow.SkipReason) {
	s.skipped.Inc()
}

func (s *LegacyUserPermissionsShadow) ObserveError(ctx context.Context, err error) {
	s.logger.FromContext(ctx).Warn("Permission shadow work failed", "error", err)
}

func (s *LegacyUserPermissionsShadow) ObservePanic(ctx context.Context, recovered any) {
	s.logger.FromContext(ctx).Warn("Permission shadow call panicked", "panic", recovered)
}

type permissionKey struct {
	Action string `json:"action"`
	Scope  string `json:"scope"`
}

func permissionSetDifference(expected, actual []ac.Permission) (missing, gained []permissionKey) {
	oldSet := make(map[permissionKey]struct{}, len(expected))
	newSet := make(map[permissionKey]struct{}, len(actual))
	for _, p := range expected {
		oldSet[permissionKey{p.Action, p.Scope}] = struct{}{}
	}
	for _, p := range actual {
		newSet[permissionKey{p.Action, p.Scope}] = struct{}{}
	}
	for p := range oldSet {
		if _, ok := newSet[p]; !ok {
			missing = append(missing, p)
		}
	}
	for p := range newSet {
		if _, ok := oldSet[p]; !ok {
			gained = append(gained, p)
		}
	}
	return missing, gained
}

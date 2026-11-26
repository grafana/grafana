package acimpl

import (
	"context"
	"maps"
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
	"github.com/grafana/grafana/pkg/services/authz/zanzana/legacyscopes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// LegacyUserPermissionsSearchShadow routes Search and observes admitted comparisons.
type LegacyUserPermissionsSearchShadow struct {
	runner   *shadow.Runner
	duration *prometheus.HistogramVec
	results  *prometheus.CounterVec
	skipped  *prometheus.CounterVec
	logger   log.Logger
}

func NewLegacyUserPermissionsSearchShadow(reg prometheus.Registerer) (*LegacyUserPermissionsSearchShadow, error) {
	// A bulk search pages through IAM and can run up to 16 concurrent per-user
	// Zanzana lookups. Admit only one extra search per Grafana process.
	runner, err := shadow.NewRunner(1, 10*time.Second)
	if err != nil {
		return nil, err
	}
	factory := promauto.With(reg)
	return &LegacyUserPermissionsSearchShadow{
		runner: runner,
		logger: log.New("accesscontrol.search-shadow"),
		duration: factory.NewHistogramVec(prometheus.HistogramOpts{
			Name: "grafana_accesscontrol_user_permissions_search_duration_seconds",
			Help: "Execution time of permission search implementations during shadow comparisons.",
		}, []string{"implementation"}),
		results: factory.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_accesscontrol_user_permissions_search_shadow_comparisons_total",
			Help: "Permission search shadow comparisons by outcome.",
		}, []string{"result"}),
		skipped: factory.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_accesscontrol_user_permissions_search_shadow_skipped_total",
			Help: "Permission searches skipped by the shadow runner.",
		}, []string{"reason"}),
	}, nil
}

// Search routes the operation for OSS and licensed Enterprise. Unlicensed
// Enterprise reaches it through the OSS fallback.
func (s *LegacyUserPermissionsSearchShadow) Search(ctx context.Context, client legacyclient.LegacyUserPermissionsClient, usr identity.Requester, options ac.SearchOptions, cfg *setting.Cfg, primary func() (map[int64][]ac.Permission, error)) (map[int64][]ac.Permission, error) {
	return s.search(ctx, client, usr, options, cfg, primary, nil, nil)
}

func (s *LegacyUserPermissionsSearchShadow) search(ctx context.Context, client legacyclient.LegacyUserPermissionsClient, usr identity.Requester, options ac.SearchOptions, cfg *setting.Cfg, primary func() (map[int64][]ac.Permission, error), fallbackScope *string, resolver legacyscopes.ScopeResolver) (map[int64][]ac.Permission, error) {
	finish := func(permissions map[int64][]ac.Permission, err error) (map[int64][]ac.Permission, error) {
		if fallbackScope == nil {
			return permissions, err
		}
		if err != nil {
			return nil, err
		}
		return legacyscopes.ResolveSearchScopes(ctx, usr, *fallbackScope, resolver, permissions)
	}
	if shadow.IsShadow(ctx) || !LegacyUserPermissionsSearchEnabled(ctx) {
		return finish(primary())
	}
	// Carry the immutable evaluation context value without keeping the request context.
	eval := openfeature.TransactionContext(ctx)
	if !openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagAuthzLegacyUserPermissionsSearchShadow, false, eval) {
		return finish(GetLegacySearchUsersPermissions(ctx, client, usr, options, cfg))
	}
	if s == nil {
		return finish(primary())
	}

	var permissions map[int64][]ac.Permission
	var primaryErr error
	s.runner.Run(ctx, s, func() {
		permissions, primaryErr = finish(primary())
	}, func() shadow.Work {
		req := legacySearchUsersPermissionsRequest(ctx, usr, options, cfg)
		req.Requester.EffectivePermissions = cloneSearchGrants(req.Requester.EffectivePermissions)
		req.Requester.GlobalPermissions = cloneSearchGrants(req.Requester.GlobalPermissions)
		req.Options = ac.SearchOptions{
			Action:       options.Action,
			ActionPrefix: options.ActionPrefix,
			Scope:        options.Scope,
			UserID:       options.UserID,
			ActionSets:   slices.Clone(options.ActionSets),
			RolePrefixes: slices.Clone(options.RolePrefixes),
		}
		if resolver != nil {
			req.FallbackScope = fallbackScope
		}
		if !req.Requester.HasDirectoryContext {
			req.Requester.IAMIDToken = ""
			req.Requester.IAMAccessToken = ""
		}

		var expected, actual map[int64][]ac.Permission
		var primaryFailed, rpcFailed bool
		return shadow.Work{
			Snapshot: func() {
				primaryFailed = primaryErr != nil
				if !primaryFailed {
					expected = make(map[int64][]ac.Permission, len(permissions))
					for id, grants := range permissions {
						expected[id] = slices.Clone(grants)
					}
				}
			},
			Call: func(ctx context.Context) {
				var err error
				actual, err = loadLegacySearchUsersPermissions(openfeature.WithTransactionContext(ctx, eval), client, req)
				rpcFailed = err != nil
			},
			Compare: func(ctx context.Context) shadow.Outcome {
				if primaryFailed || rpcFailed || ctx.Err() != nil {
					s.logger.FromContext(ctx).Debug("Permission search shadow comparison failed", "primaryFailed", primaryFailed, "rpcFailed", rpcFailed, "deadlineExceeded", ctx.Err() == context.DeadlineExceeded)
					return shadow.Failed
				}
				different := countDifferentSearchUsers(ctx, expected, actual)
				if ctx.Err() != nil {
					return shadow.Failed
				}
				if different != 0 {
					s.logger.FromContext(ctx).Debug("Permission search shadow results differ", "differentUsers", different, "primaryUsers", len(expected), "shadowUsers", len(actual))
					return shadow.Mismatch
				}
				return shadow.Match
			},
		}
	}, shadow.WithSkip(skipPermissionShadowForSQLSession))
	return permissions, primaryErr
}

func cloneSearchGrants(grants map[string][]string) map[string][]string {
	cloned := maps.Clone(grants)
	for action, scopes := range cloned {
		cloned[action] = slices.Clone(scopes)
	}
	return cloned
}

func countDifferentSearchUsers(ctx context.Context, expected, actual map[int64][]ac.Permission) int {
	different := 0
	for id, permissions := range expected {
		if ctx.Err() != nil {
			return 0
		}
		other, ok := actual[id]
		if !ok || !maps.EqualFunc(ac.Reduce(permissions), ac.Reduce(other), func(left, right []string) bool {
			slices.Sort(left)
			slices.Sort(right)
			return slices.Equal(left, right)
		}) {
			different++
		}
	}
	for id := range actual {
		if _, ok := expected[id]; !ok {
			different++
		}
	}
	return different
}

func (s *LegacyUserPermissionsSearchShadow) ObserveDuration(implementation shadow.Implementation, elapsed time.Duration) {
	s.duration.WithLabelValues(string(implementation)).Observe(elapsed.Seconds())
}

func (s *LegacyUserPermissionsSearchShadow) ObserveOutcome(outcome shadow.Outcome) {
	s.results.WithLabelValues(string(outcome)).Inc()
}

func (s *LegacyUserPermissionsSearchShadow) ObserveSkip(reason shadow.SkipReason) {
	s.skipped.WithLabelValues(string(reason)).Inc()
}

func (s *LegacyUserPermissionsSearchShadow) ObserveError(ctx context.Context, _ error) {
	s.logger.FromContext(ctx).Warn("Permission search shadow work failed")
}

func (s *LegacyUserPermissionsSearchShadow) ObservePanic(ctx context.Context, _ any) {
	s.logger.FromContext(ctx).Warn("Permission search shadow work panicked")
}

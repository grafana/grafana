package acimpl

import (
	"context"
	"slices"
	"time"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
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
	inFlight chan struct{}
	duration *prometheus.HistogramVec
	results  *prometheus.CounterVec
	skipped  prometheus.Counter
	logger   log.Logger
}

func NewLegacyUserPermissionsShadow(reg prometheus.Registerer, maxConcurrent int) *LegacyUserPermissionsShadow {
	if maxConcurrent < 1 {
		maxConcurrent = setting.DefaultLegacyUserPermissionsShadowMaxConcurrent
	}
	factory := promauto.With(reg)
	return &LegacyUserPermissionsShadow{
		inFlight: make(chan struct{}, maxConcurrent),
		logger:   log.New("accesscontrol.legacy-shadow"),
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
	}
}

func (s *LegacyUserPermissionsShadow) GetUserPermissions(ctx context.Context, client legacyclient.Service, usr identity.Requester, options ac.Options, cfg *setting.Cfg, primary func() ([]ac.Permission, error)) ([]ac.Permission, error) {
	if s == nil {
		return primary()
	}
	// A detached read cannot compare the caller's uncommitted transaction state safely.
	if session, ok := ctx.Value(sqlstore.ContextSessionKey{}).(*sqlstore.DBSession); ok && session != nil {
		s.skipped.Inc()
		return primary()
	}
	select {
	case s.inFlight <- struct{}{}:
	default:
		s.skipped.Inc()
		return primary()
	}

	// Snapshot requester state before the caller can reuse or modify it.
	req, requestErr := legacyUserPermissionsRequest(usr, options, cfg)
	start := time.Now()
	permissions, err := primary()
	s.duration.WithLabelValues("current").Observe(float64(time.Since(start)) / float64(time.Millisecond))
	// The caller and permission caches can retain the returned slice.
	expected := slices.Clone(permissions)
	// Copy only trace metadata. Request context values can hold caller-owned SQL sessions.
	background := trace.ContextWithSpanContext(context.Background(), trace.SpanContextFromContext(ctx))
	background = legacypermissions.WithPermissionShadow(background)
	go func() {
		defer func() {
			<-s.inFlight
			if recovered := recover(); recovered != nil {
				s.results.WithLabelValues("error").Inc()
				s.logger.Warn("Permission shadow call panicked", "panic", recovered)
			}
		}()
		shadowCtx, cancel := context.WithTimeout(background, 10*time.Second)
		defer cancel()
		start := time.Now()
		var actual []ac.Permission
		shadowErr := requestErr
		if shadowErr == nil {
			actual, shadowErr = loadLegacyUserPermissions(shadowCtx, client, req)
		}
		s.duration.WithLabelValues("legacy").Observe(float64(time.Since(start)) / float64(time.Millisecond))
		if err != nil || shadowErr != nil {
			s.results.WithLabelValues("error").Inc()
			s.logger.FromContext(shadowCtx).Warn("Permission shadow comparison failed", "namespace", req.Namespace, "currentError", err, "shadowError", shadowErr)
			return
		}
		missing, gained := permissionSetDifference(expected, actual)
		if len(missing) != 0 || len(gained) != 0 {
			s.results.WithLabelValues("error").Inc()
			s.logger.FromContext(shadowCtx).Warn("Permission shadow results differ", "namespace", req.Namespace, "subject", req.Identity.UID, "missing", missing, "gained", gained)
			return
		}
		s.results.WithLabelValues("ok").Inc()
	}()
	return permissions, err
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
